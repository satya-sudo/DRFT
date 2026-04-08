package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

type TokenManager struct {
	secret []byte
}

type Claims struct {
	Subject string `json:"sub"`
	Email   string `json:"email"`
	Role    string `json:"role"`
	Expiry  int64  `json:"exp"`
}

func NewTokenManager(secret string) *TokenManager {
	return &TokenManager{secret: []byte(secret)}
}

func (m *TokenManager) Issue(user User) (string, error) {
	header, err := json.Marshal(map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	})
	if err != nil {
		return "", fmt.Errorf("marshal token header: %w", err)
	}

	claims, err := json.Marshal(Claims{
		Subject: user.ID,
		Email:   user.Email,
		Role:    string(user.Role),
		Expiry:  time.Now().Add(7 * 24 * time.Hour).Unix(),
	})
	if err != nil {
		return "", fmt.Errorf("marshal token claims: %w", err)
	}

	unsignedToken := encodeSegment(header) + "." + encodeSegment(claims)
	signature := m.sign(unsignedToken)

	return unsignedToken + "." + signature, nil
}

func (m *TokenManager) Parse(token string) (Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return Claims{}, errors.New("invalid token format")
	}

	unsignedToken := parts[0] + "." + parts[1]
	expectedSignature := m.sign(unsignedToken)
	if !hmac.Equal([]byte(expectedSignature), []byte(parts[2])) {
		return Claims{}, errors.New("invalid token signature")
	}

	var claims Claims
	payload, err := decodeSegment(parts[1])
	if err != nil {
		return Claims{}, fmt.Errorf("decode token payload: %w", err)
	}

	if err := json.Unmarshal(payload, &claims); err != nil {
		return Claims{}, fmt.Errorf("unmarshal token claims: %w", err)
	}

	if time.Now().Unix() > claims.Expiry {
		return Claims{}, errors.New("token expired")
	}

	return claims, nil
}

func (m *TokenManager) UserFromRequest(ctx context.Context, header string, store *Store) (User, error) {
	return m.UserFromToken(ctx, extractBearerToken(header), store)
}

func (m *TokenManager) UserFromToken(ctx context.Context, token string, store *Store) (User, error) {
	if token == "" {
		return User{}, errors.New("missing bearer token")
	}

	claims, err := m.Parse(token)
	if err != nil {
		return User{}, err
	}

	return store.GetUserByID(ctx, claims.Subject)
}

func (m *TokenManager) sign(value string) string {
	mac := hmac.New(sha256.New, m.secret)
	mac.Write([]byte(value))
	return encodeSegment(mac.Sum(nil))
}

func extractBearerToken(header string) string {
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}

	return strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
}

func encodeSegment(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}

func decodeSegment(data string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(data)
}
