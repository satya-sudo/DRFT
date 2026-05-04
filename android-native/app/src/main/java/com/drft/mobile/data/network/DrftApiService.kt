package com.drft.mobile.data.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface DrftApiService {
    @GET("/healthz")
    suspend fun health(): HealthResponse

    @GET("/api/v1/setup/status")
    suspend fun setupStatus(): SetupStatusResponse

    @POST("/api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @GET("/api/v1/auth/me")
    suspend fun currentUser(): UserResponse
}
