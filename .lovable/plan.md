

## Админ-панель Gruzli

### Что будет сделано

Полноценная админ-панель с доступом только для пользователей с ролью `admin`. Панель будет доступна по маршруту `/admin` и включать управление пользователями, балансами, верификацией и мониторинг чатов.

### Шаг 1: Добавить роль admin в систему

- Добавить `'admin'` в enum `app_role` (миграция: `ALTER TYPE app_role ADD VALUE 'admin'`)
- Обновить `AuthContext` — расширить `AppRole` на `"worker" | "dispatcher" | "admin"`
- Создать RPC-функцию `admin_list_users` (security definer) для получения списка всех пользователей с профилями и ролями
- Создать RPC-функции для админ-действий:
  - `admin_set_verified(target_user_id, verified)` — подтверждение верификации
  - `admin_update_balance(target_user_id, amount)` — пополнение баланса
  - `admin_set_blocked(target_user_id, blocked)` — блокировка пользователя
- Добавить колонку `blocked` (boolean, default false) в таблицу `profiles`

### Шаг 2: Страницы админ-панели

Создать `src/pages/AdminPage.tsx` — основной layout с боковым меню (sidebar) и вкладками:

**Вкладка «Пользователи»** (`AdminUsersTab.tsx`):
- Таблица всех пользователей (имя, роль, баланс, верификация, статус блокировки)
- Поиск и фильтр по роли (worker/dispatcher)
- Кнопки действий: верифицировать, заблокировать, пополнить баланс (через диалог с вводом суммы)

**Вкладка «Чаты»** (`AdminChatsTab.tsx`):
- Список всех диалогов с участниками
- Возможность открыть и просмотреть сообщения любого чата (read-only)

**Вкладка «Заказы»** (`AdminJobsTab.tsx`):
- Список всех заказов со статусами и откликами
- Фильтр по статусу (active/completed/cancelled)

### Шаг 3: Маршрутизация и защита

- Добавить маршрут `/admin` в `App.tsx`
- Проверка роли `admin` — если не admin, редирект на `/`
- Добавить кнопку «Админ-панель» в профиле, видимую только для admin

### Шаг 4: RLS-политики для админ-функций

Все админ-действия выполняются через `security definer` функции, которые внутри проверяют `has_role(auth.uid(), 'admin')`. Это безопасно — клиент не получает прямой доступ к чужим данным.

Для чтения чатов админом — добавить SELECT-политику на `messages` и `conversations`:
```sql
CREATE POLICY "Admins can view all messages"
ON messages FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));
```

### Файлы

**Создать:**
- `src/pages/AdminPage.tsx` — layout админки
- `src/components/admin/AdminUsersTab.tsx`
- `src/components/admin/AdminChatsTab.tsx`  
- `src/components/admin/AdminJobsTab.tsx`
- Миграция с новыми функциями, колонкой `blocked`, ролью `admin`

**Изменить:**
- `src/contexts/AuthContext.tsx` — добавить `"admin"` в тип
- `src/App.tsx` — маршрут `/admin`
- `src/screens/ProfileScreen.tsx` — кнопка «Админ-панель» для admin

