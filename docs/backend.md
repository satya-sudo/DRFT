# Backend and API

## Backend stack

- Go
- PostgreSQL
- local/SSD filesystem storage
- bcrypt password hashing
- JWT auth

## Main backend areas

- `cmd/drft/`
  CLI entrypoint and reset-password command
- `internal/app/`
  app wiring and startup
- `internal/auth/`
  auth, roles, tokens, password reset, mailer
- `internal/media/`
  upload, metadata extraction, serving, storage stats
- `migrations/`
  SQL schema changes

## Current API surface

### Setup and auth

- `GET /api/v1/setup/status`
- `POST /api/v1/setup/admin`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/password-reset/request`
- `POST /api/v1/auth/password-reset/confirm`

### Admin

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `DELETE /api/v1/admin/users/:id`

### Media

- `GET /api/v1/files`
- `POST /api/v1/upload`
- `GET /api/v1/file/:id`
- `DELETE /api/v1/file/:id`
- `GET /api/v1/storage/stats`

## Current backend behavior

### Auth

- first user becomes admin through setup flow
- login returns JWT plus current user payload
- role permissions are derived centrally in backend code
- admin/user access is enforced server-side

### Password reset

Two recovery paths exist:

1. Email reset code
2. Master CLI reset command

#### Email reset code

Request:

- user submits email
- DRFT creates a short-lived reset code
- DRFT stores a hash of the code
- DRFT sends the code by email

Confirm:

- user submits email, code, and new password
- DRFT verifies expiry and code hash
- password is replaced

#### Master CLI reset

Example:

```bash
docker compose exec drft-api drft reset-password --email you@example.com
```

Or with an explicit password:

```bash
docker compose exec drft-api drft reset-password --email you@example.com --password 'NewStrongPassword123!'
```

### Media upload pipeline

Current upload flow:

1. authenticate user
2. parse multipart upload
3. sniff MIME type
4. write file to storage
5. compute checksum
6. extract metadata
7. generate image thumbnail if applicable
8. insert DB record tied to `user_id`

### Storage stats

Current stats API returns:

- `drftUsedBytes`
  per-user library usage
- `availableBytes`
  instance-wide free disk space
- `totalBytes`
  instance-wide total disk capacity

## Environment variables

Core:

- `DRFT_APP_ENV`
- `DRFT_HTTP_ADDR`
- `DRFT_DB_DSN`
- `DRFT_STORAGE_ROOT`
- `DRFT_JWT_SECRET`
- `DRFT_MAX_UPLOAD_SIZE_BYTES`

Password reset / email:

- `DRFT_SMTP_HOST`
- `DRFT_SMTP_PORT`
- `DRFT_SMTP_USERNAME`
- `DRFT_SMTP_PASSWORD`
- `DRFT_SMTP_FROM_EMAIL`
- `DRFT_SMTP_FROM_NAME`
- `DRFT_PASSWORD_RESET_TTL_MINUTES`

