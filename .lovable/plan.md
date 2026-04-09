

# Fix: Bottom Nav Scrolling + Channel Screen Post Visibility

## Problems Identified

1. **Bottom nav moves when scrolling** — `.bottom-docked` uses `position: relative` which makes it part of the document flow. When content overflows, it gets pushed down. Need to make it truly fixed at the bottom.

2. **Channel screen can't scroll to see all posts** — `ChannelScreen` renders as a full-screen overlay with `min-h-screen` but no proper scroll container. The sticky header + posts list lacks a scrollable wrapper, so content gets clipped.

## Changes

### 1. Fix `.bottom-docked` in `src/index.css`
Change from `position: relative` to `position: sticky; bottom: 0` (or keep flexbox approach but ensure `flex-shrink: 0` works). The real fix: the `app-scroll` div needs `padding-bottom` equal to nav height, and the nav needs to stay pinned. Since the layout uses flexbox (`app-shell` is flex column), the nav should already stay at bottom — but content inside `app-scroll` may need bottom padding so the last items aren't hidden behind the nav.

Actually, reviewing the layout: `app-shell` is flex column with `overflow: hidden`. `app-scroll` is `flex: 1` with `overflow-y: auto`. `bottom-docked` is `flex-shrink: 0`. This should work correctly. The issue is likely that the feed screen content doesn't have enough bottom padding, so the last card is partially hidden behind the nav. Will add `pb-20` (or similar) to scrollable content areas.

Also, the `PullToRefresh` wrapper on the feed tab may not have proper scroll containment, causing the bottom nav to be pushed.

### 2. Fix `ChannelScreen.tsx` scroll
Wrap the entire channel screen in a proper flex layout with a scrollable content area, similar to `app-shell` pattern. Add `overflow-y: auto` to the posts container and constrain the screen height.

### Files Modified
- `src/index.css` — ensure bottom-docked is properly fixed
- `src/screens/ChannelScreen.tsx` — add proper scroll container, add bottom padding
- `src/screens/FeedScreen.tsx` — add bottom padding to content
- `src/pages/Index.tsx` — check PullToRefresh wrapper doesn't break layout

