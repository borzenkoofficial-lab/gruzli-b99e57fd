# Gruzli Push Security — deployment gate

The two internal push relays are invoked from PostgreSQL triggers. Supabase gateway JWT verification remains disabled for these two endpoints because their callers use a shared bearer secret rather than a user JWT. **The Edge Functions must validate that secret themselves.**

## Required secret agreement

The exact same high-entropy value must be configured in both places:

1. Supabase Edge Function environment variable: `SEND_PUSH_INTERNAL_SECRET` (set with the Supabase secrets manager, not in the frontend).
2. Supabase Vault secret named `SEND_PUSH_INTERNAL_SECRET`, which the database trigger functions read.

The trigger sends `Authorization: Bearer <secret>`. The Edge Functions return `503` when their environment secret is missing and `401` when the bearer is absent or incorrect. Do not place this value in `VITE_*` variables, frontend source, or commit history.

The migration `20261009170000_harden_push_endpoint_auth.sql` updates the Push4site trigger functions to use the Vault secret instead of the public Supabase anon key. Existing native Web Push triggers already use the Vault secret.

## Deployment verification checklist

Before merging/deploying this change:

- Confirm the Vault secret exists and its value exactly matches the Edge Function secret.
- Deploy `send-push` and `send-push4site` with the updated handlers.
- Apply the new SQL migration.
- Verify requests without a bearer or with the public anon key return `401`.
- Verify a request with the internal secret reaches payload validation/dispatch.
- Create a test job, message, and worker status update; confirm expected push delivery and that a push failure does not roll back the business transaction.

This repository cannot verify Supabase's live secret values or whether a migration has already been applied to the hosted database. Keep the PR unmerged until the secret agreement and delivery smoke test are confirmed.
