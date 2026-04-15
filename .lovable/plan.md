

# AI-помощник для описания заявки

## Что сделаем
Кнопка ✨ AI рядом с полем описания. Диспетчер пишет черновик → нажимает кнопку → AI переписывает текст грамотнее, структурированнее и профессиональнее. Также может дополнить описание на основе названия заявки, если описание пустое.

## План

### 1. Edge Function `improve-job-description`
Новая функция `supabase/functions/improve-job-description/index.ts`:
- Принимает `{ title, description }` 
- Вызывает Lovable AI Gateway (`google/gemini-3-flash-preview`)
- Системный промпт: "Ты — помощник диспетчера грузчиков. Перепиши описание заявки грамотно, структурированно и кратко. Если описание пустое — составь его по названию. Пиши на русском. Не добавляй лишнего."
- Возвращает улучшенный текст (без стриминга, просто invoke)

### 2. Кнопка AI в CreateJobScreen
- Кнопка `✨ AI` (иконка Sparkles) под полем описания
- При нажатии:
  - Если нет ни title, ни description → toast "Сначала введите название"
  - Показать лоадер на кнопке
  - Вызвать `supabase.functions.invoke('improve-job-description', { body: { title, description } })`
  - Заменить description улучшенным текстом
  - Toast "Описание улучшено"
- Кнопка неактивна во время загрузки

### Файлы
1. **Создать** `supabase/functions/improve-job-description/index.ts` — edge function
2. **Изменить** `src/screens/CreateJobScreen.tsx` — добавить кнопку AI и логику вызова

