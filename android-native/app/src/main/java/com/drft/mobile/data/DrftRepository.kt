package com.drft.mobile.data

import com.drft.mobile.data.network.AlbumsResponse
import com.drft.mobile.data.network.DrftApiFactory
import com.drft.mobile.data.network.DrftApiService
import com.drft.mobile.data.network.DrftNetworkError
import com.drft.mobile.data.network.ErrorResponse
import com.drft.mobile.data.network.FilesResponse
import com.drft.mobile.data.network.LoginRequest
import com.drft.mobile.data.network.SessionResponse
import com.drft.mobile.data.network.SetupStatusResponse
import com.drft.mobile.data.network.StorageStatsResponse
import com.drft.mobile.data.network.TagsResponse
import com.drft.mobile.data.network.UserResponse
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.io.IOException
import retrofit2.HttpException

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

    private fun createApi(baseUrl: String, tokenProvider: (() -> String?)? = null): DrftApiService {
        return DrftApiFactory.create(
            baseUrl = baseUrl,
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
