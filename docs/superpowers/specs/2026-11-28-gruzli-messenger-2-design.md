# Gruzli Messenger 2.0 — Design Specification

**Status:** Draft for product approval  
**Target:** Mobile-first Gruzli PWA  
**Implementation branch:** `feat/messenger-2.0`

## 1. Intent

Rebuild the working chat area into a coherent, modern communications product for dispatchers, movers, and other Gruzli participants. The redesign covers both the conversation inbox and the active one-to-one/group conversation. It should feel like a native, polished messenger while remaining recognizably Gruzli.

The inspiration is the interaction density and convenience of modern Telegram, not a visual copy. The visual system should reuse the editorial language of the Gruzli job feed: strong typography, restrained black/white/yellow palette, precise borders, compact metadata chips, and job cards embedded in conversations.

## 2. Goals

- Make conversations easy to find, sort, separate, and manage.
- Provide built-in tabs plus user-created folders.
- Search conversation names and message contents.
- Make unread state, online presence, last activity, and message delivery understandable.
- Redesign the active conversation: header, message grouping, bubbles, replies, composer, attachments, and linked-job cards.
- Preserve working capabilities where verified: text, replies, emoji/stickers, image/video attachments, voice messages, presence, and call entry points.
- Audit and fix functional defects in the chat area, not only visual defects.
- Keep Supabase as the current backend and preserve existing conversation/message records.

## 3. Non-goals

- No migration away from Supabase or Vercel.
- No attempt to clone Telegram pixel-for-pixel.
- No new end-to-end encryption protocol in this redesign.
- No claims of delivered/read status unless the underlying state is actually persisted and reliable.
- No destructive global deletion as a swipe shortcut.
- No fabricated participants, avatars, typing states, or delivery states.

## 4. Current implementation findings

The active routes use `src/screens/RealChatsScreen.tsx` and `src/screens/RealChatScreen.tsx`. Legacy `ChatsScreen.tsx` and `ChatDetailScreen.tsx` are separate implementations and must not be mistaken for the active screens.

The inbox currently:
- Loads `conversation_participants`, `conversations`, recent `messages`, and public profiles from Supabase.
- Uses Supabase Realtime for inserted messages and participant changes.
- Searches only `otherName`, not message content.
- Derives unread counts from a broad descending message query and each participant's `last_read_at`.
- Has no persisted folders, archive, pin, or per-user mute model.
- Exposes a swipe action that invokes `delete_conversation_fully`, which deletes the conversation for all participants after confirmation. This is too destructive for an ordinary inbox gesture.
- Contains untyped `any` casts in profile and realtime payload handling.

The active conversation already contains message replies, emoji/sticker selection, image/video attachments, voice recording/playback, presence, linked-job context, and call entry points. These must be regression-tested before changing their presentation. Some actions need a behavior audit: for example, the current mute action only displays a success toast and does not persist notification preferences.

The generated Supabase schema currently includes `conversations`, `conversation_participants`, `messages`, and `blocked_users`. No existing chat-folder or per-user conversation-preference table was found in the generated types.

## 5. Approaches considered

### A. Cosmetic redesign only
Fastest, but leaves search, folders, archive, mute, and destructive swipe behavior unresolved.

### B. Full messenger rebuild with a new chat backend
Would allow a clean architecture, but adds migration risk and would threaten existing conversation history and working features.

### C. Incremental Messenger 2.0 on the current Supabase model — selected
Rebuild the two active screens and add narrowly scoped per-user chat preferences and folder metadata while preserving the existing conversations/messages model. This gives a new product experience without replacing the messaging backend.

## 6. Product experience

### 6.1 Inbox

**Header**
- Gruzli Chats title, compact account/context controls, and a clear new-chat action where supported by existing user-discovery flows.
- Search field with a dedicated clear action and useful empty/loading/error states.

**Built-in tabs**
- All
- Unread
- Personal
- Work
- Groups
- Archive

The classification rules must be based on actual conversation metadata and verified role/job relationships. Do not silently classify a conversation as “Work” unless there is a reliable signal (for example, linked `job_id`, group context, or a verified participant relationship).

**Custom folders**
- Users can create, rename, reorder, and delete folders.
- Folder contents can be manually selected and optionally driven by supported smart filters (unread, groups, linked-to-job).
- Folder configuration and per-user conversation preferences persist in Supabase so they survive sign-in and device changes.
- Deleting a folder must never delete conversations.
- A conversation may appear in more than one custom folder.
- Empty folders have a useful empty state and edit action.

**Conversation rows**
- Avatar/initials and online indicator only when real data exists.
- Name, preview of last message, timestamp, unread badge.
- Distinct preview labels for image, video, voice, sticker, and system messages.
- Optional pinned/favorite indicators and linked-order context.
- Context menu and swipe actions for safe, reversible actions: pin/unpin, archive/unarchive, mute/unmute, mark unread/read. Destructive deletion is not a swipe action.

**Search**
- Search people/conversation titles and message text.
- Results identify the matching conversation and message excerpt; selecting a message opens the conversation at that message.
- Debounce requests, cancel or ignore stale results, and show separate empty/error states.
- Respect Supabase row-level security; never search messages outside the current user's conversations.

### 6.2 Active conversation

**Header**
- Back navigation, avatar, name, actual presence/last-seen, and a compact action menu.
- Audio/video call buttons only when their existing implementation is operational and permission errors are handled.
- Conversation details/profile opens from the header.

