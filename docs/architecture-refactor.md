# Architecture refactor

Local audit and execution ledger, 2026-11-13. Audience: maintainers working on this refactor. No external publication.

## Before changes

The live Rust executable has 1,762 lines in `src/main.rs`: startup, state, router, OAuth/account transactions, mailbox aggregation, provider HTTP, compose/MIME and integration tests. Existing attachment, settings, AI and persistence modules already have focused responsibilities.

The live React entry mounts `AuroraLive.tsx` (540 densely packed lines): navigation, mailbox/pagination/reader, settings persistence, compose/session/AI and all screens. Existing renderer, attachment and sender components remain reusable. Vite outputs `src/aurora-dist`; `frontend/dist` is not the production entry. Reference prototype source remains intact.

### Priorities and risks

| Priority | Boundary | Preserve |
| --- | --- | --- |
| 1 | App state/router, OAuth, accounts | Host/Origin checks, token secrecy, serialized refresh, disk/keyring ordering |
| 1 | Mailbox orchestration, concrete Gmail/Graph functions | Cursor binding, partial failures, current unsupported Graph behavior |
| 1 | Compose HTTP versus preparation/delivery | MIME/ownership/bounds, retained HTML/files, reservation timing, uncertain sends |
| 1 | Typed frontend API | Status/text errors, bodyless204, multipart headers, abort; no retries |
| 2 | Settings/mailbox/compose hooks and views | Mounted editor, DOM/classes/focus, stale guards, privacy remount keys |
| 2 | Reuse header lookup/settings hydration/contracts | No generalized provider framework or state library |

### Contracts

Keep existing route methods and response shapes: static `/`, `/assets/{*path}`, icon; OAuth `/auth/{provider}`, `/callback/{provider}`; accounts GET/DELETE; inbox GET with account/folder/category/search-bound cursors; message GET/read POST/action POST/attachment GET; draft GET; compose POST JSON or multipart returning201 identity; settings GET/PATCH redacted/no-store; AI compose POST requiring Origin and consent. Keep existing limits, status/error text, secret-preserving settings patches and explicit manual application/send.

No live account, keyring, provider, private settings or mailbox access. Tests use synthetic state, local HTTP mocks and frontend API interception. Root `test-browser.cjs` targets production3000 and is excluded.

### Starting dirty state

Modified before this refactor: `.gitignore`, `README.md`, `frontend/src/AuroraLive.tsx`, `frontend/src/compose.css`, `frontend/test-actions.cjs`, `frontend/test-browser.cjs`, `frontend/test-icons.cjs`, `frontend/test-layout.cjs`, `frontend/test-pagination.cjs`, `frontend/test-security.cjs`, `src/aurora-dist/assets/aurora.css`, `src/aurora-dist/assets/aurora.js`, `src/main.rs`, `src/persistence.rs`.

Already untracked: `config.example.json`, `frontend/test-ai.cjs`, `src/ai.rs`, `src/settings.rs`. Preserve all; no commits/reset/stash/worktree cleanup.

## Execution ledger

Approved plan: `/home/bambang/.claude/plans/greedy-weaving-engelbart.md`.

Pre-flight: backend router consumes extracted handler signatures; frontend views consume hook models and typed API contracts. Preserve signatures first, compile between feature moves. Settings saved AI configuration remains an explicit compose input, not panel-local state.

Ruling: use this local report as the ledger, remain in the approved dirty workspace, perform inline author review, no commits/agents — explicit task constraints override skill defaults — cost: no independent reviewer or commit-isolated rollback.

Task1: baseline complete: Rust60/60, Cargo build, TypeScript, isolated production frontend build and13/13 browser suites passed. Added router characterization before extracting router. Characterization tests pin existing behavior; green-before-move is expected. Not claiming full test-first implementation compliance.

Ruling: build into fresh temporary directories with `--emptyOutDir false`, not `src/aurora-dist` — overwriting pre-existing modified generated assets was explicitly denied — cost: Rust still embeds the earlier frontend until separately authorized regeneration. Backup: `/tmp/aurora-refactor-assets-wu2a3hs8/aurora-dist`.

Task2: backend extraction complete; router/state/guards, OAuth, accounts, mailbox orchestration, concrete Gmail/Graph reads/mutations, compose HTTP/service and downloads separated. Tests moved without dropping assertions. Header lookup delegates to existing attachment helper; identical Gmail date/link mappings shared. Rust62/62 passed after final provider extraction.

Ruling: retain existing status/string wire errors instead of adding an unsupported-operation enum — no shared domain consumer needs that enum; adding one solely to convert back to identical501 tuples increases indirection — cost: capability errors remain string-based. Existing Graph filtered-empty behavior deliberately unchanged.

Ruling: add `downloads.rs` and `mailPresentation.ts` beyond the initial named boundaries — download response ownership and shared frontend display parsing are cohesive existing responsibilities — cost: two additional small modules to navigate.

Task3: typed frontend API complete; named operations, unknown JSON validation, status-bearing errors, bodyless204, encoded paths, AbortSignal, unchanged binary/FormData semantics. Compose success intentionally consumes only status as before. Account contract reused by sender selector. API assertions pass, including aborted detail/AI and binary multipart preservation.

Task4: settings/mailbox/compose hooks and views extracted. Root coordinates explicit feature models and shell. Views use narrow Pick contracts with type-only hook imports. Saved AI configuration remains a hook input while settings presentation is unmounted. Dedicated browser checks now cover existing preview and pending-generation invalidation, recipient/body/file preservation and late page/detail responses after account switch.

