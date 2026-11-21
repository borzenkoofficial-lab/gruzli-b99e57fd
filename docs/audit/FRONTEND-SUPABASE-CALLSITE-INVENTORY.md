# Frontend Supabase call-site inventory (Amvera migration)

**Branch:** `migration/amvera-native-backend`  
**Base audited:** `c8dfc85a6026927014c353dbbc79b72b96092cd8`  
**Main:** `eb40eef3646813f7517d2559fa41d0576613b70c`  
**Status:** inventory only; no frontend cutover and no auth changes.

## Scope and safety boundary

Reviewed the principal application screens, data hooks, chat/community screens, profile/contract flows, and supporting components. This is a source-level inventory of runtime Supabase usage found in those files, not a claim that every file in the repository has been exhaustively scanned.

Explicitly excluded from migration work:
- `src/contexts/AuthContext.tsx` and auth screens/flows;
- Supabase Auth calls for registration, login, password recovery, metadata updates, and session lifecycle;
- any public-domain or production cutover.

The new API uses its own cookie session and `requireAuth`. The current frontend still obtains identity from Supabase Auth. Therefore, API routes must not be wired into authenticated screens until a separately approved session adapter exists. Do not “fix” this by changing the old registration/login flow as part of a feature migration.

## Existing Amvera API coverage

Routes currently present in `server/index.mjs`:
- Identity/session foundation: `/api/auth/*` (not authorized for frontend cutover in this phase).
- Profile presence: `POST /api/profile/presence`.
- Conversations/messages/files: `/api/conversations`, `/api/conversations/:id`, `/api/conversations/:id/messages`, `/api/conversations/:id/files`, `/api/conversations/:id/read`, `/api/files/:fileId`, plus `/api/realtime`.
- Jobs: `GET/POST /api/jobs`, `GET /api/jobs/:jobId`.
- Responses: `GET /api/jobs/:jobId/responses`, `GET /api/jobs/:jobId/my-response`, `POST /api/jobs/:jobId/responses`, `POST /api/responses/:responseId/{accept,reject,withdraw,worker-status,cancel-assignment,review}`.
- Dispatcher offers: `GET/POST /api/jobs/:jobId/offers`, `POST /api/dispatcher-offers/:offerId/select`.
- Lifecycle: `POST /api/jobs/:jobId/{finish,complete}`.

Typed client coverage in `src/lib/apiClient.ts` currently focuses on dispatcher offers and worker/dispatcher lifecycle. It does not yet represent all API routes or legacy screen queries.

## Frontend inventory by domain

| Domain | Runtime Supabase call sites | Existing Amvera coverage | Remaining work |
|---|---|---|---|
| Jobs / worker feed | `src/screens/FeedScreen.tsx`: `smart-search-jobs` Edge Function remains; basic feed already uses `GET /api/jobs`. `CreateJobScreen.tsx`: create already uses `POST /api/jobs`; `improve-job-description` Edge Function remains. | Basic job list/create/detail routes exist. | Port AI search/description enhancement only after specifying provider, limits, and API contract. |
| Worker response submission | `src/hooks/useRespondToJob.ts`: `get_weekly_completed_jobs`, `worker_submit_response`, profile lookup, `create_direct_conversation`, message insert, `notify-email`. | `POST /api/jobs/:jobId/responses` creates a response; conversation create and message routes exist separately. | One server-side response workflow is incomplete: quota enforcement, idempotent chat creation/message, notification behavior and consistent response result are not yet composed. Do not call this hook migrated. |
| Orders / client cabinet | `src/screens/OrdersScreen.tsx`: job/response/profile/offer reads, realtime channel, `worker_update_response_status`, `client_select_dispatcher_offer`. | Offer list/select, response accept/reject/withdraw and worker-status endpoints exist. | Replace screen query fan-out and realtime with typed API/event contracts; verify legacy RPC semantics before mapping status changes. |
| Dispatcher cabinet | `src/screens/DispatcherCabinetScreen.tsx`: jobs/responses/profile/stat reads; RPCs `dispatcher_submit_offer`, `dispatcher_cancel_job`, `dispatcher_republish_job`, `dispatcher_update_job`, `dispatcher_finish_job`, `dispatcher_complete_job`, `dispatcher_review_worker`; `dispatcher-analytics` Edge Function. | Offer submit, finish, complete and review endpoints exist. | Cancel/republish/update and analytics routes are missing; profile/stat queries need explicit response DTOs. |
| Job detail / responses | `JobDetailScreen.tsx`, `JobResponsesScreen.tsx` use API fetches; remaining Supabase imports are type-only. | Detail, own-response, response list, accept/reject/withdraw exist. | No direct runtime Supabase migration needed here; remove obsolete type imports only when types are replaced safely. |
| Chats | `RealChatsScreen.tsx` uses API for real sessions. `RealChatScreen.tsx` uses API/WebSocket in real sessions; remaining Supabase reads/writes are inside the demo branch. | Conversation list/create/delete/block, message list/send/read, file upload/download, WebSocket exist. | Keep demo data isolated from production backend; verify demo branch does not require a Supabase project. |
| Dispatcher community | `DispatcherCommunityScreen.tsx`: join RPC, message/count/profile queries, realtime, message send/delete, media upload. | General conversations/messages/files exist. | Community-specific membership, group access and moderation semantics/routes are missing. |
| Channel / social feed | `ChannelScreen.tsx`: settings, posts, likes, comments, profile lookups, realtime, image storage. | No corresponding channel/social API routes found. | Separate feature domain; requires schema, authorization, upload and moderation contract. |
| Profiles / reputation | `ProfileScreen.tsx`: avatar storage, profile updates, weekly/monthly stats, transactions, reviews/profile lookups. `UserProfileScreen.tsx`: profile/role/review reads and `worker_review_dispatcher`. `DispatchersScreen.tsx`: roles/profile reads. | Profile presence only; lifecycle updates aggregate selected financial fields. | Profile read/update, public profile, stats, transaction history and review routes are missing or incomplete. |
| Contracts / documents | `ContractScreen.tsx`, `DispatcherContractsModal.tsx`: contract/job/response/signature queries, party-profile RPC, PDF/preview Edge Functions, storage signed URLs, chat notifications. | Chat file storage is implemented; no contract API surface found. | Contract lifecycle, signatures, PDF generation and private document delivery need dedicated routes/storage policy. |
| Kartoteka | `KartotekaScreen.tsx`: CRUD and photo storage. | No corresponding API routes found. | Dedicated CRUD and private file API required. |
| Monetization | `CompanyScreen.tsx`: `purchase_company`; `PremiumScreen.tsx`: `purchase_premium`. | No purchase/billing routes found. | Do not port as raw RPC equivalents; define payment/ledger and entitlement rules first. |
| Notifications / unread | `useUnreadCounts.ts`: unread RPC/query and Supabase realtime. `useRealtimeNotifications.ts` already uses WebSocket. `NotificationsScreen.tsx` has no direct Supabase calls in the inspected file. | WebSocket transport exists; presence route exists. | Add notification persistence/list/read and unread-count API; remove old realtime channel only with parity tests. |
| Settings / push / misc components | `SettingsScreen.tsx`: support-user lookup, profile/avatar/block-list operations; Auth calls are excluded. `EnablePushButton.tsx`: VAPID Edge Function and push subscription insert (auth lookup is excluded). `AnnouncementModal.tsx`: settings query/realtime. `AppRatingModal.tsx`: rating insert. | No matching routes found for these features. | Add settings, push, announcements and app-rating contracts separately. |

