# DRFT Mobile

DRFT Mobile is the Expo-based client for browsing, uploading, and viewing your private DRFT media library from Android.

Target SDK:

- Expo SDK 54
- Play Store Expo Go compatible with SDK 54

## Current scope

- server setup flow before login
- login
- session restore
- image/video timeline
- gallery drawer with filters and settings
- swipeable media viewer
- save media to local device
- delete media with confirmation
- upload from device gallery
- sign out and change server

## Run locally

Node.js:

```bash
node -v
```

Expected:

```bash
v20.x
```

1. Install dependencies:

```bash
cd mobile
npm install
```

2. Start Expo:

```bash
npm run start -- --clear
```

Or:

```bash
npm run android -- --clear
```

## API base URL

The app now asks for the DRFT server on first run and saves it locally.

You can still prefill the setup form with:

- `EXPO_PUBLIC_API_BASE_URL`

Examples:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8080 npm run start -- --clear
```

For a physical Android device on your local network:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8080 npm run start
```

The user still confirms the server inside the app before login.

## Mobile behavior

- first open asks for DRFT host and port
- server is validated before login is shown
- selected server is saved locally
- saved login session is restored when possible
- drawer includes `Everything`, `Images`, `Videos`, and `Settings`
- bottom drawer area shows current server info
- viewer supports left/right swiping through current media set

## Notes

- Admin management and device management are not in mobile yet.
- Video playback uses `expo-video`, which is the supported replacement for `expo-av` on the current Expo SDK line.
- Media save-to-device uses `expo-file-system` and `expo-media-library`.
