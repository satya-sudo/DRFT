# Architecture

## High-level design

```text
Browser / Phone
      |
      v
Go API Server
      |
      +--> PostgreSQL (users, files, reset codes, metadata)
      |
      +--> SSD Storage (original files, thumbnails)
```

## Core principles

- single-node system
- simple deployment model
- DB as metadata source of truth
- disk as file source of truth
- JWT-authenticated API
- no microservices
- no background queue in v1

## Data model

### Users

Users have:

- `id`
- `name`
- `email`
- `password_hash`
- `role`
- `created_at`

### Files

Files have:

- `id`
- `user_id`
- `file_name`
- `original_extension`
- `storage_key`
- `mime_type`
- `size_bytes`
- `media_type`
- checksum and metadata fields
- optional thumbnail key
- timestamps for creation, capture, and deletion

### Password reset codes

Reset codes are stored separately with:

- `user_id`
- hashed code
- expiry
- consumed timestamp

## Media ownership model

Media is linked to a user through `files.user_id`.

This means:

- each user sees only their own files
- file reads are authorized per user
- file deletes are authorized per user
- library usage is shown per user

Disk capacity remains instance-wide because the underlying machine storage is shared.

## Storage layout

Files are stored using a hashed path layout:

```text
/storage/ab/cd/<uuid>.<ext>
```

This keeps directories balanced and avoids path collisions.

## Future architectural extensions

- session/device registry
- background workers
- video thumbnail generation
- search index
- albums and sharing model

