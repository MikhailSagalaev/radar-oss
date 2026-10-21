# Contributing

Thanks for taking a look. Radar is a small project and the bar for a useful contribution is low: one working adapter, one fixture, one test.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm typecheck
pnpm test
pnpm build
```

Node 22.12+ and pnpm 11 are required. The test suite uses an in-memory SQLite database and never calls the network: adapters are tested against fixtures.

## Adding a source adapter

1. Create `src/sources/<name>.ts` and export a `SourceAdapter`.
2. Register it in `src/sources/index.ts`.
3. Put a small, sanitized HTML/XML/JSON fixture in `test/fixtures/`.
4. Add a test to `test/sources.test.ts`.
5. Declare `access` and `risks` honestly.

The adapter must:

- fetch only the URL from `source.config`;
- respect `ctx.timeoutMs` and `ctx.userAgent`;
- return `RawLead[]`, not database rows;
- never throw for an empty page: return `[]` and log a warning;
- never bypass login, CAPTCHA, paywalls or private groups;
- never include a real person's phone, address or other personal data in a fixture.

If a source requires an account or a session cookie, it is out of scope for the default adapters. Use the `webhook` source: the operator supplies the data they already have access to.

## Adding a sink

1. Create `src/sinks/<name>.ts` with a `SinkAdapter`.
2. Register it in `createSinkRegistry`.
3. Keep the payload minimal and log errors instead of throwing past the pipeline.
4. Add a test with a mocked `fetch`.

## Code style

- TypeScript strict mode; no `any` unless there is no reasonable alternative.
- Small modules, pure functions in `src/core`, side effects in adapters.
- Comments explain *why*, not *what*.
- No new runtime dependency without a short note in the pull request.

## Commits and pull requests

- One adapter or one behavior per pull request.
- Describe the source, its access level and what can break.
- Include the test command output.
- Do not commit `.env`, databases, logs or scraped personal data.

## Legal

By contributing an adapter you confirm that it does not bypass a protection and that you have checked the source's terms. Maintainers may remove an adapter on a platform request.
