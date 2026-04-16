package app

import (
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"drft/internal/auth"
	"drft/internal/config"
	drfthttp "drft/internal/http"
	"drft/internal/library"
	"drft/internal/media"
	"drft/migrations"
	_ "github.com/lib/pq"
)

type App struct {
	cfg    config.Config
	logger *slog.Logger
	db     *sql.DB
	auth   *auth.Handler
	media  *media.Handler
	library *library.Handler
	stopUploadCleanup func()
}

func New(cfg config.Config, logger *slog.Logger) (*App, error) {
	if err := os.MkdirAll(cfg.StorageRoot, 0o755); err != nil {
		return nil, fmt.Errorf("create storage root: %w", err)
	}

	db, err := sql.Open("postgres", cfg.DatabaseDSN)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	if err := migrations.Apply(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	authHandler := auth.NewHandler(cfg, logger, db)
	uploadSessionTTL := time.Duration(cfg.UploadSessionTTLHours) * time.Hour
	if err := media.CleanupStaleUploads(cfg.StorageRoot, uploadSessionTTL, logger); err != nil {
		db.Close()
		return nil, fmt.Errorf("cleanup stale uploads: %w", err)
	}

	return &App{
		cfg:    cfg,
		logger: logger,
		db:     db,
		auth:   authHandler,
		media:  media.NewHandler(cfg, logger, authHandler, db),
		library: library.NewHandler(logger, authHandler, db),
		stopUploadCleanup: media.StartUploadCleanupLoop(cfg.StorageRoot, uploadSessionTTL, logger),
	}, nil
}

func (a *App) Routes() http.Handler {
	router := drfthttp.NewRouter(drfthttp.Dependencies{
		Config: a.cfg,
		Logger: a.logger,
		Auth:   a.auth,
		Media:  a.media,
		Library: a.library,
	})

	return drfthttp.WithRequestLogging(a.logger, router)
}

func (a *App) Close() error {
	if a.stopUploadCleanup != nil {
		a.stopUploadCleanup()
	}

	if a.db != nil {
		return a.db.Close()
	}

	return nil
}
