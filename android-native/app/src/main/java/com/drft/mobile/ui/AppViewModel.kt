package com.drft.mobile.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.drft.mobile.BuildConfig
import com.drft.mobile.data.DrftRepository
import com.drft.mobile.data.LibraryBootstrapData
import com.drft.mobile.data.ServerCheckResult
import com.drft.mobile.data.local.AppPreferencesRepository
import com.drft.mobile.data.local.LocalSession
import com.drft.mobile.data.network.FileItemResponse
import com.drft.mobile.data.network.PaginationResponse
import com.drft.mobile.data.network.UserResponse
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class DrftSection {
    All,
    Images,
    Videos,
    Settings
}

sealed class RootDestination {
    data object ServerSetup : RootDestination()
    data object Login : RootDestination()
    data object Library : RootDestination()
}

data class LibrarySummary(
    val totalItems: Int,
    val imageItems: Int,
    val videoItems: Int,
    val albumCount: Int,
    val tagCount: Int
)

data class TimelineState(
    val items: List<FileItemResponse> = emptyList(),
    val pagination: PaginationResponse? = null
) {
    val hasMore: Boolean
        get() = pagination?.hasMore == true

    val nextOffset: Int?
        get() = pagination?.nextOffset
}

data class AppUiState(
    val session: LocalSession = LocalSession(serverUrl = BuildConfig.DEFAULT_API_BASE_URL),
    val activeSection: DrftSection = DrftSection.All,
    val destination: RootDestination = RootDestination.ServerSetup,
    val activeUser: UserResponse? = null,
    val librarySummary: LibrarySummary? = null,
    val timelineState: TimelineState = TimelineState(),
    val libraryLoading: Boolean = false,
    val libraryError: String? = null,
    val loadingMore: Boolean = false
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val preferencesRepository = AppPreferencesRepository(application)
    private val repository = DrftRepository()
    private val activeSection = MutableStateFlow(DrftSection.All)
    private val serverSetupOverride = MutableStateFlow(false)
    private val activeUser = MutableStateFlow<UserResponse?>(null)
    private val librarySummary = MutableStateFlow<LibrarySummary?>(null)
    private val timelineState = MutableStateFlow(TimelineState())
    private val libraryLoading = MutableStateFlow(false)
    private val loadingMore = MutableStateFlow(false)
    private val libraryError = MutableStateFlow<String?>(null)

    private val shellIdentity = combine(
        preferencesRepository.session,
        activeSection,
        serverSetupOverride,
        activeUser,
        librarySummary
    ) { session, section, setupOverride, user, summary ->
        ShellState(
            session = session,
            section = section,
            setupOverride = setupOverride,
            user = user,
            summary = summary
        )
    }

    private val shellState = combine(
        shellIdentity,
        timelineState
    ) { identity, timeline ->
        identity.copy(timeline = timeline)
    }

    val uiState: StateFlow<AppUiState> = combine(
        shellState,
        libraryLoading,
        loadingMore,
        libraryError
    ) { shell, isLoading, isLoadingMore, error ->
        AppUiState(
            session = if (shell.session.serverUrl.isBlank()) {
                shell.session.copy(serverUrl = BuildConfig.DEFAULT_API_BASE_URL)
            } else {
                shell.session
            },
            activeSection = shell.section,
            destination = resolveDestination(shell.session, shell.setupOverride),
            activeUser = shell.user,
            librarySummary = shell.summary,
            timelineState = shell.timeline,
            libraryLoading = isLoading,
            libraryError = error,
            loadingMore = isLoadingMore
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = AppUiState(
            session = LocalSession(serverUrl = BuildConfig.DEFAULT_API_BASE_URL),
            activeSection = DrftSection.All,
            destination = RootDestination.ServerSetup,
            activeUser = null,
            librarySummary = null,
            timelineState = TimelineState(),
            libraryLoading = false,
            libraryError = null,
            loadingMore = false
        )
    )

    init {
        viewModelScope.launch {
            preferencesRepository.session.collectLatest { session ->
                if (session.authToken.isBlank() || session.serverUrl.isBlank()) {
                    activeUser.value = null
                    librarySummary.value = null
                    timelineState.value = TimelineState()
                    libraryError.value = null
                    libraryLoading.value = false
                    loadingMore.value = false
                    return@collectLatest
                }

                if (activeUser.value == null) {
                    runCatching {
                        repository.getCurrentUser(session.serverUrl, session.authToken)
                    }.onSuccess { user ->
                        activeUser.value = user
                        loadLibrarySnapshot(session.serverUrl, session.authToken)
                    }.onFailure {
                        preferencesRepository.clearAuthToken()
                        activeUser.value = null
                        librarySummary.value = null
                        timelineState.value = TimelineState()
                        libraryError.value = null
                        libraryLoading.value = false
                        loadingMore.value = false
                    }
                    return@collectLatest
                }

                if ((librarySummary.value == null || timelineState.value.items.isEmpty()) && !libraryLoading.value) {
                    loadLibrarySnapshot(session.serverUrl, session.authToken)
                }
            }
        }
    }

    fun setActiveSection(section: DrftSection) {
        activeSection.value = section
    }

    suspend fun configureServer(serverUrl: String): ServerCheckResult {
        val result = repository.checkServer(serverUrl)
        preferencesRepository.setServerUrl(result.baseUrl)
        serverSetupOverride.value = false
        return result
    }

    suspend fun login(email: String, password: String): UserResponse {
        val currentServer = uiState.value.session.serverUrl
        val response = repository.login(currentServer, email, password)
        preferencesRepository.setAuthToken(response.token)
        activeUser.value = response.user
        loadLibrarySnapshot(currentServer, response.token)
        return response.user
    }

    fun signOut() {
        viewModelScope.launch {
            preferencesRepository.clearAuthToken()
            activeUser.value = null
            librarySummary.value = null
            timelineState.value = TimelineState()
            libraryError.value = null
            libraryLoading.value = false
            loadingMore.value = false
        }
    }

    fun openServerSetup() {
        serverSetupOverride.value = true
    }

    fun closeServerSetup() {
        serverSetupOverride.value = false
    }

    fun refreshLibrary() {
        val session = uiState.value.session
        if (!session.hasServer || !session.hasAuthToken) return
        viewModelScope.launch {
            loadLibrarySnapshot(session.serverUrl, session.authToken)
        }
    }

    fun loadMoreLibrary() {
        val session = uiState.value.session
        val nextOffset = timelineState.value.nextOffset ?: return
        if (!session.hasServer || !session.hasAuthToken || loadingMore.value || libraryLoading.value) return
        viewModelScope.launch {
            loadingMore.value = true
            runCatching {
                repository.loadFilesPage(
                    baseUrl = session.serverUrl,
                    token = session.authToken,
                    offset = nextOffset
                )
            }.onSuccess { files ->
                timelineState.value = TimelineState(
                    items = timelineState.value.items + files.items,
                    pagination = files.pagination
                )
                libraryError.value = null
            }.onFailure {
                libraryError.value = it.message
            }
            loadingMore.value = false
        }
    }

    private fun resolveDestination(session: LocalSession, setupOverride: Boolean): RootDestination {
        if (setupOverride) {
            return RootDestination.ServerSetup
        }
        return when {
            !session.hasServer -> RootDestination.ServerSetup
            !session.hasAuthToken -> RootDestination.Login
            else -> RootDestination.Library
        }
    }

    private suspend fun loadLibrarySnapshot(serverUrl: String, token: String) {
        libraryLoading.value = true
        libraryError.value = null
        runCatching {
            repository.loadLibraryBootstrap(serverUrl, token)
        }.onSuccess { bootstrap ->
            librarySummary.value = bootstrap.toLibrarySummary()
            timelineState.value = TimelineState(
                items = bootstrap.files.items,
                pagination = bootstrap.files.pagination
            )
        }.onFailure {
            librarySummary.value = null
            timelineState.value = TimelineState()
            libraryError.value = it.message
        }
        libraryLoading.value = false
    }
}

private fun LibraryBootstrapData.toLibrarySummary(): LibrarySummary {
    return LibrarySummary(
        totalItems = storageStats.totalItems,
        imageItems = storageStats.imageItems,
        videoItems = storageStats.videoItems,
        albumCount = albums.albums.size,
        tagCount = tags.tags.size
    )
}

private data class ShellState(
    val session: LocalSession,
    val section: DrftSection,
    val setupOverride: Boolean,
    val user: UserResponse?,
    val summary: LibrarySummary?,
    val timeline: TimelineState = TimelineState()
)
