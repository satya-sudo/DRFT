package enrichment

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

const (
	JobTypeFull = "full"

	StatusPending    = "pending"
	StatusProcessing = "processing"
	StatusCompleted  = "completed"
	StatusFailed     = "failed"
)

type Store struct {
	db *sql.DB
}

type UserStatus struct {
	EligibleImages int `json:"eligibleImages"`
	Pending        int `json:"pending"`
	Processing     int `json:"processing"`
	Completed      int `json:"completed"`
	Failed         int `json:"failed"`
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) ClaimNextJob(ctx context.Context) (Job, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Job{}, fmt.Errorf("begin claim job: %w", err)
	}
	defer tx.Rollback()

	var job Job
	err = tx.QueryRowContext(ctx, `
		SELECT id, user_id, file_id, job_type, attempt_count
		FROM enrichment_jobs
		WHERE status IN ('pending', 'retry_wait')
		  AND available_at <= NOW()
		ORDER BY available_at ASC, created_at ASC
		FOR UPDATE SKIP LOCKED
		LIMIT 1
	`).Scan(&job.ID, &job.UserID, &job.FileID, &job.JobType, &job.AttemptCount)
	if errors.Is(err, sql.ErrNoRows) {
		return Job{}, ErrNoJobsAvailable
	}
	if err != nil {
		return Job{}, fmt.Errorf("select next job: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE enrichment_jobs
		SET status = $2,
		    attempt_count = attempt_count + 1,
		    started_at = NOW(),
		    updated_at = NOW(),
		    last_error = ''
		WHERE id = $1
	`, job.ID, StatusProcessing); err != nil {
		return Job{}, fmt.Errorf("mark job processing: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE file_enrichment
		SET overall_status = $2,
		    face_status = CASE WHEN face_status = 'pending' THEN $2 ELSE face_status END,
		    place_status = CASE WHEN place_status = 'pending' THEN $2 ELSE place_status END,
		    started_at = COALESCE(started_at, NOW()),
		    updated_at = NOW(),
		    last_error = ''
		WHERE file_id = $1
	`, job.FileID, StatusProcessing); err != nil {
		return Job{}, fmt.Errorf("mark file enrichment processing: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Job{}, fmt.Errorf("commit claim job: %w", err)
	}

	return job, nil
}

func (s *Store) EnqueueFile(ctx context.Context, userID, fileID string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin enrichment enqueue: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO file_enrichment (
			file_id, user_id, overall_status, face_status, place_status, queued_at, updated_at
		)
		VALUES ($1, $2, $3, $3, $3, NOW(), NOW())
		ON CONFLICT (file_id) DO UPDATE
		SET user_id = EXCLUDED.user_id,
		    overall_status = EXCLUDED.overall_status,
		    face_status = EXCLUDED.face_status,
		    place_status = EXCLUDED.place_status,
		    queued_at = NOW(),
		    started_at = NULL,
		    completed_at = NULL,
		    last_error = '',
		    updated_at = NOW()
	`, fileID, userID, StatusPending); err != nil {
		return fmt.Errorf("upsert file enrichment: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO enrichment_jobs (user_id, file_id, job_type, status, available_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT DO NOTHING
	`, userID, fileID, JobTypeFull, StatusPending); err != nil {
		return fmt.Errorf("insert enrichment job: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit enrichment enqueue: %w", err)
	}

	return nil
}

