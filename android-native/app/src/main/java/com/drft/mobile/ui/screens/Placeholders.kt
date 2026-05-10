package com.drft.mobile.ui.screens

import android.net.Uri
import android.view.ViewGroup
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridItemSpan
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.Devices
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.filled.Close
import androidx.compose.ui.viewinterop.AndroidView
import com.drft.mobile.BuildConfig
import coil.compose.AsyncImage
import com.drft.mobile.data.network.FileItemResponse
import com.drft.mobile.ui.AppViewModel
import com.drft.mobile.ui.DrftSection
import com.drft.mobile.ui.LibrarySummary
import com.drft.mobile.ui.TimelineState
import com.drft.mobile.data.network.UserResponse
import kotlinx.coroutines.launch
import androidx.compose.ui.window.Dialog
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

@Composable
fun ServerSetupScreen(
    serverUrl: String,
    appViewModel: AppViewModel
) {
    var input by remember(serverUrl) { mutableStateOf(serverUrl) }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var success by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    FeatureCardScreen {
        Eyebrow("DRFT MOBILE")
        Title("Connect to your server")
        Description(
            "Enter the DRFT host and port this phone should use. We will test the connection before showing the login screen."
        )

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = input,
            onValueChange = { input = it },
            label = { Text("Server host and port") },
            placeholder = { Text("192.168.1.109:8080") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri)
        )

        Helper("Example: ${normalizedServerExample(input)}")

        if (serverUrl.isNotBlank()) {
            Helper("Saved server: $serverUrl")
        }

        if (error.isNotBlank()) {
            ErrorText(error)
        }

        if (success.isNotBlank()) {
            SuccessText(success)
        }

        Button(
            modifier = Modifier.fillMaxWidth(),
            enabled = !submitting,
            onClick = {
                scope.launch {
                    submitting = true
                    error = ""
                    success = ""
                    runCatching {
                        appViewModel.configureServer(input)
                    }.onSuccess {
                        success = "Connected to DRFT. You can sign in now."
                    }.onFailure {
                        error = it.message.orEmpty()
                    }
                    submitting = false
                }
            }
        ) {
            Text(if (submitting) "Checking server..." else "Use this server")
        }

        if (serverUrl.isNotBlank()) {
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = { appViewModel.closeServerSetup() }
            ) {
                Text("Keep current server")
            }
        }
    }
}

@Composable
fun LoginScreen(
    serverUrl: String,
    appViewModel: AppViewModel
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    FeatureCardScreen {
        Eyebrow("DRFT MOBILE")
        Title("Sign in to your library")
        Description(
            "This first Kotlin mobile milestone focuses on login, timeline browsing, media viewing, and upload."
        )
        Helper("Server: $serverUrl")

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            placeholder = { Text("you@drft.local") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
        )

        OutlinedTextField(
            modifier = Modifier.fillMaxWidth(),
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            placeholder = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation()
        )

        if (error.isNotBlank()) {
            ErrorText(error)
        }

        Button(
            modifier = Modifier.fillMaxWidth(),
            enabled = !submitting,
            onClick = {
                scope.launch {
                    submitting = true
                    error = ""
                    runCatching {
                        appViewModel.login(email, password)
                    }.onFailure {
                        error = it.message.orEmpty()
                    }
                    submitting = false
                }
            }
        ) {
            Text(if (submitting) "Signing in..." else "Enter DRFT")
        }

        OutlinedButton(
            modifier = Modifier.fillMaxWidth(),
            onClick = { appViewModel.openServerSetup() }
        ) {
            Text("Change server")
        }
    }
}

