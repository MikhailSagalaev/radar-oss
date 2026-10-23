# Privacy Policy for Open Radar Extension

**Last Updated:** October 23, 2026

## Overview
Open Radar Extension is an open-source browser extension designed to help users capture job postings and freelance gigs from public web pages into their self-hosted or community Open Radar instance.

## Data Collection and Usage
1. **No Personal Data Collection:** The extension does not collect, store, sell, or transmit personal data to any centralized third-party servers, tracking services, or analytics platforms.
2. **Local Storage:** The extension stores only user configuration data (`base` server URL, `sourceId`, and optional authentication token) strictly within `chrome.storage.local` on the user's device.
3. **Target Transmission:** Content (page title, description, URL, and salary metadata) is only sent to the specific Radar server address explicitly configured by the user.
4. **Permissions:**
   - `activeTab` & `scripting`: Required solely to extract public JobPosting metadata or text selection from the active tab when the user clicks the extension.
   - `storage`: Required to preserve the user's server address and token locally.
   - `contextMenus` & `notifications`: Used to provide convenient one-click context menu submission and confirmation notifications.

## Open Source
The full source code of this extension and server is public and auditable at:
https://github.com/MikhailSagalaev/radar-oss
