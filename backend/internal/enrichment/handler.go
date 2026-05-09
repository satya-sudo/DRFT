package enrichment

import (
	"database/sql"
	"log/slog"
	"net/http"

	"drft/internal/auth"
	"drft/internal/config"
	"drft/internal/http/response"
)

type Handler struct {
	cfg    config.Config
	logger *slog.Logger
	auth   *auth.Handler
	store  *Store
}

func NewHandler(cfg config.Config, logger *slog.Logger, authHandler *auth.Handler, db *sql.DB) *Handler {
	return &Handler{
		cfg:    cfg,
		logger: logger,
		auth:   authHandler,
		store:  NewStore(db),
	}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/enrichment/status", h.handleStatus)
	mux.HandleFunc("/api/v1/enrichment/backfill", h.handleBackfill)
}

func (h *Handler) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	status, err := h.store.GetUserStatus(r.Context(), user.ID)
	if err != nil {
		h.serverError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"enabled": h.cfg.EnrichmentEnabled,
		"status":  status,
	})
}

func (h *Handler) handleBackfill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	if !h.cfg.EnrichmentEnabled {
		response.JSON(w, http.StatusConflict, map[string]string{"error": "enrichment is disabled"})
		return
	}

	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	enqueuedCount, err := h.store.EnqueueBackfillForUser(r.Context(), user.ID)
	if err != nil {
		h.serverError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"success":       true,
		"enqueuedCount": enqueuedCount,
	})
}

func (h *Handler) serverError(w http.ResponseWriter, err error) {
	h.logger.Error("enrichment request failed", "error", err)
	response.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
}
