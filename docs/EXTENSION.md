# Browser extension

A Manifest V3 extension that sends the current page, its schema.org/JobPosting metadata or selected text to a Radar webhook source — in one click, via a context menu or the `Alt+Shift+R` hotkey.

No build step, no external dependencies.

## Install (Chrome / Edge / Yandex Browser)

1. Create a webhook source:

   ```bash
   node bin/radar.js source add --kind webhook --title "Browser"
   ```

   The command prints a per-source token. It is shown once. The `/extension` page on the server lists the IDs of ready webhook sources for copying.

2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and choose the `extension/` directory.

3. Click the Radar icon and fill in:

   - Radar URL, for example `http://127.0.0.1:8787`
   - source id from step 1
   - source token from step 1
   - contributor nickname (`@telegram`) — optional; every lead you submit is signed with it

   Save.

## What it can do

- **Send page** — popup button or `Alt+Shift+R`. The extension parses `schema.org/JobPosting` first (title, company, salary, stack, city) and falls back to the meta description; you can switch the lead type between «Заказ» (gig) and «Вакансия» (job) before sending.
- **Send selection** — select text on any page, right click → «Отправить заказ в Radar». The selection is submitted with the page title and URL.
- After a successful send the popup shows a direct link to the lead card on the server.

## What is sent

```json
{
  "type": "gig",
  "title": "page or JobPosting title",
  "text": "selection, or JobPosting description, or meta description",
  "url": "https://...",
  "author": "@nickname (community)",
  "externalId": "browser:https://..."
}
```

The payload goes to `POST /api/ingest/<sourceId>` with `x-radar-token`. Radar then runs the normal pipeline: deduplication, rules, optional classifier, scoring and sinks.

## Permissions

- `activeTab` and `scripting` — read the current tab only after a click or hotkey.
- `storage` — keep the Radar URL, source id, token and nickname in `chrome.storage.local`.
- `contextMenus` and `notifications` — the right-click submission and its feedback.
- Content scripts are declared for all HTTP/HTTPS pages, but they only listen for an extract message from the extension and do nothing on their own.

The token is stored locally and is not synced. Treat it like a password.

## Limitations

- The extension sends the current page, not a whole site.
- It does not log in anywhere or bypass a paywall.
- Pages rendered entirely in a cross-origin iframe may return an empty selection.
