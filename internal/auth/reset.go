package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrResetCodeNotFound = errors.New("reset code not found")

type ResetManager struct {
	store  *Store
	mailer Mailer
	ttl    time.Duration
}

func NewResetManager(store *Store, mailer Mailer, ttl time.Duration) *ResetManager {
	return &ResetManager{
		store:  store,
		mailer: mailer,
		ttl:    ttl,
	}
}

func (m *ResetManager) Request(ctx context.Context, email string) error {
	user, err := m.store.GetUserByEmail(ctx, email)
	if errors.Is(err, ErrUserNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	code, err := generateResetCode()
	if err != nil {
		return fmt.Errorf("generate reset code: %w", err)
	}

	expiresAt := time.Now().Add(m.ttl)
	if err := m.store.CreatePasswordResetCode(ctx, user.ID, hashResetCode(code), expiresAt); err != nil {
		return err
	}

	if err := m.mailer.SendPasswordResetCode(ctx, user.Email, user.Name, code, expiresAt); err != nil {
		return err
	}

	return nil
}

func (m *ResetManager) Confirm(ctx context.Context, email, code, newPassword string) error {
	if len(newPassword) < 8 {
		return errors.New("password must be at least 8 characters")
	}

	user, resetCodeID, err := m.store.ConsumePasswordResetCode(ctx, normalizeEmail(email), hashResetCode(code), time.Now())
	if err != nil {
		return err
	}

	passwordHash, err := HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	if err := m.store.UpdatePasswordHashByUserID(ctx, user.ID, passwordHash); err != nil {
		return err
	}
	if err := m.store.DeleteAllPasswordResetCodesForUser(ctx, user.ID); err != nil {
		return err
	}
	_ = resetCodeID

	return nil
}

func hashResetCode(code string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

func generateResetCode() (string, error) {
	const digits = "0123456789"
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}

	for index, value := range buf {
		buf[index] = digits[int(value)%len(digits)]
	}

	return string(buf), nil
}

func GenerateMasterPassword() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*"
	buf := make([]byte, 18)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}

	for index, value := range buf {
		buf[index] = alphabet[int(value)%len(alphabet)]
	}

	return string(buf), nil
}
