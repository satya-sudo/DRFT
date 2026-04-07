# DRFT

DRFT is a self-hosted photo and video cloud built as a single Go backend with PostgreSQL metadata, SSD-backed media storage, and a React web client.

This documentation captures:

- what DRFT already does
- how the system is structured
- how to run it locally or with Docker
- what APIs and flows exist today
- what we should build next

## Documentation

- [Current status](./status.md)
- [Architecture](./architecture.md)
- [Backend and API](./backend.md)
- [Frontend and UX](./frontend.md)
- [Setup and operations](./setup.md)
- [Roadmap and milestones](./roadmap.md)

## Product goals

DRFT is aiming for a private, reliable, extensible personal media cloud with:

- SSD-backed media storage
- PostgreSQL as the metadata source of truth
- JWT-based auth
- admin-first setup
- per-user media isolation
- image and video serving
- a clean gallery experience that can grow over time

## Current highlights

- first-admin bootstrap flow
- login and role-aware user management
- password reset by email code and master CLI command
- protected file serving
- image thumbnails and metadata extraction
- drag-and-drop and bulk upload UX
- per-user gallery timeline
- live storage stats in the sidebar

## GitHub Pages

This `docs/` directory is structured to work well with GitHub Pages.

Suggested repo settings:

1. Open GitHub repository settings.
2. Go to `Pages`.
3. Set source to `Deploy from a branch`.
4. Choose your default branch and `/docs` as the folder.

