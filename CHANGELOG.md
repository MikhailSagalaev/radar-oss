# Changelog

## 0.2.3

- The dashboard, source page, login and extension popup are fully monochrome.
- Status is conveyed by filled, ring and muted dots instead of colour.
- Updated screenshots.

## 0.2.2

- The admin session cookie is marked `Secure` when the request arrives over HTTPS.
- Test deployment behind nginx with `X-Forwarded-Proto`.

## 0.2.1

- Sources can be added, enabled, disabled and deleted from the dashboard.
- New source form covers RSS, Telegram, Kwork, IMAP and webhook; webhook tokens are shown once.
- Updated CI actions to checkout v7, setup-node v7 and pnpm/action-setup v6.
- Added tests for the dashboard source flow.

## 0.2.0

- Added an IMAP source for job-alert emails; credentials stay in an environment variable.
- Added per-source health: 24-hour counters, success rate, last run and a `/sources/:id` page.
- Added a Manifest V3 browser extension that sends a page or selection to a webhook source.
- Redesigned the dashboard and source page: fewer blocks, one accent, no cards or shadows.
- Added `--token` for webhook sources and automatic token generation.
- Added the `defineSource` / `defineSink` SDK helpers and `docs/PLUGINS.md`.
- Added CI, `SECURITY.md`, `PUBLISHING.md` and the extension guide.

## 0.1.0

- Initial MVP: RSS, Telegram public, Kwork and webhook sources.
- SQLite store, deduplication, spam rules, scoring.
- Console, Telegram and webhook sinks.
- CLI, HTTP API, server-rendered dashboard.
- 28 tests and a Dockerfile.
