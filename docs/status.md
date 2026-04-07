# Current Status

This is the current state of DRFT as of the latest implemented milestone.

## Backend

The Go backend currently includes:

- environment-based configuration
- PostgreSQL-backed auth and media metadata
- automatic SQL migration application at startup
- JWT authentication
- role-aware authorization
- first-admin bootstrap
- admin user management
- password reset flows
- media upload, list, stream, and delete endpoints
- protected media access
- storage stats endpoint

## Frontend

The web client currently includes:

- React + Vite + JavaScript + vanilla CSS
- first-run admin bootstrap page
- login flow
- forgot-password and reset-by-code flow
- timeline-style media gallery
- masonry-like media grid
- image and video preview support
- bulk upload UX
- upload queue tray in the action bar
- admin user management UI
- device page placeholder
- role-aware navigation

## Implemented flows

### Authentication

- first admin creation
- login
- current user session restore
- role-aware admin-only pages
- password reset by email code
- password reset by master CLI command

### Media

- upload image/video
- file metadata extraction
- image thumbnail generation
- list current user media only
- open protected media
- video preview in grid
- viewer actions such as info, download, delete
- delete confirmation

### Storage

- SSD-backed media storage
- hash-based file path generation
- storage usage stats
- per-user media usage number
- instance-wide disk capacity number

## What is intentionally not built yet

- sharing links
- albums
- search indexing
- thumbnails for video
- device/session registry
- background job system
- Redis/cache layer
- mobile sync logic

