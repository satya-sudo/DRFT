package com.drft.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.drft.mobile.ui.DrftApp
import com.drft.mobile.ui.theme.DrftTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DrftTheme {
                DrftApp()
            }
        }
    }
}
