package media

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"drft/internal/auth"
	"drft/internal/config"
	"drft/internal/http/response"
	"github.com/lib/pq"
)

type Handler struct {
	cfg    config.Config
	logger *slog.Logger
	auth   *auth.Handler
	store  *Store
}

func NewHandler(cfg config.Config, logger *slog.Logger, authHandler *auth.Handler, db *sql.DB) *Handler {
	return &Handler{
		cfg:    cfg,
		logger: logger,
		auth:   authHandler,
		store:  NewStore(db),
	}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/upload", h.handleUpload)
	mux.HandleFunc("/api/v1/uploads/init", h.handleChunkUploadInit)
	mux.HandleFunc("/api/v1/uploads/", h.handleChunkUploadByID)
	mux.HandleFunc("/api/v1/files", h.handleListFiles)
	mux.HandleFunc("/api/v1/storage/stats", h.handleStorageStats)
	mux.HandleFunc("/api/v1/file/", h.handleFileByID)
}

func (h *Handler) handleListFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	limit := 40
	offset := 0
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("offset")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	page, err := h.store.ListFilesByUser(r.Context(), user.ID, limit, offset)
	if err != nil {
		h.serverError(w, err)
		return
	}

	items := make([]map[string]any, 0, len(page.Files))
	for _, file := range page.Files {
		items = append(items, h.serializeFile(file))
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"items": items,
		"pagination": map[string]any{
			"limit":      limit,
			"offset":     offset,
			"nextOffset": page.NextOffset,
			"hasMore":    page.HasMore,
		},
	})
}

func (h *Handler) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, h.cfg.MaxUploadSizeBytes)
	if err := r.ParseMultipartForm(h.cfg.MaxUploadSizeBytes); err != nil {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "upload could not be parsed"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "multipart field `file` is required"})
		return
	}
	defer file.Close()

	takenAt := parseOptionalTime(r.FormValue("taken_at"))
	createdFile, err := h.ingestMedia(r.Context(), user.ID, header.Filename, takenAt, file)
	if err != nil {
		h.writeIngestError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, map[string]any{
		"item": h.serializeFile(createdFile),
	})
}

