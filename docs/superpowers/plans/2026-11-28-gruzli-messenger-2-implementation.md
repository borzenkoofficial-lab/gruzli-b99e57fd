# Gruzli Messenger 2.0 — Implementation Plan

**Date:** 2026-11-28  
**Design spec:** `docs/superpowers/specs/2026-11-28-gruzli-messenger-2-design.md`  
**Branch:** `feat/messenger-2.0`

## Phase 1 — Audit and safety baseline
- Map active route wiring and all chat-specific components/hooks/styles.
- Trace inbox query, unread/read cursor, realtime subscription lifecycle, search, archive/delete/mute actions.
- Trace conversation send, reply, media/voice upload, reactions, presence, calls, and linked-job card.
- Identify existing RLS policies and SQL functions used by chat flows.
- Add focused tests for pure filtering/sorting/unread behavior and correct unsafe action semantics.
- Replace destructive swipe behavior with reversible archive; move permanent deletion behind an explicit, clearly labelled confirmation only if authorization and server behavior are verified.

## Phase 2 — Inbox foundation and UI
- Introduce typed view models and a small set of focused hooks/components.
- Build the redesigned mobile-first inbox with built-in tabs: All, Unread, Personal, Work, Groups, Archive.
- Add robust loading, error, empty, search, and realtime states.
- Add pin/favorite/mute/archive user preferences with optimistic updates and rollback on failure.
- Keep existing data source and conversation IDs unchanged.

## Phase 3 — Custom folders
- Add source-controlled migration for user-owned folders, folder membership, and per-user conversation preferences.
- Add strict RLS policies enforcing folder ownership and conversation participation.
- Add generated-type update workflow (never hand-edit generated output).
- Implement create, rename, reorder, membership, smart filters, and delete-folder-only semantics.
- Add demo-mode parity and tests.
- Do not apply migration to hosted Production in this task.

## Phase 4 — Conversation redesign
- Refactor active conversation into header, timeline, message group, message bubble, reply preview, linked-job card, and composer components.
- Apply Gruzli feed visual language consistently.
- Preserve current text/reply/media/voice/emoji/call/presence flows.
- Make failures, upload progress, retry, and unavailable integrations explicit.

## Phase 5 — Verification and release
- Run lint, typecheck, unit tests, production build, and Playwright.
- Test mobile widths, keyboard/safe area, long messages/names, unread transitions, folder persistence, search isolation, and realtime updates.
- Review SQL migration and RLS separately.
- Deploy Preview for user review; do not merge to main or apply Production migrations until approved.

## Exit criteria
- No global conversation deletion from a swipe.
- No fake state or success toast for a no-op.
- All folders/preferences are per-user.
- Search is constrained to conversations the user participates in.
- Existing conversation history and message behavior remain compatible.
- Automated checks pass; any unavailable external test is disclosed.
