# Radar

[![CI](https://github.com/MikhailSagalaev/radar-oss/actions/workflows/ci.yml/badge.svg)](https://github.com/MikhailSagalaev/radar-oss/actions/workflows/ci.yml)

Self-hosted lead pipeline for public order sources.

Radar watches the sources you configure, normalizes new orders, removes duplicates, filters spam, scores relevance and delivers leads to Telegram, a webhook or the console. It is a small, inspectable alternative to paid "lead radar" channels.

**Status: early v0.3.0.** It is not a hosted service and it does not promise to scrape every marketplace. It gives you a pipeline, a few working adapters and a clear contract for adding more.

![Radar leads](docs/screenshots/dashboard.png)

## Why

Small teams and freelancers often pay for Telegram channels that resell the same public orders. The collection layer is not the moat; relevance, speed and routing are. Radar makes the collection layer free and replaceable:

- one process, PostgreSQL 17 with pgvector, transactional outbox pattern;
- rules-first filtering, optional LLM classification with your own key;
- sources are adapters, not hard-coded scrapers;
- data stays on your server.

## What it is not

- Not a hosted SaaS and not a public lead database.
- Not a CAPTCHA bypass, not an account farm, not a private-group scraper.
- Not an auto-responder. It collects and routes; a human decides.
- Not a guarantee of completeness. Public pages change, and adapters break.

## Features

- RSS/Atom, IMAP, public Telegram channels, Kwork public projects and inbound webhooks.
- URL canonicalization, fingerprint deduplication and cross-source title matching.
- Spam and scam rules for the categories that are never a real order.
- Optional OpenAI-compatible classifier; the pipeline works without it.
- Scoring by keywords, budget, freshness, city and source trust.
- Sinks: console, Telegram Bot API, generic webhook.
- Per-source health: 24-hour counters, success rate, last run and a detail page.
- CLI, HTTP API and a minimal server-rendered dashboard.
- Lead inbox: search, status filters, an internal lead page with full text, score and source.
- Add, edit, enable, disable and delete sources from the dashboard; webhook tokens are shown once.
- A Manifest V3 browser extension for sending the current page to a webhook source.
- Tests with fixtures for every adapter.

## Quick start

Requirements: Docker Compose (recommended) or Node.js 22.12+, pnpm 11, and PostgreSQL 17.

### Running with Docker Compose (Recommended)

```bash
cp .env.example .env
# Set RADAR_ADMIN_TOKEN and POSTGRES_PASSWORD in .env
docker compose up -d --build
```

The database runs on PostgreSQL 17 with `pgvector`. Radar is available at `http://127.0.0.1:8787`.

### Running Locally

```bash
pnpm install
cp .env.example .env
pnpm build

# Run migrations
node bin/radar.js migrate

# Load popular freelance presets (FL.ru, Habr Freelance, Kwork, Telegram)
node bin/radar.js source presets --add

node bin/radar.js poll
node bin/radar.js leads
node bin/radar.js serve
```

Open `http://127.0.0.1:8787`. If `RADAR_ADMIN_TOKEN` is set, the dashboard asks for it once and stores it in an HTTP-only cookie.

For development without a build:

```bash
pnpm dev -- source list
pnpm dev -- serve
```

### IMAP

Point Radar at a mailbox that already receives job alerts. The password is read from an environment variable, not stored in the database.

```bash
export RADAR_IMAP_PASSWORD="app-password"

node bin/radar.js source add \
  --kind imap \
  --title "Job alerts" \
  --host imap.example.com \
  --user radar@example.com \
  --password-env RADAR_IMAP_PASSWORD \
  --mailbox INBOX \
  --subject "заказ" \
  --since-days 7
```

Use an app password, not the main account password. `--mark-seen` is off by default, so a failed run can be retried.

## Sources

| Kind | Access | Status | Requirements |
|---|---|---|---|
| `rss` | official | works | a feed URL |
| `imap` | user-provided | works | host, user and an env var with the password |
| `telegram` | public | works | a public channel username; reads `t.me/s/` |
| `kwork` | public | works, fragile | no account; parses the embedded page state |
| `webhook` | user-provided | works | `POST /api/ingest/:sourceId` with a per-source token |

Planned: RSS auto-discovery, generic JSON API.

Every adapter declares its access level and risks in code. New adapters are expected to ship with a fixture and a contract test.

## Sinks
| Kind | Configuration |
|---|---|
| `console` | `RADAR_CONSOLE_SINK=true` (default) |
| `telegram` | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` |
| `webhook` | `WEBHOOK_URL` + optional `WEBHOOK_SECRET` |

A sink failure marks the lead as `failed`, records the error and does not stop other sinks.

## Browser extension

A tiny Manifest V3 extension sends the current page or selected text to a webhook source. It has no build step and no dependencies.

```bash
node bin/radar.js source add --kind webhook --title "Browser"
# copy the token printed once

# chrome://extensions -> Developer mode -> Load unpacked -> extension/
```

See [docs/EXTENSION.md](docs/EXTENSION.md) for the full walkthrough.

## Health

The dashboard shows one row per source on `/sources`: status, last run and 24-hour counters. Click a source for `/sources/:id` with the configuration, recent leads, runs and success rate. The same data is available at `GET /api/sources/health`.

![Sources](docs/screenshots/sources.png)

![Source health](docs/screenshots/source.png)

## CLI

| Command | What it does |
|---|---|
| `radar migrate` | apply database migrations in PostgreSQL |
| `radar init` | initialize database and print next steps |
| `radar source add ...` | add a source |
| `radar source list` | list sources |
| `radar source enable <id>` / `disable` / `remove` | manage sources |
| `radar poll [id]` | poll one source or all enabled sources once |
| `radar run [--once]` | poll continuously |
| `radar serve [--port] [--no-scheduler]` | HTTP API + dashboard |
| `radar leads [--status] [--source] [--json]` | list leads |
| `radar runs` | recent poll runs |
| `radar stats` | counters |
| `radar export --format json\|csv` | export leads |

## HTTP API

`GET /health` is public. Everything under `/api` requires the admin token unless `RADAR_PUBLIC_READ=true`; mutations always require it.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/stats` | counters |
| `GET` | `/api/sources` | list sources |
| `GET` | `/api/sources/health` | per-source 24-hour health |
| `POST` | `/api/sources` | create a source |
| `PATCH` | `/api/sources/:id` | enable/disable or edit |
| `DELETE` | `/api/sources/:id` | delete |
| `POST` | `/api/sources/:id/poll` | poll one source |
| `POST` | `/api/poll` | poll all enabled sources |
| `GET` | `/api/leads` | list leads |
| `GET` | `/api/runs` | recent runs |
| `POST` | `/api/ingest/:sourceId` | accept a lead from a webhook source |

The UI has two pages: `/` for leads and `/sources` for sources. A lead opens at `/leads/:id` with the full text and delivery details. New sources are added at `/sources/new`; an existing one is edited at `/sources/:id/edit`.

![Lead](docs/screenshots/lead.png)

![New source](docs/screenshots/new-source.png)

Authentication: `Authorization: Bearer <RADAR_ADMIN_TOKEN>` or `x-radar-token`. A webhook source may have its own `config.token` and accepts `x-radar-token: <source token>` on `/api/ingest/:sourceId`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://radar:...@postgres:5432/radar` | PostgreSQL connection string |
| `RADAR_HOST_PORT` | `8787` | HTTP port exposed on the host |
| `RADAR_ADMIN_TOKEN` | unset | protects the API and dashboard (min 32 chars in production) |
| `RADAR_USER_AGENT` | `RadarBot/0.3.0 ...` | sent to sources |
| `RADAR_HTTP_TIMEOUT_MS` | `15000` | per-request timeout |
| `RADAR_POLL_INTERVAL_SEC` | `300` | scheduler interval |
| `RADAR_PUBLIC_READ` | `false` | allow read-only API without a token |
| `RADAR_CONSOLE_SINK` | `true` | log delivered leads |
| `TELEGRAM_BOT_TOKEN` | unset | Telegram sink |
| `TELEGRAM_CHAT_ID` | unset | Telegram sink target |
| `WEBHOOK_URL` | unset | webhook sink |
| `WEBHOOK_SECRET` | unset | `x-radar-secret` header |
| `RADAR_LLM_ENABLED` | `false` | enable the classifier |
| `OPENAI_API_KEY` | unset | classifier key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `OPENAI_MODEL` | `gpt-4o-mini` | classifier model |
| `PORT` | `8787` | HTTP port |

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

The database lives in `./data`, mounted into the container. The image runs `radar serve`; the scheduler is enabled by default.

## Legal and ethics

Radar is a self-hosted tool. Whoever runs it is responsible for what it collects and where it sends it.

- Prefer feeds, official APIs and data the operator already has access to.
- Do not use Radar to bypass authentication, CAPTCHA or private groups.
- Public pages are not automatically free to republish: database rights, copyright, personal-data law and platform terms still apply.
- Store the minimum, link to the original and do not build a public database of other people's orders.
- Respect rate limits and identify your bot with a real `RADAR_USER_AGENT`.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the pipeline, contracts, data model and roadmap. Adapter authors should read [docs/PLUGINS.md](docs/PLUGINS.md); publishing notes are in [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: add one adapter, one fixture, one test; do not add a source that requires bypassing a protection.

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
