package media

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

func CleanupStaleUploads(storageRoot string, ttl time.Duration, logger *slog.Logger) error {
	root := uploadsRoot(storageRoot)
	if err := os.MkdirAll(root, 0o755); err != nil {
		return fmt.Errorf("prepare uploads root: %w", err)
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return fmt.Errorf("read uploads root: %w", err)
	}

	now := time.Now().UTC()
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		uploadID := entry.Name()
		session, err := loadChunkUploadSession(storageRoot, uploadID)
		if err != nil {
			logger.Warn("remove broken upload session", "upload_id", uploadID, "error", err)
			if cleanupErr := deleteChunkUploadSession(storageRoot, uploadID); cleanupErr != nil {
				logger.Error("remove broken upload session failed", "upload_id", uploadID, "error", cleanupErr)
			}
			continue
		}

		if now.Sub(session.CreatedAtUTC) < ttl {
			continue
		}

		logger.Info(
			"remove stale upload session",
			"upload_id",
			uploadID,
			"age_hours",
			now.Sub(session.CreatedAtUTC).Hours(),
		)
		if err := deleteChunkUploadSession(storageRoot, uploadID); err != nil {
			logger.Error("remove stale upload session failed", "upload_id", uploadID, "error", err)
		}
	}

	return nil
}

func StartUploadCleanupLoop(storageRoot string, ttl time.Duration, logger *slog.Logger) func() {
	stop := make(chan struct{})
	ticker := time.NewTicker(time.Hour)

	go func() {
		for {
			select {
			case <-ticker.C:
				if err := CleanupStaleUploads(storageRoot, ttl, logger); err != nil {
					logger.Error("stale upload cleanup failed", "error", err)
				}
			case <-stop:
				ticker.Stop()
				return
			}
		}
	}()

	return func() {
		close(stop)
	}
}

func mergedUploadPath(storageRoot, uploadID string) string {
	return filepath.Join(uploadSessionDir(storageRoot, uploadID), "merged.bin")
}
