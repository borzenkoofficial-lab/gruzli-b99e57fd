# GRUZLI — проверка готовности Amvera backend

Дата проверки: 2026-11-21  
Проверяемая ветка: `migration/amvera-native-backend`  
База сравнения: `main`  
Статус: **не готова к слиянию и публичному deployment; ядро dispatcher/worker/settlement частично реализовано в migration branch**

## Вывод

PR #14 — полезный каркас нового backend, но пока не полноценная замена текущему приложению. В ветке есть Node.js/Express API, PostgreSQL migrations, cookie sessions, WebSocket и базовый чат/заказы. Однако текущие экраны приложения всё ещё используют Supabase напрямую, а критические бизнес-функции GRUZLI не перенесены.

Слияние этой ветки сейчас приведёт к разрыву существующих сценариев. Успешный CI в PR #14 подтверждает только прохождение текущих автоматических проверок на ограниченном наборе кода, но не функциональную полноту миграции.

## 1. Frontend не переключён на новый API

В migration branch остаются:
- `@supabase/supabase-js` в `package.json`;
- `src/integrations/supabase/client.ts` и Supabase-generated types;
- прямые вызовы `supabase.from()`, `supabase.rpc()`, `supabase.functions.invoke()`, `supabase.storage` и `supabase.channel()` в экранах и hooks.

В README PR #14 прямо указано, что frontend всё ещё содержит legacy Supabase call sites. Серверный API сам по себе не заменяет эти вызовы. До завершения миграции data layer нельзя считать Amvera-версию готовой к запуску пользователей.

## 2. Реализованные HTTP-маршруты

В `server/index.mjs` на момент проверки присутствуют:
- health и DB health;
- auth register/login/recovery/me/logout;
- profile presence;
- conversations: create/list/detail/delete/block;
- messages: list/send/read;
- file upload/download;
- jobs: list/create/detail;
- responses: list, own response, create, accept, reject, withdraw;
- dispatcher offers: list, submit/update, client selection;
- worker lifecycle: status transitions, no-show cancellation before work starts;
- dispatcher lifecycle: finishing stage, final completion, worker review;
- financial ledger: immutable accrued-earning entries and transactional settlement.

Эти новые маршруты находятся в migration branch и пока не означают, что текущий frontend уже работает через Amvera API.

Старая регистрация/авторизация не является предметом текущего функционального аудита; перечисление этих маршрутов приведено только для фиксации состава migration branch.

## 3. Критические отсутствующие бизнес-сценарии

### Заказчик ↔ диспетчер
- **Реализовано в migration branch:** таблица `dispatcher_offers`, просмотр предложений, отправка/повторное предложение диспетчера и выбор предложения заказчиком.
- Выбор диспетчера блокирует строку заказа, фиксирует ставку и количество исполнителей, отклоняет остальные pending предложения и записывает audit log в одной транзакции.
- **Остаётся:** frontend всё ещё вызывает старые Supabase RPC; typed API client подготовлен, но экраны пока не переключены.

### Жизненный цикл исполнителя
- **Реализовано в migration branch:** endpoint переходов исполнителя `confirmed → en_route/late → arrived → completed`, endpoint этапа finishing, окончательного завершения заказа, отзывов и отмены назначения исполнителя до начала работы.
- При принятии отклика фиксируется `agreed_hourly_rate`; конкурентное принятие сериализуется блокировкой строки заказа, чтобы не допустить oversubscription/deadlock.
- Завершение заказа разрешено только после фактического старта назначенных исполнителей, завершения работ и отзывов. No-show можно снять с назначения до начала работы; при освобождении слота заказ снова открывается для подбора.
- Фактические часы при завершении исполнителя передаются явно (0,5–72 часа, с точностью до 0,1), а не вычисляются без ограничения по времени до нажатия кнопки.
- Не реализовано серверное применение недельного лимита исполнителя/Premium.
- Повторный отклик при конфликте уникального индекса сейчас попадёт в общий catch и может вернуть 500 вместо стабильного конфликта 409.