func (s *Store) EnqueueBackfillForUser(ctx context.Context, userID string) (int, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin enrichment backfill: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO file_enrichment (
			file_id, user_id, overall_status, face_status, place_status, queued_at, updated_at
		)
		SELECT f.id, f.user_id, $2, $2, $2, NOW(), NOW()
		FROM files f
		WHERE f.user_id = $1
		  AND f.media_type = 'image'
		  AND f.deleted_at IS NULL
		ON CONFLICT (file_id) DO NOTHING
	`, userID, StatusPending); err != nil {
		return 0, fmt.Errorf("seed file enrichment rows: %w", err)
	}

	result, err := tx.ExecContext(ctx, `
		INSERT INTO enrichment_jobs (user_id, file_id, job_type, status, available_at, updated_at)
		SELECT f.user_id, f.id, $2, $3, NOW(), NOW()
		FROM files f
		WHERE f.user_id = $1
		  AND f.media_type = 'image'
		  AND f.deleted_at IS NULL
		  AND NOT EXISTS (
		      SELECT 1
		      FROM enrichment_jobs j
		      WHERE j.file_id = f.id
		        AND j.job_type = $2
		        AND j.status IN ('pending', 'processing', 'retry_wait')
		  )
	`, userID, JobTypeFull, StatusPending)
	if err != nil {
		return 0, fmt.Errorf("insert backfill jobs: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("count backfill rows: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit enrichment backfill: %w", err)
	}

	return int(rowsAffected), nil
}

func (s *Store) GetUserStatus(ctx context.Context, userID string) (UserStatus, error) {
	var status UserStatus

	if err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)::INTEGER
		FROM files
		WHERE user_id = $1
		  AND media_type = 'image'
		  AND deleted_at IS NULL
	`, userID).Scan(&status.EligibleImages); err != nil {
		return UserStatus{}, fmt.Errorf("count eligible images: %w", err)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT overall_status, COUNT(*)::INTEGER
		FROM file_enrichment
		WHERE user_id = $1
		GROUP BY overall_status
	`, userID)
	if err != nil {
		return UserStatus{}, fmt.Errorf("load enrichment counts: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var state string
		var count int
		if err := rows.Scan(&state, &count); err != nil {
			return UserStatus{}, fmt.Errorf("scan enrichment count: %w", err)
		}

		switch state {
		case StatusPending:
			status.Pending = count
		case StatusProcessing:
			status.Processing = count
		case StatusCompleted:
			status.Completed = count
		case StatusFailed:
			status.Failed = count
		}
	}

	if err := rows.Err(); err != nil {
		return UserStatus{}, fmt.Errorf("iterate enrichment counts: %w", err)
	}

	return status, nil
}

func (s *Store) MarkJobCompleted(ctx context.Context, jobID string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin mark job completed: %w", err)
	}
	defer tx.Rollback()

	var fileID string
	if err := tx.QueryRowContext(ctx, `
		UPDATE enrichment_jobs
		SET status = $2,
		    completed_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1
		RETURNING file_id
	`, jobID, StatusCompleted).Scan(&fileID); err != nil {
		return fmt.Errorf("update job completed: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE file_enrichment
		SET overall_status = $2,
		    face_status = $2,
		    place_status = $2,
		    completed_at = NOW(),
		    updated_at = NOW(),
		    last_error = ''
		WHERE file_id = $1
	`, fileID, StatusCompleted); err != nil {
		return fmt.Errorf("update file enrichment completed: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit mark job completed: %w", err)
	}

	return nil
}

func (s *Store) MarkJobFailed(ctx context.Context, jobID, failure string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin mark job failed: %w", err)
	}
	defer tx.Rollback()

	var fileID string
	if err := tx.QueryRowContext(ctx, `
		UPDATE enrichment_jobs
		SET status = $2,
		    last_error = $3,
		    completed_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1
		RETURNING file_id
	`, jobID, StatusFailed, failure).Scan(&fileID); err != nil {
		return fmt.Errorf("update job failed: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE file_enrichment
		SET overall_status = $2,
		    face_status = $2,
		    place_status = $2,
		    completed_at = NOW(),
		    updated_at = NOW(),
		    last_error = $3
		WHERE file_id = $1
	`, fileID, StatusFailed, failure); err != nil {
		return fmt.Errorf("update file enrichment failed: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit mark job failed: %w", err)
	}

	return nil
}
