package library

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrAlbumNotFound = errors.New("album not found")
	ErrTagNotFound   = errors.New("tag not found")
)

type Album struct {
	ID          string
	UserID      string
	Name        string
	Description string
	CoverFileID sql.NullString
	CreatedAt   time.Time
	UpdatedAt   time.Time
	FileCount   int
}

type Tag struct {
	ID        string
	UserID    string
	Name      string
	Color     string
	CreatedAt time.Time
	UpdatedAt time.Time
	FileCount int
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) ListAlbumsByUser(ctx context.Context, userID string) ([]Album, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT a.id, a.user_id, a.name, a.description, a.cover_file_id, a.created_at, a.updated_at,
		       COUNT(af.file_id)::INTEGER AS file_count
		FROM albums a
		LEFT JOIN album_files af ON af.album_id = a.id
		WHERE a.user_id = $1
		GROUP BY a.id
		ORDER BY a.updated_at DESC, a.id DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list albums: %w", err)
	}
	defer rows.Close()

	albums := make([]Album, 0)
	for rows.Next() {
		var album Album
		if err := rows.Scan(
			&album.ID,
			&album.UserID,
			&album.Name,
			&album.Description,
			&album.CoverFileID,
			&album.CreatedAt,
			&album.UpdatedAt,
			&album.FileCount,
		); err != nil {
			return nil, fmt.Errorf("scan album: %w", err)
		}
		albums = append(albums, album)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate albums: %w", err)
	}

	return albums, nil
}

func (s *Store) CreateAlbum(ctx context.Context, userID, name, description string) (Album, error) {
	var album Album
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO albums (user_id, name, description)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, name, description, cover_file_id, created_at, updated_at
	`, userID, strings.TrimSpace(name), strings.TrimSpace(description)).Scan(
		&album.ID,
		&album.UserID,
		&album.Name,
		&album.Description,
		&album.CoverFileID,
		&album.CreatedAt,
		&album.UpdatedAt,
	)
	if err != nil {
		return Album{}, fmt.Errorf("create album: %w", err)
	}
	return album, nil
}

func (s *Store) GetAlbumByID(ctx context.Context, userID, albumID string) (Album, error) {
	var album Album
	err := s.db.QueryRowContext(ctx, `
		SELECT a.id, a.user_id, a.name, a.description, a.cover_file_id, a.created_at, a.updated_at,
		       COUNT(af.file_id)::INTEGER AS file_count
		FROM albums a
		LEFT JOIN album_files af ON af.album_id = a.id
		WHERE a.user_id = $1 AND a.id = $2
		GROUP BY a.id
	`, userID, albumID).Scan(
		&album.ID,
		&album.UserID,
		&album.Name,
		&album.Description,
		&album.CoverFileID,
		&album.CreatedAt,
		&album.UpdatedAt,
		&album.FileCount,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Album{}, ErrAlbumNotFound
	}
	if err != nil {
		return Album{}, fmt.Errorf("get album: %w", err)
	}
	return album, nil
}

func (s *Store) UpdateAlbum(ctx context.Context, userID, albumID, name, description string) (Album, error) {
	var album Album
	err := s.db.QueryRowContext(ctx, `
		UPDATE albums
		SET name = $3, description = $4, updated_at = NOW()
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, name, description, cover_file_id, created_at, updated_at
	`, userID, albumID, strings.TrimSpace(name), strings.TrimSpace(description)).Scan(
		&album.ID,
		&album.UserID,
		&album.Name,
		&album.Description,
		&album.CoverFileID,
		&album.CreatedAt,
		&album.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Album{}, ErrAlbumNotFound
	}
	if err != nil {
		return Album{}, fmt.Errorf("update album: %w", err)
	}
	return s.GetAlbumByID(ctx, userID, album.ID)
}

func (s *Store) DeleteAlbum(ctx context.Context, userID, albumID string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM albums WHERE user_id = $1 AND id = $2`, userID, albumID)
	if err != nil {
		return fmt.Errorf("delete album: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("delete album rows affected: %w", err)
	}
	if affected == 0 {
		return ErrAlbumNotFound
	}
	return nil
}

