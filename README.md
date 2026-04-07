# DRFT

DRFT is a self-hosted photo and video cloud built as a single Go service with PostgreSQL metadata and SSD-backed file storage.

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

Backend:

```bash
make run
```

Frontend:

```bash
make frontend-dev
```

Docker backend:

```bash
make docker-up
```
