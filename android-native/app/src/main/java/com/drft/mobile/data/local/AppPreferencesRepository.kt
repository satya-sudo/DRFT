package com.drft.mobile.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private const val DrftPreferencesName = "drft_preferences"

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = DrftPreferencesName)

data class LocalSession(
    val serverUrl: String = "",
    val authToken: String = ""
) {
    val hasServer: Boolean
        get() = serverUrl.isNotBlank()

    val hasAuthToken: Boolean
        get() = authToken.isNotBlank()
}

class AppPreferencesRepository(private val context: Context) {
    private object Keys {
        val serverUrl = stringPreferencesKey("server_url")
        val authToken = stringPreferencesKey("auth_token")
    }

    val session: Flow<LocalSession> = context.dataStore.data
        .catch { error ->
            if (error is IOException) {
                emit(emptyPreferences())
            } else {
                throw error
            }
        }
        .map { preferences ->
            LocalSession(
                serverUrl = preferences[Keys.serverUrl].orEmpty(),
                authToken = preferences[Keys.authToken].orEmpty()
            )
        }

    suspend fun setServerUrl(serverUrl: String) {
        context.dataStore.edit { preferences ->
            preferences[Keys.serverUrl] = serverUrl.trim()
        }
    }

    suspend fun setAuthToken(authToken: String) {
        context.dataStore.edit { preferences ->
            preferences[Keys.authToken] = authToken.trim()
        }
    }

    suspend fun clearAuthToken() {
        context.dataStore.edit { preferences ->
            preferences.remove(Keys.authToken)
        }
    }

    suspend fun clearAll() {
        context.dataStore.edit { preferences ->
            preferences.clear()
        }
    }
}
