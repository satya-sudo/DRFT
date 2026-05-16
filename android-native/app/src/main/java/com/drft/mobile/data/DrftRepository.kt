package com.drft.mobile.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.drft.mobile.data.network.AlbumsResponse
import com.drft.mobile.data.network.DrftApiFactory
import com.drft.mobile.data.network.DrftApiService
import com.drft.mobile.data.network.DrftNetworkError
import com.drft.mobile.data.network.ErrorResponse
import com.drft.mobile.data.network.FilesResponse
import com.drft.mobile.data.network.ChunkedUploadInitRequest
import com.drft.mobile.data.network.LoginRequest
import com.drft.mobile.data.network.SessionResponse
import com.drft.mobile.data.network.SetupStatusResponse
import com.drft.mobile.data.network.StorageStatsResponse
import com.drft.mobile.data.network.TagsResponse
import com.drft.mobile.data.network.TimeoutProfile
import com.drft.mobile.data.network.UploadedFileResponse
import com.drft.mobile.data.network.UserResponse
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.io.IOException
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okio.BufferedSink
import retrofit2.HttpException

private const val ChunkedUploadThresholdBytes = 8L * 1024L * 1024L

data class ServerCheckResult(
    val baseUrl: String,
    val setupStatus: SetupStatusResponse
)

data class LibraryBootstrapData(
    val files: FilesResponse,
    val storageStats: StorageStatsResponse,
    val albums: AlbumsResponse,
    val tags: TagsResponse
)

class UserFacingException(message: String) : Exception(message)

class DrftRepository {
    private val moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()
    private val errorAdapter = moshi.adapter(ErrorResponse::class.java)

    suspend fun checkServer(baseUrl: String): ServerCheckResult {
        val normalized = normalizeServerUrl(baseUrl)
            ?: throw UserFacingException("Enter the DRFT server host and port, for example 192.168.1.109:8080.")

        val api = createApi(normalized)

        try {
            api.health()
            val setupStatus = api.setupStatus()
            if (!setupStatus.adminExists) {
                throw UserFacingException("This DRFT server still needs first-time setup in the web app before mobile login can be used.")
            }
            return ServerCheckResult(
                baseUrl = normalized,
                setupStatus = setupStatus
            )
        } catch (error: Exception) {
            throw mapException(
                error = error,
                networkFallback = "Could not reach that DRFT server. Check the host, port, Wi-Fi, and that the backend is running."
            )
        }
    }

    suspend fun login(baseUrl: String, email: String, password: String): SessionResponse {
        val normalized = normalizeServerUrl(baseUrl)
            ?: throw UserFacingException("Choose a DRFT server before signing in.")

        val trimmedEmail = email.trim()
        if (trimmedEmail.isBlank()) {
            throw UserFacingException("Enter your DRFT account email.")
        }

        if (password.isBlank()) {
            throw UserFacingException("Enter your DRFT password.")
        }

        return try {
            createApi(normalized).login(LoginRequest(email = trimmedEmail, password = password))
        } catch (error: Exception) {
            throw mapException(
                error = error,
                networkFallback = "Could not reach DRFT while trying to sign in."
            )
        }
    }

    suspend fun getCurrentUser(baseUrl: String, token: String): UserResponse {
        val normalized = normalizeServerUrl(baseUrl)
            ?: throw UserFacingException("Choose a DRFT server before restoring a session.")

        if (token.isBlank()) {
            throw UserFacingException("Missing DRFT auth token.")
        }

        return try {
            createApi(normalized) { token }.currentUser().user
        } catch (error: Exception) {
            throw mapException(
                error = error,
                networkFallback = "Could not reach DRFT while restoring the saved session."
            )
        }
    }

    suspend fun loadLibraryBootstrap(
        baseUrl: String,
        token: String,
        limit: Int = 40,
        offset: Int = 0
    ): LibraryBootstrapData {
        val normalized = normalizeServerUrl(baseUrl)
            ?: throw UserFacingException("Choose a DRFT server before loading the library.")

        if (token.isBlank()) {
            throw UserFacingException("Missing DRFT auth token.")
        }

        return try {
            val api = createApi(normalized) { token }
            LibraryBootstrapData(
                files = api.listFiles(limit = limit, offset = offset),
                storageStats = api.storageStats(),
                albums = api.listAlbums(),
                tags = api.listTags()
            )
        } catch (error: Exception) {
            throw mapException(
                error = error,
                networkFallback = "Could not reach DRFT while loading the library."
            )
        }
    }

