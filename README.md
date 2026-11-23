# Gruzli

Gruzli — mobile-first marketplace prototype for the workflow «Заказчик → Диспетчер → Грузчик».

## Development

```bash
npm ci
npm run dev
```

## Runtime mode

The application currently runs as a standalone local demo. It does not require Supabase, remote database credentials, or a backend connection.

- Authentication is simulated locally.
- Demo profiles, orders, responses, and related records are stored in the browser's local storage.
- Data is isolated to the current browser and device; it is not shared between users.
- Realtime updates and server-side workflows are represented by local demo behavior and are not production services.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test --project=chromium
```
