# Sela Aurora

A local-first email client with a Rust backend and a React interface. Bring multiple Gmail accounts into one workspace, read messages, manage attachments, and compose email without running a hosted mailbox service.

**Status:** early-stage development · **Current target:** Linux, accessed through a local web browser.

> [!WARNING]
> **Intended for local, personal use.**
>
> Sela Aurora is experimental software. Its security controls have not been comprehensively or independently validated, and it is **not ready for enterprise, organizational, shared-server, or internet-facing deployment**.
>
> Before considering business use, review the source code, conduct an independent security audit and threat assessment, and address the authentication, deployment, privacy, and compliance requirements of your environment. Existing tests and security reviews are not a security certification or a guarantee that the application is free of vulnerabilities.
>
> For the current implementation, do not expose the application through a public reverse proxy, port forwarding, a tunnel, or a shared network. Use a trusted personal computer and accounts you are authorized to access. These statements describe security guidance and the supported deployment scope, not additional restrictions on the permissions granted by the MIT License.

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [OAuth permissions](#oauth-permissions)
- [Privacy and security](#privacy-and-security)
- [Limits and known limitations](#limits-and-known-limitations)
- [Development and testing](#development-and-testing)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)

## Features

### Inbox and reading

- Unified inbox or individual account views.
- Gmail folders, categories, search, and per-account pagination, with up to 30 messages per account per page.
- Star, archive, mark read or unread, move to Trash, restore, and report or remove spam when Gmail permissions are verified.
- Three reading modes: **Adaptive**, **Original**, and **Plain Text**.
- Dark and light themes, adjustable density, and responsive layouts.
- Inbox polling approximately every 30 seconds while the list is eligible for refresh. This is not push delivery; polling pauses in hidden tabs, while reading a message, and when preserving paginated results.

### Compose and drafts

- New messages, replies, reply-all, forwarding, and Gmail draft creation and editing.
- Account-bound sender selection, To/CC/BCC validation, and a plain-text editor.
- Multiple attachments through the file picker or drag-and-drop; subsequent selections preserve existing files.
- Minimize and expand controls, explicit dirty-discard confirmation, and browser unload warnings for unsaved content.
- Sending requires user confirmation. Write operations depend on verified Gmail permissions.

### Attachments

- PDF, supported raster image, and UTF-8 text previews.
- PDF page navigation, zoom, and download, with PDF.js resources bundled locally.
- Download-only handling for Office documents, archives, SVG, HTML, unsupported formats, and encrypted PDFs.
- Inline CID images resolved only from the same account and message.
- Filename, MIME, size, and resource checks on the relevant upload and preview paths.

**Provider support:** Gmail is the primary implementation. Outlook integration is partial and has not been verified end-to-end; see [known limitations](#limits-and-known-limitations).

## Requirements

- Linux with `secret-tool` and an unlocked, compatible Secret Service keyring.
- A current stable Rust toolchain and Cargo.
- Node.js **22.13 or later**; Node.js 24 LTS is a suitable choice.
- npm.
- A modern browser.
- Your own Google Cloud OAuth configuration for Gmail.

Python 3 is required for MIME tests. Browser tests additionally require Playwright and Brave; the current scripts expect Brave at `/usr/bin/brave-browser` and a resolvable `playwright` module.

Windows and macOS are future targets, not currently verified supported platforms. The existing token-storage integration uses the Linux `secret-tool` command.

## Getting started

### 1. Obtain the source

Clone this repository, then open a terminal in its root directory. Run the application from that directory because configuration paths are currently relative to it.

### 2. Create your Google OAuth client

In [Google Cloud Console](https://console.cloud.google.com/):

1. Create or select a project.
2. Enable the **Gmail API** for that project.
3. Configure the OAuth consent screen and the requested scopes.
4. Add your Google account as a test user if the project is in Testing mode.
5. Create an OAuth client of type **Web application** for the current local web implementation.
6. Add this exact authorized redirect URI:

   ```text
   http://127.0.0.1:3000/callback/google
   ```

The current Google integration requests:

```text
openid
email
https://www.googleapis.com/auth/gmail.modify
```

`gmail.modify` is a restricted scope. Public OAuth distribution must comply with Google's applicable verification and user-data policies. Publishing source code does not itself make an OAuth application verified. Testing-mode Gmail authorizations generally receive refresh tokens that expire after seven days.

See [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server) and [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

### 3. Create local configuration files

The entire `config/` directory is ignored by Git. **Create both files locally**, even if you only use Gmail: startup currently reads both provider files.

Create the directory if needed:

```sh
mkdir -p config
```

Create `config/google.json` with your own values:

```json
{
  "client_id": "YOUR_GOOGLE_CLIENT_ID",
  "client_secret": "YOUR_GOOGLE_CLIENT_SECRET"
}
```

For a Gmail-only setup, create `config/microsoft.json` with:

```json
{
  "client_id": ""
}
```

An unused provider must still have a valid JSON configuration file with an empty `client_id`; do not leave the file empty. Do not overwrite existing configurations or account metadata when following these instructions.

Do not commit credentials, tokens, account metadata, or screenshots containing private email. You do not need to create `config/accounts.json`; the application manages account metadata after a successful connection.

<details>
<summary>Optional: configure the partial Outlook integration</summary>

In Microsoft Entra admin center, create an app registration supporting the account types you intend to use. Add a **Mobile and desktop applications** redirect URI:

```text
http://localhost:3000/callback/microsoft
```

Configure delegated permissions `User.Read` and `Mail.ReadWrite`. The application also requests `openid`, `email`, and `offline_access` and uses PKCE without a Microsoft client secret.

Set the Application (client) ID in `config/microsoft.json`. Organizational accounts may require administrator consent. This configuration does not imply that all Outlook features are supported or verified.

</details>

### 4. Build and run

From the project root:

```sh
npm --prefix frontend ci
npm --prefix frontend run check
npm --prefix frontend run build
cargo build --locked
cargo run --locked
```

Open **http://127.0.0.1:3000**, then connect your Gmail account through the application.

The frontend build writes to `src/aurora-dist/`; Rust embeds those assets during compilation. Rebuild the frontend and restart the Rust process to load UI changes. Save pending work before stopping an existing process.

Do not open `src/index.html` directly or use VS Code Live Server as the application server: those options do not provide the API or OAuth endpoints.

## OAuth permissions

Gmail read and write features use `gmail.modify`. This permission allows more than reading messages, including draft creation and sending. Only connect accounts for which you accept that access.

The application checks granted Gmail scopes from OAuth responses. Actions requiring verified permissions remain unavailable when the grant is unknown or insufficient. Requesting a scope alone is not treated as proof that it was granted.

If you connected an account under an older read-only configuration, update the OAuth consent configuration and reconnect that account through Settings. Do not delete account metadata to force a permission upgrade.

Opening an unread message can mark it as read at the provider. Other actions, including sending or moving messages, also affect the real mailbox; this is not a read-only demo.

## Privacy and security

### Local storage and trust boundary

- The server binds to `127.0.0.1:3000` and checks allowed Host and Origin headers.
- **There is no separate local user authentication.** Other processes running on the same computer can access the local API, including mailbox operations. Loopback binding is not isolation from local software.
- Account identifiers, email addresses, and provider names are stored in `config/accounts.json`, with mode `0600` on Unix.
- Refresh tokens are stored through the OS keyring. Access tokens are held in process memory; they are not returned to the frontend.
- There is no plaintext-token fallback when keyring storage fails.
- The application does not maintain a persistent local email database. Message content and attachment previews are handled in memory; explicit downloads are saved by the browser.
- Browser storage is used for appearance and reading preferences, not for persisting unsent messages or OAuth tokens.

Do not delete or edit `config/accounts.json` while the application is running. Disconnect accounts through Settings with the confirmation dialog; disconnecting removes the local connection, not provider email messages.

### Email rendering

- Adaptive mode renders sanitized content as a restricted React element tree.
- Original mode uses sanitized HTML in a sandboxed iframe without script, same-origin, or form permissions. Long messages may have an inner iframe scrollbar.
- HTTPS remote images are blocked until you explicitly allow them for the current message. Loading them can reveal your IP address and reading activity to the sender; no referrer is sent.
- Embedded raster data and unambiguous CID images can display without contacting an external image host. CID retrieval still contacts the email provider.
- Plain Text mode does not load images or fetch CID resources.
- Attachments are treated as untrusted. Unsupported and active formats are not executed as previews.

### Protective limits

Provider requests have a 10-second connection timeout and a 30-second total timeout. OAuth token JSON is limited to 64 KiB. Attachment downloads use attachment disposition, `application/octet-stream`, `nosniff`, and `no-store` headers. The application document denies framing by other sites.

These controls reduce specific risks; they do not replace an independent audit. Not every provider JSON response currently has an explicit byte limit, and preview limits do not cover every possible resource-exhaustion scenario.

### Reporting a vulnerability

Do not post credentials, OAuth codes, tokens, private email, or exploit details involving real accounts in public issues. Arrange a private reporting channel with the maintainer before sharing sensitive evidence. A dedicated security reporting policy has not yet been established.

## Limits and known limitations

| Area | Current limit or behavior |
| --- | --- |
| Compose attachments | Up to 100 files, 25,000,000 bytes combined |
| Multipart request | 27,000,000 bytes |
| Generated MIME | 36,700,160 bytes maximum; provider limits still apply |
| Message body | Up to 1,000,000 bytes on bounded Gmail body paths |
| PDF and raster preview input | Up to 20 MB per preview |
| PDF canvas | Up to 16 million pixels |
| Raster image | Up to 40 million pixels; maximum dimension 32,768 |
| Inline CID acquisition | Combined 20 MB / 40 million pixels |
| Inline data/CID rendering | Shared 20 MB / 40 million pixels, charged per rendered occurrence |
| Text preview | Up to 1 MB, UTF-8 |
| Gallery thumbnails | First 10 attachments, with sequential thumbnail fetches |
| Local compose thumbnails | Up to four; each at most 5 MB / 4 million pixels |
| Heavy backend transfers | Two concurrent operations |

Additional limitations:

- **No enterprise or public-server deployment support.** No multi-user authentication or tenant isolation.
- **No official desktop packages yet.** Linux desktop, Windows, and macOS support are planned, not delivered.
- Outlook lacks pagination, attachment support, compose support, search, and several Gmail-specific folder/category behaviors. Its existing paths remain unverified end-to-end.
- No offline synchronization, local full-text search, scheduling, custom label management, contacts, calendar, or notifications.
- The interface is currently primarily in Indonesian; this English README does not imply an English UI.
- Adaptive mode preserves readable structure, not pixel-perfect original email formatting.
- Compose edits plain text. Changing text can discard original HTML formatting. Unsupported HTML-only or complex drafts are rejected for editing rather than silently flattened; open them in the provider instead.
- Draft revision checks cannot prevent every concurrent edit in Gmail; they are not an atomic compare-and-swap operation.
- Duplicate-send reservations exist only for the current server process. They do not provide exactly-once delivery across restarts.
- **A timeout after submission can leave delivery uncertain. Check Sent before retrying.** The composer blocks some unsafe retries but cannot prove that the provider did not send the message.
- Unload warnings cannot guarantee recovery after browser crashes or mobile process termination. Save important work as a Gmail draft.
- Gallery thumbnails do not yet share a combined decoded-memory budget. Raster checks validate container dimensions, not exhaustive animated-frame or CPU consumption.
- Unread counts describe loaded messages, not the entire remote mailbox.

## Development and testing

### Build checks

```sh
npm --prefix frontend ci
npm --prefix frontend run check
npm --prefix frontend run build
cargo test --locked
cargo build --locked
```

### Browser regression tests

Install or provide the test prerequisites listed under [Requirements](#requirements). Start a frontend-only preview in a separate terminal:

```sh
cd frontend
npx vite preview --host 127.0.0.1 --port 4175 --strictPort --outDir ../src/aurora-dist
```

From the project root, run:

```sh
node frontend/test-browser.cjs
node frontend/test-security.cjs
node frontend/test-pagination.cjs
node frontend/test-email-body.cjs
node frontend/test-actions.cjs
node frontend/test-layout.cjs
node frontend/test-icons.cjs
node frontend/test-attachments.cjs
node frontend/test-sender-selector.cjs
node frontend/test-compose.cjs
node frontend/test-compose-review.cjs
node frontend/test-audit-fixes.cjs
```

Browser tests intercept API calls with fictional accounts, messages, and attachments. Rust integration tests use synthetic local provider endpoints. They are not evidence of live Google or Microsoft compatibility, physical-device behavior, or a comprehensive security audit.

**Never send real email, disconnect real accounts, or expose saved credentials during automated testing.** Do not run the application against saved accounts just to execute the browser regression suite.

## Troubleshooting

### Gmail returns 403 after login

Check that the Gmail API is enabled in the **same Google Cloud project that owns your OAuth client**. Confirm the required scopes, test-user settings, and granted permissions. Allow time for configuration changes to propagate, then retry. Reconnect only when a permission update or invalid authorization requires it.

Do not share raw OAuth responses, authorization codes, tokens, or secrets when requesting help.

### Startup cannot read configuration

Run from the project root. Ensure both `config/google.json` and `config/microsoft.json` exist and contain valid JSON. An unused provider should have an empty `client_id`, not a missing file.

### The keyring is unavailable

Ensure `secret-tool` is installed and a compatible Secret Service keyring is running and unlocked. Do not work around this by saving refresh tokens in plaintext.

### Port 3000 is already in use

Save pending work and stop the older application process yourself before starting another instance. Do not delete account files to resolve a port conflict.

### PDF tests time out

Build the frontend and use the production preview command above. The PDF worker and supporting resources are emitted during the build; a plain development server is not equivalent to that preview.

## Project structure

```text
frontend/
  src/               React interface, message rendering, and attachment previews
  test-*.cjs         Synthetic browser regression tests
src/
  main.rs            Axum routes, OAuth flows, and provider integration
  attachments.rs     MIME traversal, validation, and attachment construction
  persistence.rs     Account metadata and OS keyring integration
  aurora-dist/       Frontend build output embedded in the Rust binary
config/              Local-only provider configuration and account metadata
build.rs             Embedded asset generation
```

## Contributing

Bug reports, focused fixes, accessibility improvements, and documentation contributions are welcome.

- Describe the behavior, reproduction steps, and expected result.
- Use fictional accounts and minimal synthetic fixtures.
- Preserve real provider functionality; do not replace it with demo data.
- Include a regression test for behavior changes where practical.
- Run the relevant checks and state which platforms and scenarios you actually tested.
- Keep credentials, mailbox content, local configuration, and tooling caches out of contributions.
- Discuss substantial architecture or dependency changes before implementing them.

Project code is available under the [MIT License](LICENSE). Keep the required copyright and permission notices when redistributing it, and respect the separate licenses of third-party dependencies and assets.

## Roadmap

Planned directions, not release commitments:

- Improve clean-clone onboarding and portable test setup.
- Expand contribution guidance and establish private security reporting.
- Strengthen resource limits and expand security regression coverage.
- Explore desktop packaging while preserving the local web version.
- Evaluate platform-native credential storage and test Linux, Windows, and macOS separately before declaring support.

## License

Sela Aurora's original project code is licensed under the **[MIT License](LICENSE)**. It permits use, modification, redistribution, and commercial use, provided the required copyright and permission notices are retained.

The software is provided **"AS IS", without warranty**, as specified in the license. The security warnings in this README describe the project's current readiness and do not prohibit commercial or organizational use under MIT.

Third-party dependencies, designs, images, fonts, and other assets remain subject to their respective licenses. This project's MIT License does not relicense third-party material or establish rights to redistribute it.