**Message timeline**
- Editorial Gruzli message surfaces: own messages use a dark graphite surface with a restrained yellow accent; incoming messages use a light surface with a fine neutral border. Keep text contrast high and avoid thick outlines.
- Rounded geometry and grouped message tails should distinguish consecutive messages without creating a stack of oversized cards.
- Date separators and system messages remain clear and compact.
- Replies show a concise quoted preview and jump to the original message.
- Media, voice, stickers, and system messages keep their specialized renderers.
- Message actions (reply, copy where supported, delete only with correct authorization, reactions where persisted) must be functional and accessible.

**Linked job card**
- Reuse the feed's editorial card language in a compact embedded format: job title, location, worker count, rate, and a clear open-job action.
- Do not duplicate or invent job data; render only fields returned by the linked job.
- The card must not overwhelm the conversation timeline.

**Composer**
- Message input with clear send state, attachment entry, emoji/sticker entry, and voice recording.
- Support keyboard-safe and mobile safe-area layout.
- Upload progress, failed upload, retry/cancel, disabled/sending, and empty states.
- Keep existing working media and voice capabilities.

### 6.3 Visual language

- Gruzli palette: charcoal/black, white/off-white, yellow as a purposeful accent.
- Typography: strong screen title, compact labels, readable message body.
- Borders: thin and low-contrast by default; stronger emphasis only for selected, focused, or important states.
- Icons: one consistent Lucide stroke weight and optical size; avoid mixing emoji and unrelated icon styles for primary controls.
- Motion: short, restrained transitions for tab selection, opening menus, and new messages; respect reduced-motion settings.
- Responsive behavior: mobile-first; verify narrow widths, safe areas, long names, long message text, and large text settings.

## 7. Data and persistence proposal

Add user-scoped persistence without changing existing message ownership:

1. `conversation_user_preferences`
   - `user_id`, `conversation_id`
   - `is_pinned`, `is_archived`, `is_favorite`, `is_muted`
   - optional `is_unread_override` only if product behavior requires manual mark-unread independent of `last_read_at`
   - timestamps and unique constraint on (`user_id`, `conversation_id`)

2. `chat_folders`
   - `id`, `user_id`, `name`, `icon`, `sort_order`, `filter_config`, timestamps
   - owner-only RLS

3. `chat_folder_conversations`
   - `folder_id`, `conversation_id`, `sort_order`
   - RLS must verify folder ownership and conversation participation.
   - Unique constraint on (`folder_id`, `conversation_id`).

Exact SQL and policy definitions belong in a reviewed migration. Do not apply migrations to the live Supabase project as part of this design approval. The existing `conversation_participants.last_read_at` remains the canonical read cursor unless the audit proves it insufficient.

Message search should use a bounded, indexed query or a security-reviewed RPC. Do not fetch every message for every conversation to implement search. Search must be scoped by current-user participation and respect RLS.

## 8. Safety and correctness requirements

- Swipe gestures must never globally delete a conversation.
- Archive, pin, favorite, mute, and folder membership are per-user.
- Folder deletion only removes folder metadata/membership.
- Errors from Supabase must be visible and recoverable; no success toast for a no-op.
- Realtime updates must not double-count unread messages or reorder stale results incorrectly.
- Unread count must be correct across pagination and multiple devices.
- Search must not leak cross-conversation or cross-user message data.
- All actions must have loading/disabled states and clear failure feedback.
- Demo mode must remain usable without production Supabase credentials and must not accidentally invoke live-only RPCs.

## 9. Delivery sequence

1. **Audit and baseline:** document current message behavior, active route wiring, schema/RLS assumptions, current errors, and add tests around existing behavior.
2. **Inbox foundations:** typed conversation model, safe query strategy, unread/read correctness, realtime handling, and per-user preference data model.
3. **Inbox UI:** redesigned list, built-in tabs, search, archive, safe row actions, and empty/loading/error states.
4. **Custom folders:** create/edit/reorder/delete, manual membership, supported smart filters, persistence, and RLS tests.
5. **Conversation UI:** redesigned header, timeline/bubbles, composer, and linked-job card.
6. **Feature regression:** replies, attachments, voice, emoji/stickers, presence, calls, block/report, and deletion authorization.
7. **Verification:** lint, TypeScript, unit/integration tests, production build, Playwright flows at mobile and desktop widths, keyboard/safe-area checks, and realtime multi-user smoke tests where the environment permits.

Deliver the inbox redesign first as a usable milestone, then the active conversation redesign. Keep work on the feature branch until Preview and checks are reviewed.

## 10. Acceptance criteria

- Built-in tabs produce correct, explainable results.
- Users can create, edit, reorder, and delete custom folders; folders persist after refresh and sign-in.
- Search finds both conversations and matching message content without exposing unauthorized messages.
- Archive/pin/favorite/mute are per-user and do not affect other participants.
- A swipe cannot delete a conversation for everyone.
- Unread counts and ordering remain correct after new messages, read updates, and realtime reconnects.
- Existing text, reply, media, voice, sticker, presence, and call flows still work or are explicitly marked unavailable with a truthful UI state.
- Linked-job card shows only real job fields and opens the correct job.
- No mobile horizontal overflow; controls remain reachable above the keyboard and safe-area insets.
- All required automated checks pass; any unavailable external integration test is reported explicitly.

## 11. Builder decisions

- Use the existing React, Tailwind, shadcn/ui, Framer Motion, Lucide, and Supabase stack; do not add a UI framework.
- Prefer small focused components/hooks over further expanding the already large screen files.
- Keep generated Supabase types generated from the reviewed schema; do not hand-edit generated output.
- Treat new database migrations as source-controlled artifacts; live application is a separate release decision.
- Implement demo behavior intentionally for folder/preferences/search UI so Preview remains testable without Supabase.
