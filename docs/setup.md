# Setup and Operations

## Local development

### Backend

```bash
make run
```

### Frontend

```bash
make frontend-dev
```

Frontend runs on:

- `http://localhost:5173`

Backend runs on:

- `http://localhost:8080`

## Docker setup

Start backend and PostgreSQL:

```bash
make docker-up
```

Useful commands:

```bash
make docker-logs
make docker-down
```

Persisted Docker volumes:

- `drft_postgres_data`
- `drft_storage`

## First admin setup

1. Start backend and frontend.
2. Open the web app.
3. If no admin exists, DRFT routes to `/setup/admin`.
4. Create the first admin account.

## Password reset

### Master CLI reset

If you are using Docker:

```bash
docker compose exec drft-api drft reset-password --email you@example.com
```

If you want to set the password explicitly:

```bash
docker compose exec drft-api drft reset-password --email you@example.com --password 'NewStrongPassword123!'
```

### Email-code reset

Configure Gmail SMTP-style settings:

- `DRFT_SMTP_HOST=smtp.gmail.com`
- `DRFT_SMTP_PORT=587`
- `DRFT_SMTP_USERNAME=your_gmail@gmail.com`
- `DRFT_SMTP_PASSWORD=your_gmail_app_password`
- `DRFT_SMTP_FROM_EMAIL=your_gmail@gmail.com`
- `DRFT_SMTP_FROM_NAME=DRFT`

Then use the web flow at:

- `/reset-password`

## GitHub Pages

To publish the docs:

1. Push the repository with the `docs/` directory.
2. Open GitHub repository settings.
3. Go to `Pages`.
4. Choose `Deploy from a branch`.
5. Select the branch and the `/docs` folder.