    suspend fun loadFilesPage(
        baseUrl: String,
        token: String,
        limit: Int = 40,
        offset: Int = 0
    ): FilesResponse {
        val normalized = normalizeServerUrl(baseUrl)
            ?: throw UserFacingException("Choose a DRFT server before loading the library.")

        if (token.isBlank()) {
            throw UserFacingException("Missing DRFT auth token.")
        }

        return try {
            createApi(normalized) { token }.listFiles(limit = limit, offset = offset)
        } catch (error: Exception) {
            throw mapException(
                error = error,
                networkFallback = "Could not reach DRFT while loading more media."
            )
        }
    }

    suspend fun uploadFile(
        context: Context,
        baseUrl: String,
        token: String,
        uri: Uri,
        onProgress: (percent: Int, phase: String) -> Unit = { _, _ -> }
    ): UploadedFileResponse {
        val normalized = normalizeServerUrl(baseUrl)
            ?: throw UserFacingException("Choose a DRFT server before uploading.")

        if (token.isBlank()) {
            throw UserFacingException("Missing DRFT auth token.")
        }

        val fileMeta = resolveFileMeta(context, uri)

        return try {
            if (fileMeta.sizeBytes >= ChunkedUploadThresholdBytes) {
                uploadFileChunked(
                    context = context,
                    baseUrl = normalized,
                    token = token,
                    uri = uri,
                    fileMeta = fileMeta,
                    onProgress = onProgress
                )
            } else {
                uploadFileDirect(
                    context = context,
                    baseUrl = normalized,
                    token = token,
                    uri = uri,
                    fileMeta = fileMeta,
                    onProgress = onProgress
                )
            }
        } catch (error: Exception) {
            throw mapException(
                error = error,
                networkFallback = "Could not reach DRFT while uploading that file."
            )
        }
    }

    private suspend fun uploadFileDirect(
        context: Context,
        baseUrl: String,
        token: String,
        uri: Uri,
        fileMeta: FileMeta,
        onProgress: (percent: Int, phase: String) -> Unit
    ): UploadedFileResponse {
        onProgress(5, "Preparing upload")
        val response = createApi(
            baseUrl = baseUrl,
            timeoutProfile = TimeoutProfile.Upload,
            tokenProvider = { token }
        ).uploadFile(
            file = MultipartBody.Part.createFormData(
                name = "file",
                filename = fileMeta.displayName,
                body = ContentUriRequestBody(
                    context = context,
                    uri = uri,
                    contentType = fileMeta.mimeType,
                    progressCap = 95,
                    onProgress = onProgress
                )
            ),
            takenAt = null
        )
        onProgress(100, "Uploaded")
        return response
    }

    private suspend fun uploadFileChunked(
        context: Context,
        baseUrl: String,
        token: String,
        uri: Uri,
        fileMeta: FileMeta,
        onProgress: (percent: Int, phase: String) -> Unit
    ): UploadedFileResponse {
        val api = createApi(
            baseUrl = baseUrl,
            timeoutProfile = TimeoutProfile.Upload,
            tokenProvider = { token }
        )

        onProgress(5, "Creating upload session")
        val init = api.initChunkedUpload(
            ChunkedUploadInitRequest(
                fileName = fileMeta.displayName,
                sizeBytes = fileMeta.sizeBytes,
                mimeType = fileMeta.mimeType,
                takenAt = null
            )
        )

        repeat(init.totalChunks) { index ->
            val chunkOffset = index.toLong() * init.chunkSize
            val remaining = fileMeta.sizeBytes - chunkOffset
            val chunkLength = minOf(init.chunkSize, remaining)
            api.uploadChunk(
                uploadId = init.uploadId,
                index = index,
                body = ChunkRequestBody(
                    context = context,
                    uri = uri,
                    contentType = fileMeta.mimeType,
                    offset = chunkOffset,
                    byteCount = chunkLength
                )
            )
            val completedPercent = 5 + (((index + 1).toFloat() / init.totalChunks.toFloat()) * 90f).toInt()
            onProgress(
                completedPercent.coerceAtMost(95),
                "Uploading chunk ${index + 1} of ${init.totalChunks}"
            )
        }

        onProgress(96, "Finalizing upload")
        val response = api.completeChunkedUpload(init.uploadId)
        onProgress(100, "Uploaded")
        return response
    }

    private fun createApi(
        baseUrl: String,
        timeoutProfile: TimeoutProfile = TimeoutProfile.Default,
        tokenProvider: (() -> String?)? = null
    ): DrftApiService {
        return DrftApiFactory.create(
            baseUrl = baseUrl,
            timeoutProfile = timeoutProfile,
            authTokenProvider = tokenProvider
        )
    }

