# AI assistant — Phase 1 ledger

Local implementation record, 2026-11-13. No external publication.

Approved plan: `/home/bambang/.claude/plans/greedy-weaving-engelbart.md`.

Phase 1 is conversational preparation, reviewed manual sending through existing Compose, and private JSON proposals. A saved proposal is **not** scheduled delivery. Phase 2 requires separate server authorization, encrypted credential storage, PostgreSQL and an independent worker.

## Conversational agent rebuild — active
- Approved replacement plan: same plan path, now conversational agent rather than form-only preparation. Main-session implementation, no agents/commits/dependencies/live providers.
- Audit: email-only system prompt, no authoritative active draft/session and permanent form/warnings caused the product mismatch.
- Pre-flight: controller uses existing AI transport, Compose delivery and proposal routes; frontend consumes tagged session/action/card types. Ruling: validated structured proposals across both providers, not native tools — existing transport rejects tools and no extra provider loop needed; cost: one typed action per turn.
- Ruling: preserve dirty workspace and local ledger, no generic commit/worktree/reviewer workflow — explicit safety constraints; cost: author-only review and no isolated rollback.
- First regression test failed404 for missing session route. Controller test covers general chat, active draft through unrelated topic, sender/body update, denied shell operation, exact revision confirmation, one-shot mocked Gmail send, consent revocation and malformed provider result as uncertain.
- Source now includes conversational messenger, backend-owned sessions, exact review/cancel buttons, scoped Gmail search/read, separate excerpt sharing, source-bound reply recipient, Compose handoff and confirmed JSON plan CRUD. Provider-native tools remain disabled; structured action proposals reuse both configured protocols.
- Reproduced then fixed: revoked account left active draft in provider context; identical draft could receive a fresh send approval after dispatch; canceled inference left session busy; model could invent reply recipient. Dedicated regression checks cover these paths. Shared excerpts are committed only after successful approval. Known plan context sent to AI contains IDs/revisions only, not stored plan bodies.
- Final verification: Rust78/78 `/tmp/aurora-chat-rust-final.log`; Cargo build `/tmp/aurora-chat-cargo-build.log`; TypeScript, isolated Vite build and diff check PASS. All15 frontend scripts PASS `/tmp/aurora-chat-browser-final.log`, including messenger at1440/768/390. Latest additional model-config invalidation assertions focused PASS `/tmp/aurora-agent-config.log` (test-only edit after suite). All calls fictional/loopback; source GUI only until permitted embedded rebuild.
- Ruling: closing cancels inference, not dispatched Gmail operations; results stay server-owned for reopen — cancellation cannot recall a Gmail request. In-memory send digest conservatively blocks the same snapshot even after failure; Gmail/manual Compose review is required instead of automatic resend.
- Ruling: store HTTP adapters remain directly reused internally for this increment — no duplicate persistence, minimal change; cost: controller still knows Axum extraction wrappers. Native provider-loop/streaming, persisted chat, arbitrary timezone data and production scheduler remain absent.

## Assistant availability bug — 2026-11-13

- Confirmed browser behavior with a standalone fictional HTTP fixture: same-origin POST sends Origin; GET does not. Session GET incorrectly used the mutation guard. Regression `/tmp/aurora-origin-red.log` failed403 instead of200; existing read guard now applies only to GET. Host and supplied Origin remain checked; all assistant mutations still reject absent/hostile Origin. Focused GREEN `/tmp/aurora-origin-green.log`.
- Checkbox/send gates correctly require an active provider and configured key; actual private configuration was not inspected. Previous copy conflated disabled provider, missing key and unavailable settings. Popup now distinguishes these states and opens AI settings directly. Synthetic browser tests cover all three, session creation failure/retry and successful consent/chat; availability test RED then GREEN.
- Rust79/79 `/tmp/aurora-origin-rust-suite.log`; Cargo build `/tmp/aurora-origin-rust-build.log`; TypeScript and isolated Vite build PASS `/tmp/aurora-origin-vite-build.log`. Isolated output `/tmp/aurora-origin-dist-N8SQe3vs`; existing chunk-size warning remains. Full frontend suite PASS15/15 `/tmp/aurora-origin-frontend-suite.log`; owned isolated preview stopped afterward.
- Embedded asset provenance correction: current embedded JS exactly matches the previous conversational isolated build `/tmp/aurora-chat-dist-W8QEDE`, so the earlier claim that GUI was still form-only is obsolete. This continuation does not replace embedded assets or bypass the prior overwrite denial; latest frontend guidance remains isolated until an approved regeneration. Rust GET fix is in the rebuilt binary, not an already-running process.

## Loading, focus and error feedback — 2026-11-13