func (s *Store) AddFilesToAlbum(ctx context.Context, userID, albumID string, fileIDs []string) error {
	if len(fileIDs) == 0 {
		return nil
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin add files to album: %w", err)
	}
	defer tx.Rollback()

	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM albums WHERE user_id = $1 AND id = $2)`, userID, albumID).Scan(&exists); err != nil {
		return fmt.Errorf("check album exists: %w", err)
	}
	if !exists {
		return ErrAlbumNotFound
	}

	for _, fileID := range fileIDs {
		var owned bool
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM files WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL)`, userID, fileID).Scan(&owned); err != nil {
			return fmt.Errorf("check file ownership: %w", err)
		}
		if !owned {
			continue
		}

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO album_files (album_id, file_id)
			VALUES ($1, $2)
			ON CONFLICT (album_id, file_id) DO NOTHING
		`, albumID, fileID); err != nil {
			return fmt.Errorf("insert album file: %w", err)
		}
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE albums
		SET updated_at = NOW(),
		    cover_file_id = COALESCE(cover_file_id, (SELECT file_id FROM album_files WHERE album_id = $1 ORDER BY created_at ASC LIMIT 1))
		WHERE id = $1
	`, albumID); err != nil {
		return fmt.Errorf("touch album after add: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit add files to album: %w", err)
	}
	return nil
}

func (s *Store) RemoveFileFromAlbum(ctx context.Context, userID, albumID, fileID string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin remove file from album: %w", err)
	}
	defer tx.Rollback()

	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM albums WHERE user_id = $1 AND id = $2)`, userID, albumID).Scan(&exists); err != nil {
		return fmt.Errorf("check album exists: %w", err)
	}
	if !exists {
		return ErrAlbumNotFound
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM album_files WHERE album_id = $1 AND file_id = $2`, albumID, fileID); err != nil {
		return fmt.Errorf("delete album file: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE albums
		SET updated_at = NOW(),
		    cover_file_id = CASE
		        WHEN cover_file_id = $2 THEN (SELECT file_id FROM album_files WHERE album_id = $1 ORDER BY created_at ASC LIMIT 1)
		        ELSE cover_file_id
		    END
		WHERE id = $1
	`, albumID, fileID); err != nil {
		return fmt.Errorf("touch album after remove: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit remove file from album: %w", err)
	}
	return nil
}

func (s *Store) ListAlbumFiles(ctx context.Context, userID, albumID string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT af.file_id
		FROM album_files af
		INNER JOIN albums a ON a.id = af.album_id
		INNER JOIN files f ON f.id = af.file_id
		WHERE a.user_id = $1 AND a.id = $2 AND f.deleted_at IS NULL
		ORDER BY af.created_at DESC
	`, userID, albumID)
	if err != nil {
		return nil, fmt.Errorf("list album files: %w", err)
	}
	defer rows.Close()

	ids := make([]string, 0)
	for rows.Next() {
		var fileID string
		if err := rows.Scan(&fileID); err != nil {
			return nil, fmt.Errorf("scan album file id: %w", err)
		}
		ids = append(ids, fileID)
	}
	return ids, rows.Err()
}

