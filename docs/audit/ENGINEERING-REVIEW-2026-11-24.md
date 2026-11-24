# GRUZLI — engineering review (2026-11-24)

## Scope and confidence

This is a repository-level review of the current `main` snapshot and the open change set. It is based on source/configuration/document inspection through GitHub. No local checkout, dependency installation, test execution, live production session, production database, Amvera runtime, or device-level visual QA was available in this pass.

- Repository: `borzenkoofficial-lab/gruzli-b99e57fd`
- Base branch: `main`
- Reviewed main HEAD: `eb40eef3646813f7517d2559fa41d0576613b70c` (2026-11-21)
- Review date: 2026-11-24
- No production deployment, database, secrets, or user data were changed.

## Executive assessment

Gruzli has a substantial frontend foundation and a real CI pipeline, but the repository is currently in an architectural transition. The most consequential risk is not a missing framework or a need for a rewrite: it is the mismatch between the current Supabase-coupled frontend and the proposed Amvera-native backend, combined with an open PR queue containing parallel and sometimes overlapping proposals.

**Recommendation:** do not merge broad infrastructure or demo-mode changes until the owner confirms the target runtime and the intended product mode (production backend vs local/demo-only). Continue with isolated, evidence-backed changes after that decision.

## Confirmed findings

### P1 — Production architecture is not yet an approved, integrated target

