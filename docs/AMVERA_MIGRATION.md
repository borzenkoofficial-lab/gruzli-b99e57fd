# GRUZLI — Amvera-native migration

## Goal

Remove Supabase as a runtime, build-time, data, authentication, realtime, storage, and deployment dependency. The production application must run on Amvera and use services owned by the GRUZLI project.

## Migration mode: clean start (owner-approved)

The owner has confirmed there is no access to the old Supabase project and no legacy data needs to be preserved. Do not block the migration on exporting or importing the old Supabase database. Create a new empty production database on Amvera and initialize it from reviewed, application-owned SQL migrations. Existing users will register again; historical profiles, jobs, responses, chats, files, and other records will not be migrated. Preserve product behavior and feature requirements, not legacy data. Do not attempt to access, delete, or disable the old Supabase project.

This is a migration, not a visual rewrite. Preserve current UX, routes, role behavior, validation, business rules, and user-facing features unless a feature is explicitly redesigned in a separate task.

## Repository audit (2026-10-31)

- Frontend: React 18 + TypeScript + Vite.
- Current deployment config: `static_web` with Bun; this only builds and publishes `dist`.
- Runtime Supabase client: `src/integrations/supabase/client.ts`; it throws when production Supabase URL/key are absent.
- Authentication context calls Supabase Auth, `get_user_role`, and `profiles`.
- Main application imports Supabase-generated database types and uses Supabase queries/RPC.
- Supabase project assets include 93 SQL migration files and 26 Edge Function entrypoints.
- Existing demo client uses browser localStorage. It is suitable only for isolated UI/demo tests, not production or multi-user data.
- The current Amvera build log proves only that the Vite static bundle builds and uploads. It does not prove that application runtime, auth, database, or realtime work.

## Target architecture

Use one Amvera Node.js application for the first production migration:
- Express API and static Vite frontend served from the same origin.
- Managed PostgreSQL on Amvera in the same region as the application.
- Database access through a server-only PostgreSQL driver and a typed repository/service layer.
- Server-managed sessions with opaque random session tokens, hashed at rest, delivered via HttpOnly, Secure, SameSite cookies. Passwords hashed with Argon2id. Never expose database credentials or signing secrets to Vite.
- Socket.IO (or a documented native WebSocket implementation) for chat, presence, and live notifications, authenticated against the same server session.
- File uploads stored in durable Amvera storage mounted at `/data` initially; isolate storage behind an adapter so it can move to object storage without frontend changes.
- Background jobs for email, push, Telegram, document generation, and scheduled work; use a persistent queue/worker design and retries. Do not silently drop jobs on process restart.
- Same-origin `/api/*` and realtime endpoints; avoid unnecessary CORS configuration.

## Non-negotiable migration rules

1. This is an owner-approved clean start: do not attempt to access, delete, or disable the inaccessible legacy Supabase project. No legacy user or business data is to be imported.
2. Do not replace real multi-user backend behavior with localStorage/demo data.
3. Do not leave a hidden Supabase fallback, SDK import, URL/key env variable, Edge Function URL, generated Supabase client, or deployment dependency.
4. Do not translate RLS to permissive API handlers. Re-implement authorization on the server and test every role boundary.
5. Do not expose service credentials, database URLs, password hashes, session tokens, private profile fields, or admin operations to the browser.
6. Generate new UUIDs for all clean-start records; preserve referential integrity inside the new database.
7. Every endpoint must validate input, authenticate where required, authorize the acting user, and return a stable error format.
8. All production data writes must be transactional where multiple records or state transitions are involved.
9. Every migration stage must pass typecheck, lint, unit tests, build, and browser smoke tests before deployment.
10. No paid Amvera database or compute resource may be created without the owner's explicit approval.

## Work plan and acceptance criteria

### Phase 0 — Inventory and baseline
- Enumerate every frontend Supabase import and every usage of `auth`, `from`, `rpc`, `storage`, `functions.invoke`, realtime channels, and Supabase environment variables.
- Map each call to a replacement API/service and record its auth/role requirements.
- Inventory all 93 SQL migrations, tables, indexes, triggers, RLS policies, grants, RPC functions, and all 26 Edge Functions.
- Identify external integrations and required secrets (email, Telegram, push/VAPID, AI providers, PDF/document generation).
- Reconstruct the required schema and business invariants from the repository's SQL history; no legacy data export/import is required or authorized.
- Deliver a feature-parity matrix with owner, endpoint, data tables, authorization rules, tests, and migration status.