- Confirmed parser error conflation: `length`/`max_tokens`, refusal, unsupported tools and malformed provider envelopes all returned the same message. Shared response parser now emits distinct safe actionable explanations; no provider content/secrets exposed and no unsupported response accepted. Screenshot alone cannot establish the actual live-provider reason. Regression `/tmp/aurora-errors-red.log` then `/tmp/aurora-errors-green.log`.
- Existing inference loading/Stop was inside the transcript and could scroll out of view. Loading now lives in footer with three animated dots (static under reduced motion), Send becomes an accessible Stop button during inference. Existing abort plus revision invalidation reused; dispatched Gmail operations still cannot be recalled. Synthetic response hangs indefinitely until stopped; input/draft remain, Send becomes available again. No fake streamed answer or progress percentage.
- Global focus-visible styles added a square outline and6px shadow to textarea. Move focus to rounded form:focus-within and remove only textarea outline/shadow. Separate browser RED evidence `/tmp/aurora-composer-red.log`, `/tmp/aurora-focus-shadow-red.log`; GREEN at1440/768/390; screenshots `/tmp/aurora-loading-{1440,768,390}.png` (mobile inspected).
- Rust80/80 and Cargo build PASS `/tmp/aurora-loading-rust-suite.log`, `/tmp/aurora-loading-rust-build.log`; TypeScript/diff PASS. Isolated build `/tmp/aurora-loading-dist-oARDKc4c`, log `/tmp/aurora-loading-vite-build.log`; existing large-chunk warning. Full frontend suite PASS15/15 `/tmp/aurora-loading-frontend-suite.log`; owned preview stopped. Embedded assets intentionally unchanged under prior execution denial; no live calls/config reads/agents/installs.

## Router response compatibility — 2026-11-13

- Confirmed synthetic failure: a valid OpenAI Chat Completions response was rejected when the configured request protocol was Anthropic, and vice versa. Parser selection depended on settings rather than the actual response envelope. Public 9Router docs show both formats; this does not establish the user's actual response shape.
- Shared transport now recognizes either complete envelope from the single configured endpoint response. No endpoint/auth/request change, retry, private-data logging or automatic fallback request. Ambiguous mixed envelopes and explicit provider errors are rejected; completion/refusal/truncation/tool checks and strict downstream proposal/draft validation remain.
- Regression RED `/tmp/aurora-router-red.log`; full Rust81/81 PASS `/tmp/aurora-router-suite.log`, including HTTP transport and conversational chat/draft/confirmation tests with cross-format responses. Cargo build PASS `/tmp/aurora-router-build.log`; TypeScript PASS `/tmp/aurora-router-types.log`; diff check PASS. No frontend source/assets changed; browser suite not rerun for this backend-only change.
- Ruling: support the two already-documented complete response envelopes, not arbitrary payload guessing — router normalization can differ from request protocol; cost: Responses API, SSE-only/nonstandard envelopes and unsupported request/auth remain unavailable. Actual 9Router endpoint/key/model untouched; live chat remains unverified. Restart is user-owned; no production process started.

## Current verification and remaining gaps

- Source verification: scoped retrieval, explicit source sharing, reply recipient binding, aborted inference cleanup, exact plan create/edit/cancel and uncertain Gmail outcome are synthetic tests. No real provider compatibility or real mailbox claim.
- Current UI uses non-streaming responses and one model-proposed operation per turn. Search results remain local cards; the model receives authorized message IDs, not search snippets. To summarize, approve the displayed excerpt then send the summary request.
- Confirmed send digest is in memory only. Restart invalidates session/action IDs, not a durable delivery journal. An interrupted mutation may stay running until restart; inspect Gmail before any manual retry. Opening Compose is a separate manual workflow, not guaranteed cross-workflow deduplication.
- Remaining verification gaps: exhaustive concurrent config/account replacement, confirmation expiry and transcript saturation, real provider schema acceptance, keyboard behavior under real mobile software keyboards. No external reviewer; no subagents permitted.
- Latest frontend availability guidance is isolated: this continuation did not overwrite `src/aurora-dist` because of the earlier execution denial. Existing embedded assets already contain the previous conversational GUI (byte-match verified); a running process does not gain the latest backend fix until restart.

## Execution

