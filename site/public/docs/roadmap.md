# Roadmap and Milestones

This roadmap is split into what is done, what should come next, and later-stage ideas.

## Completed milestones

### Milestone 1: Foundation

- project structure in Go
- PostgreSQL schema and migrations
- Docker backend setup
- frontend shell and routing

### Milestone 2: Auth and roles

- first-admin bootstrap
- JWT login
- current user session
- role-aware admin access
- user management

### Milestone 3: Media core

- upload
- list files
- serve files
- delete files
- protected previews
- per-user media linkage

### Milestone 4: UX baseline

- timeline UI
- masonry-like grid
- media viewer
- bulk upload
- queue tray
- storage stats

### Milestone 5: Recovery and ops

- master CLI password reset
- email-code reset
- Dockerized backend
- docs foundation

## Next milestone candidates

### Milestone 6: Device and session management

- real devices/sessions table
- list active sessions
- revoke session/device
- show last seen and issued at

### Milestone 7: Better media processing

- video thumbnails
- video duration extraction
- EXIF improvements
- orientation handling
- more efficient thumbnail strategy

### Milestone 8: Bulk actions

- multi-select in gallery
- bulk delete
- bulk download
- better import progress

### Milestone 9: Search and organization

- albums
- favorites
- tags
- search by filename/date/media type

### Milestone 10: Native Android client

- keep `v0.1.0` on the current Expo-based mobile client
- move `v0.2.0` Android work to a Kotlin-based native client
- prioritize stronger upload control, playback stability, background behavior, and memory handling

## Longer-term ideas

- sharing links
- public/private albums
- mobile app
- background worker pipeline
- notifications
- offline sync and import agents
- duplicate detection
- smarter storage policy and cleanup tools

## Suggested near-term priorities

1. Device/session management
2. Video thumbnails
3. Bulk actions in the gallery
4. Better metadata extraction
5. Search and albums
6. Kotlin Android planning for `v0.2.0`
