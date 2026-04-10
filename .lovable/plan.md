

## Problem

The app has opaque backgrounds at the top (header area with `safe-top` padding) and bottom (below the floating pill nav). Content cannot scroll into these areas — it's clipped, leaving dead space. The user wants content to be visible behind the nav pill AND behind the top header area, creating a true edge-to-edge scrolling experience.

## Plan

### 1. Bottom area — let content scroll fully to the edge

**`src/index.css`**:
- Change `.app-scroll` `padding-bottom` from `calc(var(--bottom-nav-height) - 16px)` to just `0`. Content will scroll all the way to the bottom; the floating pill overlays it transparently (it already has `backdrop-filter: blur` and semi-transparent background).

### 2. Top area — make headers transparent with blur

**`src/index.css`**:
- Create a new `.safe-top` class that replaces the current opaque version. Instead of just padding, it will have a transparent/blur background so content scrolls behind it:
  - `background: hsl(var(--background) / 0.55)`
  - `backdrop-filter: blur(32px) saturate(1.6)`
  - `position: sticky; top: 0; z-index: 40`
  - Keep the existing padding: `padding-top: calc(env(safe-area-inset-top, 0px) + 18px)`

### 3. App shell background

**`src/index.css`**:
- On `.app-shell`, keep `background: hsl(var(--background))` — this is the base. The transparency effect comes from the header and nav overlays, not the shell itself.

### Summary of changes

- **1 file modified**: `src/index.css`
  - `.app-scroll`: remove bottom padding so content reaches the bottom edge
  - `.safe-top`: add sticky positioning + glass blur + semi-transparent background
  - Light theme variants for `.safe-top`

This ensures content scrolls edge-to-edge behind both the top header and the bottom floating nav pill, matching the reference screenshot's aesthetic.

