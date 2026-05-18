package enrichment

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"drft/internal/config"
)

var ErrNoJobsAvailable = errors.New("no enrichment jobs available")

type Job struct {
	ID           string
	UserID       string
	FileID       string
	JobType      string
	AttemptCount int
}

type Processor interface {
	Process(context.Context, Job) error
}

type Worker struct {
	cfg       config.Config
	logger    *slog.Logger
	store     *Store
	processor Processor
}

func NewWorker(cfg config.Config, logger *slog.Logger, db *sql.DB, processor Processor) *Worker {
	store := NewStore(db)
	if processor == nil {
		processor = NewPipelineProcessor(store, cfg.StorageRoot)
	}

	return &Worker{
		cfg:       cfg,
		logger:    logger,
		store:     store,
		processor: processor,
	}
}

func (w *Worker) Run(ctx context.Context) error {
	if !w.cfg.EnrichmentEnabled {
		w.logger.Info("enrichment worker is disabled")
		<-ctx.Done()
		return ctx.Err()
	}

	pollInterval := time.Duration(w.cfg.EnrichmentPollIntervalSeconds) * time.Second
	if pollInterval <= 0 {
		pollInterval = 30 * time.Second
	}

	batchSize := w.cfg.EnrichmentBatchSize
	if batchSize <= 0 {
		batchSize = 10
	}

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	w.logger.Info("enrichment worker started", "batch_size", batchSize, "poll_interval_seconds", w.cfg.EnrichmentPollIntervalSeconds)

	for {
		drained, err := w.runBatch(ctx, batchSize)
		if err != nil && !errors.Is(err, context.Canceled) {
			w.logger.Error("enrichment batch failed", "error", err)
		}

		if ctx.Err() != nil {
			return ctx.Err()
		}

		if drained {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-ticker.C:
			}
		}
	}
}

func (w *Worker) runBatch(ctx context.Context, batchSize int) (bool, error) {
	drained := false

	for range batchSize {
		job, err := w.store.ClaimNextJob(ctx)
		switch {
		case errors.Is(err, ErrNoJobsAvailable):
			return true, nil
		case err != nil:
			return false, err
		}

		drained = false

		if err := w.processor.Process(ctx, job); err != nil {
			if markErr := w.store.MarkJobFailed(ctx, job.ID, err.Error()); markErr != nil {
				return false, fmt.Errorf("process job %s: %w (mark failed: %v)", job.ID, err, markErr)
			}
			w.logger.Warn("enrichment job failed", "job_id", job.ID, "file_id", job.FileID, "error", err)
			continue
		}

		if err := w.store.MarkJobCompleted(ctx, job.ID); err != nil {
			return false, fmt.Errorf("mark job %s completed: %w", job.ID, err)
		}
		w.logger.Info("enrichment job completed", "job_id", job.ID, "file_id", job.FileID)
	}

	return drained, nil
}
