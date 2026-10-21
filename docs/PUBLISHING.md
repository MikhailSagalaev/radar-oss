# Publishing checklist

Radar is developed inside the ProfiPass workspace but must be published as a separate repository. Do not publish the monorepo: it contains internal board data, logs and product code that are not part of this project.

## 1. Move the directory

```bash
# from C:\projects\ProPass
move radar-oss C:\projects\radar-oss
cd C:\projects\radar-oss
```

A sibling directory avoids a nested Git repository inside ProfiPass.

## 2. Scan for secrets and data

```bash
git init
git add .
git status
```

Before the first commit, check:

- no `.env`, `data/`, `dist/`, `node_modules/` or logs are staged;
- no real tokens, cookies or email addresses in fixtures;
- no screenshots with personal data;
- `git grep -nE "(api[_-]?key|token|password|secret)"` only finds documentation and env names.

The repository `.gitignore` already excludes `.env`, `data/`, `dist/`, logs and coverage.

## 3. Create the repository

```bash
gh repo create radar-oss --public --source=. --remote=origin --push
```

Suggested description:

> Self-hosted lead pipeline for public order sources: RSS, IMAP, Telegram, Kwork and webhooks.

Topics: `lead-generation`, `self-hosted`, `rss`, `imap`, `telegram`, `typescript`, `sqlite`, `open-source`.

## 4. Before the announcement

- [ ] CI is green on `main`.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build` pass locally.
- [ ] Docker image builds and `/health` answers inside the container.
- [ ] README quick start works from a clean clone.
- [ ] `LICENSE` is AGPL-3.0 and `package.json` says `AGPL-3.0-only`.
- [ ] `SECURITY.md` has a working private reporting channel.
- [ ] The extension loads unpacked and sends a page to a webhook source.
- [ ] No adapter claims to support a source it cannot actually read.

## 5. Release

```bash
git tag v0.2.0
git push origin v0.2.0
gh release create v0.2.0 --generate-notes
```

Attach nothing that contains a database or a `.env`.

## 6. Naming

"Radar" is a working title and is heavily used by other projects. Before a public launch, check GitHub, npm and trademarks, and rename if needed. The code does not depend on the name except for the `radar` binary and the dashboard title.

## 7. What not to promise

- "collects from every marketplace";
- "free hosted service";
- "bypasses anti-bot protection";
- "replaces a CRM".

The README already states the limits. Keep it that way.
