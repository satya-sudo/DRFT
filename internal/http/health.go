package http

import (
	"net/http"
	"time"

	"drft/internal/config"
	"drft/internal/http/response"
)

func registerHealthRoutes(mux *http.ServeMux, cfg config.Config) {
	type healthResponse struct {
		Status    string `json:"status"`
		Service   string `json:"service"`
		Env       string `json:"env"`
		Timestamp string `json:"timestamp"`
	}

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}

		response.JSON(w, http.StatusOK, healthResponse{
			Status:    "ok",
			Service:   "drft",
			Env:       cfg.AppEnv,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		})
	})
}

