# Project Memory

## Core
Dark theme, neumorphic. Primary hsl(230 60% 58%), bg hsl(228 20% 12%).
Inter font. Russian UI language. Mobile-first PWA (Gruzli).
Bottom nav fixed, flush to screen edge, just above iOS home indicator.
App shell max-width 32rem. Use --vh variable for height, never 100dvh directly.

## Memories
- [Layout rules](mem://design/layout-rules) — Bottom nav positioning, scroll padding, FAB placement
- [iOS viewport rules](mem://design/ios-viewport-rules) — innerHeight for --vh, bottom nav padding, keyboard behavior, orientation lock
- [VAPID push config](mem://features/vapid-push-config) — Native Web Push via VAPID keys configured but DISABLED; Progressier is the active push system
