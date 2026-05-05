# CLAUDE.md — Контекст проекта НейроЗачёт

> Этот файл читается Claude Code в начале каждой сессии.
> Обновлён: 2026-05-05 после переноса с Replit на VPS Beget.

---

## Что такое этот проект

**НейроЗачёт** (домен `neurozachet.ru`) — русскоязычный AI-помощник для студентов.

Ключевые функции:
- Решение задач через ансамбль AI-моделей (GPT-4o, Claude Sonnet, DeepSeek-V3, Grok 3, Gemini 2.0 Flash)
- Интерактивные чат-сессии с AI по учебным предметам
- Генерация курсовых/дипломных по разделам
- Антиплагиат и рерайтинг текста (`/uniqueness`)
- Генерация иллюстраций DALL-E 3
- Квизы, конспекты, билеты
- Личный баланс в рублях, пополнение через ЮKassa
- Реферальная система, промокоды, подписка «Месяц безлимит»
- Панель администратора

**Целевая аудитория:** студенты и аспиранты российских вузов.

---

## Контекст переноса

- До 4 мая 2026 проект жил на **Replit** (Replit Deployments)
- 4–5 мая 2026 перенесён на **VPS Beget** (Москва), сервер `neurozachet.ru`
- При переносе выявлены и исправлены 10+ багов (см. `BUGS.md`)
- Часть Replit-специфичного кода (Object Storage, GCS sidecar) пока не заменена

---

## Стек

```
pnpm monorepo (pnpm-workspace.yaml)
TypeScript 5.9
Express 5 ESM               — бэкенд API
React 19 + Vite 7           — фронтенд SPA
Tailwind CSS 4 + shadcn/ui  — UI-компоненты
Supabase PostgreSQL          — основная БД (через REST API и прямой JDBC)
Drizzle ORM                  — fallback если Supabase недоступен
ЮKassa                       — приём платежей
Nodemailer / SMTP            — транзакционная почта
Sentry                       — мониторинг ошибок
KaTeX + remark-math          — рендер математических формул
```

---

## Архитектура монорепо

```
~/projects/nero6/
├── artifacts/
│   ├── api-server/          — Express 5 API (@workspace/api-server)
│   │   ├── src/routes/      — маршруты: auth, tasks, sessions, uniqueness,
│   │   │                      coursework, payments, admin, storage, ...
│   │   ├── src/lib/         — settings.ts (цены), supabase, email, ...
│   │   └── dist/            — скомпилированный ESM (index.mjs)
│   ├── solvehub/            — React-фронтенд (@workspace/solvehub)
│   │   ├── src/pages/       — страницы: tasks/[id], uniqueness, dashboard, ...
│   │   ├── src/lib/         — render-message.tsx (remark-math + rehype-katex)
│   │   └── dist/public/     — статика для nginx
│   └── mockup-sandbox/      — прототипы (не в проде)
├── lib/
│   ├── api-client-react/    — React Query хуки для API (@workspace/api-client-react)
│   └── db/                  — Drizzle схема (@workspace/db)
├── scripts/                 — вспомогательные скрипты
├── ecosystem.config.cjs     — PM2 конфиг
├── .env                     — секреты (см. ниже)
├── PROJECT_OVERVIEW.md      — подробная техдокументация
├── DEPLOY.md                — runbook деплоя
└── BUGS.md                  — известные проблемы
```

---

## Конфигурация и секреты

**Боевой `.env`** находится в: `/home/deploy/projects/nero6/.env`

Секреты хранятся только там, в git не попадают. Имена ключевых переменных:
- `OPENAI_API_KEY`, `OPENAI_BASE_URL` — OpenAI / прокси
- `ANTHROPIC_API_KEY` — Claude
- `DEEPSEEK_API_KEY`, `GROK_API_KEY`, `GEMINI_API_KEY` — другие провайдеры
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- `SUPABASE_DATABASE_URL` — прямой JDBC (сейчас пустой, используется REST)
- `JWT_SECRET` — подпись токенов
- `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` — платежи
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — почта
- `SENTRY_DSN` — мониторинг

---

## Как запускается в проде

**API-сервер** управляется через PM2:
```bash
pm2 start ecosystem.config.cjs    # первый запуск
pm2 restart api-server --update-env  # перезапуск после изменений
pm2 logs api-server --lines 50    # логи
pm2 list                          # статус
```

`ecosystem.config.cjs` запускает `artifacts/api-server/dist/index.mjs` с флагом
`--env-file=/home/deploy/projects/nero6/.env`. API слушает на порту **3001**.

**Фронтенд** — статика в `artifacts/solvehub/dist/public/`, nginx раздаёт её
напрямую и проксирует `/api/*` на `localhost:3001`.

---

## Прокси для Anthropic

Сервер Beget блокирует прямые обращения к `api.anthropic.com`.
Прокси прописан в `/home/deploy/.bashrc`:
```bash
export HTTPS_PROXY=http://...  # значение в .bashrc, не в .env
```

Это влияет на:
- **Claude Code** (сам агент) — работает через прокси автоматически
- **Серверный Anthropic SDK** — переменная `HTTPS_PROXY` должна быть видна
  процессу api-server; PM2 наследует env из shell при старте через `--update-env`

Если Claude-звонки с сервера перестали работать — проверить `echo $HTTPS_PROXY`.

---

## Быстрый старт для новой сессии

1. Прочитать `PROJECT_OVERVIEW.md` — подробная техдокументация
2. Прочитать `BUGS.md` — что сейчас не работает и почему
3. Запустить `pm2 list` — убедиться что api-server online
4. При правках фронта: `pnpm --filter @workspace/solvehub run build`
5. При правках бэка: `pnpm --filter @workspace/api-server run build && pm2 restart api-server`

**Подробный деплой-процесс → `DEPLOY.md`**

---

## Ключевые архитектурные решения (не трогать без понимания)

- **Рендер математики:** `render-message.tsx` использует `remark-math + rehype-katex`.
  `segmentContent()` обрабатывает только `\[...\]`, `\(...\)`, `\begin{...}` —
  инлайн `$...$` и блочный `$$...$$` отданы remark-math.
- **Цены:** все тарифы в `artifacts/api-server/src/lib/settings.ts` (`PRICING_DEFAULTS`).
  Переопределяются через Supabase-таблицу настроек.
- **Auth:** JWT в localStorage, middleware `requireAuth` в каждом защищённом роуте.
  Поле `emailVerified` (camelCase) в API — не `email_verified`.
- **Supabase:** таблицы с префиксом `Neyrozachet_` (с заглавной N).
  Прямой JDBC (`SUPABASE_DATABASE_URL`) пустой — используется только REST API.
- **SPA-роутинг:** защищённые пути перечислены в `PROTECTED_PREFIXES` в `App.tsx`.
  `/tasks/shared/*` — публичный маршрут, должен быть исключён из protected.
