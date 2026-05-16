package com.drft.mobile.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Collections
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SmartDisplay
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.drft.mobile.ui.screens.LibraryPlaceholder
import com.drft.mobile.ui.screens.LoginScreen
import com.drft.mobile.ui.screens.ServerSetupScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DrftApp(
    appViewModel: AppViewModel = viewModel()
) {
    val uiState by appViewModel.uiState.collectAsStateWithLifecycle()
    val uploadLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris ->
        appViewModel.enqueueUploads(uris)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(topBarTitle(uiState.destination, uiState.activeSection))
                },
                actions = {
                    if (uiState.destination is RootDestination.Library && uiState.activeSection != DrftSection.Settings) {
                        IconButton(
                            onClick = {
                                uploadLauncher.launch(arrayOf("image/*", "video/*"))
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Upload,
                                contentDescription = "Upload media"
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors()
            )
        },
        bottomBar = {
            if (uiState.destination is RootDestination.Library) {
                NavigationBar {
                    DrftSection.entries.forEach { section ->
                        NavigationBarItem(
                            selected = uiState.activeSection == section,
                            onClick = { appViewModel.setActiveSection(section) },
                            icon = {
                                Icon(
                                    imageVector = section.icon,
                                    contentDescription = section.label
                                )
                            },
                            label = { Text(section.label) }
                        )
                    }
                }
            }
        }
    ) { padding ->
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .consumeWindowInsets(padding)
        ) {
            when (uiState.destination) {
                RootDestination.ServerSetup -> {
                    ServerSetupScreen(
                        serverUrl = uiState.session.serverUrl,
                        appViewModel = appViewModel
                    )
                }
                RootDestination.Login -> {
                    LoginScreen(
                        serverUrl = uiState.session.serverUrl,
                        appViewModel = appViewModel
                    )
                }
                RootDestination.Library -> {
                    LibraryPlaceholder(
                        section = uiState.activeSection,
                        serverUrl = uiState.session.serverUrl,
                        authToken = uiState.session.authToken,
                        activeUser = uiState.activeUser,
                        librarySummary = uiState.librarySummary,
                        timelineState = uiState.timelineState,
                        libraryLoading = uiState.libraryLoading,
                        libraryError = uiState.libraryError,
                        loadingMore = uiState.loadingMore,
                        uploadQueue = uiState.uploadQueue,
                        onRefresh = appViewModel::refreshLibrary,
                        onLoadMore = appViewModel::loadMoreLibrary,
                        onRetryUpload = appViewModel::retryUpload,
                        onClearFinishedUploads = appViewModel::clearFinishedUploads,
                        onChangeServer = appViewModel::openServerSetup,
                        onSignOut = appViewModel::signOut
                    )
                }
            }
        }
    }
}

private val DrftSection.label: String
    get() = when (this) {
        DrftSection.All -> "All"
        DrftSection.Images -> "Images"
        DrftSection.Videos -> "Videos"
        DrftSection.Settings -> "Settings"
    }

private val DrftSection.icon
    get() = when (this) {
        DrftSection.All -> Icons.Filled.Collections
        DrftSection.Images -> Icons.Filled.Image
        DrftSection.Videos -> Icons.Filled.SmartDisplay
        DrftSection.Settings -> Icons.Filled.Settings
    }

private fun topBarTitle(destination: RootDestination, section: DrftSection): String {
    return when (destination) {
        RootDestination.ServerSetup -> "Connect to DRFT"
        RootDestination.Login -> "Login to DRFT"
        RootDestination.Library -> when (section) {
            DrftSection.All -> "All media"
            DrftSection.Images -> "Images"
            DrftSection.Videos -> "Videos"
            DrftSection.Settings -> "Settings"
        }
    }
}
