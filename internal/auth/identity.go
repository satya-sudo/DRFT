package auth

import (
	"errors"
	"net/http"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
)

func (h *Handler) Authenticate(r *http.Request) (User, error) {
	return h.tokens.UserFromRequest(r.Context(), r.Header.Get("Authorization"), h.store)
}

func (h *Handler) RequireAdmin(r *http.Request) (User, error) {
	user, err := h.Authenticate(r)
	if err != nil {
		return User{}, ErrUnauthorized
	}
	if !user.Role.CanManageUsers() {
		return User{}, ErrForbidden
	}

	return user, nil
}

func (h *Handler) RequireDeviceManager(r *http.Request) (User, error) {
	user, err := h.Authenticate(r)
	if err != nil {
		return User{}, ErrUnauthorized
	}
	if !user.Role.CanManageDevices() {
		return User{}, ErrForbidden
	}

	return user, nil
}
