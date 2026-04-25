# v0.1.0 Release Checklist

This checklist is the release gate for the first production push.

Target release window:

- Sunday, April 26, 2026 at night

Scope rule:

- no new features
- bug fixes, hardening, packaging, and validation only

## 1. Core server

- [ ] `drft-api` starts cleanly in Docker
- [ ] `drft-web` starts cleanly in Docker
- [ ] `postgres` is healthy
- [ ] `/healthz` returns `200`
- [ ] web app loads from `:3000`
- [ ] API responds from `:8080`
- [ ] no container restart loops
- [ ] no obvious errors in `docker compose logs`

## 2. Auth and boot flow

- [ ] fresh load checks health first
- [ ] app does not redirect to setup or login when backend is unavailable
- [ ] setup page only appears when admin is truly not created
- [ ] login works with valid credentials
- [ ] invalid login shows the correct error
- [ ] existing token restores session correctly
- [ ] logout works
- [ ] invalid or expired token is rejected cleanly

## 3. Web app

- [ ] timeline loads the first page correctly
- [ ] infinite scroll loads more media
- [ ] `All`, `Images`, and `Videos` filters work
- [ ] Albums page loads
- [ ] Tags page loads
- [ ] server status popover shows backend status and version correctly
- [ ] image viewer opens reliably
- [ ] video viewer plays reliably
- [ ] delete works with confirmation
- [ ] upload queue survives page navigation

## 4. Web uploads

- [ ] small image upload works
- [ ] small video upload works
- [ ] large file upload works
- [ ] chunked upload starts for large files
- [ ] failed chunk retries correctly
- [ ] upload errors show useful messages
- [ ] uploaded media appears in the timeline without a full reload
- [ ] nginx no longer blocks chunk uploads with `413`

## 5. Mobile app

- [ ] app boots with saved server prefilled
- [ ] change server keeps the current value populated
- [ ] login works
- [ ] timeline loads reliably
- [ ] infinite scroll loads more items
- [ ] `All`, `Images`, and `Videos` sections work
- [ ] Albums and Tags screens open
- [ ] image viewer opens reliably
- [ ] video viewer plays reliably
- [ ] media requests do not intermittently fail with `401`

## 6. Mobile uploads

- [ ] small upload works
- [ ] large upload works
- [ ] queue survives section changes
- [ ] progress never exceeds `100%`
- [ ] retry actually restarts a failed upload
- [ ] stuck uploads are either resolved or reproducible with a clear cause
- [ ] queue messaging clearly shows direct vs chunked upload path

## 7. Media stability

- [ ] image previews load fast enough
- [ ] video previews behave predictably
- [ ] opening one viewer item does not trigger excessive parallel media fetches
- [ ] range requests (`206`) work for video playback
- [ ] deleting media updates the UI correctly

## 8. Data and collections

- [ ] create album works
- [ ] add media to album works
- [ ] remove media from album works
- [ ] create tag works
- [ ] assign tag to media works
- [ ] remove tag works
- [ ] empty states are correct and readable

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

## Suggested execution order

1. Core server and auth flow
2. Web upload and viewer flow
3. Mobile upload and viewer flow
4. Albums and tags sanity check
5. Production packaging
6. Final smoke test