func (s *Store) ListTagsByUser(ctx context.Context, userID string) ([]Tag, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT t.id, t.user_id, t.name, t.color, t.created_at, t.updated_at,
		       COUNT(ft.file_id)::INTEGER AS file_count
		FROM tags t
		LEFT JOIN file_tags ft ON ft.tag_id = t.id
		WHERE t.user_id = $1
		GROUP BY t.id
		ORDER BY t.updated_at DESC, t.name ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list tags: %w", err)
	}
	defer rows.Close()

	tags := make([]Tag, 0)
	for rows.Next() {
		var tag Tag
		if err := rows.Scan(
			&tag.ID,
			&tag.UserID,
			&tag.Name,
			&tag.Color,
			&tag.CreatedAt,
			&tag.UpdatedAt,
			&tag.FileCount,
		); err != nil {
			return nil, fmt.Errorf("scan tag: %w", err)
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}

func (s *Store) CreateTag(ctx context.Context, userID, name, color string) (Tag, error) {
	var tag Tag
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO tags (user_id, name, color)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, name, color, created_at, updated_at
	`, userID, strings.TrimSpace(name), strings.TrimSpace(color)).Scan(
		&tag.ID,
		&tag.UserID,
		&tag.Name,
		&tag.Color,
		&tag.CreatedAt,
		&tag.UpdatedAt,
	)
	if err != nil {
		return Tag{}, fmt.Errorf("create tag: %w", err)
	}
	return tag, nil
}

func (s *Store) UpdateTag(ctx context.Context, userID, tagID, name, color string) (Tag, error) {
	var tag Tag
	err := s.db.QueryRowContext(ctx, `
		UPDATE tags
		SET name = $3, color = $4, updated_at = NOW()
		WHERE user_id = $1 AND id = $2
		RETURNING id, user_id, name, color, created_at, updated_at
	`, userID, tagID, strings.TrimSpace(name), strings.TrimSpace(color)).Scan(
		&tag.ID,
		&tag.UserID,
		&tag.Name,
		&tag.Color,
		&tag.CreatedAt,
		&tag.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Tag{}, ErrTagNotFound
	}
	if err != nil {
		return Tag{}, fmt.Errorf("update tag: %w", err)
	}
	return s.GetTagByID(ctx, userID, tag.ID)
}

func (s *Store) GetTagByID(ctx context.Context, userID, tagID string) (Tag, error) {
	var tag Tag
	err := s.db.QueryRowContext(ctx, `
		SELECT t.id, t.user_id, t.name, t.color, t.created_at, t.updated_at,
		       COUNT(ft.file_id)::INTEGER AS file_count
		FROM tags t
		LEFT JOIN file_tags ft ON ft.tag_id = t.id
		WHERE t.user_id = $1 AND t.id = $2
		GROUP BY t.id
	`, userID, tagID).Scan(
		&tag.ID,
		&tag.UserID,
		&tag.Name,
		&tag.Color,
		&tag.CreatedAt,
		&tag.UpdatedAt,
		&tag.FileCount,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Tag{}, ErrTagNotFound
	}
	if err != nil {
		return Tag{}, fmt.Errorf("get tag: %w", err)
	}
	return tag, nil
}

func (s *Store) DeleteTag(ctx context.Context, userID, tagID string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM tags WHERE user_id = $1 AND id = $2`, userID, tagID)
	if err != nil {
		return fmt.Errorf("delete tag: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("delete tag rows affected: %w", err)
	}
	if affected == 0 {
		return ErrTagNotFound
	}
	return nil
}

func (s *Store) AddTagToFile(ctx context.Context, userID, fileID, tagID string) error {
	var fileOwned bool
	if err := s.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM files WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL)`, userID, fileID).Scan(&fileOwned); err != nil {
		return fmt.Errorf("check file ownership for tag: %w", err)
	}
	if !fileOwned {
		return ErrFileNotFoundInLibrary
	}

	var tagOwned bool
	if err := s.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM tags WHERE user_id = $1 AND id = $2)`, userID, tagID).Scan(&tagOwned); err != nil {
		return fmt.Errorf("check tag ownership: %w", err)
	}
	if !tagOwned {
		return ErrTagNotFound
	}

	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO file_tags (file_id, tag_id, source)
		VALUES ($1, $2, 'manual')
		ON CONFLICT (file_id, tag_id) DO UPDATE SET source = 'manual'
	`, fileID, tagID); err != nil {
		return fmt.Errorf("add tag to file: %w", err)
	}

	if _, err := s.db.ExecContext(ctx, `UPDATE tags SET updated_at = NOW() WHERE id = $1`, tagID); err != nil {
		return fmt.Errorf("touch tag after file link: %w", err)
	}

	return nil
}

func (s *Store) RemoveTagFromFile(ctx context.Context, userID, fileID, tagID string) error {
	var tagOwned bool
	if err := s.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM tags WHERE user_id = $1 AND id = $2)`, userID, tagID).Scan(&tagOwned); err != nil {
		return fmt.Errorf("check tag ownership for remove: %w", err)
	}
	if !tagOwned {
		return ErrTagNotFound
	}

	if _, err := s.db.ExecContext(ctx, `DELETE FROM file_tags WHERE file_id = $1 AND tag_id = $2`, fileID, tagID); err != nil {
		return fmt.Errorf("remove tag from file: %w", err)
	}

	if _, err := s.db.ExecContext(ctx, `UPDATE tags SET updated_at = NOW() WHERE id = $1`, tagID); err != nil {
		return fmt.Errorf("touch tag after file unlink: %w", err)
	}

	return nil
}

func (s *Store) ListTagFileIDs(ctx context.Context, userID, tagID string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT ft.file_id
		FROM file_tags ft
		INNER JOIN tags t ON t.id = ft.tag_id
		INNER JOIN files f ON f.id = ft.file_id
		WHERE t.user_id = $1 AND t.id = $2 AND f.deleted_at IS NULL
		ORDER BY ft.created_at DESC
	`, userID, tagID)
	if err != nil {
		return nil, fmt.Errorf("list tag file ids: %w", err)
	}
	defer rows.Close()

	ids := make([]string, 0)
	for rows.Next() {
		var fileID string
		if err := rows.Scan(&fileID); err != nil {
			return nil, fmt.Errorf("scan tag file id: %w", err)
		}
		ids = append(ids, fileID)
	}
	return ids, rows.Err()
}

var ErrFileNotFoundInLibrary = errors.New("file not found")
