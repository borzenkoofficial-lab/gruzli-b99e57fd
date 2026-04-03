
## План реализации

### 1. База данных (миграции)
- Таблица `profiles` (id, user_id, full_name, avatar_url, role enum: worker/dispatcher, phone, rating, completed_orders, skills)
- Таблица `user_roles` (id, user_id, role enum)
- Таблица `jobs` (id, dispatcher_id, title, description, hourly_rate, start_time, duration_hours, address, metro, workers_needed, urgent, quick_minimum, status, created_at)
- Таблица `job_responses` (id, job_id, worker_id, status: pending/accepted/rejected, message, created_at)
- Таблица `conversations` (id, job_id, created_at)
- Таблица `conversation_participants` (id, conversation_id, user_id)
- Таблица `messages` (id, conversation_id, sender_id, text, type: text/image/voice, created_at)
- RLS политики на все таблицы

### 2. Авторизация
- Страница регистрации с выбором роли (Грузчик / Диспетчер)
- Страница входа
- AuthContext с проверкой роли
- Роутинг: разный интерфейс по роли

### 3. Интерфейс диспетчера
- Главная: список своих заявок (вместо ленты)
- Форма создания заявки (название, время, оплата/час, адрес, метро, описание, срочность)
- Просмотр откликов на заявку
- Чаты с грузчиками

### 4. Интерфейс грузчика
- Лента заявок (как сейчас, но из БД)
- Кнопка «Откликнуться» → создаёт отклик в БД
- Мои заказы → реальные из БД
- Чаты → реальные с Supabase Realtime

### 5. Реалтайм-чаты
- Подписка на новые сообщения через Supabase Realtime
- Отправка/получение сообщений в реальном времени
- Онлайн-статус пользователей
