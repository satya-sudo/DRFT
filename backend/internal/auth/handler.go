package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"drft/internal/config"
	"drft/internal/http/response"
	"github.com/lib/pq"
)

type Handler struct {
	logger *slog.Logger
	store  *Store
	tokens *TokenManager
	reset  *ResetManager
}

type sessionResponse struct {
	Token string      `json:"token"`
	User  publicUser  `json:"user"`
}

type publicUser struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Email       string      `json:"email"`
	Role        string      `json:"role"`
	Permissions Permissions `json:"permissions"`
	CreatedAt   string      `json:"createdAt"`
}

func NewHandler(cfg config.Config, logger *slog.Logger, db *sql.DB) *Handler {
	return &Handler{
		logger: logger,
		store:  NewStore(db),
		tokens: NewTokenManager(cfg.JWTSecret),
		reset:  NewResetManager(NewStore(db), NewMailer(cfg), time.Duration(cfg.PasswordResetTTL)*time.Minute),
	}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/setup/status", h.handleSetupStatus)
	mux.HandleFunc("/api/v1/setup/admin", h.handleSetupAdmin)
	mux.HandleFunc("/api/v1/auth/login", h.handleLogin)
	mux.HandleFunc("/api/v1/auth/me", h.handleCurrentUser)
	mux.HandleFunc("/api/v1/auth/password-reset/request", h.handlePasswordResetRequest)
	mux.HandleFunc("/api/v1/auth/password-reset/confirm", h.handlePasswordResetConfirm)
	mux.HandleFunc("/api/v1/admin/users", h.handleUsers)
	mux.HandleFunc("/api/v1/admin/users/", h.handleUserByID)
	mux.Handle("/api/v1/auth/signup", h.notImplemented("signup"))
}

func (h *Handler) notImplemented(name string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response.JSON(w, http.StatusNotImplemented, map[string]string{
			"error":    "not_implemented",
			"feature":  "auth",
			"endpoint": name,
			"path":     r.URL.Path,
		})
	})
}

func (h *Handler) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	adminExists, err := h.store.HasAdmin(r.Context())
	if err != nil {
		h.serverError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]bool{
		"adminExists": adminExists,
	})
}

func (h *Handler) handleSetupAdmin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := response.DecodeJSON(r, &input); err != nil {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.Email) == "" || len(input.Password) < 8 {
		response.JSON(w, http.StatusBadRequest, map[string]string{
			"error": "name, email, and a password of at least 8 characters are required",
		})
		return
	}

	adminExists, err := h.store.HasAdmin(r.Context())
	if err != nil {
		h.serverError(w, err)
		return
	}
	if adminExists {
		response.JSON(w, http.StatusConflict, map[string]string{"error": "an admin already exists"})
		return
	}

	user, err := h.createUser(r.Context(), createUserParams{
		Name:     input.Name,
		Email:    input.Email,
		Password: input.Password,
		Role:     string(RoleAdmin),
	})
	if err != nil {
		h.writeCreateUserError(w, err)
		return
	}

	h.writeSession(w, http.StatusCreated, user)
}

func (h *Handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := response.DecodeJSON(r, &input); err != nil {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	user, err := h.store.GetUserByEmail(r.Context(), input.Email)
	if errors.Is(err, ErrUserNotFound) {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "incorrect email or password"})
		return
	}
	if err != nil {
		h.serverError(w, err)
		return
	}

	if err := ComparePassword(user.PasswordHash, input.Password); err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "incorrect email or password"})
		return
	}

	h.writeSession(w, http.StatusOK, user)
}

func (h *Handler) handleCurrentUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	user, err := h.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	response.JSON(w, http.StatusOK, map[string]publicUser{
		"user": toPublicUser(user),
	})
}

func (h *Handler) handlePasswordResetRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var input struct {
		Email string `json:"email"`
	}
	if err := response.DecodeJSON(r, &input); err != nil {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if strings.TrimSpace(input.Email) == "" {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
		return
	}

	if err := h.reset.Request(r.Context(), input.Email); err != nil {
		if strings.Contains(err.Error(), "not configured") {
			response.JSON(w, http.StatusServiceUnavailable, map[string]string{"error": "email password reset is not configured"})
			return
		}
		h.serverError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"message": "If that email exists in DRFT, a reset code has been sent.",
	})
}

func (h *Handler) handlePasswordResetConfirm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	var input struct {
		Email    string `json:"email"`
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	if err := response.DecodeJSON(r, &input); err != nil {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if strings.TrimSpace(input.Email) == "" || strings.TrimSpace(input.Code) == "" || len(input.Password) < 8 {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "email, code, and a password of at least 8 characters are required"})
		return
	}

	if err := h.reset.Confirm(r.Context(), input.Email, input.Code, input.Password); err != nil {
		switch {
		case errors.Is(err, ErrResetCodeNotFound):
			response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired reset code"})
		case strings.Contains(err.Error(), "at least 8 characters"):
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			h.serverError(w, err)
		}
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Password updated. You can sign in to DRFT now."})
}

