package com.drft.mobile.data.network

import com.squareup.moshi.Json

data class HealthResponse(
    @Json(name = "status") val status: String,
    @Json(name = "service") val service: String,
    @Json(name = "version") val version: String,
    @Json(name = "env") val environment: String
)

data class SetupStatusResponse(
    @Json(name = "requires_setup") val requiresSetup: Boolean
)

data class LoginRequest(
    @Json(name = "email") val email: String,
    @Json(name = "password") val password: String
)

data class UserResponse(
    @Json(name = "id") val id: String,
    @Json(name = "email") val email: String,
    @Json(name = "name") val name: String?,
    @Json(name = "role") val role: String
)

data class AuthResponse(
    @Json(name = "token") val token: String,
    @Json(name = "user") val user: UserResponse
)