### Phase 1 — Amvera application foundation
- Convert the Amvera project from static-only publishing to a Node.js application that serves both the Vite build and API.
- Add `/api/health` and `/api/health/db`; the latter must report database connectivity without leaking connection details.
- Add structured logging, request IDs, secure headers, body-size limits, graceful shutdown, and process-level error handling.
- Add a startup check that refuses to claim readiness when required production configuration is absent.
- Verify SPA deep links and static asset caching.
- Keep the currently deployed static version available until the Node app passes smoke tests.

### Phase 2 — PostgreSQL schema and data migration
- Translate Supabase schema and migration history into ordered, repeatable PostgreSQL migrations.
- Replace Supabase-managed `auth.users` and role functions with application-owned users, credentials, sessions, roles, and profile tables.
- Generate new UUIDs for all new records and preserve foreign-key relationships and business invariants.
- Rebuild constraints, indexes, triggers, uniqueness rules, and transaction invariants.
- Translate RLS policies and SECURITY DEFINER RPC behavior into explicit server-side authorization and transactional services.
- Create repeatable schema initialization and seed scripts for a clean database.
- Test initialization against a disposable empty database, including rollback and rerun behavior.

### Phase 3 — Authentication and account lifecycle
- Registration, login, logout, session refresh/revocation, password reset, email verification, account changes, OAuth consent compatibility if still used.
- Roles: client, worker, dispatcher, admin.
- Server-side profile/role loading and secure admin checks.
- Rate limits, password policy, brute-force protection, CSRF protection for cookie-authenticated mutations.
- Tests for anonymous access, role escalation, expired/revoked sessions, and cross-account access.

### Phase 4 — Product APIs and realtime
- Jobs, responses, dispatcher offers/claiming, lifecycle transitions, worker acceptance/completion, orders, profiles, kartoteka, companies, subscriptions/premium, contracts, signatures, documents, channels, likes/comments, reviews, settings, notifications, and admin workflows.
- Realtime chat, typing/presence, read receipts, unread counts, incoming calls if the current feature is retained, live order events, and notification delivery.
- Preserve existing state-machine invariants from SQL functions; do not implement them as loosely coupled client writes.
- Add pagination, filtering, indexes, and query limits.

### Phase 5 — Replace all Edge Functions
Migrate all 26 current functions into server routes or background jobs. No function may be marked complete until behavior, authorization, secrets, retry policy, and tests are mapped:
- admin-broadcast-telegram
- admin-push-broadcast
- admin-reset-password
- auth-email-hook
- dispatcher-analytics
- generate-bot-jobs
- generate-contract-pdf
- generate-contract-preview
- generate-document
- handle-email-suppression
- handle-email-unsubscribe
- improve-job-description
- mcp
- moderate-content
- notify-email
- notify-telegram-job
- notify-telegram-personal
- preview-transactional-email
- process-email-queue
- reset-password-with-code
- send-push
- send-push4site
- send-transactional-email
- smart-search-jobs
- telegram-poll
- vapid-public-key

### Phase 6 — Frontend cutover
- Replace all Supabase client calls with typed same-origin API client and realtime client.
- Remove generated Supabase database types and replace them with app-owned API/domain types.
- Remove Supabase-specific auth listeners and use server session bootstrap.
- Remove demo-mode production branches; demo fixtures may remain only in tests/story/demo tooling.
- Ensure all app routes and role-specific navigation work without Supabase.
- Remove `@supabase/supabase-js`, Supabase config, functions, generated types, migration assets, environment variables, and docs only after parity and data migration are verified.

### Phase 7 — Production verification and cutover
- Unit/integration/e2e coverage for all role-critical flows.
- Browser checks on desktop and mobile, direct deep links, refresh, logout, expired session, network loss, reconnect, file uploads, chat, notifications.
- Security checks: IDOR, role escalation, CSRF, XSS, rate limiting, upload validation, secrets exposure.
- Database backup and restore drill.
- Verify clean schema initialization, constraints, indexes, seed data, and critical user flows on the new database.
- Switch the public domain only after acceptance; retain rollback path.
- Remove all Supabase references and credentials from the GRUZLI codebase and Amvera configuration after the replacement passes acceptance. The inaccessible legacy Supabase project is outside this migration; do not claim it was deleted.

