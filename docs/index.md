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
- [v0.1.0 release checklist](./release-v0.1.0.md)
- [Kotlin Android plan for v0.2.0](./android-v0.2.0-plan.md)
- [OpenAPI-style backend spec](./openapi-v0.1.0.yaml)
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

The public DRFT site now deploys through the repo GitHub Actions workflow in `site/`.

Suggested repo settings:

1. Open GitHub repository settings.
2. Go to `Pages`.
3. Set source to `GitHub Actions`.
4. Let the landing-site workflow publish the built site.
