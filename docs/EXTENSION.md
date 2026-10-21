# Browser extension

A tiny Manifest V3 extension that sends the current page, its meta description or selected text to a Radar webhook source.

No build step, no external dependencies.

## Install (Chrome / Edge)

1. Create a webhook source:

   ```bash
   node bin/radar.js source add --kind webhook --title "Browser"
   ```

   The command prints a per-source token. It is shown once.

2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and choose the `extension/` directory.

3. Click the Radar icon, fill in:

   - Radar URL, for example `http://127.0.0.1:8787`
   - source id from step 1
   - source token from step 1

   Save.

4. Open any page, select text if needed, click **Отправить страницу**.

## What is sent

```json
{
  "title": "page title",
  "text": "selection, or meta description, or title",
  "url": "https://...",
  "externalId": "browser:https://..."
}
```

The payload goes to `POST /api/ingest/<sourceId>` with `x-radar-token`. Radar then runs the normal pipeline: deduplication, rules, optional classifier, scoring and sinks.

## Permissions

- `activeTab` and `scripting` — read the current tab only after a click.
- `storage` — keep the Radar URL, source id and token in `chrome.storage.local`.
- `host_permissions` for HTTP/HTTPS — required because a self-hosted Radar can live on any domain.

The token is stored locally and is not synced. Treat it like a password.

## Limitations

- The extension sends the current page, not a whole site.
- It does not log in anywhere or bypass a paywall.
- Pages rendered entirely in a cross-origin iframe may return an empty selection.