## Required end-to-end acceptance scenarios

1. Client registers/logs in, creates a request, edits it, and sees its lifecycle.
2. Dispatcher sees eligible requests, claims one, assigns workers, receives responses, accepts/rejects, and completes the order.
3. Worker registers/logs in, sees eligible work, responds, receives assignment, updates arrival/work status, and sees earnings/profile updates.
4. Client, dispatcher, and worker can only access permitted records and conversations.
5. Two users exchange text, image, and voice messages; read receipts and unread counters stay consistent after reload/reconnect.
6. Notifications and Telegram/email/push jobs retry safely and do not duplicate side effects.
7. Admin-only actions are inaccessible to all other roles.
8. User profile, documents, contracts, and uploaded files survive redeploy/restart.
9. All core flows work on the Amvera domain without any request to Supabase domains.
10. A clean production build starts with only Amvera configuration and secrets; no `VITE_SUPABASE_*` variables exist.

## Current implementation checkpoint (2026-10-31)

The following work is committed on `migration/amvera-native-backend`. It is not yet a production-ready cutover.

### Implemented
- Amvera config changed from static-only publishing to a Docker/Node.js app; Docker builds Vite assets and starts Express.
- Express serves the frontend and same-origin `/api/*`; added health and DB health endpoints, security headers, request size limits, structured error responses, and graceful shutdown.
- PostgreSQL pool and ordered SQL migration runner added.
- Migration 001 creates application users, profiles, cookie sessions, and audit log; migration 002 creates jobs/responses and related indexes/profile fields.
- Registration, login, logout, session bootstrap, and recovery-code password reset use the Amvera API. Passwords and recovery codes use Node.js scrypt hashes; Argon2id remains a hardening task, not an implemented feature.
- Session tokens are random opaque values; only SHA-256 hashes are stored; cookies are HttpOnly, SameSite=Lax, and Secure in production.
- Role-scoped job listing, client job creation, worker response creation/withdrawal, dispatcher response listing/acceptance/rejection are implemented server-side.
- Frontend auth, job creation, worker feed, job detail response lookup/withdrawal, and dispatcher response screens now call the Amvera API.
- Presence ping uses the API. Legacy realtime subscriptions are disabled when Supabase credentials are absent.
- Missing Supabase credentials no longer throw during frontend module import. The temporary compatibility client uses a deliberately invalid endpoint; it is not a localStorage production backend and is not a completed Supabase removal.
- Vite dev server proxies `/api` to the local Express server.
- Explicit local demo fixtures remain restricted to development/test mode; they are not used as production persistence.

### Verification
- Latest GitHub Actions run for commit `b98e4dfdf3a101f0551f2acd5d0d02a94edce443`: lint, typecheck, unit tests, Vite build, Docker image build, and Chromium Playwright smoke tests all passed.
- No Amvera PostgreSQL resource has been created and no paid infrastructure has been provisioned.
- Public domain has not been switched. The migration PR remains draft.

### Not yet implemented
- Dispatcher offer submission/selection and the complete assignment workflow.
- Chat persistence, attachments, voice messages, read receipts, realtime transport, and incoming calls.
- Worker lifecycle updates, completion, earnings, and full order state machine.
- Profile editing, companies, premium, kartoteka, contracts, documents, channels, admin, notification and integration APIs.
- All remaining Edge Function replacements and complete frontend Supabase call-site removal.
- PostgreSQL-backed integration tests and production acceptance on an Amvera database.
- Argon2id, explicit CSRF token strategy, email verification, and account security workflows.

## Current status

- [x] Migration branch created: `migration/amvera-native-backend`.
- [x] Initial repository inventory: 93 SQL migrations and 26 Edge Function entrypoints.
- [ ] Full frontend call-site inventory and feature-parity matrix.
- [x] Node.js/Express application foundation (initial implementation; database readiness still pending).
- [ ] PostgreSQL schema initialization for a clean database (identity and jobs/responses migrations exist; full schema and DB integration tests pending).
- [ ] Authentication/session implementation (initial flows implemented; security hardening and full account lifecycle pending).
- [ ] Product API and realtime implementation (jobs/responses initial workflows implemented; most modules and realtime pending).
- [ ] Edge Function replacement.
- [ ] Frontend cutover (auth and initial job workflows migrated; remaining Supabase call sites pending).
- [ ] Supabase SDK/config removal and production acceptance.