- Pre-flight: assistant produces suggestions, UI approves proposal mutations, Compose alone sends. Scheduler domain has no filesystem/provider dependency; JSON adapter owns persistence. No agents, dependency installation, private account/config access, real sends or generated-asset overwrite.
- Ruling: work directly in the existing dirty workspace, no commits/worktree cleanup, author-only review — explicit user constraints override generic skill defaults; cost: no independent review or commit-isolated rollback.
- Tests use temporary files, fictional addresses and intercepted provider/AI requests only. No private configuration or real credentials accessed.
- Verified during implementation: 71 Rust tests passed, including an independently launched synthetic child process that persists Sending before mocked delivery and converts interrupted Sending to Failed/delivery_uncertain without retry. This is not a deployed production worker.
- Proposal-size regression: compact-JSON size check could accept a pretty-printed file exceeding the reopen cap. Regression test failed, check changed to actual pretty serialization, focused test passed.
- Review regression: chat remained available during confirmation, allowing another AI response to replace the reviewed draft. Browser assertion failed; chat now blocks while review is open. Three-viewport assistant workflow passed afterward.
- Ruling: no production-worker token refresh/authorization implementation in Phase 1 — encrypted vault and separately authorized OAuth are absent; cost: unattended sending remains unavailable, including laptop-off delivery.
- Store reopen failed once in the concurrent full suite with `Proposal store already in use`; explicit unlock on Store drop restored the reopen test and full suite. Underlying OS/process timing was not independently established; no broader root-cause claim.
- Final author review only; no agents. Added mocked chat-route coverage for consent, bilingual missing-detail replies, rejected forged target and no-store headers. Expanded browser coverage verifies the full manual-send review can be dismissed without sending, approved cancellation deletes only after review, and opener focus returns.
- Final Rust verification: `cargo test --locked` 74/74 PASS; `cargo build --locked`, TypeScript and `git diff --check` PASS. Evidence: `/tmp/aurora-phase1-final-rust-strevwbk.log`.
- Final production frontend verification: all15 scripts PASS against isolated `/tmp/aurora-phase1-dist-6rdtjgu5`, including expanded assistant coverage at1440/768/390. Evidence: `/tmp/aurora-phase1-verified-yvh41akh.log`.
- Isolated Vite production build PASS, existing chunk-size warning. Initial PDF test failed against development serving, then passed against copied production PDF assets; no speculative attachment source fix.
- `cargo fmt --check` and Clippy unavailable (`no such command`); nothing installed. No live model/provider/OAuth or real mailbox verification; no independently deployed production worker. Delayed chat settings/account races and stale-revision browser conflict UI are not comprehensively covered. Backend revision conflicts are covered.

## Phase 1 behavior and limits

- `/api/ai/chat`: explicit consent, bounded history, existing configurable Anthropic/OpenAI-compatible transport. Output is validated suggestion data, never tools or permission. Selected proposal ID/revision must match suggestions.
- Popup: Indonesian/English conversational preparation; editable message/sender/time fields; explicit save/cancel review; natural-language reschedule/edit/cancel of the selected proposal. No automatic inbox upload. Hiding retains conversation in memory; clearing is explicit.
- Compose handoff: existing sender/files/Gmail draft/send implementation. Assistant-origin sends require full current sender/recipients/body/attachments review. No send from model output.
- `/api/schedule-proposals`: text-only local plans, revision checks, idempotency key, bounded100 records/2MiB. Private `config/schedule-proposals/`0700, JSON/lock0600 on Unix. No private email content logging. JSON is private plaintext, **not encrypted**; other processes running as the same OS user may access it.
- JSON adapter owns locking/atomic replace/file+directory sync. Domain transitions in `scheduling.rs` do not depend on JSON; Phase 2 can use PostgreSQL without changing popup/Compose. Single local owner only; no distributed queue guarantee.
- Time support: UTC, Asia/Jakarta, Asia/Makassar, Asia/Jayapura. Other zones rejected, not guessed. UTC and original local time/IANA zone retained.
- `/api/scheduling/capabilities` reports disabled; `/api/schedules` rejects503. A plan is labeled **Rencana tersimpan / Belum dijadwalkan**, never **Email terjadwal**. No native Gmail schedule endpoint assumed.
- Scheduled attachments, remote authentication, server OAuth, encrypted vault and production delivery are not implemented. The existing embedded frontend remains untouched until separately authorized regeneration.

## Phase 2 — concrete implementation plan

### 1. Authenticated scheduling server
Deliver a separate Rust/Axum service, not the desktop router exposed to the Internet. Deploy behind HTTPS with authenticated user sessions, secure HttpOnly/SameSite cookies, CSRF enforcement and strict origin policy. Derive user ownership from server sessions; never accept client user/account IDs as authority. Add per-user quotas and body bounds. Approval required for infrastructure/costs and chosen authentication dependencies.

Acceptance: two synthetic users cannot list/change each other's grants/jobs/files; unauthenticated and cross-origin mutations fail; browser never receives Gmail tokens.

