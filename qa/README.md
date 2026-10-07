# Gruzli Temporary AI QA Scanner

Это временный dev-only QA слой. Основное приложение не получает AI-интеграцию в production.

## Запуск

Терминал 1:

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

Терминал 2:

```bash
npm run qa:server
```

Открой:

```text
http://127.0.0.1:4173/?qa=1
```

В панели можно временно вставить OpenAI-compatible endpoint, model и API key. Ключ хранится только в React state этой вкладки и не записывается в localStorage или репозиторий.

Без ключа запускается deterministic scan: console, network, screenshots, DOM и geometry. С ключом добавляется AI-анализ выбранного количества screenshots.

Результаты сохраняются локально:

- `qa/reports/latest.json`
- `qa/reports/latest.md`
- `qa/reports/runs/<run>/`

После завершения тестов весь временный слой можно удалить целиком:

```text
qa/
src/components/qa/
изменение src/App.tsx
изменение package.json
изменение .gitignore
изменение CI, если добавлен qa:typecheck
```