    private fun mapException(error: Exception, networkFallback: String): UserFacingException {
        if (error is UserFacingException) {
            return error
        }

        return when (error) {
            is DrftNetworkError.InvalidBaseUrl -> UserFacingException("Enter a valid DRFT server URL or host:port value.")
            is IOException -> UserFacingException(networkFallback)
            is HttpException -> {
                val apiError = error.response()?.errorBody()?.string()?.let(errorAdapter::fromJson)
                UserFacingException(apiError?.error?.ifBlank { null } ?: "DRFT rejected the request with HTTP ${error.code()}.")
            }
            else -> UserFacingException(error.message ?: "Something went wrong while talking to DRFT.")
        }
    }
}

private data class FileMeta(
    val displayName: String,
    val mimeType: String,
    val sizeBytes: Long
)

private class ContentUriRequestBody(
    private val context: Context,
    private val uri: Uri,
    private val contentType: String,
    private val progressCap: Int,
    private val onProgress: (percent: Int, phase: String) -> Unit
) : RequestBody() {
    override fun contentType() = contentType.toMediaTypeOrNull()

    override fun contentLength(): Long {
        return context.contentResolver.query(
            uri,
            arrayOf(OpenableColumns.SIZE),
            null,
            null,
            null
        )?.use { cursor ->
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst() && sizeIndex != -1 && !cursor.isNull(sizeIndex)) {
                cursor.getLong(sizeIndex)
            } else {
                -1L
            }
        } ?: -1L
    }

    override fun writeTo(sink: BufferedSink) {
        val totalBytes = contentLength()
        context.contentResolver.openInputStream(uri)?.use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            var uploaded = 0L
            var read = input.read(buffer)
            while (read >= 0) {
                sink.write(buffer, 0, read)
                uploaded += read
                if (totalBytes > 0) {
                    val rawPercent = ((uploaded.toDouble() / totalBytes.toDouble()) * progressCap.toDouble()).toInt()
                    onProgress(rawPercent.coerceIn(5, progressCap), "Uploading file")
                }
                read = input.read(buffer)
            }
        } ?: throw IOException("Could not open file content for upload.")
    }
}

private class ChunkRequestBody(
    private val context: Context,
    private val uri: Uri,
    private val contentType: String,
    private val offset: Long,
    private val byteCount: Long
) : RequestBody() {
    override fun contentType() = contentType.toMediaTypeOrNull()

    override fun contentLength(): Long = byteCount

    override fun writeTo(sink: BufferedSink) {
        context.contentResolver.openInputStream(uri)?.use { input ->
            var toSkip = offset
            while (toSkip > 0) {
                val skipped = input.skip(toSkip)
                if (skipped <= 0) {
                    throw IOException("Could not seek to upload chunk offset.")
                }
                toSkip -= skipped
            }

            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            var remaining = byteCount
            while (remaining > 0) {
                val read = input.read(buffer, 0, minOf(buffer.size.toLong(), remaining).toInt())
                if (read <= 0) {
                    throw IOException("Unexpected end of file while uploading chunk.")
                }
                sink.write(buffer, 0, read)
                remaining -= read
            }
        } ?: throw IOException("Could not open file content for upload.")
    }
}

private fun resolveFileMeta(context: Context, uri: Uri): FileMeta {
    val resolver = context.contentResolver
    val mimeType = resolver.getType(uri).orEmpty().ifBlank { "application/octet-stream" }

    val displayName = resolver.query(
        uri,
        arrayOf(OpenableColumns.DISPLAY_NAME),
        null,
        null,
        null
    )?.use { cursor ->
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (cursor.moveToFirst() && nameIndex != -1 && !cursor.isNull(nameIndex)) {
            cursor.getString(nameIndex)
        } else {
            null
        }
    } ?: null

    val sizeBytes = resolver.query(
        uri,
        arrayOf(OpenableColumns.SIZE),
        null,
        null,
        null
    )?.use { cursor ->
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (cursor.moveToFirst() && sizeIndex != -1 && !cursor.isNull(sizeIndex)) {
            cursor.getLong(sizeIndex)
        } else {
            null
        }
    } ?: null

    return FileMeta(
        displayName = displayName ?: "drft-upload",
        mimeType = mimeType,
        sizeBytes = sizeBytes ?: 0L
    )
}

private fun normalizeServerUrl(value: String): String? {
    val trimmed = value.trim()
    if (trimmed.isBlank()) return null
    val withScheme = if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
        trimmed
    } else {
        "http://$trimmed"
    }
    return if (withScheme.endsWith("/")) withScheme.dropLast(1) else withScheme
}
