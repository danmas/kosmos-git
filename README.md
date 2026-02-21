# GitLens Dashboard

Git репозиторий мониторинг дашборд на React + Express + simple-git.

## Запуск

**Требования:** Bun (https://bun.sh)

### 1. Установка зависимостей

```bash
bun install
```

### 2. Настройка проектов

Отредактируй `config.json`:

```json
{
  "pollInterval": 60,
  "projects": [
    {
      "id": "p1",
      "name": "my-project",
      "path": "C:/path/to/your/repo"
    }
  ]
}
```

### 3. Gemini API (опционально)

Для AI-генерации commit сообщений создай `.env`:

```
GEMINI_API_KEY=your_api_key_here
```

Получить ключ: https://ai.google.dev

### 4. Запуск

**Терминал 1 — API сервер:**
```bash
bun run server/index.ts
```
→ http://localhost:3006

**Терминал 2 — Frontend:**
```bash
bun run dev
```
→ http://localhost:3007

## Архитектура

```
kosmos-git/
├── App.tsx                     # Главный компонент
├── components/
│   ├── ProjectTab.tsx          # Табы проектов в сайдбаре
│   └── ProjectDetails.tsx      # Основной вид с файлами
├── services/
│   ├── apiService.ts           # API клиент (fetch)
│   ├── geminiService.ts        # Gemini AI интеграция
│   └── mockData.ts             # Демо данные
├── server/
│   ├── index.ts                # Express сервер (порт 3006)
│   ├── routes/projects.ts      # API роуты
│   └── services/gitService.ts  # simple-git обёртка
├── config.json                 # Конфигурация проектов
└── types.ts                    # TypeScript типы
```

## API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/projects` | Список проектов |
| GET | `/api/projects/:id/status` | Статус репозитория |
| POST | `/api/projects/:id/stage` | Stage файлов |
| POST | `/api/projects/:id/unstage` | Unstage файлов |
| POST | `/api/projects/:id/commit` | Создать коммит |
| POST | `/api/projects/:id/checkout` | Переключить ветку |
| POST | `/api/projects/:id/create-branch` | Создать ветку |
| POST | `/api/projects/config` | Сохранить конфиг |

## Функции

- 📊 Мониторинг Git репозиториев
- 🔄 Просмотр staged/unstaged изменений
- 📝 Stage/unstage файлов
- 💬 Коммиты с сообщениями
- 🤖 AI-генерация commit сообщений (Gemini)
- 🌿 Переключение веток
- ➕ Создание веток
- 📂 Несколько репозиториев одновременно
