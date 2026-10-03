# GRUZLI — Global Production Audit
Date: 2026-10-03
Branch: audit/global-production-hardening
Base: main @ ea6ec2f0c6de283417ef1b413222db173ebe5b66

## Executive summary

The repository contains a substantial React/Vite marketplace UI and a large Supabase migration history. The latest migrations harden several role boundaries and order mutations, but the current application source is not yet a production-connected client: `src/integrations/supabase/client.ts` is a localStorage/in-memory Supabase-shaped demo adapter, while the repository contains real Supabase migrations and Edge Functions. There is no GitHub Actions workflow and the only Vitest test is a trivial assertion. Playwright configuration imports an external Lovable-only config that is not declared in package.json.

Therefore the highest-risk findings are integration/production-readiness and test coverage, not visual polish.

## Findings

### P0 — Blockers

1. **Production backend is disconnected from the frontend**
   - `src/integrations/supabase/client.ts` implements auth, database queries, RPCs, storage and channels locally using localStorage.
   - `signInWithPassword` accepts an arbitrary email and creates a demo worker session.
   - `signUp` stores a local session and user role without a server.
   - This means the shipped application path can behave like a functional marketplace while not using the real Supabase backend.
   - Root cause: the integration boundary is a demo adapter rather than a real Supabase client.

2. **Authentication/authorization cannot be considered production-valid in the current frontend build**
   - AuthContext can expose a synthetic `demo-*` user/session.
   - Frontend role state is therefore not proof of authenticated identity.
   - Server-side RLS/RPC hardening exists in migrations, but the current frontend does not exercise that backend.

### P1 — Critical

3. **Unauthenticated push Edge Functions expose a service-role-backed notification path**
   - `send-push` is configured with `verify_jwt = false` but creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY` and can target workers/participants based on caller-supplied payload.
   - `send-push4site` is also configured without JWT verification and forwards caller-controlled payloads using the server-side Push4Site credential.
   - This needs an internal authenticated trigger contract before production launch; simply relying on CORS is not authorization.

4. **External/legacy hosting metadata remains in the web shell**
   - `index.html` references Lovable-hosted social metadata and a Push4site/Lovable external script, while notification code contains `https://gruzli.lovable.app` as an application URL.
   - This is an ownership/integration risk and can send users to the wrong host.


5. **Dispatcher lifecycle RPC can mutate order status directly**
   - `dispatcher_update_job` accepts `_status` and currently allows `open/active/filled`.
   - This creates a second lifecycle mutation path beside `dispatcher_claim_job`, `client_select_dispatcher_offer`, `dispatcher_finish_job`, `dispatcher_complete_job`, and cancellation.
   - Root cause: data-edit RPC mixes editable fields with state-machine transitions.

6. **Dispatcher finish/complete lifecycle lacks strict state preconditions**
   - `dispatcher_finish_job` does not require an appropriate current order state.
   - `dispatcher_complete_job` does not require the order to be in `finishing`.
   - A caller with dispatcher role could reach lifecycle states out of sequence.

7. **Automated regression protection is insufficient**
   - Only `src/test/example.test.ts` exists and only asserts `true`.
   - There are no repository-owned production E2E scenarios for client → dispatcher → worker.
   - No GitHub Actions workflow is present.

8. **Playwright configuration is not self-contained**
   - `playwright.config.ts` imports `lovable-agent-playwright-config/config`, which is not declared in package.json.
   - This makes the repository's E2E entry point dependent on an undeclared external package.

### P2 — Important

9. **README is still the default Lovable placeholder**
   - It does not document architecture, setup, roles, backend, or test commands.

10. **Very large dependency surface**
   - package.json contains many Radix primitives and UI packages. This is not automatically a defect, but it increases maintenance/bundle risk and should be measured rather than assumed.

11. **Realtime channel is broad**
   - The notification hook subscribes to INSERT/UPDATE events for whole tables and filters mostly in client code.
   - Production verification must confirm RLS/realtime publication behavior and avoid leaking metadata through realtime payloads.

12. **Presence writes are periodic client DB updates**
    - `usePresence` writes every 60 seconds and on visibility changes. This needs production measurement and rate/traffic review.

### P3 — Polish / maintainability

13. Duplicate branding assets: `gruzli-logo.jpeg` and `gruzli-splash.jpeg` currently have the same blob/size.
14. README and project documentation do not describe the current three-role product model.
15. Visual consistency and accessibility still require a runtime/device pass; repository inspection alone cannot certify pixel-level behavior.

## Architecture observations

- Frontend: React 18 + Vite + React Router + TanStack Query + Tailwind + Radix.
- Backend schema: Supabase/Postgres with a long migration chain and explicit SECURITY DEFINER workflow RPCs.
- Roles: client, worker, dispatcher, admin.
- Main app shell: mobile BottomNav + desktop sidebar/topbar.
- App navigation is mostly state-driven inside `Index.tsx`, with deep-link handling and custom back/swipe handling.
- The codebase contains a significant amount of product functionality, not just static screens.

## Security observations

Positive:
- Recent migrations use `user_roles` rather than trusting editable JWT metadata for critical role checks.
- Direct order mutation policies were removed for sensitive workflow paths.
- Worker order visibility was restricted to assigned/active jobs.
- SECURITY DEFINER RPCs are explicitly revoked from PUBLIC/anon in the recent hardening migrations.

Remaining:
- The frontend's current local adapter prevents end-to-end validation of those server guarantees.
- Production launch must not treat local demo auth as real authentication.

## Business-state model observed

Client creates an open job.
Dispatcher submits an offer.
Client selects an offer and assigns dispatcher.
Dispatcher staffs workers.
Worker response/status lifecycle progresses through confirmation, travel, arrival and completion.
Dispatcher finishes/completes the order.

The migration chain is materially stronger than the current client adapter and must become the single source of truth for production behavior.

## Verification status

Repository inspection: PASS
Architecture inspection: PASS
Migration inspection: PASS
Static security review: PARTIAL
Build: NOT EXECUTED in this audit environment
Lint: NOT EXECUTED in this audit environment
Vitest: NOT EXECUTED in this audit environment
E2E: NOT EXECUTED in this audit environment
Real Supabase E2E: NOT POSSIBLE from repository-only inspection
Mobile visual/device QA: NOT CERTIFIED
Desktop visual QA: NOT CERTIFIED
Performance profiling: NOT CERTIFIED

## Remediation order

1. Keep demo adapter explicitly isolated from production mode and connect the real Supabase client.
2. Close lifecycle bypasses in server RPCs.
3. Establish repository-owned CI: install → lint → unit tests → build → smoke E2E.
4. Add real Supabase integration/E2E coverage for role isolation and the complete order pipeline.
5. Then perform device-level UI/UX and accessibility polish.


## Changes made during this audit

- Created branch `audit/global-production-hardening` from main.
- Added this audit report.
- Added `20261003210000_harden_dispatcher_lifecycle_invariants.sql` to prevent dispatcher status mutation through the data-edit RPC and to enforce finish → finishing → complete ordering.
- Replaced the undeclared Lovable Playwright configuration with a repository-owned Playwright configuration.
- Added mobile/desktop smoke tests for root loading and initial horizontal overflow.
- Added GitHub Actions validation for npm ci, lint, Vitest, build and Playwright smoke coverage.
- Replaced the placeholder README with current architecture, workflow and production constraints.

## Current counted findings

- P0: 2
- P1: 6
- P2: 4
- P3: 3

The counts are based on repository evidence only. Runtime/device and real-backend findings remain uncertified until the application can be executed against a real Supabase environment.