## Recommended migration sequence

1. **Do not change auth/session in this task.** First complete the frontend inventory and keep the existing auth flow untouched.
2. Treat `useRespondToJob` as the first end-to-end business workflow candidate, but implement/verify its server-side orchestration before changing the hook. The current endpoint only inserts a response; it does not yet guarantee the legacy chat/message/quota/notification behavior.
3. Add integration tests against PostgreSQL for duplicate responses, unavailable jobs, dispatcher membership, chat creation idempotency, initial message insertion and notification event emission.
4. Only after a working, explicitly approved cookie-session adapter exists, switch the frontend hook to the Amvera API. Until then, leave it on the legacy path and do not create a false “migrated” state.
5. Next domains by dependency: orders/dispatcher cabinet; profile and financial read models; contracts; community/channel; storage and push; monetization.

## Known blockers / non-goals

- No frontend session adapter has been approved or wired to the new API.
- Existing Amvera endpoints are not proof that all screen workflows are equivalent.
- No old Supabase users, jobs, messages, media or other records are to be imported (clean start).
- No public DNS/domain or production traffic cutover is part of this inventory.
- This document does not claim Amvera production readiness or live deployment verification.


## Worker response workflow implementation

Implemented on the migration branch in `server/domain/submitWorkerResponse.mjs` and wired to `POST /api/jobs/:jobId/responses`.

Transaction sequence:
1. Lock the job row and verify that it is still open/active and assigned to a dispatcher.
2. Acquire a worker-scoped PostgreSQL advisory lock; read the current-week completed-job count and enforce the three-job free-tier limit unless the profile is Premium.
3. Create or reuse the worker's active response.
4. Acquire a stable participant-pair advisory lock, check mutual block state, and find or create the direct conversation.
5. For a new response only, insert the initial chat message and update the worker's read marker.
6. Write the response audit event and commit.
7. After commit, emit the dispatcher response event and the chat message event.

A repeated active response returns HTTP 200 with the existing response and conversation ID; it does not duplicate the first message. A new response returns HTTP 201. Errors use stable codes such as `WEEKLY_LIMIT_REACHED`, `JOB_NOT_AVAILABLE`, and `CHAT_BLOCKED`.

The generic direct-conversation creation endpoint now uses the same normalized pair advisory lock, preventing it from racing this workflow and creating a second direct chat through the Amvera API.

The weekly limit is checked at response submission time against completed assignments in the current PostgreSQL week (Monday-based `date_trunc('week', now())`). This preserves the legacy pre-application gate; it does not cancel or block work already accepted before the worker reaches the limit.

The integration suite requires `DATABASE_URL`; without it, these PostgreSQL-specific tests are reported as skipped. CI must run them against its PostgreSQL service.
