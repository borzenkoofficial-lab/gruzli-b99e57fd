

# Global App Optimization Plan

## Problems Identified

### Performance Issues
1. **Duplicate Supabase realtime channels**: `FeedScreen` subscribes to `jobs INSERT` AND `useRealtimeNotifications` also subscribes to `jobs INSERT` AND `useUnreadCounts` subscribes to `jobs INSERT` — 3 channels for the same event. Should consolidate.
2. **N+1 queries in `RealChatsScreen.fetchConversations`**: For each conversation, it makes separate queries for messages, participants, and profiles — should batch.
3. **`framer-motion` overhead**: Every job card, chat item, and list entry uses `AnimatePresence` + `motion.div` with delays. On lists with 20+ items this causes jank. Should limit entrance animations to first ~5 items and use CSS transitions for the rest.
4. **Google Fonts loaded via CSS `@import`**: Blocks rendering. Should use `<link preconnect>` in `index.html`.
5. **`send.wav` audio created on every message send** — should be cached once.
6. **No `React.lazy` / code splitting**: All screens load upfront even though only one is visible at a time.

### Broken / Non-functional Elements
7. **FAB buttons do nothing**: The 3 FAB actions ("Нужна бригада", "Заказы рядом", "SOS") have no `onClick` handlers — they render but clicking does nothing.
8. **Online dot is always shown** in `RealChatsScreen` — there's no actual online tracking, so it's misleading. Should hide or mark as "был недавно".
9. **Chat header shows "онлайн" always** in `RealChatScreen` — same problem.
10. **Unread count in chat list is always 0** — `unreadCount: 0` is hardcoded with `// TODO` comment.
11. **`window.location.reload()`** in `AvatarWithUpload` after avatar upload — very jarring, should update state instead.

### UX / Visual Issues
12. **Bottom nav `position: relative`** — already addressed, but content still needs consistent `pb-20` to prevent last items hiding behind nav.
13. **Splash screen 2.2s** is long for returning users — should skip or reduce to 1s for returning sessions.

## Planned Changes

### File: `index.html`
- Move Google Font from CSS `@import` to `<link rel="preconnect">` + `<link rel="stylesheet">` in head for faster loading.

### File: `src/index.css`
- Remove the `@import url(...)` for Google Fonts (moved to HTML).
- Add `pb-20` to `.app-scroll` as default bottom padding.

### File: `src/screens/FeedScreen.tsx`
- Remove duplicate realtime subscription for `jobs INSERT` (already handled by `useRealtimeNotifications`).
- Limit `motion.div` entrance animation delays to first 5 cards (`delay: i < 5 ? i * 0.05 : 0`).

### File: `src/screens/RealChatsScreen.tsx`
- Batch profile lookups: collect all other-user IDs, fetch profiles in one query.
- Implement real unread count using `messages` table (count messages after last read timestamp, or fallback to last 24h logic).
- Remove fake "online" dot — replace with last seen time or remove entirely.
- Limit entrance animation to first 5 items.

### File: `src/screens/RealChatScreen.tsx`
- Cache `send.wav` Audio object (create once, reuse).
- Remove hardcoded "онлайн" in header — show "был(а) недавно" or hide.
- Optimize `renderMediaMessage` with `useCallback` to prevent re-renders.

### File: `src/components/FAB.tsx`
- Add functional actions: "Заказы рядом" scrolls to feed, "SOS" opens support chat, "Нужна бригада" is a placeholder toast. Or remove non-functional buttons.

### File: `src/components/SplashScreen.tsx`
- Check localStorage for `returning_user` flag; if set, reduce splash to 800ms. Set the flag after first load.

### File: `src/screens/ProfileScreen.tsx`
- Replace `window.location.reload()` with profile state refresh after avatar upload.

### File: `src/hooks/useUnreadCounts.ts`
- Remove `jobs INSERT` subscription (duplicated in `useRealtimeNotifications`).

### File: `src/App.tsx`
- Add `React.lazy` for `AdminPage` and `UnsubscribePage` (rarely used routes).

## Summary
- **6 performance optimizations**: deduplicate channels, batch queries, limit animations, font loading, audio caching, lazy loading.
- **5 bug fixes**: FAB actions, fake online status, hardcoded unread=0, avatar reload, always "онлайн".
- **2 UX improvements**: splash speed for returning users, bottom padding consistency.

