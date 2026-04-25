package library

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"drft/internal/auth"
	"drft/internal/http/response"
	"drft/internal/media"
)

type Handler struct {
	logger *slog.Logger
	auth   *auth.Handler
	store  *Store
	media  *media.Store
}

func NewHandler(logger *slog.Logger, authHandler *auth.Handler, db *sql.DB) *Handler {
	return &Handler{
		logger: logger,
		auth:   authHandler,
		store:  NewStore(db),
		media:  media.NewStore(db),
	}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/albums", h.handleAlbums)
	mux.HandleFunc("/api/v1/albums/", h.handleAlbumByID)
	mux.HandleFunc("/api/v1/tags", h.handleTags)
	mux.HandleFunc("/api/v1/tags/", h.handleTagByID)
	mux.HandleFunc("/api/v1/files/", h.handleFileRelations)
}

func (h *Handler) handleAlbums(w http.ResponseWriter, r *http.Request) {
	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	switch r.Method {
	case http.MethodGet:
		albums, err := h.store.ListAlbumsByUser(r.Context(), user.ID)
		if err != nil {
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]any{"albums": serializeAlbums(albums)})
	case http.MethodPost:
		var payload struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" {
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": "album name is required"})
			return
		}
		album, err := h.store.CreateAlbum(r.Context(), user.ID, payload.Name, payload.Description)
		if err != nil {
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusCreated, map[string]any{"album": serializeAlbum(album)})
	default:
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *Handler) handleAlbumByID(w http.ResponseWriter, r *http.Request) {
	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/v1/albums/")
	if path == "" {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "album id is required"})
		return
	}

	if strings.HasSuffix(path, "/files") {
		albumID := strings.TrimSuffix(path, "/files")
		if r.Method != http.MethodPost {
			response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		var payload struct {
			FileIDs []string `json:"fileIds"`
		}
		if err := decodeJSON(r, &payload); err != nil || len(payload.FileIDs) == 0 {
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": "fileIds are required"})
			return
		}
		if err := h.store.AddFilesToAlbum(r.Context(), user.ID, albumID, payload.FileIDs); err != nil {
			if errors.Is(err, ErrAlbumNotFound) {
				response.JSON(w, http.StatusNotFound, map[string]string{"error": "album not found"})
				return
			}
			h.serverError(w, err)
			return
		}
		album, err := h.store.GetAlbumByID(r.Context(), user.ID, albumID)
		if err != nil {
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]any{"album": serializeAlbum(album)})
		return
	}

	if strings.Contains(path, "/files/") {
		parts := strings.SplitN(path, "/files/", 2)
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid album file path"})
			return
		}
		if r.Method != http.MethodDelete {
			response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		if err := h.store.RemoveFileFromAlbum(r.Context(), user.ID, parts[0], parts[1]); err != nil {
			if errors.Is(err, ErrAlbumNotFound) {
				response.JSON(w, http.StatusNotFound, map[string]string{"error": "album not found"})
				return
			}
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]bool{"success": true})
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.respondWithAlbum(w, r, user.ID, path)
	case http.MethodPatch:
		var payload struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" {
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": "album name is required"})
			return
		}
		album, err := h.store.UpdateAlbum(r.Context(), user.ID, path, payload.Name, payload.Description)
		if errors.Is(err, ErrAlbumNotFound) {
			response.JSON(w, http.StatusNotFound, map[string]string{"error": "album not found"})
			return
		}
		if err != nil {
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]any{"album": serializeAlbum(album)})
	case http.MethodDelete:
		if err := h.store.DeleteAlbum(r.Context(), user.ID, path); err != nil {
			if errors.Is(err, ErrAlbumNotFound) {
				response.JSON(w, http.StatusNotFound, map[string]string{"error": "album not found"})
				return
			}
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]bool{"success": true})
	default:
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *Handler) respondWithAlbum(w http.ResponseWriter, r *http.Request, userID, albumID string) {
	album, err := h.store.GetAlbumByID(r.Context(), userID, albumID)
	if errors.Is(err, ErrAlbumNotFound) {
		response.JSON(w, http.StatusNotFound, map[string]string{"error": "album not found"})
		return
	}
	if err != nil {
		h.serverError(w, err)
		return
	}
	fileIDs, err := h.store.ListAlbumFiles(r.Context(), userID, albumID)
	if err != nil {
		h.serverError(w, err)
		return
	}
	filePage, err := h.media.ListFilesByUser(r.Context(), userID, 10000, 0)
	if err != nil {
		h.serverError(w, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"album": serializeAlbum(album),
		"items": filterSerializedFiles(filePage.Files, fileIDs),
	})
}

