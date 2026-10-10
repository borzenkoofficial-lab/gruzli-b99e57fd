# Gruzli 0.2.0 — PWA / Mobile Architecture Audit

## Decision

Do **not** rewrite the Gruzli application shell, navigation, React Query layer, Supabase integration, or existing mobile CSS.

The repository already contains substantial native-like mobile work:

- PWA manifest and iOS meta tags;
- mobile app shell;
- safe-area handling;
- mobile viewport handling;
- bottom navigation;
- pull-to-refresh;
- mobile back gesture;
- deep-link handling;
- lazy loading / warm-up of primary screens;
- React Query caching;
- realtime notifications;
- push notification service-worker hooks;
- role-specific navigation;
- existing mobile QA and Playwright infrastructure.

The correct strategy is therefore **incremental hardening**, not a rewrite.

## Current architecture

```
React App
  ├─ AuthContext
  ├─ React Query
  ├─ BrowserRouter
  ├─ Mobile App Shell
  ├─ Role-specific screens
  └─ Supabase
       ├─ Auth
       ├─ RPC / business logic
       ├─ Realtime
       └─ Database
```

PWA infrastructure is an additional layer:

```
Browser
  │
  ├─ App Shell / React
  ├─ Service Worker
  │    ├─ App-shell cache
  │    ├─ Static asset runtime cache
  │    └─ Push / notification click
  │
  └─ Supabase
       └─ remains the server authority
```

## What we deliberately do NOT add yet

1. No full offline-first marketplace.
2. No IndexedDB replacement for React Query.
3. No client-side source of truth for orders/responses/assignments.
4. No generic POST background queue.
5. No new PWA dependency unless native browser APIs prove insufficient.
6. No React Native rewrite.
7. No visual redesign.
8. No changes to Supabase business RPCs as part of the PWA shell stage.

## Why

Gruzli contains transactional marketplace operations. An offline action such as accepting a worker, assigning an order, cancelling a job, or changing worker status can conflict with a newer server state.

Therefore:

**Supabase remains authoritative.**

The first PWA stage only makes the application shell resilient when the network is unavailable. Business synchronization will be introduced operation-by-operation later.

## Stage 1 implemented

- production service-worker registration;
- existing service worker preserved and extended rather than replaced blindly;
- versioned shell/runtime caches;
- network-first SPA navigation;
- cached app shell as offline navigation fallback;
- cache-first handling for same-origin static assets after first fetch;
- explicit exclusion of Supabase/API traffic from the service-worker cache;
- existing Web Push and notification-click behavior preserved;
- manifest identity, scope, language and description hardened.

## Next stages

### Stage 2 — Network / lifecycle

- central online/offline state;
- reconnect detection;
- request timeout/retry policy;
- foreground/background resume;
- query revalidation on resume;
- state restoration.

### Stage 3 — Local cache

Introduce IndexedDB only for data that has a clear ownership model:

- last-known read-only data;
- drafts;
- safe local preferences;
- bounded UI state.

Do not mirror all Supabase tables.

### Stage 4 — Safe sync

Introduce a durable queue only for explicitly approved operations.

Every queued operation must have:

```
QUEUED → SENDING → SERVER_CONFIRMED
                   ↘ FAILED / RETRY
```

Server confirmation, not optimistic UI, defines success.

### Stage 5 — Push / deep-link hardening

- real subscription lifecycle;
- stale subscription cleanup;
- notification routing;
- authentication-aware deep links;
- order/chat destination validation.

### Stage 6 — Device capabilities

- camera;
- location;
- vibration;
- permissions;
- share;
- install-state detection.

Only add a capability when there is a concrete Gruzli use case.

### Stage 7 — Mobile QA

Required matrix:

- iPhone Safari;
- installed iOS PWA;
- Android Chrome;
- desktop Chromium;
- 320–430px widths;
- short and tall viewports;
- online;
- offline;
- network recovery;
- background/resume;
- reload;
- PWA update;
- all three main roles;
- realtime;
- push/deep links.

## Release gate

Gruzli 0.2.0 is not complete because a build is green.

Release requires:

1. no data-loss paths found;
2. no role/permission regressions;
3. no duplicate realtime subscriptions;
4. offline shell opens after a previous successful visit;
5. backend remains authoritative;
6. PWA update does not strand users on an incompatible cached version;
7. existing business flows remain green;
8. mobile QA passes on real devices.

## Architectural principle

**Make Gruzli feel native by improving the existing engine, not by replacing the application.**
