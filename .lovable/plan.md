

# AI-аналитика, умный поиск и модерация контента

Три AI-фичи на базе Lovable AI Gateway + edge functions.

---

## 1. AI-аналитика диспетчера

**Что:** В кабинете диспетчера (вкладка "stats") — кнопка "✨ AI-совет". AI анализирует статистику заявок диспетчера и даёт персональные рекомендации.

**Edge Function** `dispatcher-analytics` — принимает объект со статистикой (кол-во заявок, средняя ставка, % принятых, среднее время отклика), отправляет в Gemini, получает 3-5 советов на русском.

**UI:** Кнопка "✨ AI-совет" внизу вкладки stats в `DispatcherCabinetScreen.tsx`. При нажатии собирает текущую статистику, вызывает edge function, показывает карточку с рекомендациями. Лоадер во время загрузки.

---

## 2. Умный поиск заявок

**Что:** В ленте (`FeedScreen.tsx`) — поле поиска вверху. Грузчик вводит текст ("переезд завтра утром", "тяжёлые работы за 500"), AI фильтрует подходящие заявки.

**Edge Function** `smart-search-jobs` — принимает `{ query, jobs: [{id, title, description, address, hourly_rate, ...}] }`. AI возвращает массив ID подходящих заявок, отсортированных по релевантности. Используем tool calling для структурированного ответа.

**UI:** Строка поиска с иконкой ✨ в FeedScreen. При вводе текста и нажатии Enter — вызов edge function, фильтрация ленты по возвращённым ID. Кнопка "✕" сбрасывает на обычный вид.

---

## 3. AI-модерация контента

**Что:** Автоматическая проверка описаний заявок при создании и сообщений в чате. Блокирует спам, мат, подозрительный контент.

**Edge Function** `moderate-content` — принимает `{ text, type: "job"|"message" }`. AI оценивает: `{ safe: boolean, reason?: string }`. Используем tool calling.

**Интеграция:**
- `CreateJobScreen.tsx` — перед публикацией заявки проверяем title + description. Если `safe: false` → показываем причину, не даём опубликовать.
- `RealChatScreen.tsx` — перед отправкой сообщения проверяем текст. Если `safe: false` → toast с предупреждением.

---

## Файлы

| Действие | Файл |
|----------|------|
| Создать | `supabase/functions/dispatcher-analytics/index.ts` |
| Создать | `supabase/functions/smart-search-jobs/index.ts` |
| Создать | `supabase/functions/moderate-content/index.ts` |
| Изменить | `src/screens/DispatcherCabinetScreen.tsx` — кнопка AI-совет |
| Изменить | `src/screens/FeedScreen.tsx` — умный поиск |
| Изменить | `src/screens/CreateJobScreen.tsx` — модерация перед публикацией |
| Изменить | `src/screens/RealChatScreen.tsx` — модерация сообщений |

Миграции не нужны. Все три фичи используют `LOVABLE_API_KEY` (уже есть) и модель `google/gemini-3-flash-preview`.

