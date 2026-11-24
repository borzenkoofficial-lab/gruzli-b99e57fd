# Gruzli demo role workspace — design

Date: 2026-11-24
Status: approved by owner; implementation in progress
Base: main at eb40eef3646813f7517d2559fa41d0576613b70c

## Intent

Provide a reliable, local development/test environment in which the owner and engineers can exercise the three Gruzli personas — client, dispatcher, and worker — against one shared demo dataset. A client-created request must remain visible as the same request when the active demo persona changes to dispatcher and then worker. The environment must remain explicitly opt-in and must never replace or mutate the production Supabase path.

## Goals

1. Let a tester choose client, dispatcher, or worker at demo entry.
2. Let a tester switch roles while the app is running, without losing demo records.
3. Seed at least one unassigned request for dispatcher discovery, while preserving worker feed examples.
4. Implement the three lifecycle RPCs that the current dispatcher UI calls but the demo adapter currently stubs: dispatcher_finish_job, dispatcher_complete_job, and dispatcher_review_worker.
5. Provide an explicit reset action that resets only the demo database and reloads the app.
6. Add Playwright coverage for role entry/switching and the cross-role order lifecycle.
7. Keep demo mode gated by both import.meta.env.DEV and VITE_GRUZLI_DEMO_MODE === true.

## Non-goals

- Selecting or migrating the production backend (Supabase vs Amvera/PostgreSQL).
- Changing production authentication, authorization, schema, migrations, secrets, storage, or deployment.
- Making demo mode available in production builds.
- Simulating real payment settlement, external notifications, push delivery, or true multi-user realtime.
- Replacing the existing Supabase-compatible demo adapter or undertaking a UI redesign.

## Current implementation evidence

- src/App.tsx and src/contexts/AuthContext.tsx already gate demo mode to development plus the explicit Vite flag.
- src/pages/AuthPage.tsx currently exposes a single demo entry callback with the label “Открыть демо-версию · 3 роли”; it does not pass a selected role.
- AuthContext already reads gruzli_demo_role and reacts to gruzli-demo-change.
- src/integrations/supabase/demoClient.ts stores the shared local demo database under gruzli_demo_db_v3. It already implements client job creation, dispatcher offers, client offer selection, worker responses, dispatcher acceptance/rejection, and worker status transitions.
- The same adapter currently returns success-shaped no-op results for the three dispatcher lifecycle RPCs listed above.
- src/data/demoData.ts seeds worker feed jobs, but those jobs are assigned to dispatcher IDs other than the active demo dispatcher; there is no unassigned seed request for a fresh dispatcher session.
- DispatcherCabinetScreen loads requests with dispatcher_id IS NULL AND status = open, and loads the current dispatcher’s jobs by exact user ID.
- tests/smoke.spec.ts seeds only the worker role. It does not cover the other two roles or a cross-role workflow.
- Open PR #44 and PR #49 propose broader removal of the Supabase runtime dependency. They are not part of this design and must not be merged or used as a base for this work. PR #45 overlaps desktop shell/navigation but is not required for this demo workflow.

## Approaches considered

### A. Extend the current gated demo adapter — recommended

Keep the current Supabase-compatible local adapter, add role selection/switching, a controlled seed request, the missing dispatcher lifecycle behavior, and isolated Playwright tests. This is the smallest change and preserves the production path.

### B. Build a separate demo-only application/runtime

Would duplicate screens and workflow behavior, creating drift from production UI. Not justified while the existing adapter already covers most operations.

### C. Adopt the broader runtime-removal proposals in PR #44/#49

These changes affect the production client/runtime boundary and remove Supabase dependencies. They exceed the requested demo scope and conflict with the owner’s undecided backend architecture. Rejected.

## Proposed behavior

### Demo entry and role switching

- Change the demo entry callback to accept one of the three allowed roles.
- Present explicit role choices at the welcome/demo entry.
- Add a compact, clearly labelled demo-only role switcher while a demo session is active.
- A role switch updates only the active demo identity (gruzli_demo_role) and dispatches the existing demo-change event. It must not clear the shared demo database.
- The active demo persona remains one of the fixed seeded identities; no real sign-in is performed.

### Shared demo dataset and reset

- Keep one shared localStorage database for all three personas so records created in one role are visible to the others.
- Add one unassigned, open demo request with client_id = demo-client, dispatcher_id = null, and valid fields required by the dispatcher offer flow.
- Preserve existing active worker feed jobs.
- Add an explicit “Сбросить демо” action. It clears only the demo database key, reinitializes from seed on next read, preserves the selected demo role and normal app preferences, then reloads the current page.
- Do not clear arbitrary localStorage keys, Supabase auth state, or production data.

### Order lifecycle

- Keep the current role-appropriate RPC API used by the screens.
- Implement the three currently stubbed dispatcher RPCs with ownership checks, valid state preconditions, persisted demo DB mutations, and useful error objects.
- Before implementation, inspect the production SQL definitions for these RPCs and mirror their observable contract/state transitions in the demo adapter; do not invent different lifecycle semantics.
- The expected browser journey is: client creates a new request; dispatcher sees the unassigned request and submits an offer; client accepts that offer; worker sees the active request and submits a response; dispatcher accepts the worker response; worker advances through allowed statuses and completes work; dispatcher reviews the worker and closes the job with expense/income values.
- Demo-only limitations (no real storage, remote realtime, payment, or notification delivery) must remain explicit; success responses must correspond to actual mutations in the local demo database.

## Test strategy

1. Unit tests for demo RPC authorization, invalid state transitions, duplicate handling, and persisted mutations.
2. Playwright role-entry tests for client, dispatcher, and worker.
3. Playwright role-switch test proving the same demo DB survives switching.
4. One end-to-end cross-role lifecycle test covering the journey above.
5. Keep existing mobile/desktop worker smoke tests intact.
6. Run the full CI commands: lint, typecheck, Vitest, production build, and Playwright Chromium. Verify the production build still requires real Supabase env configuration when demo flag is absent.

## Constraints and implementation calls

- No new runtime dependency unless an existing library cannot satisfy a required interaction.
- No schema migration.
- No changes to main; work stays on a feature branch and is delivered as a draft PR.
- Treat the demo adapter as a deterministic simulation, not as a security boundary or substitute for server-side integration tests.
- If the SQL function contract cannot be established from repository migrations, stop and report the ambiguity rather than guessing.

## Acceptance criteria

- A tester can enter all three roles through the UI.
- A tester can switch roles without losing records.
- A fresh dispatcher sees at least one unassigned request.
- The full client → dispatcher → worker → dispatcher journey succeeds and persists its state in the demo DB.
- Invalid role/action/state combinations return errors and do not mutate data.
- Reset restores seeded demo data without clearing production/auth/preferences.
- Existing CI and production runtime gating remain intact.
- No production code path, Supabase configuration, secrets, database, or deployment is modified.
