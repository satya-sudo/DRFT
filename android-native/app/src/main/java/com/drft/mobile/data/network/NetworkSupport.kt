package com.drft.mobile.data.network

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

enum class TimeoutProfile(
    val connectSeconds: Long,
    val readSeconds: Long,
    val writeSeconds: Long
) {
    Default(connectSeconds = 10, readSeconds = 20, writeSeconds = 20),
    Upload(connectSeconds = 15, readSeconds = 180, writeSeconds = 180)
}

sealed class DrftNetworkError(message: String, cause: Throwable? = null) : Exception(message, cause) {
    class InvalidBaseUrl(baseUrl: String) : DrftNetworkError("Invalid DRFT base URL: $baseUrl")
}

object DrftApiFactory {
    private val moshi: Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    fun create(
        baseUrl: String,
        timeoutProfile: TimeoutProfile = TimeoutProfile.Default,
        authTokenProvider: (() -> String?)? = null
    ): DrftApiService {
        val normalizedBaseUrl = normalizeBaseUrl(baseUrl)
            ?: throw DrftNetworkError.InvalidBaseUrl(baseUrl)

        val authInterceptor = Interceptor { chain ->
            val token = authTokenProvider?.invoke().orEmpty()
            val request = if (token.isNotBlank()) {
                chain.request().newBuilder()
                    .header("Authorization", "Bearer $token")
                    .build()
            } else {
                chain.request()
            }
            chain.proceed(request)
        }

        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(timeoutProfile.connectSeconds, TimeUnit.SECONDS)
            .readTimeout(timeoutProfile.readSeconds, TimeUnit.SECONDS)
            .writeTimeout(timeoutProfile.writeSeconds, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .build()

        return Retrofit.Builder()
            .baseUrl(normalizedBaseUrl)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(DrftApiService::class.java)
    }

    private fun normalizeBaseUrl(baseUrl: String): String? {
        val trimmed = baseUrl.trim()
        if (trimmed.isBlank()) return null
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }
}
