# Check Agent Guide

## Purpose and Scope
- Manifest V3 browser extension that detects phishing sites impersonating Microsoft 365 sign-in pages.
- Key components: detection engine, policy/branding management, and popup/options interfaces.
- Files are packaged directly—no build step. All guidance in this file applies repository-wide.

## Coding Conventions
- Plain JavaScript ES modules; filenames use `kebab-case.js`.
- Two-space indentation and required semicolons.
- Avoid build tooling; source files are shipped as-is.

## Commit and PR Guidelines
- Use [Conventional Commit](https://www.conventionalcommits.org/) prefixes such as `feat:`, `fix:`, or `docs:`.
- Keep commits small and focused.
- Summarize manual testing in pull request descriptions.

## Testing Expectations
- No automated tests for the extension itself. Manually verify using the steps in [TESTING_GUIDE.md](TESTING_GUIDE.md):
  1. Load the extension via `chrome://extensions` → **Load unpacked**.
  2. Open `test-extension-loading.html` to confirm the service worker, content scripts, and detection engine.
  3. Exercise the popup and options pages.
- Optional lint check: `npx eslint scripts options popup`.

## Directory Overview
- `scripts/` – background, content, and modular detection/policy code.
- `config/` – `branding.json` and `managed_schema.json` for policy and branding.
- `rules/` – detection rules in `detection-rules.json`.
- `popup/` & `options/` – UI pages and supporting scripts.
- `images/` – extension icons.
- `docs/` – additional project documentation.

## Security and Privacy
- Follow [SECURITY.md](SECURITY.md) for reporting vulnerabilities.
- Extension handles policy and branding data; avoid storing or transmitting unnecessary user information.

## Releases and Licensing
- Target browsers: Chromium-based (Chrome 88+).
- Document notable changes in `CHANGELOG.md`.
- Licensed under AGPL-3.0; see `ATTRIBUTIONS.md` for third-party assets.
