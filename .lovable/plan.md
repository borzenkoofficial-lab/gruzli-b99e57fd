

# Plan: Telegram/WhatsApp-style Chat Redesign

## Current Issues
- Message bubbles use flat neumorphic style — no visual distinction between own/other messages
- No tail/pointer on bubbles, no color differentiation
- No date separators between message groups
- No read status indicators (checkmarks)
- Input area feels heavy, no auto-grow textarea
- Chat list lacks online indicators, unread badges, avatar colors
- No message grouping (consecutive messages from same sender)
- Header is plain, no typing indicator

## Changes

### 1. `RealChatScreen.tsx` — Full Chat Overhaul
- **Colored bubbles**: Own messages get tinted background (like Telegram green/WhatsApp green → use `hsl(var(--primary))` tint), others get neutral surface color
- **Bubble tails**: CSS triangles on bottom-right (own) and bottom-left (other) via `rounded-br-sm` / `rounded-bl-sm`
- **Message grouping**: Consecutive messages from same sender within 2 min → no repeated name/avatar, tighter spacing
- **Date separators**: "Сегодня", "Вчера", or "12 апреля" between message groups from different days
- **Time inside bubble**: Move timestamp inside bubble (bottom-right), smaller, inline with text like WhatsApp
- **Read indicators**: Single ✓ for sent, ✓✓ for delivered (optimistic = single gray check, confirmed = double)
- **Auto-grow input**: Replace `<input>` with auto-resizing `<textarea>` (max 4 lines)
- **Send button animation**: Scale pop when sending
- **Typing area**: Rounded pill-style input like Telegram
- **Header polish**: Show avatar initials circle, subtle online dot, cleaner layout
- **Smooth scroll**: Use `scrollTo` with smooth behavior, scroll on new message only if already near bottom
- **Performance**: Memoize message items with `React.memo`, virtualize if needed later

### 2. `RealChatsScreen.tsx` — Chat List Polish
- **Colored avatar circles**: Generate consistent color from user name hash (like Telegram)
- **Unread count badge**: Show blue badge with count on conversations with unread messages
- **Last message preview**: Show ✓✓ prefix for own messages, truncate properly
- **Online dot**: Small green dot on avatar for online users
- **Typing indicator**: "печатает..." in preview when other user types
- **Smoother animations**: Reduce entrance delay, use spring physics

### 3. `src/index.css` — New Bubble Styles
- Add `.bubble-own` and `.bubble-other` utility classes with proper colors
- Own bubble: subtle primary tint background
- Other bubble: card/surface background

### Files Modified
- `src/screens/RealChatScreen.tsx` — complete visual overhaul of messages, input, header
- `src/screens/RealChatsScreen.tsx` — avatar colors, unread badges, better preview
- `src/index.css` — bubble color utilities

### No database changes needed — purely frontend/visual

