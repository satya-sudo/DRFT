package com.drft.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.drft.mobile.ui.DrftSection

@Composable
fun ServerSetupPlaceholder(serverUrl: String) {
    FeaturePlaceholder(
        title = "Server setup comes next",
        body = "The Kotlin client now has local server persistence. The next slice is wiring real server validation to /healthz and setup status.",
        footer = "Current saved server: ${serverUrl.ifBlank { "none" }}"
    )
}

@Composable
fun LoginPlaceholder(serverUrl: String) {
    FeaturePlaceholder(
        title = "Login flow is the next vertical slice",
        body = "Networking and persistence foundations are in place. The next step is turning the DRFT login and session restore flow into a real native screen.",
        footer = "Server target: ${serverUrl.ifBlank { "not set" }}"
    )
}

@Composable
fun LibraryPlaceholder(section: DrftSection, serverUrl: String) {
    FeaturePlaceholder(
        title = when (section) {
            DrftSection.All -> "All media"
            DrftSection.Images -> "Images"
            DrftSection.Videos -> "Videos"
            DrftSection.Settings -> "Settings"
        },
        body = when (section) {
            DrftSection.All -> "This screen will become the native DRFT timeline with backend totals, paging, previews, and stronger lifecycle behavior."
            DrftSection.Images -> "Image-specific browsing will live here once the timeline data model and authenticated image loading are wired up."
            DrftSection.Videos -> "This section will move to Media3-backed previews and playback once the video path is implemented."
            DrftSection.Settings -> "This settings area will hold server details, release metadata, sign-out, and future account recovery tools."
        },
        footer = "Target server: ${serverUrl.ifBlank { "not set" }}"
    )
}

@Composable
private fun FeaturePlaceholder(
    title: String,
    body: String,
    footer: String
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = body,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = footer,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}
