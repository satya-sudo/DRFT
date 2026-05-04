# Kotlin Android Plan for v0.2.0

This is the working plan for the Kotlin-based Android rewrite of DRFT.

The goal is not just to "port the Expo app." The goal is to ship a more reliable Android client for large-media workflows, protected playback, and stronger upload behavior.

## Overall direction

- keep `mobile/` as the Expo-based `v0.1.0` client
- build `android-native/` as the Kotlin-based `v0.2.0` Android client
- migrate feature by feature, not all at once
- prioritize reliability and observability over UI polish early on

## Success criteria for v0.2.0

The Kotlin client should be meaningfully better than the Expo client in these areas:

- upload reliability for large media
- video playback stability
- fewer timeout and memory issues
- better lifecycle handling when the app backgrounds or resumes
- clearer request and error handling
- stronger control over caching, paging, and rendering behavior

## Migration principles

1. Build the vertical slices in dependency order.
2. Keep the backend API contract stable where possible.
3. Use feature toggles or placeholders rather than half-working screens.
4. Prefer production-stable defaults over clever behavior.
5. Track "done" only when a feature is both implemented and device-tested.

## Architecture track

These are the platform foundations we should establish early because many later features depend on them.

### A1. App foundation

- [ ] Gradle wrapper and native build workflow
- [ ] app package, signing, and versioning strategy
- [ ] base Compose navigation shell
- [ ] app theme and shared design tokens
- [ ] environment configuration strategy for server URL handling

Done when:

- the Kotlin app builds locally and in CI
- the app launches on a physical Android device
- version and package identity are stable

### A2. Data and networking foundation

- [ ] Retrofit client
- [ ] OkHttp client with auth interceptor
- [ ] request timeout strategy by endpoint type
- [ ] JSON models for auth, files, storage stats, and uploads
- [ ] centralized error model for UI-safe error reporting

Done when:

- authenticated and unauthenticated requests can be made cleanly
- request failures surface as typed app errors rather than random crashes

### A3. Local persistence foundation

- [ ] DataStore for saved server
- [ ] DataStore or secure local persistence for auth token/session
- [ ] local session restore model
- [ ] local app preferences model

Done when:

- saved server survives restart
- session restore survives restart
- sign-out clears the expected local state

## Feature track

### F1. Server setup and validation

- [ ] server entry screen
- [ ] validate backend reachability with `/healthz`
- [ ] validate setup state with setup status endpoint
- [ ] preserve last successful server
- [ ] change-server flow from inside the app

Done when:

- a fresh install can connect to a DRFT server cleanly
- an existing user can edit the server without wiping state unexpectedly

### F2. Authentication

- [ ] login screen
- [ ] invalid login error handling
- [ ] session restore
- [ ] logout
- [ ] invalid or expired token handling

Done when:

- login, restore, and logout work cleanly across restarts
- token-expiry paths redirect correctly without app confusion

### F3. App shell and navigation

- [ ] top-level navigation shell
- [ ] sections for `All`, `Images`, `Videos`, and `Settings`
- [ ] stable header/title behavior
- [ ] server/version/status presentation

Done when:

- the user can move between sections without losing core session state
- navigation matches DRFT’s intended mobile information architecture

### F4. Timeline data model

- [ ] paginated file list client
- [ ] storage stats client
- [ ] unified screen state for loading, loaded, empty, and error
- [ ] stable totals from backend stats rather than visible-item counts

Done when:

- counts remain correct while paging
- timeline state is predictable and resilient to slow requests

### F5. Timeline UI

- [ ] media grid/list rendering
- [ ] image tiles
- [ ] video tiles
- [ ] explicit load-more or stable infinite loading behavior
- [ ] pull-to-refresh
- [ ] low-jank list updates

Done when:

- scrolling and paging do not flash excessively
- the user can browse large libraries without the UI feeling fragile

### F6. Image loading

- [ ] authenticated image loading
- [ ] preview vs full-quality strategy
- [ ] cache policy for timeline images
- [ ] full-quality image viewer load path

Done when:

- timeline images load at acceptable speed
- full-screen images look sharp enough to match product expectations

### F7. Video preview and playback

- [ ] authenticated video source handling
- [ ] preview thumbnail rendering
- [ ] Media3 player integration
- [ ] buffering/loading indicator
- [ ] playback error states
- [ ] replay/seek behavior

Done when:

- opening and replaying videos is reliable on a physical Android device
- buffering state is clear to the user

### F8. Upload foundation

- [ ] file picker integration
- [ ] upload queue model
- [ ] direct upload path, if still needed
- [ ] chunk upload path
- [ ] progress state model
- [ ] retry state model

Done when:

- uploads no longer rely on Expo-specific file/body workarounds
- the queue can represent real upload state accurately

### F9. Upload reliability

- [ ] staged local file handling
- [ ] resumable chunk strategy
- [ ] retry and backoff model
- [ ] finalization timeout handling
- [ ] large upload memory-safety strategy

Done when:

- large uploads complete reliably on real devices
- progress does not get stuck at `100%` before server completion

### F10. Background-aware upload behavior

- [ ] foreground service strategy where appropriate
- [ ] WorkManager plan for future background/resume behavior
- [ ] safe app pause/resume handling
- [ ] user messaging about unsupported states

Done when:

- app lifecycle transitions no longer make upload behavior feel mysterious
- background limitations are either solved or explicitly handled

### F11. Media viewer actions

- [ ] delete from viewer
- [ ] info/details panel or sheet
- [ ] download/save to device
- [ ] swipe between adjacent items

Done when:

- viewer actions are stable and predictable across image and video media

### F12. Settings and account

- [ ] current server display
- [ ] change server
- [ ] sign out
- [ ] version display
- [ ] release/build metadata

Done when:

- account/server settings are transparent and easy to recover from

## Optional or later tracks

These should not block the core migration unless we decide they are part of `v0.2.0`.

### L1. Albums and tags

- [ ] view-only album support
- [ ] view-only tag support
- [ ] create/edit flows if backend release scope supports it

### L2. Device/session management

- [ ] session/device listing
- [ ] session revoke
- [ ] last-seen and device metadata

### L3. Offline and sync direction

- [ ] download management
- [ ] local media cache policy
- [ ] offline-safe viewer behavior

## Suggested implementation order

This is the recommended sequence so we keep momentum without building on unstable ground.

### Phase 1: foundation

- [ ] A1 App foundation
- [ ] A2 Data and networking foundation
- [ ] A3 Local persistence foundation

### Phase 2: first usable flow

- [ ] F1 Server setup and validation
- [ ] F2 Authentication
- [ ] F3 App shell and navigation

### Phase 3: browsing experience

- [ ] F4 Timeline data model
- [ ] F5 Timeline UI
- [ ] F6 Image loading
- [ ] F7 Video preview and playback

### Phase 4: upload reliability

- [ ] F8 Upload foundation
- [ ] F9 Upload reliability
- [ ] F10 Background-aware upload behavior

### Phase 5: finishing product loops

- [ ] F11 Media viewer actions
- [ ] F12 Settings and account

## Tracking format

When we work on this branch, update items using:

- `not started`
- `in progress`
- `blocked`
- `device testing`
- `done`

If something is blocked, add a short note directly under the item in the next update.

## First recommended next tasks

1. add Gradle wrapper and a native Android CI build path
2. create the app navigation shell
3. implement server setup and validation
4. implement login and session restore

Those four give us the first meaningful Kotlin vertical slice without getting ahead of ourselves.
