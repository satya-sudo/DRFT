# DRFT

DRFT is a self-hosted photo and video cloud built as a single Go service with PostgreSQL metadata and SSD-backed file storage.

Today the repo includes:

- a Go backend with auth, media storage, streaming, and admin management
- a web client built with React, Vite, JavaScript, and vanilla CSS
- an Expo-based Android/mobile client for browsing, upload, and viewer flows

## Documentation

Full project documentation lives in [`docs/`](./docs/index.md).

Start here:

- [Docs home](./docs/index.md)
- [Current status](./docs/status.md)
- [Architecture](./docs/architecture.md)
- [Backend and API](./docs/backend.md)
- [Frontend and UX](./docs/frontend.md)
- [Setup and operations](./docs/setup.md)
- [Roadmap and milestones](./docs/roadmap.md)

## Quick start

Node.js:

```bash
node -v
```

Expected:

```bash
v20.x
```

Backend:

```bash
make run
```

Frontend:

```bash
make frontend-dev
```

Mobile:

```bash
cd mobile
npm run start -- --clear
```

Docker backend:

```bash
make docker-up
```

Docker full stack:

- web: `http://localhost:3000`
- api: `http://localhost:8080`

## Current Highlights

- first-admin bootstrap and JWT login
- role-aware user management
- password reset by email code and master CLI
- image/video upload with metadata extraction
- protected media preview and playback
- per-user media libraries
- storage usage stats
- mobile server setup flow before login
- mobile session persistence
- mobile swipeable media viewer with local save and delete