### Финансы и тарифы
- **Реализовано в migration branch:** immutable `financial_ledger` с уникальными начислениями исполнителям и доходом диспетчера; settlement и обновление агрегатов профиля выполняются в одной транзакции с завершением заказа.
- Ledger фиксирует начисленные суммы, а не факт банковского перевода. Выплаты, payment intents, списания, возвраты и статусы фактических платежей ещё не реализованы.
- Нет API для покупки Premium и тарифа компании (`purchase_premium`, `purchase_company`).
- В текущих Supabase RPC `purchase_premium` и `purchase_company` срок после повторной покупки считается от `now()`, а не от `GREATEST(now(), current_until)`: при продлении активной подписки оставшиеся дни могут теряться. В новом API продление должно накапливаться от более поздней из текущей даты и действующего срока.
- `purchase_premium` записывает ID Premium-тарифа в `profiles.company_plan`, смешивая разные типы подписок в одном поле. В новой схеме нужны отдельные идентификаторы/сущности тарифов Premium и компании.
- `purchase_company` в текущей RPC не проверяет бизнес-роль покупателя. Новая операция должна проверять право покупать и владеть компанией, а не только наличие средств.
- Новый backend рассчитывает provisional earning по зафиксированной ставке и фактическим часам, а добавляет её в ledger и `profiles.total_earned` только при окончательном закрытии заказа диспетчером.
- Корректировки/возвраты должны оформляться отдельными компенсирующими ledger entries; текущий API ещё не предоставляет полноценный workflow таких операций.
- Поле `profiles.balance` не используется как доказательство фактической выплаты. Ledger отражает начисление, не движение денег через банк.

### Профили и репутация
- Нет полноценных API чтения/обновления профиля, навыков, доступности и аватара; есть только обновление presence.
- **Реализовано в migration branch:** endpoint оценки исполнителя диспетчером с сохранением отзыва и пересчётом рейтинга.
- Полноценные публичные профили, навыки, доступность и аватары всё ещё требуют API и переноса UI.

### Чаты и коммуникации
- Базовые сообщения, read receipts, блокировка, presence, загрузка файлов и WebSocket signalling частично реализованы.
- Нет полноценной модели `voice_rooms`, хотя текущий клиент создаёт её напрямую.
- Текущий frontend удаляет сообщения/файлы через `delete_conversation_fully` и Supabase Storage; нового совместимого API-контракта на стороне UI пока нет.
- Push, email и Telegram-уведомления не перенесены как полноценная очередь/worker-система. WebSocket-события не заменяют push для закрытого приложения.

### Документы, модерация, администрирование
- Нет генерации договоров/PDF и контрактного workflow.
- Нет эквивалента модерации контента и улучшения описания заказа.
- Нет smart search, dispatcher analytics, admin users/jobs/chats/fraud reports/broadcasts.
- Нет полноценного переноса Edge Functions и фоновых задач.

## 4. Схема PostgreSQL пока покрывает только ядро

Новые миграции создают:
- пользователей/профили/сессии/audit log;
- jobs и job_responses;
- conversations, participants, messages, blocked_users;
- conversation_files.

Но для сохранения текущего продукта также нужны как минимум предметные модели:
- dispatcher_offers и история назначения;
- финансовый ledger, payment intents/transactions, тарифные подписки и история списаний;
- рейтинги/отзывы;
- contracts и generated documents;
- notifications и delivery attempts;
- push subscriptions;
- voice rooms/call sessions;
- job templates, SOS replacement, fraud reports и moderation events;
- audit trail для чувствительных бизнес-операций.

Это не требование скопировать старые таблицы один к одному. Схему нужно спроектировать заново под доменные инварианты, но перечисленные сценарии должны иметь устойчивое хранение и серверные операции.

## 5. Важные замечания по реализации API