### 2. Separate offline Google OAuth and encrypted vault
Register a separate server OAuth client and HTTPS callback. Bind expiring single-use state and PKCE to the logged-in user. Request offline authorization with least necessary Gmail scopes (`gmail.send` for messages.send, `gmail.compose` if draft management is required), verify account identity and granted scope. Explain unattended access before redirect. Do not upload, migrate or read desktop OS-keyring tokens.

Use an audited AEAD/envelope-encryption library and KMS/secret-manager key outside PostgreSQL/JSON, with user/account-associated data. Persist refresh rotation before updating in-memory credentials. Encrypt backups; exclude secrets/body content from logs. Implement explicit grant revocation, local disablement and remote revocation failure reporting. Dependencies, scopes, OAuth client configuration and secret infrastructure need explicit approval.

Acceptance: wrong-user ciphertext cannot be decrypted; rotation/restart does not lose grants; expired/revoked credentials stop sending; revoke cancels unclaimed jobs, reports in-flight limitations and provider-revocation failures.

### 3. PostgreSQL schema and transactions
Create versioned migrations for users/account grants, immutable confirmed payloads, jobs, attempts and idempotency records. Store UTC timestamptz plus original local time/IANA zone, payload digest, revision, grant ID, due/next-attempt times, state, provider message ID and safe failure code. Unique(user,idempotency_key) plus digest check rejects conflicting retries. No table design/migration or automatic JSON import is executed in Phase 1.

Implement transactional conditional claim/update/cancel. Multiple workers use row locks/`SKIP LOCKED`; a job transition and attempt record commit before provider submission. API response means transaction committed. Uploading/importing local proposals requires a separate user action, preview and confirmation; never import credentials.

Acceptance: concurrent submissions create one job; competing claims choose one worker; stale edits/cancels fail; crash/rollback preserves previous state; account ownership applies inside queries.

### 4. Independently deployed Rust worker
Provide a separate executable/container with no dependency on running desktop/browser. Reuse storage-independent domain rules and extract only genuinely shared MIME/provider preparation from existing compose. Server vault owns refresh; never call desktop keyring. Deploy with a supervisor, graceful shutdown, health checks, private network/database access and durable backups.

Persist Sending/attempt before HTTP. Persist confirmed message ID on success. Retry only proven non-delivery, bounded30s/2min/10min, at most4 attempts; honor bounded provider Retry-After. Refresh an explicit401 at most once when safe; invalid grants require authorization. Timeouts, lost responses, malformed success or ambiguous5xx must become delivery_uncertain, never blindly resent. Gmail does not guarantee exactly-once sends; deterministic Message-ID is correlation, not idempotency.

Acceptance: mocked worker delivers while desktop is stopped; restart retains future jobs; interrupted Sending is quarantined rather than resent; missed schedules over24h fail visibly. Actual deployed laptop-off delivery remains unverified until this acceptance runs independently.

### 5. Secure cancellation and recovery
Expose owner-bound, revision-checked cancel/edit/reschedule routes. Permit only unclaimed Scheduled state. Reconfirm the complete immutable payload after every change. Serialize cancel-versus-claim through PostgreSQL transaction conditions; an in-flight send cannot be recalled, so report conflict honestly. On restart do not return abandoned Sending rows to Scheduled automatically; mark uncertain, reconcile safely or require manual review. Revocation disables grant and atomically cancels unclaimed jobs.

Acceptance: deterministic race tests produce either canceled/no provider call or claimed/conflict, never both successful cancellation and send. Lost final commit produces uncertain state without automatic duplicate.

### 6. Attachments and real timezone data
Add bounded private encrypted blob storage with user/account binding, integrity hashes and lifecycle deletion. Confirm names/sizes/types plus payload digest. Retained Gmail attachments must be resolved under the authorized account before job approval. Use an audited IANA timezone-data dependency; ambiguous/nonexistent DST times require explicit user selection rather than guessed offset.

Acceptance: cross-user file IDs fail, missing/tampered blobs block delivery, byte limits survive restart, DST gap/fold tests retain UTC/original-zone consistency.

### 7. Deployment and release acceptance
Document migrations, rollback, key rotation, backup/restore, monitoring of safe counts/failure codes, retention and incident recovery. Do not log recipient/subject/body/token data. Run synthetic end-to-end flows across server/API/PostgreSQL/worker with desktop off, outage/restart/expired-grant/concurrency tests. Only after separate permission perform a controlled real OAuth/send test. Then enable the UI capability; show Scheduled/Sending/Sent/Failed/Canceled only for actual server jobs.

Delivery survives laptop shutdown only after the independently deployed worker has actually passed that verification. JSON proposals alone never establish this claim.
