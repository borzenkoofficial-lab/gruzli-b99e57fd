# Gruzli

Gruzli — marketplace для трёх ролей: **Заказчик → Диспетчер → Грузчик**.

## Архитектура

- Frontend: React 18 + Vite + TypeScript
- Routing: React Router
- Data/query layer: TanStack Query
- UI: Tailwind + Radix UI
- Backend schema: Supabase/Postgres migrations + RPC/Edge Functions
- Mobile shell: BottomNav, safe-area/keyboard handling, pull-to-refresh
- Desktop shell: sidebar + top bar + workspace layout

## Основной workflow

1. Заказчик создаёт заказ.
2. Диспетчеры отправляют предложения.
3. Заказчик выбирает диспетчера.
4. Диспетчер назначает грузчиков.
5. Грузчики подтверждают участие и проходят рабочие статусы.
6. Диспетчер завершает заказ.
7. Участники получают чат/уведомления/отзывы в соответствующих сценариях.

Критические переходы должны выполняться серверными lifecycle RPC, а не прямыми клиентскими изменениями полей заказа.

## Разработка

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
npx playwright test
```

Vite dev server использует порт **8080**.

## Production audit

Актуальная карта проблем и ограничений находится в:

`docs/GRUZLI_PRODUCTION_AUDIT_2026-10-03.md`

Важно: текущий `src/integrations/supabase/client.ts` — локальный demo adapter, совместимый по форме с Supabase API. Подключение реального Supabase client должно быть отдельным production-hardening этапом; demo-режим нельзя считать production authentication.

## Правило ролей

- **client** — создаёт свои заказы и выбирает предложение диспетчера.
- **dispatcher** — работает только со своими назначенными/доступными заказами и управляет staffing workflow.
- **worker** — видит только доступную назначенную работу и собственные отклики/статусы.
- **admin** — отдельная административная роль, не выдаётся обычной регистрацией.

## CI

GitHub Actions проверяет:

- install
- lint
- Vitest
- production build
- Playwright smoke test

Полноценный E2E с реальным Supabase backend и role-isolation пока требует подключения production/test Supabase environment.