1. `POST /api/jobs/:jobId/responses` не фиксирует agreed rate snapshot и не проверяет Premium/weekly limit на сервере.
2. Ошибка уникального индекса при параллельном повторном отклике не нормализована в 409.
3. `POST /api/responses/:responseId/accept` обновляет статус отклика, но не фиксирует agreed rate; бизнес-операция пока не эквивалентна текущему RPC.
4. `POST /api/jobs` делает базовую проверку формы, но не запускает moderation workflow и не инициирует предложение диспетчера.
5. В текущей реализации file upload проверяет MIME по заголовку клиента; перед production нужен content-signature/type validation и лимиты по типам/размерам.
6. Парольная схема в README/плане и фактическом коде должна быть согласована: документация migration plan говорит Argon2id, а `server/index.mjs` использует scrypt. Это нужно решить и задокументировать до production, но не смешивать с текущим аудитом старой авторизации.
7. **Исправлено в migration branch:** создание заказа и обязательная audit-запись выполняются в одной PostgreSQL-транзакции.
8. **Исправлено в migration branch:** проверка участника чата, reply target, блокировки, вставка сообщения и read receipt выполняются атомарно; realtime отправляется после COMMIT.
9. **Исправлено в migration branch:** отзыв отклика получает dispatcher_id тем же `UPDATE ... FROM ... RETURNING`, без второго запроса после изменения статуса.
10. `GET /api/health` возвращает HTTP 200 и `status: "ok"` даже когда PostgreSQL не настроен/недоступен; отдельно существует `/api/health/db`. Для deployment readiness необходимо использовать проверку БД, а liveness и readiness развести, чтобы платформа не считала приложение готовым при недоступном API.
11. Текущий Supabase RPC `dispatcher_finish_job` (миграция `20260929160000_harden_worker_status_lifecycle.sql`) остаётся слабее нового Amvera endpoint: старый RPC не проверяет допустимый исходный статус и наличие хотя бы одного принятого исполнителя. Новый endpoint разрешает переход только из `active/filled`, требует хотя бы одного принятого исполнителя и проверяет, что каждый назначенный исполнитель начал работу.
12. В новом `DELETE /api/conversations/:conversationId` любой участник диалога может удалить саму беседу и вложения для всех участников. До production нужно явно зафиксировать продуктовую политику: удаление для себя, удаление владельцем/администратором или глобальное удаление с подтверждением.

## 6. Порядок дальнейшей миграции

1. Частично зафиксированы доменные автоматы для dispatcher offers, worker status и settlement; далее нужно закрыть отмену/замену исполнителей, повторные запросы и граничные состояния.
2. Реализованы транзакции назначения диспетчера, принятия исполнителя, создания заказа, отправки сообщения и финансового закрытия.
3. Typed API client подготовлен для dispatcher offers и worker/dispatcher lifecycle; остаются тарифы, профили, уведомления, документы, moderation и admin operations.
4. Перевести frontend на один typed API client; удалить прямые Supabase зависимости только после замены всех call sites.
5. Перенести chat/realtime/storage полностью и обеспечить авторизованные WebSocket subscriptions.
6. Перенести уведомления, документы, модерацию, аналитику и admin operations.
7. Добавлены PostgreSQL migration checks, domain tests и ledger integration test; остаются конкурентные API integration tests для acceptance/settlement и повторных запросов.
8. Добавить Playwright сценарии для трёх ролей и end-to-end проверки на тестовом Amvera окружении.

## Критерий допуска PR #14 к merge

- Нет Supabase SDK, env variables, generated types, RPC/Storage/Realtime/Edge Function call sites в runtime/build.
- Все существующие продуктовые сценарии имеют соответствующие API и PostgreSQL-модели.
- Финансовые операции атомарны, идемпотентны и имеют ledger.
- Все три роли проходят end-to-end сценарии.
- Есть интеграционные тесты для конкурентного принятия откликов, завершения заказов и финансовых операций.
- Проверены upload/download permissions и WebSocket authorization.
- CI зелёный, а тестовый deployment проверен вручную.