func (h *Handler) handleUsers(w http.ResponseWriter, r *http.Request) {
	user, err := h.RequireAdmin(r)
	if err != nil {
		h.writeAuthzError(w, err)
		return
	}

	switch r.Method {
	case http.MethodGet:
		users, err := h.store.ListUsers(r.Context())
		if err != nil {
			h.serverError(w, err)
			return
		}

		items := make([]publicUser, 0, len(users))
		for _, entry := range users {
			items = append(items, toPublicUser(entry))
		}

		response.JSON(w, http.StatusOK, map[string]any{"items": items})
	case http.MethodPost:
		var input struct {
			Name     string `json:"name"`
			Email    string `json:"email"`
			Password string `json:"password"`
			Role     string `json:"role"`
		}

		if err := response.DecodeJSON(r, &input); err != nil {
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if strings.TrimSpace(input.Role) == "" {
			input.Role = string(RoleUser)
		}

		createdUser, err := h.createUser(r.Context(), createUserParams{
			Name:     input.Name,
			Email:    input.Email,
			Password: input.Password,
			Role:     input.Role,
		})
		if err != nil {
			h.writeCreateUserError(w, err)
			return
		}

		h.logger.Info("user created", "admin_id", user.ID, "created_user_id", createdUser.ID, "role", createdUser.Role)
		response.JSON(w, http.StatusCreated, map[string]publicUser{"user": toPublicUser(createdUser)})
	default:
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *Handler) handleUserByID(w http.ResponseWriter, r *http.Request) {
	admin, err := h.RequireAdmin(r)
	if err != nil {
		h.writeAuthzError(w, err)
		return
	}

	if r.Method != http.MethodDelete {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	userID := strings.TrimPrefix(r.URL.Path, "/api/v1/admin/users/")
	if userID == "" {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "user id is required"})
		return
	}
	if userID == admin.ID {
		response.JSON(w, http.StatusConflict, map[string]string{"error": "you cannot remove your own active admin account"})
		return
	}

	targetUser, err := h.store.GetUserByID(r.Context(), userID)
	if errors.Is(err, ErrUserNotFound) {
		response.JSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	if err != nil {
		h.serverError(w, err)
		return
	}

	if targetUser.Role == RoleAdmin {
		adminCount, err := h.store.CountAdmins(r.Context())
		if err != nil {
			h.serverError(w, err)
			return
		}
		if adminCount <= 1 {
			response.JSON(w, http.StatusConflict, map[string]string{"error": "DRFT must keep at least one admin account"})
			return
		}
	}

	if err := h.store.DeleteUser(r.Context(), userID); err != nil {
		if errors.Is(err, ErrUserNotFound) {
			response.JSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		h.serverError(w, err)
		return
	}

	h.logger.Info("user deleted", "admin_id", admin.ID, "deleted_user_id", userID)
	response.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

type createUserParams struct {
	Name     string
	Email    string
	Password string
	Role     string
}

func (h *Handler) createUser(ctx context.Context, params createUserParams) (User, error) {
	if strings.TrimSpace(params.Name) == "" || strings.TrimSpace(params.Email) == "" || len(params.Password) < 8 {
		return User{}, errors.New("name, email, and a password of at least 8 characters are required")
	}
	role := ParseRole(params.Role)
	if !role.Valid() {
		return User{}, errors.New("role must be admin or user")
	}

	hash, err := HashPassword(params.Password)
	if err != nil {
		return User{}, fmt.Errorf("hash password: %w", err)
	}

	user, err := h.store.CreateUser(ctx, CreateUserInput{
		Name:         params.Name,
		Email:        params.Email,
		PasswordHash: hash,
		Role:         role,
	})
	if err != nil {
		return User{}, err
	}

	return user, nil
}

func (h *Handler) writeSession(w http.ResponseWriter, status int, user User) {
	token, err := h.tokens.Issue(user)
	if err != nil {
		h.serverError(w, err)
		return
	}

	response.JSON(w, status, sessionResponse{
		Token: token,
		User:  toPublicUser(user),
	})
}

func (h *Handler) serverError(w http.ResponseWriter, err error) {
	h.logger.Error("auth request failed", "error", err)
	response.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
}

func (h *Handler) writeAuthzError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrUnauthorized):
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	case errors.Is(err, ErrForbidden):
		response.JSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
	default:
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
	}
}

func (h *Handler) writeCreateUserError(w http.ResponseWriter, err error) {
	var pgErr *pq.Error
	switch {
	case errors.As(err, &pgErr) && pgErr.Code == "23505":
		response.JSON(w, http.StatusConflict, map[string]string{"error": "a user with that email already exists"})
	case strings.Contains(err.Error(), "password of at least 8 characters"),
		strings.Contains(err.Error(), "role must be admin or user"),
		strings.Contains(err.Error(), "name, email"):
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	default:
		h.serverError(w, err)
	}
}

func toPublicUser(user User) publicUser {
	return publicUser{
		ID:          user.ID,
		Name:        user.Name,
		Email:       user.Email,
		Role:        string(user.Role),
		Permissions: PermissionsForRole(user.Role),
		CreatedAt:   user.CreatedAt.UTC().Format(time.RFC3339),
	}
}
