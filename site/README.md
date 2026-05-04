# DRFT Landing Site

This directory contains the public-facing DRFT landing page.

It is separate from:

- `frontend/`, which is the authenticated DRFT product UI
- `docs/`, which are developer-facing project docs

## Intended deployment

The landing page is meant to be deployed to GitHub Pages as the main public site for the repository.

## Why it is separate

Keeping the landing page in its own React app lets us:

- design for marketing and storytelling without affecting the product UI
- deploy a user-facing homepage independently
- keep docs and product code cleanly separated
