package media

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"drft/internal/http/response"
)

const defaultChunkSizeBytes int64 = 2 << 20

type chunkUploadSession struct {
	ID           string    `json:"id"`
	UserID       string    `json:"userId"`
	FileName     string    `json:"fileName"`
	SizeBytes    int64     `json:"sizeBytes"`
	MIMEType     string    `json:"mimeType"`
	TakenAt      string    `json:"takenAt,omitempty"`
	ChunkSize    int64     `json:"chunkSize"`
	TotalChunks  int       `json:"totalChunks"`
	Received     []int     `json:"received"`
	CreatedAtUTC time.Time `json:"createdAtUtc"`
}

func uploadsRoot(storageRoot string) string {
	return filepath.Join(storageRoot, ".uploads")
}

func uploadSessionDir(storageRoot, uploadID string) string {
	return filepath.Join(uploadsRoot(storageRoot), uploadID)
}

func uploadSessionPath(storageRoot, uploadID string) string {
	return filepath.Join(uploadSessionDir(storageRoot, uploadID), "session.json")
}

func uploadChunkPath(storageRoot, uploadID string, index int) string {
	return filepath.Join(uploadSessionDir(storageRoot, uploadID), "chunks", fmt.Sprintf("%06d.part", index))
}

func createChunkUploadSession(storageRoot string, session chunkUploadSession) error {
	sessionDir := uploadSessionDir(storageRoot, session.ID)
	if err := os.MkdirAll(filepath.Join(sessionDir, "chunks"), 0o755); err != nil {
		return fmt.Errorf("create upload session directory: %w", err)
	}

	return saveChunkUploadSession(storageRoot, session)
}

func saveChunkUploadSession(storageRoot string, session chunkUploadSession) error {
	body, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal upload session: %w", err)
	}

	if err := os.WriteFile(uploadSessionPath(storageRoot, session.ID), body, 0o644); err != nil {
		return fmt.Errorf("write upload session: %w", err)
	}

	return nil
}

func loadChunkUploadSession(storageRoot, uploadID string) (chunkUploadSession, error) {
	body, err := os.ReadFile(uploadSessionPath(storageRoot, uploadID))
	if err != nil {
		return chunkUploadSession{}, fmt.Errorf("read upload session: %w", err)
	}

	var session chunkUploadSession
	if err := json.Unmarshal(body, &session); err != nil {
		return chunkUploadSession{}, fmt.Errorf("unmarshal upload session: %w", err)
	}

	return session, nil
}

func deleteChunkUploadSession(storageRoot, uploadID string) error {
	if err := os.RemoveAll(uploadSessionDir(storageRoot, uploadID)); err != nil {
		return fmt.Errorf("remove upload session: %w", err)
	}

	return nil
}

func writeChunkFile(storageRoot, uploadID string, index int, source io.Reader, maxBytes int64) (int64, error) {
	chunkPath := uploadChunkPath(storageRoot, uploadID, index)
	if err := os.MkdirAll(filepath.Dir(chunkPath), 0o755); err != nil {
		return 0, fmt.Errorf("create chunk directory: %w", err)
	}

	destination, err := os.Create(chunkPath)
	if err != nil {
		return 0, fmt.Errorf("create chunk file: %w", err)
	}
	defer destination.Close()

	written, err := io.Copy(destination, io.LimitReader(source, maxBytes+1))
	if err != nil {
		return 0, fmt.Errorf("write chunk file: %w", err)
	}
	if written > maxBytes {
		return 0, fmt.Errorf("chunk exceeds expected size")
	}

	return written, nil
}

func appendChunkIfMissing(session *chunkUploadSession, index int) bool {
	if slices.Contains(session.Received, index) {
		return false
	}

	session.Received = append(session.Received, index)
	slices.Sort(session.Received)
	return true
}

func sessionIsComplete(session chunkUploadSession) bool {
	if len(session.Received) != session.TotalChunks {
		return false
	}

	for index := 0; index < session.TotalChunks; index++ {
		if session.Received[index] != index {
			return false
		}
	}

	return true
}

func mergeChunkUpload(storageRoot string, session chunkUploadSession) (string, error) {
	mergedPath := mergedUploadPath(storageRoot, session.ID)
	destination, err := os.Create(mergedPath)
	if err != nil {
		return "", fmt.Errorf("create merged upload file: %w", err)
	}
	defer destination.Close()

	for index := 0; index < session.TotalChunks; index++ {
		chunkFile, err := os.Open(uploadChunkPath(storageRoot, session.ID, index))
		if err != nil {
			return "", fmt.Errorf("open chunk %d: %w", index, err)
		}

		if _, err := io.Copy(destination, chunkFile); err != nil {
			chunkFile.Close()
			return "", fmt.Errorf("merge chunk %d: %w", index, err)
		}
		chunkFile.Close()
	}

	return mergedPath, nil
}

func parseChunkIndexFromPath(path string) (string, int, error) {
	trimmed := filepath.ToSlash(path)
	trimmed = strings.TrimPrefix(trimmed, "/api/v1/uploads/")
	parts := strings.Split(trimmed, "/")
	if len(parts) != 3 || parts[1] != "chunks" {
		return "", 0, fmt.Errorf("invalid upload chunk path")
	}

	index, err := strconv.Atoi(parts[2])
	if err != nil {
		return "", 0, fmt.Errorf("invalid chunk index")
	}

	return parts[0], index, nil
}

func chunkBytesForIndex(session chunkUploadSession, index int) int64 {
	if index < 0 || index >= session.TotalChunks {
		return 0
	}

	if index == session.TotalChunks-1 {
		remainder := session.SizeBytes % session.ChunkSize
		if remainder > 0 {
			return remainder
		}
	}

	return session.ChunkSize
}

func writeUploadMethodNotAllowed(w http.ResponseWriter) {
	response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
}
