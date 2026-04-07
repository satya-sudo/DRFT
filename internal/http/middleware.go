package http

import (
	"log/slog"
	"net/http"
	"strings"
	"time"
)

func WithRequestLogging(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()

		recorder := &statusRecorder{
			ResponseWriter: w,
			status:         http.StatusOK,
		}

		next.ServeHTTP(recorder, r)

		logger.Info(
			"http request",
			"method", r.Method,
			"path", sanitizePath(r.URL.Path),
			"status", recorder.status,
			"duration_ms", time.Since(startedAt).Milliseconds(),
		)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func sanitizePath(path string) string {
	if path == "" {
		return "/"
	}

	if strings.HasPrefix(path, "/api/v1/file/") {
		return "/api/v1/file/:id"
	}

	return path
}

