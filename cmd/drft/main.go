package main

import (
	"context"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"drft/internal/auth"
	"drft/internal/app"
	"drft/internal/config"
	"drft/internal/version"
	"drft/migrations"
	_ "github.com/lib/pq"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("load config", "error", err)
		os.Exit(1)
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.LogLevel(),
	}))

	if len(os.Args) > 1 && os.Args[1] == "reset-password" {
		if err := runResetPasswordCommand(cfg, logger, os.Args[2:]); err != nil {
			logger.Error("reset password", "error", err)
			os.Exit(1)
		}
		return
	}

	application, err := app.New(cfg, logger)
	if err != nil {
		logger.Error("build app", "error", err)
		os.Exit(1)
	}
	defer application.Close()

	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           application.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("server starting", "addr", cfg.HTTPAddr, "env", cfg.AppEnv, "version", version.Value)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	<-ctx.Done()
	logger.Info("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}

	logger.Info("server stopped")
}

func runResetPasswordCommand(cfg config.Config, logger *slog.Logger, args []string) error {
	command := flag.NewFlagSet("reset-password", flag.ContinueOnError)
	email := command.String("email", "", "User email")
	password := command.String("password", "", "New password (optional)")
	if err := command.Parse(args); err != nil {
		return err
	}
	if *email == "" {
		return errors.New("email is required")
	}

	db, err := openDatabase(cfg)
	if err != nil {
		return err
	}
	defer db.Close()

	nextPassword := *password
	if nextPassword == "" {
		nextPassword, err = auth.GenerateMasterPassword()
		if err != nil {
			return err
		}
	}
	if len(nextPassword) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	passwordHash, err := auth.HashPassword(nextPassword)
	if err != nil {
		return err
	}

	store := auth.NewStore(db)
	user, err := store.GetUserByEmail(context.Background(), *email)
	if err != nil {
		return err
	}
	if err := store.UpdatePasswordHashByEmail(context.Background(), *email, passwordHash); err != nil {
		return err
	}
	if err := store.DeleteAllPasswordResetCodesForUser(context.Background(), user.ID); err != nil {
		return err
	}

	logger.Info("DRFT password reset complete", "email", user.Email)
	fmt.Fprintf(os.Stdout, "DRFT password reset complete for %s\nNew password: %s\n", user.Email, nextPassword)
	return nil
}

func openDatabase(cfg config.Config) (*sql.DB, error) {
	db, err := sql.Open("postgres", cfg.DatabaseDSN)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	if err := migrations.Apply(db); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}