func (h *Handler) handleChunkUploadInit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeUploadMethodNotAllowed(w)
		return
	}

	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var payload struct {
		FileName  string `json:"fileName"`
		SizeBytes int64  `json:"sizeBytes"`
		MIMEType  string `json:"mimeType"`
		TakenAt   string `json:"takenAt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "upload session payload is invalid"})
		return
	}
	if strings.TrimSpace(payload.FileName) == "" || payload.SizeBytes <= 0 {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "file name and size are required"})
		return
	}

	uploadID, err := generateID()
	if err != nil {
		h.serverError(w, err)
		return
	}

	totalChunks := int((payload.SizeBytes + defaultChunkSizeBytes - 1) / defaultChunkSizeBytes)
	session := chunkUploadSession{
		ID:           uploadID,
		UserID:       user.ID,
		FileName:     payload.FileName,
		SizeBytes:    payload.SizeBytes,
		MIMEType:     payload.MIMEType,
		TakenAt:      payload.TakenAt,
		ChunkSize:    defaultChunkSizeBytes,
		TotalChunks:  totalChunks,
		Received:     []int{},
		CreatedAtUTC: time.Now().UTC(),
	}

	if err := createChunkUploadSession(h.cfg.StorageRoot, session); err != nil {
		h.serverError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, map[string]any{
		"uploadId":   session.ID,
		"chunkSize":  session.ChunkSize,
		"totalChunks": session.TotalChunks,
	})
}

func (h *Handler) handleChunkUploadByID(w http.ResponseWriter, r *http.Request) {
	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	trimmed := strings.TrimPrefix(r.URL.Path, "/api/v1/uploads/")
	if trimmed == "" {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "upload id is required"})
		return
	}

	switch {
	case strings.HasSuffix(trimmed, "/complete"):
		uploadID := strings.TrimSuffix(trimmed, "/complete")
		h.handleChunkUploadComplete(w, r, user.ID, strings.TrimSuffix(uploadID, "/"))
	case strings.Contains(trimmed, "/chunks/"):
		uploadID, chunkIndex, err := parseChunkIndexFromPath(r.URL.Path)
		if err != nil {
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		h.handleChunkUploadChunk(w, r, user.ID, uploadID, chunkIndex)
	default:
		if r.Method == http.MethodDelete {
			h.handleChunkUploadCancel(w, r, user.ID, strings.TrimSuffix(trimmed, "/"))
			return
		}
		writeUploadMethodNotAllowed(w)
	}
}

func (h *Handler) handleChunkUploadChunk(w http.ResponseWriter, r *http.Request, userID, uploadID string, chunkIndex int) {
	if r.Method != http.MethodPut {
		writeUploadMethodNotAllowed(w)
		return
	}

	session, err := loadChunkUploadSession(h.cfg.StorageRoot, uploadID)
	if err != nil {
		response.JSON(w, http.StatusNotFound, map[string]string{"error": "upload session not found"})
		return
	}
	if session.UserID != userID {
		response.JSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	if chunkIndex < 0 || chunkIndex >= session.TotalChunks {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "chunk index is out of range"})
		return
	}

	expectedBytes := chunkBytesForIndex(session, chunkIndex)
	if _, err := writeChunkFile(h.cfg.StorageRoot, uploadID, chunkIndex, r.Body, expectedBytes); err != nil {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	appendChunkIfMissing(&session, chunkIndex)
	if err := saveChunkUploadSession(h.cfg.StorageRoot, session); err != nil {
		h.serverError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"uploadId":      session.ID,
		"receivedCount": len(session.Received),
		"totalChunks":   session.TotalChunks,
	})
}

func (h *Handler) handleChunkUploadComplete(w http.ResponseWriter, r *http.Request, userID, uploadID string) {
	if r.Method != http.MethodPost {
		writeUploadMethodNotAllowed(w)
		return
	}

	session, err := loadChunkUploadSession(h.cfg.StorageRoot, uploadID)
	if err != nil {
		response.JSON(w, http.StatusNotFound, map[string]string{"error": "upload session not found"})
		return
	}
	if session.UserID != userID {
		response.JSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	if !sessionIsComplete(session) {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "upload is missing one or more chunks"})
		return
	}

	mergedPath, err := mergeChunkUpload(h.cfg.StorageRoot, session)
	if err != nil {
		h.serverError(w, err)
		return
	}
	defer func() {
		_ = deleteChunkUploadSession(h.cfg.StorageRoot, uploadID)
	}()

	mergedFile, err := os.Open(mergedPath)
	if err != nil {
		h.serverError(w, err)
		return
	}
	defer mergedFile.Close()

	takenAt := parseOptionalTime(session.TakenAt)
	createdFile, err := h.ingestMedia(r.Context(), userID, session.FileName, takenAt, mergedFile)
	if err != nil {
		h.writeIngestError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, map[string]any{
		"item": h.serializeFile(createdFile),
	})
}

func (h *Handler) handleChunkUploadCancel(w http.ResponseWriter, r *http.Request, userID, uploadID string) {
	if r.Method != http.MethodDelete {
		writeUploadMethodNotAllowed(w)
		return
	}

	session, err := loadChunkUploadSession(h.cfg.StorageRoot, uploadID)
	if err != nil {
		response.JSON(w, http.StatusNotFound, map[string]string{"error": "upload session not found"})
		return
	}
	if session.UserID != userID {
		response.JSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}
	if err := deleteChunkUploadSession(h.cfg.StorageRoot, uploadID); err != nil {
		h.serverError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) handleStorageStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	stats, err := readStorageStats(h.cfg.StorageRoot)
	if err != nil {
		h.serverError(w, err)
		return
	}
	userUsedBytes, err := h.store.SumActiveFileBytesByUser(r.Context(), user.ID)
	if err != nil {
		h.serverError(w, err)
		return
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"drftUsedBytes":  userUsedBytes,
		"availableBytes": stats.AvailableBytes,
		"totalBytes":     stats.TotalBytes,
	})
}

func (h *Handler) handleFileByID(w http.ResponseWriter, r *http.Request) {
	user, err := h.auth.AuthenticateMedia(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	fileID := strings.TrimPrefix(r.URL.Path, "/api/v1/file/")
	if fileID == "" {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "file id is required"})
		return
	}

	file, err := h.store.GetFileByID(r.Context(), user.ID, fileID)
	if errors.Is(err, ErrFileNotFound) {
		response.JSON(w, http.StatusNotFound, map[string]string{"error": "file not found"})
		return
	}
	if err != nil {
		h.serverError(w, err)
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.serveFile(w, r, file)
	case http.MethodDelete:
		h.deleteFile(w, r, file)
	default:
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *Handler) serveFile(w http.ResponseWriter, r *http.Request, file File) {
	fullPath := filepath.Join(h.cfg.StorageRoot, file.StorageKey)
	contentType := file.MIMEType
	fileName := file.FileName

	if r.URL.Query().Get("variant") == "preview" {
		if file.ThumbnailKey.Valid {
			fullPath = filepath.Join(h.cfg.StorageRoot, file.ThumbnailKey.String)
			contentType = "image/jpeg"
			fileName = file.FileName + "-preview.jpg"
		} else if file.MediaType == "video" {
			response.JSON(w, http.StatusNotFound, map[string]string{"error": "preview unavailable"})
			return
		}
	}

	handle, err := os.Open(fullPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			response.JSON(w, http.StatusNotFound, map[string]string{"error": "file missing from storage"})
			return
		}
		h.serverError(w, err)
		return
	}
	defer handle.Close()

	info, err := handle.Stat()
	if err != nil {
		h.serverError(w, err)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=60")
	http.ServeContent(w, r, fileName, info.ModTime(), handle)
}

func (h *Handler) deleteFile(w http.ResponseWriter, r *http.Request, file File) {
	fullPath := filepath.Join(h.cfg.StorageRoot, file.StorageKey)

	if err := h.store.MarkDeleted(r.Context(), file.UserID, file.ID); err != nil {
		if errors.Is(err, ErrFileNotFound) {
			response.JSON(w, http.StatusNotFound, map[string]string{"error": "file not found"})
			return
		}
		h.serverError(w, err)
		return
	}

	if err := removeFileIfExists(fullPath); err != nil {
		h.logger.Error("remove stored file", "error", err, "path", fullPath)
	}
	if file.ThumbnailKey.Valid {
		if err := removeFileIfExists(filepath.Join(h.cfg.StorageRoot, file.ThumbnailKey.String)); err != nil {
			h.logger.Error("remove thumbnail file", "error", err, "path", file.ThumbnailKey.String)
		}
	}

	response.JSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handler) serializeFile(file File) map[string]any {
	takenAt := file.CreatedAt
	if file.TakenAt.Valid {
		takenAt = file.TakenAt.Time
	}

	return map[string]any{
		"id":          file.ID,
		"fileName":    file.FileName,
		"mediaType":   file.MediaType,
		"mimeType":    file.MIMEType,
		"sizeBytes":   file.SizeBytes,
		"widthPx":     nullableInt(file.WidthPX),
		"heightPx":    nullableInt(file.HeightPX),
		"durationMs":  nullableInt(file.DurationMS),
		"takenAt":     takenAt.UTC().Format(time.RFC3339),
		"createdAt":   file.CreatedAt.UTC().Format(time.RFC3339),
		"previewUrl":  fmt.Sprintf("/api/v1/file/%s?variant=preview", file.ID),
		"downloadUrl": fmt.Sprintf("/api/v1/file/%s", file.ID),
	}
}

func (h *Handler) ingestMedia(ctx context.Context, userID, originalFileName string, takenAt *time.Time, source io.Reader) (File, error) {
	fileID, err := generateID()
	if err != nil {
		return File{}, err
	}

	originalExt := filepath.Ext(originalFileName)
	storageKey := buildStorageKey(fileID, originalExt)

	bufferedFile, err := prepareUpload(source)
	if err != nil {
		return File{}, err
	}

	mediaType := mediaTypeFromMIME(bufferedFile.MIMEType)
	if mediaType == "" {
		return File{}, fmt.Errorf("only image and video uploads are supported")
	}

	savedPath, writtenBytes, err := writeFile(h.cfg.StorageRoot, storageKey, bufferedFile.Reader)
	if err != nil {
		return File{}, err
	}

	checksum, err := computeSHA256(savedPath)
	if err != nil {
		_ = removeFileIfExists(savedPath)
		return File{}, err
	}

	metadata, err := extractMetadata(savedPath, mediaType)
	if err != nil {
		_ = removeFileIfExists(savedPath)
		return File{}, fmt.Errorf("uploaded file could not be processed")
	}

	thumbnailKey := ""
	switch mediaType {
	case "image":
		thumbnailKey, err = generateImageThumbnail(h.cfg.StorageRoot, savedPath, fileID)
		if err != nil {
			h.logger.Warn("thumbnail generation failed", "error", err, "path", savedPath, "media_type", mediaType)
		}
	case "video":
		thumbnailKey, err = generateVideoThumbnail(h.cfg.StorageRoot, savedPath, fileID)
		if err != nil {
			h.logger.Warn("video thumbnail generation failed", "error", err, "path", savedPath)
		}
	}

	if takenAt == nil {
		takenAt = metadata.TakenAt
	}
	createdFile, err := h.store.CreateFile(ctx, CreateFileInput{
		UserID:            userID,
		FileName:          fileNameWithoutExt(originalFileName, originalExt),
		OriginalExtension: strings.TrimPrefix(originalExt, "."),
		StorageKey:        storageKey,
		MIMEType:          bufferedFile.MIMEType,
		SizeBytes:         writtenBytes,
		MediaType:         mediaType,
		ChecksumSHA256:    checksum,
		WidthPX:           metadata.WidthPX,
		HeightPX:          metadata.HeightPX,
		DurationMS:        metadata.DurationMS,
		ThumbnailKey:      thumbnailKey,
		TakenAt:           takenAt,
	})
	if err != nil {
		_ = removeFileIfExists(savedPath)
		if thumbnailKey != "" {
			_ = removeFileIfExists(filepath.Join(h.cfg.StorageRoot, thumbnailKey))
		}
		return File{}, err
	}

	return createdFile, nil
}

func (h *Handler) writeIngestError(w http.ResponseWriter, err error) {
	if strings.Contains(err.Error(), "only image and video uploads are supported") ||
		strings.Contains(err.Error(), "uploaded file could not be processed") ||
		strings.Contains(err.Error(), "chunk exceeds expected size") {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	h.writeStoreError(w, err)
}

func (h *Handler) writeStoreError(w http.ResponseWriter, err error) {
	var pqErr *pq.Error
	switch {
	case errors.As(err, &pqErr) && pqErr.Code == "23505":
		response.JSON(w, http.StatusConflict, map[string]string{"error": "a file with that storage key already exists"})
	default:
		h.serverError(w, err)
	}
}

func (h *Handler) serverError(w http.ResponseWriter, err error) {
	h.logger.Error("media request failed", "error", err)
	response.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
}

func mediaTypeFromMIME(mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return "image"
	case strings.HasPrefix(mimeType, "video/"):
		return "video"
	default:
		return ""
	}
}

func parseOptionalTime(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}

	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil
	}

	return &parsed
}

func generateID() (string, error) {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate file id: %w", err)
	}

	buffer[6] = (buffer[6] & 0x0f) | 0x40
	buffer[8] = (buffer[8] & 0x3f) | 0x80

	encoded := hex.EncodeToString(buffer)
	return fmt.Sprintf("%s-%s-%s-%s-%s",
		encoded[0:8],
		encoded[8:12],
		encoded[12:16],
		encoded[16:20],
		encoded[20:32],
	), nil
}

func fileNameWithoutExt(fileName, extension string) string {
	name := strings.TrimSpace(strings.TrimSuffix(fileName, extension))
	if name == "" {
		return "untitled"
	}

	return name
}

func nullableInt(value sql.NullInt64) any {
	if !value.Valid {
		return nil
	}

	return value.Int64
}