@Composable
fun LibraryPlaceholder(
    section: DrftSection,
    serverUrl: String,
    authToken: String,
    activeUser: UserResponse?,
    librarySummary: LibrarySummary?,
    timelineState: TimelineState,
    libraryLoading: Boolean,
    libraryError: String?,
    loadingMore: Boolean,
    onRefresh: () -> Unit,
    onLoadMore: () -> Unit,
    onChangeServer: () -> Unit,
    onSignOut: () -> Unit
) {
    var selectedItem by remember(section) { mutableStateOf<FileItemResponse?>(null) }

    if (section == DrftSection.Settings) {
        FeatureCardScreen {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                color = Color.Transparent
            ) {
                Box(
                    modifier = Modifier
                        .background(
                            brush = Brush.linearGradient(
                                listOf(
                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.22f),
                                    MaterialTheme.colorScheme.secondary.copy(alpha = 0.12f),
                                    MaterialTheme.colorScheme.surface
                                )
                            ),
                            shape = MaterialTheme.shapes.large
                        )
                        .padding(18.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(
                                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                                shape = MaterialTheme.shapes.medium
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.Tune,
                                    contentDescription = null,
                                    modifier = Modifier.padding(10.dp),
                                    tint = MaterialTheme.colorScheme.primary
                                )
                            }
                            Column {
                                Text(
                                    text = "DRFT Settings",
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Account, device, and library status for this Android client.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        Surface(
                            shape = MaterialTheme.shapes.medium,
                            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.65f),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.CloudDone,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary
                                )
                                Column {
                                    Text(
                                        text = activeUser?.name ?: "Unknown user",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = activeUser?.email ?: "Unknown email",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }
            }

            if (librarySummary != null) {
                StatsRow("Items", librarySummary.totalItems.toString(), "Albums", librarySummary.albumCount.toString())
                StatsRow("Images", librarySummary.imageItems.toString(), "Videos", librarySummary.videoItems.toString())
                StatsRow("Tags", librarySummary.tagCount.toString(), "Version", BuildConfig.VERSION_NAME)
            }
            SettingsInfoCard(
                icon = Icons.Filled.Devices,
                title = "Current server",
                body = serverUrl.ifBlank { "Not set" }
            )
            SettingsInfoCard(
                icon = Icons.Filled.Storage,
                title = "Role and account",
                body = buildString {
                    append(activeUser?.role ?: "Unknown role")
                    if (activeUser?.createdAt != null) {
                        append(" • Created ")
                        append(activeUser.createdAt)
                    }
                }
            )
            if (libraryError?.isNotBlank() == true) {
                ErrorText(libraryError)
            }
            Button(modifier = Modifier.fillMaxWidth(), onClick = onRefresh) {
                Text("Refresh data")
            }
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = onChangeServer) {
                Text("Change server")
            }
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = onSignOut) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Filled.Logout,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Text("Sign out")
                }
            }
        }
        return
    }

    val visibleItems = filteredItems(section, timelineState.items)

    LazyVerticalStaggeredGrid(
        columns = StaggeredGridCells.Adaptive(minSize = 152.dp),
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalItemSpacing = 14.dp,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item(span = StaggeredGridItemSpan.FullLine) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Title(
                        when (section) {
                            DrftSection.All -> "All media"
                            DrftSection.Images -> "Images"
                            DrftSection.Videos -> "Videos"
                            DrftSection.Settings -> "Settings"
                        }
                    )
                    Description(
                        when (section) {
                            DrftSection.All -> "First native timeline slice backed by DRFT pagination and backend totals."
                            DrftSection.Images -> "Image-only timeline slice backed by the DRFT files endpoint."
                            DrftSection.Videos -> "Video-only timeline slice backed by the DRFT files endpoint."
                            DrftSection.Settings -> ""
                        }
                    )
                    Helper("Target server: ${serverUrl.ifBlank { "not set" }}")
                    if (librarySummary != null) {
                        val count = when (section) {
                            DrftSection.Images -> librarySummary.imageItems
                            DrftSection.Videos -> librarySummary.videoItems
                            else -> librarySummary.totalItems
                        }
                        Helper("Backend count: $count")
                    }
                    if (libraryLoading) {
                        Helper("Loading library snapshot from DRFT...")
                    }
                    if (libraryError?.isNotBlank() == true) {
                        ErrorText(libraryError)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(modifier = Modifier.weight(1f)) {
                            Button(modifier = Modifier.fillMaxWidth(), onClick = onRefresh) {
                                Text("Refresh")
                            }
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = onChangeServer) {
                                Text("Change server")
                            }
                        }
                    }
                }
            }
        }

        if (visibleItems.isEmpty() && !libraryLoading) {
            item(span = StaggeredGridItemSpan.FullLine) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "No media loaded yet",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Helper("Once DRFT returns files for this section, they will appear here.")
                    }
                }
            }
        }

        items(visibleItems, key = { it.id }) { item ->
            MediaGridTile(
                item = item,
                serverUrl = serverUrl,
                authToken = authToken,
                onOpenMedia = {
                    selectedItem = item
                }
            )
        }

        if (timelineState.hasMore) {
            item(span = StaggeredGridItemSpan.FullLine) {
                OutlinedButton(
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !loadingMore,
                    onClick = onLoadMore
                ) {
                    Text(if (loadingMore) "Loading more..." else "Load more")
                }
            }
        }
    }

    if (selectedItem != null) {
        MediaViewerDialog(
            item = selectedItem!!,
            serverUrl = serverUrl,
            authToken = authToken,
            onDismiss = { selectedItem = null }
        )
    }
}

