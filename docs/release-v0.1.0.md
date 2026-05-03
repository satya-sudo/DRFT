# v0.1.0 Release Checklist

This checklist is the release gate for the first production push.

Target release window:

- Sunday, April 26, 2026 at night

Scope rule:

- no new features
- bug fixes, hardening, packaging, and validation only

## 1. Core server

- [x] `drft-api` starts cleanly in Docker
- [x] `drft-web` starts cleanly in Docker
- [x] `postgres` is healthy
- [x] `/healthz` returns `200`
- [x] web app loads from `:3000`
- [x] API responds from `:8080`
- [x] no container restart loops
- [ ] no obvious errors in `docker compose logs`

## 2. Auth and boot flow

- [x] fresh load checks health first
- [x] app does not redirect to setup or login when backend is unavailable
- [ ] setup page only appears when admin is truly not created
- [x] login works with valid credentials
- [x] invalid login shows the correct error
- [x] existing token restores session correctly
- [ ] logout works
- [ ] invalid or expired token is rejected cleanly

Notes:

- `setup page only appears when admin is truly not created` is intentionally still open until we run the destructive empty-db/bootstrap check.

## 3. Web app

- [x] timeline loads the first page correctly
- [x] infinite scroll loads more media
- [x] `All`, `Images`, and `Videos` filters work
- [x] Albums page loads
- [x] Tags page loads
- [x] server status popover shows backend status and version correctly
- [x] image viewer opens reliably
- [x] video viewer plays reliably
- [x] delete works with confirmation
- [x] upload queue survives page navigation

## 4. Web uploads

- [x] small image upload works
- [x] small video upload works
- [x] large file upload works
- [x] chunked upload starts for large files
- [x] failed chunk retries correctly
- [x] upload errors show useful messages
- [x] uploaded media appears in the timeline without a full reload
- [x] nginx no longer blocks chunk uploads with `413`

## 5. Mobile app

- [x] app boots with saved server prefilled
- [x] change server keeps the current value populated
- [x] login works
- [ ] timeline loads reliably
- [x] paginated loading is stable without repeated load-more timeout spam
- [x] `All`, `Images`, and `Videos` sections work
- [ ] Albums and Tags screens open
- [ ] image viewer opens reliably
- [ ] video viewer plays reliably
- [ ] media requests do not intermittently fail with `401`

Notes:

- mobile counts now use backend totals instead of the currently paginated on-screen items
- the repeated mobile `load more failed DRFT API request timed out` loop is considered fixed
- mobile still has known instability around upload reliability, video playback, and general request timing, so this section is not release-green yet

## 6. Mobile uploads

- [ ] small upload works
- [ ] large upload works
- [ ] queue survives section changes
- [ ] progress never exceeds `100%`
- [ ] retry actually restarts a failed upload
- [ ] stuck uploads are either resolved or reproducible with a clear cause
- [ ] queue messaging clearly shows direct vs chunked upload path

Notes:

- mobile now prefers chunked upload much more aggressively, but upload speed and reliability are still not stable enough to mark this section done
- the current mobile client should be treated as foreground-only for uploads during `v0.1.0`

## 7. Media stability

- [x] image previews load fast enough
- [x] video previews behave predictably
- [x] opening one viewer item does not trigger excessive parallel media fetches
- [x] range requests (`206`) work for video playback
- [x] deleting media updates the UI correctly

## 8. Data and collections

- [x] Albums route is intentionally limited to a polished `Coming soon` page for `v0.1.0`
- [x] Tags route is intentionally limited to a polished `Coming soon` page for `v0.1.0`
- [x] no half-finished collection management actions are exposed in the web release
- [x] empty states and placeholder copy are correct and readable

## 9. Production packaging

- [ ] `docker-compose.prod.yml` is correct
- [ ] images build successfully
- [ ] image publish script works
- [ ] environment values are ready
- [ ] server can pull the latest images
- [ ] rollback tag is known before deploy

## 10. Final smoke test

- [ ] fresh admin setup works
- [ ] login on web works
- [ ] login on mobile works
- [ ] upload image on web works
- [ ] upload video on web works
- [ ] upload image or video on mobile works
- [ ] browse timeline works
- [ ] open image works
- [ ] play video works
- [ ] delete one item works
- [ ] restart the stack and verify the app still works

## Current release read

- web is close to `v0.1.0-rc` ready
- backend and Docker startup are in good shape
- mobile is improved, but still not stable enough to call release-ready without more upload and playback work

## Suggested execution order

1. Core server and auth flow
2. Web upload and viewer flow
3. Mobile upload and viewer flow
4. Albums and tags sanity check
5. Production packaging
6. Final smoke test
