package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
)

const defaultMaxUploadSizeBytes int64 = 1 << 30

type Config struct {
	AppEnv             string
	HTTPAddr           string
	DatabaseDSN        string
	StorageRoot        string
	JWTSecret          string
	MaxUploadSizeBytes int64
	SMTPHost           string
	SMTPPort           string
	SMTPUsername       string
	SMTPPassword       string
	SMTPFromEmail      string
	SMTPFromName       string
	PasswordResetTTL   int64
}

func Load() (Config, error) {
	cfg := Config{
		AppEnv:             getEnv("DRFT_APP_ENV", "development"),
		HTTPAddr:           getEnv("DRFT_HTTP_ADDR", ":8080"),
		DatabaseDSN:        getEnv("DRFT_DB_DSN", ""),
		StorageRoot:        getEnv("DRFT_STORAGE_ROOT", "./storage"),
		JWTSecret:          getEnv("DRFT_JWT_SECRET", ""),
		MaxUploadSizeBytes: getEnvInt64("DRFT_MAX_UPLOAD_SIZE_BYTES", defaultMaxUploadSizeBytes),
		SMTPHost:           getEnv("DRFT_SMTP_HOST", ""),
		SMTPPort:           getEnv("DRFT_SMTP_PORT", ""),
		SMTPUsername:       getEnv("DRFT_SMTP_USERNAME", ""),
		SMTPPassword:       getEnv("DRFT_SMTP_PASSWORD", ""),
		SMTPFromEmail:      getEnv("DRFT_SMTP_FROM_EMAIL", ""),
		SMTPFromName:       getEnv("DRFT_SMTP_FROM_NAME", "DRFT"),
		PasswordResetTTL:   getEnvInt64("DRFT_PASSWORD_RESET_TTL_MINUTES", 10),
	}

	if cfg.DatabaseDSN == "" {
		return Config{}, fmt.Errorf("DRFT_DB_DSN is required")
	}

	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("DRFT_JWT_SECRET is required")
	}

	return cfg, nil
}

func (c Config) LogLevel() slog.Level {
	if c.AppEnv == "development" {
		return slog.LevelDebug
	}

	return slog.LevelInfo
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}

func getEnvInt64(key string, fallback int64) int64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}

	return parsed
}
