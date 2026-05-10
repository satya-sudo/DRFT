package com.drft.mobile.data.network

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface DrftApiService {
    @GET("/healthz")
    suspend fun health(): HealthResponse

    @GET("/api/v1/setup/status")
    suspend fun setupStatus(): SetupStatusResponse

    @POST("/api/v1/setup/admin")
    suspend fun createAdmin(@Body request: CreateAdminRequest): SessionResponse

    @POST("/api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): SessionResponse

    @GET("/api/v1/auth/me")
    suspend fun currentUser(): CurrentUserResponse

    @POST("/api/v1/auth/password-reset/request")
    suspend fun requestPasswordReset(@Body request: PasswordResetRequest): MessageResponse

    @POST("/api/v1/auth/password-reset/confirm")
    suspend fun confirmPasswordReset(@Body request: PasswordResetConfirmRequest): MessageResponse

    @GET("/api/v1/admin/users")
    suspend fun listUsers(): UsersResponse

    @POST("/api/v1/admin/users")
    suspend fun createUser(@Body request: CreateUserRequest): CreatedUserResponse

    @DELETE("/api/v1/admin/users/{id}")
    suspend fun deleteUser(@Path("id") id: String): SuccessResponse

    @GET("/api/v1/files")
    suspend fun listFiles(
        @Query("limit") limit: Int = 40,
        @Query("offset") offset: Int = 0
    ): FilesResponse

    @Multipart
    @POST("/api/v1/upload")
    suspend fun uploadFile(
        @Part file: MultipartBody.Part,
        @Part("taken_at") takenAt: RequestBody? = null
    ): UploadedFileResponse

    @POST("/api/v1/uploads/init")
    suspend fun initChunkedUpload(@Body request: ChunkedUploadInitRequest): ChunkInitResponse

    @PUT("/api/v1/uploads/{uploadId}/chunks/{index}")
    suspend fun uploadChunk(
        @Path("uploadId") uploadId: String,
        @Path("index") index: Int,
        @Body body: RequestBody
    ): ChunkProgressResponse

    @POST("/api/v1/uploads/{uploadId}/complete")
    suspend fun completeChunkedUpload(@Path("uploadId") uploadId: String): UploadedFileResponse

    @DELETE("/api/v1/uploads/{uploadId}")
    suspend fun cancelChunkedUpload(@Path("uploadId") uploadId: String): SuccessResponse

    @GET("/api/v1/storage/stats")
    suspend fun storageStats(): StorageStatsResponse

    @DELETE("/api/v1/file/{id}")
    suspend fun deleteFile(@Path("id") id: String): SuccessResponse

    @GET("/api/v1/albums")
    suspend fun listAlbums(): AlbumsResponse

    @POST("/api/v1/albums")
    suspend fun createAlbum(@Body request: AlbumMutationRequest): AlbumEnvelope

    @GET("/api/v1/albums/{id}")
    suspend fun getAlbum(@Path("id") id: String): AlbumDetailResponse

    @PATCH("/api/v1/albums/{id}")
    suspend fun updateAlbum(
        @Path("id") id: String,
        @Body request: AlbumMutationRequest
    ): AlbumEnvelope

    @DELETE("/api/v1/albums/{id}")
    suspend fun deleteAlbum(@Path("id") id: String): SuccessResponse

    @POST("/api/v1/albums/{id}/files")
    suspend fun addFilesToAlbum(
        @Path("id") id: String,
        @Body request: AlbumFilesRequest
    ): AlbumEnvelope

    @DELETE("/api/v1/albums/{id}/files/{fileId}")
    suspend fun removeFileFromAlbum(
        @Path("id") id: String,
        @Path("fileId") fileId: String
    ): SuccessResponse

    @GET("/api/v1/tags")
    suspend fun listTags(): TagsResponse

    @POST("/api/v1/tags")
    suspend fun createTag(@Body request: TagMutationRequest): TagEnvelope

    @GET("/api/v1/tags/{id}")
    suspend fun getTag(@Path("id") id: String): TagDetailResponse

    @PATCH("/api/v1/tags/{id}")
    suspend fun updateTag(
        @Path("id") id: String,
        @Body request: TagMutationRequest
    ): TagEnvelope

    @DELETE("/api/v1/tags/{id}")
    suspend fun deleteTag(@Path("id") id: String): SuccessResponse

    @POST("/api/v1/files/{id}/tags")
    suspend fun addTagToFile(
        @Path("id") id: String,
        @Body request: FileTagRequest
    ): SuccessResponse

    @DELETE("/api/v1/files/{id}/tags/{tagId}")
    suspend fun removeTagFromFile(
        @Path("id") id: String,
        @Path("tagId") tagId: String
    ): SuccessResponse
}
