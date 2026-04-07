package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrUserNotFound = errors.New("user not found")

type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	Role         Role      `json:"role"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) HasAdmin(ctx context.Context) (bool, error) {
	var exists bool

	err := s.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM users
			WHERE role = 'admin'
		)
	`).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check admin exists: %w", err)
	}

	return exists, nil
}

func (s *Store) CreateUser(ctx context.Context, input CreateUserInput) (User, error) {
	var user User

	err := s.db.QueryRowContext(ctx, `
		INSERT INTO users (name, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, email, role, password_hash, created_at
	`, strings.TrimSpace(input.Name), normalizeEmail(input.Email), input.PasswordHash, input.Role).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Role,
		&user.PasswordHash,
		&user.CreatedAt,
	)
	if err != nil {
		return User{}, fmt.Errorf("create user: %w", err)
	}

	return user, nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (User, error) {
	return s.getUser(ctx, `
		SELECT id, name, email, role, password_hash, created_at
		FROM users
		WHERE email = $1
	`, normalizeEmail(email))
}

func (s *Store) GetUserByID(ctx context.Context, id string) (User, error) {
	return s.getUser(ctx, `
		SELECT id, name, email, role, password_hash, created_at
		FROM users
		WHERE id = $1
	`, id)
}

func (s *Store) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, email, role, password_hash, created_at
		FROM users
		ORDER BY created_at DESC, id DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	users := make([]User, 0)
	for rows.Next() {
		var user User
		if err := rows.Scan(
			&user.ID,
			&user.Name,
			&user.Email,
			&user.Role,
			&user.PasswordHash,
			&user.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}

		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users: %w", err)
	}

	return users, nil
}

func (s *Store) DeleteUser(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("delete user rows affected: %w", err)
	}

	if affected == 0 {
		return ErrUserNotFound
	}

	return nil
}

func (s *Store) UpdatePasswordHashByEmail(ctx context.Context, email, passwordHash string) error {
	result, err := s.db.ExecContext(ctx, `
		UPDATE users
		SET password_hash = $2
		WHERE email = $1
	`, normalizeEmail(email), passwordHash)
	if err != nil {
		return fmt.Errorf("update password by email: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("password update rows affected: %w", err)
	}
	if affected == 0 {
		return ErrUserNotFound
	}

	return nil
}

func (s *Store) UpdatePasswordHashByUserID(ctx context.Context, userID, passwordHash string) error {
	result, err := s.db.ExecContext(ctx, `
		UPDATE users
		SET password_hash = $2
		WHERE id = $1
	`, userID, passwordHash)
	if err != nil {
		return fmt.Errorf("update password by user id: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("password update rows affected: %w", err)
	}
	if affected == 0 {
		return ErrUserNotFound
	}

	return nil
}

func (s *Store) CountAdmins(ctx context.Context) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE role = 'admin'`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count admins: %w", err)
	}

	return count, nil
}

func (s *Store) CreatePasswordResetCode(ctx context.Context, userID, codeHash string, expiresAt time.Time) error {
	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, codeHash, expiresAt); err != nil {
		return fmt.Errorf("create password reset code: %w", err)
	}

	return nil
}

func (s *Store) ConsumePasswordResetCode(ctx context.Context, email, codeHash string, now time.Time) (User, string, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return User{}, "", fmt.Errorf("begin consume reset code tx: %w", err)
	}
	defer tx.Rollback()

	var user User
	var resetCodeID string
	err = tx.QueryRowContext(ctx, `
		SELECT u.id, u.name, u.email, u.role, u.password_hash, u.created_at, prc.id
		FROM password_reset_codes prc
		JOIN users u ON u.id = prc.user_id
		WHERE u.email = $1
		  AND prc.code_hash = $2
		  AND prc.consumed_at IS NULL
		  AND prc.expires_at > $3
		ORDER BY prc.created_at DESC
		LIMIT 1
	`, email, codeHash, now).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Role,
		&user.PasswordHash,
		&user.CreatedAt,
		&resetCodeID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, "", ErrResetCodeNotFound
	}
	if err != nil {
		return User{}, "", fmt.Errorf("load password reset code: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE password_reset_codes
		SET consumed_at = $2
		WHERE id = $1
	`, resetCodeID, now); err != nil {
		return User{}, "", fmt.Errorf("consume password reset code: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return User{}, "", fmt.Errorf("commit password reset code tx: %w", err)
	}

	return user, resetCodeID, nil
}

func (s *Store) DeleteAllPasswordResetCodesForUser(ctx context.Context, userID string) error {
	if _, err := s.db.ExecContext(ctx, `
		DELETE FROM password_reset_codes
		WHERE user_id = $1
	`, userID); err != nil {
		return fmt.Errorf("delete password reset codes: %w", err)
	}

	return nil
}

func (s *Store) getUser(ctx context.Context, query string, arg string) (User, error) {
	var user User

	err := s.db.QueryRowContext(ctx, query, arg).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.Role,
		&user.PasswordHash,
		&user.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("get user: %w", err)
	}

	return user, nil
}

func normalizeEmail(value string) string {
	return strings.TrimSpace(strings.ToLower(value))
}

type CreateUserInput struct {
	Name         string
	Email        string
	PasswordHash string
	Role         Role
}