func (h *Handler) handleTags(w http.ResponseWriter, r *http.Request) {
	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	switch r.Method {
	case http.MethodGet:
		tags, err := h.store.ListTagsByUser(r.Context(), user.ID)
		if err != nil {
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]any{"tags": serializeTags(tags)})
	case http.MethodPost:
		var payload struct {
			Name  string `json:"name"`
			Color string `json:"color"`
		}
		if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" {
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": "tag name is required"})
			return
		}
		tag, err := h.store.CreateTag(r.Context(), user.ID, payload.Name, payload.Color)
		if err != nil {
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusCreated, map[string]any{"tag": serializeTag(tag)})
	default:
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *Handler) handleTagByID(w http.ResponseWriter, r *http.Request) {
	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	tagID := strings.TrimPrefix(r.URL.Path, "/api/v1/tags/")
	if tagID == "" {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "tag id is required"})
		return
	}

	switch r.Method {
	case http.MethodGet:
		tag, err := h.store.GetTagByID(r.Context(), user.ID, tagID)
		if errors.Is(err, ErrTagNotFound) {
			response.JSON(w, http.StatusNotFound, map[string]string{"error": "tag not found"})
			return
		}
		if err != nil {
			h.serverError(w, err)
			return
		}
		fileIDs, err := h.store.ListTagFileIDs(r.Context(), user.ID, tagID)
		if err != nil {
			h.serverError(w, err)
			return
		}
		filePage, err := h.media.ListFilesByUser(r.Context(), user.ID, 10000, 0)
		if err != nil {
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]any{
			"tag":   serializeTag(tag),
			"items": filterSerializedFiles(filePage.Files, fileIDs),
		})
	case http.MethodPatch:
		var payload struct {
			Name  string `json:"name"`
			Color string `json:"color"`
		}
		if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" {
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": "tag name is required"})
			return
		}
		tag, err := h.store.UpdateTag(r.Context(), user.ID, tagID, payload.Name, payload.Color)
		if errors.Is(err, ErrTagNotFound) {
			response.JSON(w, http.StatusNotFound, map[string]string{"error": "tag not found"})
			return
		}
		if err != nil {
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]any{"tag": serializeTag(tag)})
	case http.MethodDelete:
		if err := h.store.DeleteTag(r.Context(), user.ID, tagID); err != nil {
			if errors.Is(err, ErrTagNotFound) {
				response.JSON(w, http.StatusNotFound, map[string]string{"error": "tag not found"})
				return
			}
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]bool{"success": true})
	default:
		response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (h *Handler) handleFileRelations(w http.ResponseWriter, r *http.Request) {
	if !strings.HasSuffix(r.URL.Path, "/tags") && !strings.Contains(r.URL.Path, "/tags/") {
		return
	}

	user, err := h.auth.Authenticate(r)
	if err != nil {
		response.JSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/v1/files/")
	if strings.HasSuffix(path, "/tags") {
		if r.Method != http.MethodPost {
			response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		fileID := strings.TrimSuffix(path, "/tags")
		var payload struct {
			TagID string `json:"tagId"`
		}
		if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.TagID) == "" {
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": "tagId is required"})
			return
		}
		if err := h.store.AddTagToFile(r.Context(), user.ID, fileID, payload.TagID); err != nil {
			switch {
			case errors.Is(err, ErrTagNotFound):
				response.JSON(w, http.StatusNotFound, map[string]string{"error": "tag not found"})
			case errors.Is(err, ErrFileNotFoundInLibrary):
				response.JSON(w, http.StatusNotFound, map[string]string{"error": "file not found"})
			default:
				h.serverError(w, err)
			}
			return
		}
		response.JSON(w, http.StatusOK, map[string]bool{"success": true})
		return
	}

	if strings.Contains(path, "/tags/") {
		if r.Method != http.MethodDelete {
			response.JSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		parts := strings.SplitN(path, "/tags/", 2)
		if len(parts) != 2 {
			response.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid tag removal path"})
			return
		}
		if err := h.store.RemoveTagFromFile(r.Context(), user.ID, parts[0], parts[1]); err != nil {
			if errors.Is(err, ErrTagNotFound) {
				response.JSON(w, http.StatusNotFound, map[string]string{"error": "tag not found"})
				return
			}
			h.serverError(w, err)
			return
		}
		response.JSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func decodeJSON(r *http.Request, target any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(target)
}

func serializeAlbum(album Album) map[string]any {
	return map[string]any{
		"id":          album.ID,
		"name":        album.Name,
		"description": album.Description,
		"coverFileId": nullableString(album.CoverFileID),
		"fileCount":   album.FileCount,
		"createdAt":   album.CreatedAt.UTC().Format(time.RFC3339),
		"updatedAt":   album.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func serializeAlbums(albums []Album) []map[string]any {
	items := make([]map[string]any, 0, len(albums))
	for _, album := range albums {
		items = append(items, serializeAlbum(album))
	}
	return items
}

func serializeTag(tag Tag) map[string]any {
	return map[string]any{
		"id":        tag.ID,
		"name":      tag.Name,
		"color":     tag.Color,
		"fileCount": tag.FileCount,
		"createdAt": tag.CreatedAt.UTC().Format(time.RFC3339),
		"updatedAt": tag.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func serializeTags(tags []Tag) []map[string]any {
	items := make([]map[string]any, 0, len(tags))
	for _, tag := range tags {
		items = append(items, serializeTag(tag))
	}
	return items
}

func filterSerializedFiles(files []media.File, fileIDs []string) []map[string]any {
	if len(fileIDs) == 0 {
		return []map[string]any{}
	}
	lookup := make(map[string]media.File, len(files))
	for _, file := range files {
		lookup[file.ID] = file
	}
	items := make([]map[string]any, 0, len(fileIDs))
	for _, fileID := range fileIDs {
		file, ok := lookup[fileID]
		if !ok {
			continue
		}
		items = append(items, serializeMediaFile(file))
	}
	return items
}

func serializeMediaFile(file media.File) map[string]any {
	takenAt := file.CreatedAt
	if file.TakenAt.Valid {
		takenAt = file.TakenAt.Time
	}
	return map[string]any{
		"id":          file.ID,
		"fileName":    file.FileName,
		"downloadName": buildLibraryDownloadName(file),
		"mediaType":   file.MediaType,
		"mimeType":    file.MIMEType,
		"sizeBytes":   file.SizeBytes,
		"widthPx":     nullableInt(file.WidthPX),
		"heightPx":    nullableInt(file.HeightPX),
		"durationMs":  nullableInt(file.DurationMS),
		"takenAt":     takenAt.UTC().Format(time.RFC3339),
		"createdAt":   file.CreatedAt.UTC().Format(time.RFC3339),
		"previewUrl":  "/api/v1/file/" + file.ID + "?variant=preview",
		"downloadUrl": "/api/v1/file/" + file.ID,
	}
}

func buildLibraryDownloadName(file media.File) string {
	if strings.TrimSpace(file.OriginalExtension) == "" {
		return file.FileName
	}
	return file.FileName + "." + strings.TrimPrefix(file.OriginalExtension, ".")
}

func nullableString(value sql.NullString) any {
	if value.Valid {
		return value.String
	}
	return nil
}

func nullableInt(value sql.NullInt64) any {
	if value.Valid {
		return value.Int64
	}
	return nil
}

func (h *Handler) serverError(w http.ResponseWriter, err error) {
	h.logger.Error("library request failed", "error", err)
	response.JSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
}
