# Gruzli

Gruzli — mobile-first marketplace for the workflow «Заказчик → Диспетчер → Грузчик».

## Development

```bash
npm ci
npm run dev
```

Production builds use the real Supabase backend. Demo mode is enabled only with:

```env
VITE_GRUZLI_DEMO_MODE=true
```

Required production variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

## Validation

```bash
npm run lint
npm test
npm run build
npx playwright test --project=chromium
```
