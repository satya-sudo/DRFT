package com.drft.mobile.ui

import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
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
import com.drft.mobile.ui.screens.LoginPlaceholder
import com.drft.mobile.ui.screens.ServerSetupPlaceholder

@Composable
fun DrftApp(
    appViewModel: AppViewModel = viewModel()
) {
    val uiState by appViewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(topBarTitle(uiState.destination, uiState.activeSection))
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
                            icon = {},
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
                    ServerSetupPlaceholder(serverUrl = uiState.session.serverUrl)
                }
                RootDestination.Login -> {
                    LoginPlaceholder(serverUrl = uiState.session.serverUrl)
                }
                RootDestination.Library -> {
                    LibraryPlaceholder(
                        section = uiState.activeSection,
                        serverUrl = uiState.session.serverUrl
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