The current `main` application still uses the Supabase client and the existing Supabase integration layer. The repository contains a draft Amvera migration PR (#14), a demo-mode PR that removes the Supabase runtime dependency (#44), and an ADR proposal explicitly recording that backend/runtime selection requires an owner decision (#46).

The existing Amvera gap review also records that the migration branch has an API foundation but the current frontend still contains legacy Supabase call sites. A server implementation alone does not switch the running app to that server.

**Risk:** merging a backend or demo-mode branch without an explicit product decision can leave the deployed application disconnected from its expected data/auth services.

**Owner decision recorded on 2026-11-24:** keep a demo mode available for testing while leaving the production backend decision open. This is a product-mode decision, not approval to replace production auth/data services or to make demo mode the default in production.

**Required boundary:** preserve the current production path unchanged; keep demo behavior behind an explicit, environment-scoped opt-in; ensure demo data/storage cannot be mistaken for or overwrite production data. The target production backend (Supabase vs Amvera/PostgreSQL) remains undecided.

Do not infer approval for backend migration or production demo mode from an open PR.

### P1 — Main branch has no enforced GitHub protection

The GitHub branch metadata for `main` reports protection disabled and no required status checks.

**Risk:** direct pushes and merges can bypass the repository's own CI gate.

**Recommendation:** enable protection/ruleset for `main`, disallow direct pushes, and require the complete CI workflow before merge. This is a repository settings change and is intentionally not performed by this review.

### P1 — CI is comprehensive on paper, but current green status is not established

The checked-in workflow runs:
- `npm ci`
- ESLint
- TypeScript typecheck
- Vitest
- Vite production build
- Playwright Chromium smoke tests

The latest `main` commit status currently exposes a failed Vercel status with the message “Deployment rate limited — retry in 24 hours.” This is a deployment-provider status, not evidence that the CI validation job failed. No passing GitHub Actions run was independently verified in this review.

**Recommendation:** treat deployment status and CI test status as separate signals. Confirm the actual Actions run and all job steps before calling the current revision validated.

### P1 — Browser integration coverage is shallow relative to the product surface

The Playwright suite covers:
- demo worker workspace boot;
- mobile shell at 390 px;
- desktop shell at 1024 px and 1440 px, including horizontal overflow.

These are useful shell smoke tests, but do not prove the core marketplace workflows: client order creation, dispatcher assignment, worker response/acceptance, completion, chat, reviews, or settlement.

The existing technical audit records 14 Vitest unit tests across four files at its review snapshot. The checked-in Vitest configuration only discovers tests under `src/**/*.{test,spec}.{ts,tsx}`.

**Recommendation:** prioritize tests around domain invariants and failure paths, not just component rendering. Add API/database-backed integration coverage as part of the Amvera migration; an open PR (#48) already proposes starting the API and database in Playwright CI, so do not duplicate that work.

### P1 — TypeScript compiler strictness is deliberately relaxed

The app TypeScript config currently sets `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`, and disables unused-local/parameter checks. ESLint also treats several legacy code-quality rules as warnings.

**Risk:** typecheck can pass while important nullability and implicit-any defects remain undetected.

**Recommendation:** introduce stricter checks incrementally by domain or folder, with tests and fixes in small PRs. Do not flip strict mode globally as an unreviewed one-shot change.

### P2 — Large UI modules and CSS cascade increase change cost

The existing UI review reports a 6,508-line editorial stylesheet with 1,212 `!important` uses and several large screen modules. The dispatcher cabinet file alone is approximately 81 KB in the current tree.

**Risk:** unrelated visual regressions and expensive review when changing core screens.

**Recommendation:** avoid a wholesale redesign or mechanical component split. Extract domain hooks/services and view components only when a concrete feature or bug requires it; add responsive regression coverage around the changed screen.

### Demo mode: preserve opt-in isolation; do not merge PR #44 as-is

The current `main` branch gates demo mode behind both `import.meta.env.DEV` and `VITE_GRUZLI_DEMO_MODE === "true"`; the Playwright web server explicitly sets that flag and seeds the demo localStorage keys. By inspection, this keeps demo mode scoped to development/test builds.

Open PR #44 changes `DEMO_ENABLED` to unconditional `true` in `App.tsx` and the auth context, replaces the Supabase client with the local demo client, and removes the Supabase SDK/configuration. That is not merely enabling a test mode: it changes the application runtime and can route production builds into demo behavior. **Do not merge PR #44 in its current form.** If demo mode needs a separately deployable preview, implement an explicit build/runtime target with isolated data and a production guard, while leaving the production backend path intact.

The current Playwright wiring is internally consistent by inspection. It has not been executed in this review, so runtime success is not claimed.


### Role-level demo audit (static code review, not yet an end-to-end runtime test)

The demo entry point is currently worker-only despite its label:

- The button in `src/pages/AuthPage.tsx` is labelled “Открыть демо-версию · 3 роли”, but invokes a zero-argument callback.
- `src/App.tsx` handles that callback by setting only `gruzli_demo_worker=1`; it does not set `gruzli_demo_role`.
- `src/contexts/AuthContext.tsx` defaults the role to `worker` when no valid role is stored.
- Client and dispatcher views can be selected by pre-seeding `gruzli_demo_role` in localStorage, but the public demo entry UI does not expose that choice.

**Finding:** the UI currently advertises three demo roles but exposes only the worker role through its normal entry point.

The seeded dispatcher data also does not provide a useful initial dispatcher workspace:

- `DEMO_USERS.dispatcher.id` is `demo-dispatcher`.
- The five seeded feed jobs use dispatcher IDs `demo-dispatcher-1` through `demo-dispatcher-5`, and all are `active`.
- `DispatcherCabinetScreen.fetchMyJobs()` filters owned jobs by the current dispatcher's exact ID and available requests by `dispatcher_id IS NULL AND status = 'open'`.

**Finding:** a newly opened demo dispatcher sees neither owned jobs nor open requests from the initial seed. A client-created request can create an open request for the dispatcher flow, but this cross-role scenario is not covered by the current Playwright suite.

The demo RPC implementation contains explicit success-shaped stubs:

- `dispatcher_finish_job`, `dispatcher_complete_job`, and `dispatcher_review_worker` return `{ data: {}, error: null }` without changing demo records.
- Demo auth's `signInWithPassword` does not validate the password and can synthesize a worker session.
- Demo Storage returns synthetic paths; demo Realtime channels only retain handlers and do not deliver database changes.
- Demo Functions return canned responses for moderation and job-description assistance.

These are acceptable only as clearly labelled simulation behavior. They must not be used to validate real authentication, authorization, file storage, realtime delivery, or final settlement.

**Current test coverage:** `tests/smoke.spec.ts` seeds the worker role for all tests. It does not exercise client/dispatcher role navigation or a client → dispatcher → worker order lifecycle. The green CI run for this review therefore validates the existing worker smoke tests and build/lint/typecheck only; it does not establish that all three demo roles or the complete marketplace lifecycle work.

**Recommended next test slice:** add isolated Playwright coverage for (1) each role's entry/workspace and navigation, and (2) a cross-role order flow using a fresh demo localStorage database. Before treating the workflow as complete, replace or explicitly mark the no-op RPC stubs and verify the simulated lifecycle transitions.

## Open change-set coordination

The repository currently has a substantial open PR queue. Important current proposals include:
- #14 — draft Amvera backend migration;
- #44 — remove Supabase runtime dependency and restore local demo mode;
- #46 — record the unresolved backend/runtime decision;
- #48 — run API and database during Playwright CI;
- #49 — worker feed overhaul;
- #45 — desktop workspace/navigation stabilization;
- #47 — empty-state search reset.

Older PRs also cover order validation, response preconditions, realtime feed consistency, auth state, profile integrity, and worker ranking.

**Coordination rule:** inspect each PR's base/head and diff before taking ownership of the same files or behavior. Prefer selecting and finishing a coherent existing PR over creating a duplicate branch. Treat older October PRs as potentially stale until rebased and revalidated against current `main`.

## Recommended execution order

1. **Demo boundary:** retain the existing dev/test-only opt-in; do not merge PR #44 as-is. If a hosted demo is needed, build it as a separate, isolated target without replacing production auth/data services.
2. **Backend decision later:** keep Supabase vs Amvera/PostgreSQL open until the owner has evaluated the options.
3. **PR triage:** classify open PRs as mergeable, needs rebase, superseded, or blocked by architecture; resolve overlapping changes before implementation.
4. **CI gate:** verify the actual Actions run for the current base; then enable required checks on `main` through repository settings.
5. **Domain safety:** audit and test order/response state transitions, dispatcher assignment, completion, and financial settlement at the server/database boundary.
6. **Backend migration:** only after the owner selects a target, map each Supabase query/RPC/Edge Function/Storage/Realtime call to an approved API contract; migrate one bounded workflow at a time.
7. **UI regression:** expand Playwright coverage for the exact screens and states changed by each PR.
8. **Strictness and maintainability:** reduce TypeScript/ESLint debt incrementally, not through a risky global rewrite.

## Verification limitations

This document is a static review, not a release approval. No commands were executed against a local checkout, and no CI run was triggered or independently observed by this review. Production readiness, data integrity in the live environment, real-time behavior, and deployment correctness remain unverified.