@Composable
private fun FeatureCardScreen(content: @Composable ColumnScope.() -> Unit) {
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
                verticalArrangement = Arrangement.spacedBy(12.dp),
                content = content
            )
        }
    }
}

@Composable
private fun Eyebrow(value: String) {
    Text(
        text = value,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.Bold
    )
}

@Composable
private fun Title(value: String) {
    Text(
        text = value,
        style = MaterialTheme.typography.headlineMedium,
        fontWeight = FontWeight.Bold
    )
}

@Composable
private fun Description(value: String) {
    Text(
        text = value,
        style = MaterialTheme.typography.bodyLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun Helper(value: String) {
    Text(
        text = value,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun ErrorText(value: String) {
    Text(
        text = value,
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium
    )
}

@Composable
private fun SuccessText(value: String) {
    Text(
        text = value,
        color = MaterialTheme.colorScheme.tertiary,
        style = MaterialTheme.typography.bodyMedium
    )
}

@Composable
private fun StatsRow(leftLabel: String, leftValue: String, rightLabel: String, rightValue: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(modifier = Modifier.weight(1f)) {
            StatCard(
                label = leftLabel,
                value = leftValue,
                modifier = Modifier.fillMaxWidth()
            )
        }
        Box(modifier = Modifier.weight(1f)) {
            StatCard(
                label = rightLabel,
                value = rightValue,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun SettingsInfoCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    body: String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
                shape = MaterialTheme.shapes.medium
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.padding(10.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = body,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun MediaGridTile(
    item: FileItemResponse,
    serverUrl: String,
    authToken: String,
    onOpenMedia: () -> Unit
) {
    val previewUrl = remember(serverUrl, authToken, item.previewUrl) {
        buildAuthenticatedMediaUrl(serverUrl, item.previewUrl, authToken)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpenMedia),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(MaterialTheme.shapes.medium)
        ) {
            if (previewUrl != null) {
                AsyncImage(
                    model = previewUrl,
                    contentDescription = item.fileName,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(previewAspectRatio(item)),
                    contentScale = ContentScale.Crop
                )
            } else {
                MediaFallbackCard(item = item)
            }
            if (item.mediaType == "video") {
                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(8.dp),
                    color = Color.Black.copy(alpha = 0.58f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        text = "VIDEO",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@Composable
private fun MediaViewerDialog(
    item: FileItemResponse,
    serverUrl: String,
    authToken: String,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Color.Black.copy(alpha = 0.95f)
        ) {
            when (item.mediaType) {
                "video" -> VideoViewerContent(
                    item = item,
                    serverUrl = serverUrl,
                    authToken = authToken,
                    onDismiss = onDismiss
                )
                else -> ImageViewerContent(
                    item = item,
                    serverUrl = serverUrl,
                    authToken = authToken,
                    onDismiss = onDismiss
                )
            }
        }
    }
}

@Composable
private fun ImageViewerContent(
    item: FileItemResponse,
    serverUrl: String,
    authToken: String,
    onDismiss: () -> Unit
) {
    val imageUrl = remember(serverUrl, authToken, item.downloadUrl) {
        buildAuthenticatedMediaUrl(serverUrl, item.downloadUrl, authToken)
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (imageUrl != null) {
            AsyncImage(
                model = imageUrl,
                contentDescription = item.fileName,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit
            )
        }
        ViewerChrome(item = item, onDismiss = onDismiss)
    }
}

@Composable
private fun VideoViewerContent(
    item: FileItemResponse,
    serverUrl: String,
    authToken: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val videoUrl = remember(serverUrl, authToken, item.downloadUrl) {
        buildAuthenticatedMediaUrl(serverUrl, item.downloadUrl, authToken)
    }
    var isReady by remember(videoUrl) { mutableStateOf(false) }
    val player = remember(videoUrl) {
        ExoPlayer.Builder(context).build().apply {
            if (videoUrl != null) {
                setMediaItem(MediaItem.fromUri(videoUrl))
                prepare()
                playWhenReady = true
            }
        }
    }

    DisposableEffect(player) {
        val listener = object : androidx.media3.common.Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                isReady = playbackState == androidx.media3.common.Player.STATE_READY
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { viewContext ->
                PlayerView(viewContext).apply {
                    useController = true
                    this.player = player
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
            },
            update = { playerView ->
                playerView.player = player
            }
        )
        if (!isReady) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = Color.White)
            }
        }
        ViewerChrome(item = item, onDismiss = onDismiss)
    }
}

@Composable
private fun ViewerChrome(item: FileItemResponse, onDismiss: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize()) {
        Surface(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp),
            color = Color.Black.copy(alpha = 0.5f),
            shape = MaterialTheme.shapes.medium
        ) {
            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = "Close media",
                    tint = Color.White
                )
            }
        }
        Surface(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .fillMaxWidth()
                .padding(12.dp),
            color = Color.Black.copy(alpha = 0.55f),
            shape = MaterialTheme.shapes.large
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = item.fileName,
                    color = Color.White,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${formatSize(item.sizeBytes)} • ${item.mimeType}",
                    color = Color.White.copy(alpha = 0.85f),
                    style = MaterialTheme.typography.bodySmall
                )
                if (item.widthPx != null && item.heightPx != null) {
                    Text(
                        text = "${item.widthPx} x ${item.heightPx}",
                        color = Color.White.copy(alpha = 0.85f),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                if (item.durationMs != null) {
                    Text(
                        text = formatDuration(item.durationMs),
                        color = Color.White.copy(alpha = 0.85f),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}

@Composable
private fun MediaFallbackCard(item: FileItemResponse) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(previewAspectRatio(item))
            .background(MaterialTheme.colorScheme.surface),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = item.mediaType.uppercase(),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
    }
}

private fun filteredItems(section: DrftSection, items: List<FileItemResponse>): List<FileItemResponse> {
    return when (section) {
        DrftSection.All -> items
        DrftSection.Images -> items.filter { it.mediaType == "image" }
        DrftSection.Videos -> items.filter { it.mediaType == "video" }
        DrftSection.Settings -> items
    }
}


private fun formatSize(sizeBytes: Long): String {
    val kilo = 1024.0
    val mega = kilo * 1024
    val giga = mega * 1024
    return when {
        sizeBytes >= giga -> "%.1f GB".format(sizeBytes / giga)
        sizeBytes >= mega -> "%.1f MB".format(sizeBytes / mega)
        sizeBytes >= kilo -> "%.1f KB".format(sizeBytes / kilo)
        else -> "$sizeBytes B"
    }
}

private fun formatDuration(durationMs: Long): String {
    val totalSeconds = durationMs / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}

private fun previewAspectRatio(item: FileItemResponse): Float {
    val width = item.widthPx?.toFloat()
    val height = item.heightPx?.toFloat()
    return if (width != null && height != null && width > 0f && height > 0f) {
        width / height
    } else if (item.mediaType == "video") {
        16f / 9f
    } else {
        1f
    }
}

private fun buildAuthenticatedMediaUrl(serverUrl: String, mediaPath: String, authToken: String): String? {
    if (serverUrl.isBlank() || mediaPath.isBlank() || authToken.isBlank()) return null
    val base = if (serverUrl.endsWith("/")) serverUrl.dropLast(1) else serverUrl
    val absolute = if (mediaPath.startsWith("http://") || mediaPath.startsWith("https://")) {
        mediaPath
    } else {
        "$base$mediaPath"
    }
    return Uri.parse(absolute)
        .buildUpon()
        .appendQueryParameter("access_token", authToken)
        .build()
        .toString()
}

private fun normalizedServerExample(value: String): String {
    val trimmed = value.trim()
    if (trimmed.isBlank()) {
        return "http://192.168.1.109:8080"
    }
    return if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
        trimmed
    } else {
        "http://$trimmed"
    }
}
