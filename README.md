# DRFT

DRFT is a self-hosted photo and video cloud built as a single Go service with PostgreSQL metadata and SSD-backed file storage.

Today the repo includes:

- a Go backend in `backend/` with auth, media storage, streaming, and admin management
- a web client built with React, Vite, JavaScript, and vanilla CSS
- an Expo-based Android/mobile client for browsing, upload, and viewer flows

Mobile roadmap note:

- `v0.1.0` ships with the current Expo-based Android client
- `v0.2.0` is planned to move Android to a native Kotlin app for stronger media, upload, and playback control

## Documentation

Full project documentation lives in [`docs/`](./docs/index.md).

Start here:

- [Docs home](./docs/index.md)
- [v0.1.0 release checklist](./docs/release-v0.1.0.md)
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

Docker full stack, development:

```bash
make docker-up
```

- web: `http://localhost:3000`
- api: `http://localhost:8080`

Note:

- `make docker-up` uses [`docker-compose.dev.yml`](./docker-compose.dev.yml) and builds from source
- the Go service now lives under [`backend/`](./backend)
- if your network uses a custom npm registry, proxy, or trusted CA, pass them through Docker build args via environment variables:
  - `DRFT_NPM_REGISTRY`
  - `DRFT_NPM_STRICT_SSL`
  - `DRFT_EXTRA_CA_CERT_BASE64`
  - `HTTP_PROXY`
  - `HTTPS_PROXY`
  - `NO_PROXY`

Docker production stack:

```bash
cp .env.prod.example .env.prod
make docker-prod-up
```

- `make docker-prod-up` uses [`docker-compose.prod.yml`](./docker-compose.prod.yml)
- production compose expects published images:
  - `dockermaninthehouse/drft-api`
  - `dockermaninthehouse/drft-web`
- production data is stored on explicit host paths from `.env.prod`:
  - `DRFT_POSTGRES_DATA_PATH`
  - `DRFT_STORAGE_PATH`
  - `DRFT_BACKUPS_PATH`

Publish images:

```bash
./scripts/publish-images.sh v0.1.0-rc
```

This pushes:
- `dockermaninthehouse/drft-api:v0.1.0-rc`
- `dockermaninthehouse/drft-web:v0.1.0-rc`

And, by default, also updates `latest`.

GitHub Actions image publishing:

- workflow file: [`/.github/workflows/publish-images.yml`](./.github/workflows/publish-images.yml)
- automatic publish on pushed git tags like `v0.1.0-rc`
- manual publish through `workflow_dispatch`
- required GitHub repository secrets:
  - `DOCKERHUB_USERNAME`
  - `DOCKERHUB_TOKEN`

Production backup and restore:

- automatic backup service is included in [`docker-compose.prod.yml`](./docker-compose.prod.yml)
- manual backup now:

```bash
sh ./scripts/backup-prod-now.sh
```

- manual restore from a backup directory:

```bash
sh ./scripts/restore-prod-backup.sh ./backups/<timestamp>
```

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
