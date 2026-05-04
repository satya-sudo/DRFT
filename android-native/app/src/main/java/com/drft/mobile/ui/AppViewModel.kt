package com.drft.mobile.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.drft.mobile.BuildConfig
import com.drft.mobile.data.local.AppPreferencesRepository
import com.drft.mobile.data.local.LocalSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
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

data class AppUiState(
    val session: LocalSession = LocalSession(serverUrl = BuildConfig.DEFAULT_API_BASE_URL),
    val activeSection: DrftSection = DrftSection.All,
    val destination: RootDestination = RootDestination.ServerSetup
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val preferencesRepository = AppPreferencesRepository(application)
    private val activeSection = MutableStateFlow(DrftSection.All)

    val uiState: StateFlow<AppUiState> = combine(
        preferencesRepository.session,
        activeSection
    ) { session, section ->
        AppUiState(
            session = if (session.serverUrl.isBlank()) {
                session.copy(serverUrl = BuildConfig.DEFAULT_API_BASE_URL)
            } else {
                session
            },
            activeSection = section,
            destination = resolveDestination(session)
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = AppUiState(
            session = LocalSession(serverUrl = BuildConfig.DEFAULT_API_BASE_URL),
            activeSection = DrftSection.All,
            destination = RootDestination.ServerSetup
        )
    )

    fun setActiveSection(section: DrftSection) {
        activeSection.value = section
    }

    fun saveServerUrl(serverUrl: String) {
        viewModelScope.launch {
            preferencesRepository.setServerUrl(serverUrl)
        }
    }

    fun saveAuthToken(token: String) {
        viewModelScope.launch {
            preferencesRepository.setAuthToken(token)
        }
    }

    fun signOut() {
        viewModelScope.launch {
            preferencesRepository.clearAuthToken()
        }
    }

    private fun resolveDestination(session: LocalSession): RootDestination {
        return when {
            !session.hasServer -> RootDestination.ServerSetup
            !session.hasAuthToken -> RootDestination.Login
            else -> RootDestination.Library
        }
    }
}
