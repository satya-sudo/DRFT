package com.drft.mobile.data.network

import com.squareup.moshi.Json

data class HealthResponse(
    @Json(name = "status") val status: String,
    @Json(name = "service") val service: String,
    @Json(name = "version") val version: String,
    @Json(name = "env") val environment: String,
    @Json(name = "timestamp") val timestamp: String? = null
)

data class ErrorResponse(
    @Json(name = "error") val error: String
)

data class SuccessResponse(
    @Json(name = "success") val success: Boolean
)

data class PermissionsResponse(
    @Json(name = "canManageUsers") val canManageUsers: Boolean? = null,
    @Json(name = "canUpload") val canUpload: Boolean? = null,
    @Json(name = "canDelete") val canDelete: Boolean? = null,
    @Json(name = "canCreateAlbums") val canCreateAlbums: Boolean? = null,
    @Json(name = "canManageTags") val canManageTags: Boolean? = null
)

data class SetupStatusResponse(
    @Json(name = "adminExists") val adminExists: Boolean
)

data class CreateAdminRequest(
    @Json(name = "name") val name: String,
    @Json(name = "email") val email: String,
    @Json(name = "password") val password: String
)

data class LoginRequest(
    @Json(name = "email") val email: String,
    @Json(name = "password") val password: String
)

data class PasswordResetRequest(
    @Json(name = "email") val email: String
)

data class PasswordResetConfirmRequest(
    @Json(name = "email") val email: String,
    @Json(name = "code") val code: String,
    @Json(name = "password") val password: String
)

data class MessageResponse(
    @Json(name = "message") val message: String
)

data class UserResponse(
    @Json(name = "id") val id: String,
    @Json(name = "email") val email: String,
    @Json(name = "name") val name: String? = null,
    @Json(name = "role") val role: String,
    @Json(name = "permissions") val permissions: PermissionsResponse? = null,
    @Json(name = "createdAt") val createdAt: String? = null
)

data class SessionResponse(
    @Json(name = "token") val token: String,
    @Json(name = "user") val user: UserResponse
)

data class CurrentUserResponse(
    @Json(name = "user") val user: UserResponse
)

data class UsersResponse(
    @Json(name = "items") val items: List<UserResponse>
)

data class CreateUserRequest(
    @Json(name = "name") val name: String,
    @Json(name = "email") val email: String,
    @Json(name = "password") val password: String,
    @Json(name = "role") val role: String
)

data class CreatedUserResponse(
    @Json(name = "user") val user: UserResponse
)

data class PaginationResponse(
    @Json(name = "limit") val limit: Int,
    @Json(name = "offset") val offset: Int,
    @Json(name = "nextOffset") val nextOffset: Int? = null,
    @Json(name = "hasMore") val hasMore: Boolean
)

data class FileItemResponse(
    @Json(name = "id") val id: String,
    @Json(name = "fileName") val fileName: String,
    @Json(name = "downloadName") val downloadName: String,
    @Json(name = "mediaType") val mediaType: String,
    @Json(name = "mimeType") val mimeType: String,
    @Json(name = "sizeBytes") val sizeBytes: Long,
    @Json(name = "widthPx") val widthPx: Long? = null,
    @Json(name = "heightPx") val heightPx: Long? = null,
    @Json(name = "durationMs") val durationMs: Long? = null,
    @Json(name = "takenAt") val takenAt: String,
    @Json(name = "createdAt") val createdAt: String,
    @Json(name = "previewUrl") val previewUrl: String,
    @Json(name = "downloadUrl") val downloadUrl: String
)

data class FilesResponse(
    @Json(name = "items") val items: List<FileItemResponse>,
    @Json(name = "pagination") val pagination: PaginationResponse
)

data class UploadedFileResponse(
    @Json(name = "item") val item: FileItemResponse
)

data class ChunkedUploadInitRequest(
    @Json(name = "fileName") val fileName: String,
    @Json(name = "sizeBytes") val sizeBytes: Long,
    @Json(name = "mimeType") val mimeType: String? = null,
    @Json(name = "takenAt") val takenAt: String? = null
)

data class ChunkInitResponse(
    @Json(name = "uploadId") val uploadId: String,
    @Json(name = "chunkSize") val chunkSize: Long,
    @Json(name = "totalChunks") val totalChunks: Int
)

data class ChunkProgressResponse(
    @Json(name = "uploadId") val uploadId: String,
    @Json(name = "receivedCount") val receivedCount: Int,
    @Json(name = "totalChunks") val totalChunks: Int
)

data class StorageStatsResponse(
    @Json(name = "drftUsedBytes") val drftUsedBytes: Long,
    @Json(name = "availableBytes") val availableBytes: Long,
    @Json(name = "totalBytes") val totalBytes: Long,
    @Json(name = "totalItems") val totalItems: Int,
    @Json(name = "imageItems") val imageItems: Int,
    @Json(name = "videoItems") val videoItems: Int
)

data class AlbumResponse(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null,
    @Json(name = "coverFileId") val coverFileId: String? = null,
    @Json(name = "fileCount") val fileCount: Int,
    @Json(name = "createdAt") val createdAt: String,
    @Json(name = "updatedAt") val updatedAt: String
)

data class AlbumsResponse(
    @Json(name = "albums") val albums: List<AlbumResponse>
)

data class AlbumMutationRequest(
    @Json(name = "name") val name: String,
    @Json(name = "description") val description: String? = null
)

data class AlbumEnvelope(
    @Json(name = "album") val album: AlbumResponse
)

data class AlbumDetailResponse(
    @Json(name = "album") val album: AlbumResponse,
    @Json(name = "items") val items: List<FileItemResponse>
)

data class AlbumFilesRequest(
    @Json(name = "fileIds") val fileIds: List<String>
)

data class TagResponse(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "color") val color: String? = null,
    @Json(name = "fileCount") val fileCount: Int,
    @Json(name = "createdAt") val createdAt: String,
    @Json(name = "updatedAt") val updatedAt: String
)

data class TagsResponse(
    @Json(name = "tags") val tags: List<TagResponse>
)

data class TagMutationRequest(
    @Json(name = "name") val name: String,
    @Json(name = "color") val color: String? = null
)

data class TagEnvelope(
    @Json(name = "tag") val tag: TagResponse
)

data class TagDetailResponse(
    @Json(name = "tag") val tag: TagResponse,
    @Json(name = "items") val items: List<FileItemResponse>
)

data class FileTagRequest(
    @Json(name = "tagId") val tagId: String
)
