

# Fix: Status Bar Padding (Top) + Remove Bottom "Chin"

## Problem
1. **Top**: Content overlaps with the phone's status bar (clock, battery) — no safe-area padding at the top of `.app-shell`.
2. **Bottom**: A visible "chin" (extra space) appears below the bottom navigation bar — the app doesn't extend to the bottom edge properly.

## Root Cause
- `.app-shell` has no top padding for `env(safe-area-inset-top)`.
- `--app-height` uses `100vh` which doesn't account for mobile browser chrome. Should use `100dvh` (dynamic viewport height) with `100vh` fallback.
- `.bottom-docked` doesn't include `env(safe-area-inset-bottom)` padding, leaving the OS home indicator area as dead space that creates the "chin".

## Changes

### `src/index.css`
- **`.app-shell`**: Add `padding-top: env(safe-area-inset-top, 0px)` so content starts below the status bar.
- **`--app-height`**: Change from `100vh` to `100dvh` with `100vh` fallback across `:root`, `html`, `body`, `#root`.
- **`.bottom-docked`**: Add `padding-bottom: env(safe-area-inset-bottom, 0px)` so nav hugs the bottom edge on notched phones.

### `src/App.css`
- Update `#root` height to use `100dvh` with `100vh` fallback (match the CSS variable change).

### Files: 2
- `src/index.css` — safe-area top padding on shell, safe-area bottom on nav, dvh height
- `src/App.css` — dvh height fallback

