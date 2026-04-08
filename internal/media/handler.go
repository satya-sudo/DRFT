package media

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
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

	files, err := h.store.ListFilesByUser(r.Context(), user.ID)
	if err != nil {
		h.serverError(w, err)
		return
	}

	items := make([]map[string]any, 0, len(files))
	for _, file := range files {
		items = append(items, h.serializeFile(file))
	}

	response.JSON(w, http.StatusOK, map[string]any{"items": items})
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

	fileID, err := generateID()
	if err != nil {
		h.serverError(w, err)
		return
	}
	originalExt := filepath.Ext(header.Filename)
	storageKey := buildStorageKey(fileID, originalExt)

	bufferedFile, err := prepareUpload(file)
	if err != nil {
		h.serverError(w, err)
		return
	}

	mediaType := mediaTypeFromMIME(bufferedFile.MIMEType)
	if mediaType == "" {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "only image and video uploads are supported"})
		return
	}

	savedPath, writtenBytes, err := writeFile(h.cfg.StorageRoot, storageKey, bufferedFile.Reader)
	if err != nil {
		h.serverError(w, err)
		return
	}

	checksum, err := computeSHA256(savedPath)
	if err != nil {
		_ = removeFileIfExists(savedPath)
		h.serverError(w, err)
		return
	}

	metadata, err := extractMetadata(savedPath, mediaType)
	if err != nil {
		_ = removeFileIfExists(savedPath)
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "uploaded file could not be processed"})
		return
	}

	thumbnailKey := ""
	if mediaType == "image" {
		thumbnailKey, err = generateThumbnail(h.cfg.StorageRoot, savedPath, fileID)
		if err != nil {
			h.logger.Warn("thumbnail generation failed", "error", err, "path", savedPath)
		}
	}

	takenAt := parseOptionalTime(r.FormValue("taken_at"))
	if takenAt == nil {
		takenAt = metadata.TakenAt
	}
	createdFile, err := h.store.CreateFile(r.Context(), CreateFileInput{
		UserID:            user.ID,
		FileName:          fileNameWithoutExt(header.Filename, originalExt),
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
		h.writeStoreError(w, err)
		return
	}

	response.JSON(w, http.StatusCreated, map[string]any{
		"item": h.serializeFile(createdFile),
	})
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

	if r.URL.Query().Get("variant") == "preview" && file.ThumbnailKey.Valid {
		fullPath = filepath.Join(h.cfg.StorageRoot, file.ThumbnailKey.String)
		contentType = "image/jpeg"
		fileName = file.FileName + "-preview.jpg"
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
