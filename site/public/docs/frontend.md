# Frontend and UX

## Frontend stack

- React
- Vite
- JavaScript
- vanilla CSS
- React Router

## Docker web serving

For Docker, DRFT uses a multi-stage frontend image:

- a Node builder stage runs `npm ci` and `npm run build`
- nginx serves the built static output

The Docker build also supports:

- custom npm registry
- proxy environment variables
- optional custom CA certificate passed as base64

## Current frontend pages

- `/setup/admin`
- `/login`
- `/reset-password`
- `/photos`
- `/admin/users`
- `/devices`

## Current UX direction

The UI has been moving toward:

- dark, denser layout
- Google Photos-inspired timeline browsing
- cleaner sidebar-first navigation
- media-first presentation
- less card clutter in the grid

## Implemented frontend features

### Auth and setup

- first-admin bootstrap
- login
- forgot password page
- reset by email code

### Gallery

- timeline grouped by date
- masonry-like media grid
- protected image loading
- short auto-preview for videos in the grid
- full media viewer
- metadata panel on demand
- delete confirmation

### Upload UX

- multi-file upload
- folder selection where supported
- drag-and-drop bulk import
- upload queue tray in the action bar
- local preview before upload completes

### Admin

- users page
- add user
- remove user
- role-aware navigation

## Sidebar model

The sidebar currently contains:

- DRFT brand
- media navigation
- admin/device navigation when allowed
- library/storage stats
- current user block

## Future frontend improvements

- stronger empty states
- keyboard navigation
- multi-select and bulk actions
- better mobile media viewer controls
- hover-to-preview refinements
- device/session UI once backend exists
