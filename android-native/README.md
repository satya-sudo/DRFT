# DRFT Android Native

This directory contains the Kotlin-based native Android rewrite planned for `v0.2.0`.

It lives alongside the existing Expo app on purpose:

- `mobile/` remains the release path for `v0.1.0`
- `android-native/` is the migration track for the stronger Android client

## Why this exists

The Expo client helped DRFT move quickly, but the Android app now needs tighter control over:

- large media uploads
- video playback stability
- background and foreground lifecycle behavior
- image and video caching
- memory usage during upload and playback

The native Android app is where we solve those more seriously.

## Tech direction

- Kotlin
- Jetpack Compose
- DataStore for local config and session persistence
- Retrofit and OkHttp for API access
- Media3 for playback
- WorkManager for future background upload and sync work

## Initial migration scope

The first Kotlin milestones should mirror the parts of DRFT mobile that matter most:

1. server setup and validation
2. login and session restore
3. timeline with paginated media loading
4. image and video viewer
5. reliable upload pipeline
6. stronger playback and caching behavior

## Project layout

- `app/` Android application module
- `app/src/main/java/com/drft/mobile/` Kotlin source
- `app/src/main/res/` Android resources

## Build note

This is an initial scaffold for the rewrite branch. It is intentionally separate from the Expo CI workflow and will get its own Android-native build workflow as the Kotlin client becomes functional.
