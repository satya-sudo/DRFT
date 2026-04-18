package media

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

var ErrFileNotFound = errors.New("file not found")

type File struct {
	ID                string
	UserID            string
	FileName          string
	OriginalExtension string
	StorageKey        string
	MIMEType          string
	SizeBytes         int64
	MediaType         string
	ChecksumSHA256    sql.NullString
	WidthPX           sql.NullInt64
	HeightPX          sql.NullInt64
	DurationMS        sql.NullInt64
	ThumbnailKey      sql.NullString
	CreatedAt         time.Time
	TakenAt           sql.NullTime
	DeletedAt         sql.NullTime
}

type CreateFileInput struct {
	UserID            string
	FileName          string
	OriginalExtension string
	StorageKey        string
	MIMEType          string
	SizeBytes         int64
	MediaType         string
	ChecksumSHA256    string
	WidthPX           *int
	HeightPX          *int
	DurationMS        *int64
	ThumbnailKey      string
	TakenAt           *time.Time
}

type Store struct {
	db *sql.DB
}

type FilePage struct {
	Files      []File
	HasMore    bool
	NextOffset int
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) ListFilesByUser(ctx context.Context, userID string, limit, offset int) (FilePage, error) {
	if limit <= 0 {
		limit = 40
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, user_id, file_name, original_extension, storage_key, mime_type, size_bytes,
		       media_type, checksum_sha256, width_px, height_px, duration_ms, thumbnail_key,
		       created_at, taken_at, deleted_at
		FROM files
		WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY COALESCE(taken_at, created_at) DESC, id DESC
		LIMIT $2 OFFSET $3
	`, userID, limit+1, offset)
	if err != nil {
		return FilePage{}, fmt.Errorf("list files: %w", err)
	}
	defer rows.Close()

	files := make([]File, 0, limit+1)
	for rows.Next() {
		var file File
		if err := rows.Scan(
			&file.ID,
			&file.UserID,
			&file.FileName,
			&file.OriginalExtension,
			&file.StorageKey,
			&file.MIMEType,
			&file.SizeBytes,
			&file.MediaType,
			&file.ChecksumSHA256,
			&file.WidthPX,
			&file.HeightPX,
			&file.DurationMS,
			&file.ThumbnailKey,
			&file.CreatedAt,
			&file.TakenAt,
			&file.DeletedAt,
		); err != nil {
			return FilePage{}, fmt.Errorf("scan file: %w", err)
		}

		files = append(files, file)
	}

	if err := rows.Err(); err != nil {
		return FilePage{}, fmt.Errorf("iterate files: %w", err)
	}

	hasMore := len(files) > limit
	if hasMore {
		files = files[:limit]
	}

	return FilePage{
		Files:      files,
		HasMore:    hasMore,
		NextOffset: offset + len(files),
	}, nil
}

func (s *Store) CreateFile(ctx context.Context, input CreateFileInput) (File, error) {
	var file File
	var takenAt any
	var widthPX any
	var heightPX any
	var durationMS any
	if input.TakenAt != nil {
		takenAt = *input.TakenAt
	}
	if input.WidthPX != nil {
		widthPX = *input.WidthPX
	}
	if input.HeightPX != nil {
		heightPX = *input.HeightPX
	}
	if input.DurationMS != nil {
		durationMS = *input.DurationMS
	}

	err := s.db.QueryRowContext(ctx, `
		INSERT INTO files (
			user_id, file_name, original_extension, storage_key, mime_type, size_bytes,
			media_type, checksum_sha256, width_px, height_px, duration_ms, thumbnail_key, taken_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''), $9, $10, $11, NULLIF($12, ''), $13)
		RETURNING id, user_id, file_name, original_extension, storage_key, mime_type, size_bytes,
		          media_type, checksum_sha256, width_px, height_px, duration_ms, thumbnail_key,
		          created_at, taken_at, deleted_at
	`, input.UserID, input.FileName, input.OriginalExtension, input.StorageKey, input.MIMEType,
		input.SizeBytes, input.MediaType, input.ChecksumSHA256, widthPX, heightPX, durationMS, input.ThumbnailKey, takenAt).Scan(
		&file.ID,
		&file.UserID,
		&file.FileName,
		&file.OriginalExtension,
		&file.StorageKey,
		&file.MIMEType,
		&file.SizeBytes,
		&file.MediaType,
		&file.ChecksumSHA256,
		&file.WidthPX,
		&file.HeightPX,
		&file.DurationMS,
		&file.ThumbnailKey,
		&file.CreatedAt,
		&file.TakenAt,
		&file.DeletedAt,
	)
	if err != nil {
		return File{}, fmt.Errorf("create file: %w", err)
	}

	return file, nil
}

func (s *Store) GetFileByID(ctx context.Context, userID, fileID string) (File, error) {
	var file File

	err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, file_name, original_extension, storage_key, mime_type, size_bytes,
		       media_type, checksum_sha256, width_px, height_px, duration_ms, thumbnail_key,
		       created_at, taken_at, deleted_at
		FROM files
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, fileID, userID).Scan(
		&file.ID,
		&file.UserID,
		&file.FileName,
		&file.OriginalExtension,
		&file.StorageKey,
		&file.MIMEType,
		&file.SizeBytes,
		&file.MediaType,
		&file.ChecksumSHA256,
		&file.WidthPX,
		&file.HeightPX,
		&file.DurationMS,
		&file.ThumbnailKey,
		&file.CreatedAt,
		&file.TakenAt,
		&file.DeletedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return File{}, ErrFileNotFound
	}
	if err != nil {
		return File{}, fmt.Errorf("get file: %w", err)
	}

	return file, nil
}

func (s *Store) MarkDeleted(ctx context.Context, userID, fileID string) error {
	result, err := s.db.ExecContext(ctx, `
		UPDATE files
		SET deleted_at = NOW()
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, fileID, userID)
	if err != nil {
		return fmt.Errorf("mark file deleted: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("mark file deleted rows affected: %w", err)
	}
	if affected == 0 {
		return ErrFileNotFound
	}

	return nil
}

func (s *Store) SumActiveFileBytesByUser(ctx context.Context, userID string) (int64, error) {
	var total sql.NullInt64

	err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(size_bytes), 0)
		FROM files
		WHERE user_id = $1 AND deleted_at IS NULL
	`, userID).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("sum active file bytes: %w", err)
	}
	if !total.Valid {
		return 0, nil
	}

	return total.Int64, nil
}
