package com.drft.mobile.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DrftDarkColors = darkColorScheme(
    primary = Color(0xFF8FB4FF),
    onPrimary = Color(0xFF0A1A36),
    secondary = Color(0xFFB8C7FF),
    tertiary = Color(0xFF9FD6C0),
    background = Color(0xFF101114),
    surface = Color(0xFF17191E),
    surfaceVariant = Color(0xFF222630),
    onSurface = Color(0xFFE8ECF5),
    onSurfaceVariant = Color(0xFFB6BFCC)
)

private val DrftLightColors = lightColorScheme(
    primary = Color(0xFF3158B0),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF4A5FA6),
    tertiary = Color(0xFF2E7A63),
    background = Color(0xFFF5F7FB),
    surface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFFE7ECF5),
    onSurface = Color(0xFF101114),
    onSurfaceVariant = Color(0xFF4F5968)
)

@Composable
fun DrftTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DrftDarkColors else DrftLightColors,
        content = content
    )
}