Verified regression: moving feature imports before application styles changed Vite CSS cascade order. Base button alignment overrode attachment layout; third mobile lazy thumbnail was outside viewport. Existing attachment suite failed before correction; restoring base-before-feature imports passed all three widths. Recorded root cause in `.wolf/buglog.json`.

Final-suite observation: one compose run lost a synthetic immediately-filled subject during scheduled recipient autofocus. Standalone reproduction passed; test now waits for the existing recipient-focus effect before filling another field. No product timing workaround added. Complete rerun14/14 passed.

Task5: author review and synthetic desktop1440/mobile390 screenshot inspection complete; generated-asset integration remains blocked. No agents, commits, dependency installs, live Rust startup, real provider operations, private settings or keyring access.

## Refactored architecture

- `main.rs`: startup/client construction/account restoration/listener.
- `app.rs`: router, internal state/contracts, HTTP guards/settings/AI wrappers/static assets.
- `oauth.rs`, `accounts.rs`: authorization/serialized refresh and account transaction orchestration.
- `mailbox.rs`: validated query/cursor/merge and feature dispatch; `gmail.rs`/`graph.rs`: concrete provider HTTP/mapping.
- `compose.rs`: request/MIME validation, thin HTTP wrapper, transport-free delivery service; `downloads.rs`: bounded account/message-bound responses.
- Existing persistence/settings/AI/attachment security implementations retained.
- `AuroraLive.tsx`: shell/navigation and feature coordination.
- `api.ts`: transport/contracts/response validation; `useMailbox`, `useSettings`, `useCompose`: feature behavior.
- `MailboxView`, `SettingsPanel`, `ComposeEditor`: presentation; existing safe message/attachment/sender components reused.

### Concrete SOLID/DRY improvements

Single responsibilities now follow features rather than two omnibus entry files. HTTP compose parsing is separate from delivery. Views consume narrow feature models, not a global context. Provider changes stay concrete and localized; no speculative extensibility framework or one-implementation traits. Shared typed transport removes repeated fetch/status checks, settings hydration is single-source, sender account shape is shared, Gmail header/date/link duplication is removed. Dependency inversion is pragmatic: explicit inputs/client/state and mockable HTTP seams, not interfaces everywhere. This is not100% SOLID compliance; app state and large compose behavior remain coupled intentionally.

## File inventory for this refactor

Created backend: `src/app.rs`, `oauth.rs`, `accounts.rs`, `mailbox.rs`, `gmail.rs`, `graph.rs`, `compose.rs`, `downloads.rs`, `tests.rs`.

Created frontend: `frontend/src/api.ts`, `mailPresentation.ts`, `useSettings.ts`, `useMailbox.ts`, `useCompose.ts`, `SettingsPanel.tsx`, `MailboxView.tsx`, `ComposeEditor.tsx`; `frontend/test-api.cjs`.

Created report: `docs/architecture-refactor.md`.

Changed existing: `src/main.rs`, `src/ai.rs` (import only); `frontend/src/AuroraLive.tsx`, `SenderSelector.tsx`; `frontend/test-ai.cjs`, `test-pagination.cjs`, `test-compose.cjs`; `README.md`, `.wolf/STATUS.md`, `.wolf/buglog.json`. Other starting dirty files and generated assets preserved. No source files removed.

## Verification

| Check | Actual result |
| --- | --- |
| `cargo test --locked` |62 passed,0 failed; final log `/tmp/aurora-refactor-final-rust.log` |
| `cargo build --locked` |PASS; embeds preserved earlier frontend assets |
| `npm --prefix frontend run check` |PASS |
| Vite production build with fresh temporary output |PASS; existing >500kB chunk warning |
| All `frontend/test-*.cjs` |14/14 PASS:13 browser suites plus API assertions; log `/tmp/aurora-refactor-final-browser.log` |
| `cargo fmt --check` |Unavailable: `error: no such command: fmt` |
| `cargo clippy --all-targets -- -D warnings` |Unavailable: `error: no such command: clippy` |
| `git diff --check` |PASS |
| Synthetic screenshots |1440/390 compose inspected; existing layout/attachment/security assertions passed; not pixel-exact baseline comparison |
| Configured frontend build/updated embedded integration |NOT RUN: explicit overwrite authorization still required |

## Compatibility, review and remaining debt

No intended API, storage, provider capability or visual changes. New JSON decoders reject malformed consumed response shapes rather than propagating undefined data. Existing minimal/legacy optional fields remain supported. Sender fallback now follows accounts via an effect; sender/source-lock/browser tests pass. CSS order is explicitly preserved at root.

Author-only review checked account/message/part binding, token redaction, refresh critical section and persistence order, disk-first settings, submission reservation after preparation/no automatic retry, binary bounds, no-content/FormData handling, stale-result counters, hidden mounted editor, message identity/privacy reset, focus/inert behavior and saved-settings AI cancellation. Existing sanitizer/sandbox/CID/object-URL code was not rewritten. No independent security certification or live compatibility claim.

Remaining: authorize generated asset replacement, rebuild configured frontend then Rust; install/use formatter and Clippy only if user permits; independent review; optional stronger provider inbox/Graph JSON bounds, aggregate decoded gallery budget, local authentication and portable keyring. Compose remains a substantial feature module, cross-feature tests remain centralized, provider errors remain tuples/strings, global refresh remains serialized, submission reservations remain in memory, prototype source remains. No new dependencies, framework, state library, provider traits, unsupported Outlook functionality or storage migration.
