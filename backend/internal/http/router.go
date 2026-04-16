package http

import (
	"log/slog"
	"net/http"

	"drft/internal/auth"
	"drft/internal/config"
	"drft/internal/library"
	"drft/internal/media"
)

type Dependencies struct {
	Config config.Config
	Logger *slog.Logger
	Auth   *auth.Handler
	Media  *media.Handler
	Library *library.Handler
}

func NewRouter(deps Dependencies) http.Handler {
	mux := http.NewServeMux()

	registerHealthRoutes(mux, deps.Config)
	deps.Auth.RegisterRoutes(mux)
	deps.Media.RegisterRoutes(mux)
	deps.Library.RegisterRoutes(mux)

	return mux
}
