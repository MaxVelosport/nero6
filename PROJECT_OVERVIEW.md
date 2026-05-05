# PROJECT OVERVIEW — НейроЗачёт (SolveHub)

> Технический отчёт для передачи контекста другому разработчику/ИИ-ассистенту.  
> Сформирован: 2026-05-03. Статус: проект клонирован с Replit, `pnpm install` ещё не запускался.

---

## 1. ОБЗОР ПРОЕКТА

### Бизнес-функция

**НейроЗачёт** — русскоязычная AI-платформа для помощи студентам и аспирантам в решении учебных задач.

Ключевые возможности:
- Решение задач через ансамбль AI-моделей (GPT-4o, Claude Sonnet, DeepSeek-V3, Grok 3, Gemini 2.0 Flash)
- Интерактивные чат-сессии с AI по предметам
- Генерация курсовых/дипломных работ по разделам
- Антиплагиат и рерайтинг текста
- Генерация иллюстраций (DALL-E 3)
- Генерация тестов/квизов
- Генерация конспектов
- Личный баланс пользователя (рублёвый), пополнение через ЮKassa
- Реферальная система, промокоды, подписка «Месяц безлимит»
- Статистика и дашборд для пользователя
- Панель администратора

**Целевая аудитория**: студенты и аспиранты российских вузов.

### Стек одной строкой

```
pnpm monorepo · TypeScript 5.9 · Express 5 ESM (бэкенд) · React 19 + Vite 7 + Tailwind CSS 4 + shadcn/ui (фронтенд) · Supabase PostgreSQL + Drizzle ORM (fallback) · ЮKassa · Nodemailer/SMTP · Sentry
```

### Размер кода

| Метрика | Значение |
|---|---|
| Файлов `.ts` / `.tsx` | 274 (112 ts + 160 tsx + 2 mjs) |
| Строк кода (суммарно) | ~49 700 |
| JSON-файлов | 21 |
| Основные языки | TypeScript, TSX |

---

## 2. АРХИТЕКТУРА

### Структура монорепо (pnpm workspaces)

```
nero6/                              ← корень монорепо
├── pnpm-workspace.yaml             ← конфигурация воркспейсов + catalog зависимостей
├── package.json                    ← скрипты root: build, typecheck
├── tsconfig.base.json              ← базовый TS-конфиг для всех пакетов
│
├── artifacts/
│   ├── api-server/                 ← [BACKEND] Express 5 API-сервер
│   │   ├── src/
│   │   │   ├── index.ts            ← точка входа (PORT, init, start)
│   │   │   ├── app.ts              ← Express app, Sentry, CORS, middleware
│   │   │   ├── routes/             ← все API-роуты (19 файлов)
│   │   │   ├── middlewares/        ← rateLimit.ts
│   │   │   └── lib/               ← утилиты: ai, auth, billing, config, email...
│   │   ├── build.mjs               ← esbuild конфигурация
│   │   └── dist/                  ← (генерируется) dist/index.mjs
│   │
│   ├── solvehub/                   ← [FRONTEND] React SPA
│   │   ├── src/
│   │   │   ├── App.tsx             ← точка входа (роутинг, QueryClient)
│   │   │   ├── pages/             ← 28 страниц
│   │   │   ├── components/        ← ui/, layout/, общие компоненты
│   │   │   ├── hooks/             ← useTokenRefresh, useUpdateBalance...
│   │   │   └── lib/               ← pdf-export, pptx-export, render-message...
│   │   ├── vite.config.ts
│   │   └── dist/public/           ← (генерируется) статика для nginx
│   │
│   └── mockup-sandbox/            ← изолированная песочница (не используется в проде)
│
├── lib/
│   ├── api-spec/                  ← OpenAPI YAML спека (orval.config.ts для кодогенерации)
│   ├── api-zod/                   ← [ГЕНЕРИРОВАННЫЙ] Zod-схемы из OpenAPI
│   ├── api-client-react/          ← [ГЕНЕРИРОВАННЫЙ] React Query хуки + customFetch
│   └── db/                        ← Drizzle ORM схема + pg Pool (Postgres fallback)
│
└── scripts/
    ├── check-env.mjs              ← проверка переменных окружения при старте
    └── backup-supabase.sh         ← резервное копирование
```

### Связи между воркспейсами

```
api-server
  └─ импортирует @workspace/api-zod   (Zod-схемы для валидации входящих запросов)
  └─ импортирует @workspace/db        (Drizzle + pg pool, fallback к Supabase)

solvehub
  └─ импортирует @workspace/api-client-react  (React Query хуки + customFetch)

api-client-react
  └─ зависит от @workspace/api-spec   (OpenAPI → Orval → генерация кода)

api-zod
  └─ зависит от @workspace/api-spec
```

### Точки входа

| Воркспейс | Точка входа | Артефакт после сборки |
|---|---|---|
| api-server | `src/index.ts` | `dist/index.mjs` |
| solvehub | `src/App.tsx` (через Vite) | `dist/public/index.html` + assets |

### Как фронтенд общается с бэкендом

**В production**: нет прокси в vite.config. Фронтенд обращается к относительным URL `/api/...` — nginx должен проксировать `/api/` на порт бэкенда.

**В dev на Replit**: аналогично, но через Replit-роутинг.

**Авторизация**: Bearer-токен хранится в `localStorage` под ключом `authToken`. Каждый запрос через `customFetch` (lib/api-client-react) автоматически добавляет заголовок `Authorization: Bearer <token>`.

**Кодогенерация**: хуки в `lib/api-client-react/src/generated/api.ts` генерируются Orval из OpenAPI-спеки. Они используют TanStack Query v5.

**Sliding session**: хук `useTokenRefresh` (`hooks/useTokenRefresh.ts`) вызывает `POST /api/auth/refresh` для продления сессии. При 401 диспатчится `CustomEvent('auth:expired')` → `SessionExpiredModal`.

---

## 3. БЭКЕНД (artifacts/api-server)

### Общая информация

| Параметр | Значение |
|---|---|
| Фреймворк | Express 5 |
| Модульная система | ESM (`"type": "module"`) |
| Язык | TypeScript 5.9 |
| Рантайм | Node.js (рекомендован v24, работает на v20+) |
| Порт | Из переменной `PORT` (обязательна, нет default) |
| Logging | pino + pino-http (JSON логи) |

### Запуск и сборка

```bash
# Сборка (esbuild → dist/index.mjs)
pnpm run build

# Запуск собранного
PORT=3000 pnpm run start
# Внутри: node --enable-source-maps ./dist/index.mjs
```

### API-роуты (все под `/api/`)

| Путь | Метод(ы) | Описание | Auth |
|---|---|---|---|
| `/healthz` | GET | Простая проверка живости | нет |
| `/healthz/full` | GET | Проверка с пингом БД | нет |
| `/auth/register` | POST | Регистрация (лимит 3/час с IP) | нет |
| `/auth/login` | POST | Вход (брутфорс: 8/15 мин) | нет |
| `/auth/logout` | POST | Отзыв токена | да |
| `/auth/me` | GET | Текущий пользователь | да |
| `/auth/forgot-password` | POST | Отправка письма сброса пароля | нет |
| `/auth/reset-password` | POST | Применение нового пароля | нет |
| `/auth/verify-email` | POST | Подтверждение email | нет |
| `/auth/resend-verification` | POST | Повторная отправка подтверждения | да |
| `/auth/refresh` | POST | Продление токена (sliding session) | да |
| `/users/profile` | GET/PATCH | Профиль пользователя | да |
| `/users/balance` | GET | Баланс | да |
| `/users/charge` | POST | Ручное списание (тест) | да |
| `/tasks` | GET/POST | Список задач / создание | да |
| `/tasks/estimate` | GET/POST | Оценка стоимости задачи | да/нет |
| `/tasks/:id` | GET | Получить задачу | да |
| `/tasks/:id/revision` | POST | Пересчитать решение | да |
| `/tasks/generate-image` | POST | Генерация иллюстрации DALL-E 3 | да |
| `/tasks/verify-image` | POST | Vision-проверка изображения | да |
| `/tasks/summary` | POST | Краткое резюме задачи | да |
| `/tasks/shared/:id` | GET | Публичный просмотр задачи | нет |
| `/tasks/:id/check-originality` | POST | Проверка на уникальность | да |
| `/sessions` | GET/POST | Чат-сессии | да |
| `/sessions/packages` | GET | Пакеты сессий | нет |
| `/sessions/models` | GET | Список AI-моделей | нет |
| `/sessions/:id` | GET/PATCH | Сессия по ID | да |
| `/sessions/:id/messages` | POST | Отправить сообщение в сессию | да |
| `/pricing/plans` | GET | Тарифные планы | нет |
| `/stats/dashboard` | GET | Дашборд статистики | да |
| `/stats/timeline` | GET | График активности | да |
| `/stats/subjects` | GET | Разбивка по предметам | да |
| `/admin/stats` | GET | Общая статистика (админ) | да+admin |
| `/admin/users` | GET | Список пользователей | да+admin |
| `/admin/users/:id/topup` | POST | Пополнение баланса | да+admin |
| `/admin/users/:id/toggle-admin` | POST | Изменение роли | да+admin |
| `/admin/users/:id/adjust` | POST | Корректировка баланса | да+admin |
| `/admin/promo` | GET/POST | Управление промокодами | да+admin |
| `/admin/transactions` | GET | Все транзакции | да+admin |
| `/admin/ai-stats` | GET | Статистика использования AI | да+admin |
| `/referral` | GET | Реферальная информация | да |
| `/promo/redeem` | POST | Активировать промокод | да |
| `/public/settings` | GET | Публичные настройки сайта | нет |
| `/tickets` | POST | Создать тикет (задание-файл) | да |
| `/tickets/modes` | GET | Режимы тикетов | нет |
| `/tickets/estimate` | POST | Оценка стоимости тикета | да |
| `/summaries/generate` | POST | Сгенерировать конспект | да |
| `/summaries/modes` | GET | Режимы конспектов | нет |
| `/coursework/generate-plan` | POST | Сгенерировать план курсовой | да |
| `/coursework/price-preview` | POST | Предварительная цена | да |
| `/coursework/generate-chapter` | POST | Написать раздел курсовой | да |
| `/coursework/revise-chapter` | POST | Улучшить раздел | да |
| `/illustrations/analyze` | POST | Анализ изображения | да |
| `/illustrations/generate` | POST | Генерация иллюстрации | да |
| `/payments/packages` | GET | Пакеты пополнения | нет |
| `/payments/create` | POST | Создать платёж ЮKassa | да |
| `/payments/webhook` | POST | Webhook от ЮKassa | нет |
| `/payments/status/:id` | GET | Статус платежа | да |
| `/uniqueness/pricing` | GET | Цены антиплагиата | нет |
| `/uniqueness/extract` | POST | Извлечь текст | да |
| `/uniqueness/check` | POST | Проверить уникальность | да |
| `/uniqueness/rewrite` | POST | Рерайт текста | да |
| `/support/chat` | POST | Чат с поддержкой | нет |
| `/refund-requests` | POST | Запрос на возврат | нет |
| `/quiz/tiers` | GET | Уровни квиза | нет |
| `/quiz/generate` | POST | Сгенерировать квиз | да |
| `/storage/uploads/request-url` | POST | Signed URL для загрузки (Replit GCS) | нет |
| `/storage/public-objects/*` | GET | Раздача публичных файлов (Replit GCS) | нет |
| `/storage/objects/*` | GET | Раздача приватных файлов (Replit GCS) | нет |

### Middleware (порядок в app.ts)

1. **Sentry** — инициализируется первым, до всего (httpIntegration, expressIntegration)
2. **trust proxy = 1** — одиночный хоп прокси (для корректного IP в rate-limit и ЮKassa webhook)
3. **pino-http** — структурированное логирование каждого запроса
4. **CORS** — `app.use(cors())` без параметров → все origins разрешены ⚠️
5. **express.json** — лимит 70MB (для base64-изображений)
6. **express.urlencoded** — лимит 70MB
7. **Rate limiters** (routes/index.ts):
   - `authLimiter`: 30 req / 5 мин на IP (auth endpoints)
   - `aiNormalLimiter`: 60 req / мин на пользователя (sessions, support)
   - `aiHeavyLimiter`: 20 req / мин на пользователя (tasks, tickets, summaries, coursework, illustrations, uniqueness, quiz)
8. **requireAuth** — middleware для защищённых роутов: извлекает Bearer-токен, ищет в `Neyrozachet_tokens`, прикрепляет `req.user`
9. **Sentry expressErrorHandler** — в конце
10. **Глобальный error handler** — 500 JSON

### Авторизация

Кастомная, **не JWT**. Токен — случайная строка, хранится в `Neyrozachet_tokens` как SHA-256 хэш. Срок жизни — 1 год. `requireAuth` читает таблицу и прикрепляет к запросу объект пользователя.

### AI-роутер (lib/ai.ts)

Поддерживает 5 провайдеров. Логика:
- **Ensemble mode** для задач: несколько моделей параллельно (`Promise.allSettled`), синтез через GPT-4o/Claude/Gemini
- **Fast mode**: DeepSeek-V3 + GPT-4o-mini
- **Standard mode**: DeepSeek-V3 + GPT-4o + Claude Sonnet → синтез Gemini
- **Premium mode**: DeepSeek-R1 + GPT-4o + Gemini 2.5 Pro → синтез Claude Sonnet
- **Super Premium**: то же → синтез Claude Opus
- **Fallback цепочки**: каждый провайдер при ошибке откатывается к Gemini via OpenRouter
- **Vision**: изображения поддерживают OpenAI (gpt-4o) и Claude; DeepSeek не поддерживает

### Биллинг (lib/billing.ts)

Атомарная тарификация через `chargeAtomic()`:
- Supabase-ветка: CAS-loop (SELECT balance → UPDATE WHERE balance=current → retry до 5)
- Drizzle-ветка: conditional UPDATE с `WHERE balance >= cost`
- Учитывает подписку `subscription_until` (если активна — cost = 0)
- `refund()` — тоже атомарный CAS-loop

### Интеграции с внешними сервисами

| Сервис | Файл | Как подключается |
|---|---|---|
| Supabase | `lib/supabase.ts` | `@supabase/supabase-js`, service_role ключ, ленивая инициализация с retry |
| Drizzle + PostgreSQL | `lib/db` workspace | `drizzle-orm/node-postgres` + `pg.Pool`, SUPABASE_DATABASE_URL |
| OpenAI | `lib/ai.ts` | `openai` SDK, OPENAI_API_KEY |
| Anthropic | `lib/ai.ts` | `@anthropic-ai/sdk`, ANTHROPIC_API_KEY |
| DeepSeek | `lib/ai.ts` | OpenAI SDK с baseURL `api.deepseek.com` |
| xAI (Grok) | `lib/ai.ts` | OpenAI SDK с baseURL `api.x.ai/v1` |
| OpenRouter | `lib/ai.ts` | OpenAI SDK с baseURL `openrouter.ai/api/v1` |
| ЮKassa | `lib/yookassa.ts` | Нативный `fetch`, Basic Auth (shopId:secretKey) |
| Email | `lib/email.ts` | `nodemailer` → smtp.beget.com (465), двойной транспорт info/support |
| Sentry | `lib/errorMonitor.ts` | `@sentry/node`, инициализируется в app.ts ДО express |
| Google Cloud Storage | `lib/objectStorage.ts` | `@google-cloud/storage` + Replit sidecar на `127.0.0.1:1106` ⚠️ **Replit-only** |

### Build pipeline (esbuild)

`build.mjs` запускает esbuild:
- Вход: `src/index.ts`
- Выход: `dist/index.mjs` (ESM, bundled)
- Source maps: linked (`*.mjs.map`)
- Externals: ~60 пакетов (нативные модули, cloud SDKs, ORM-ы — не используются, но перечислены превентивно)
- Banner: полифил `require`, `__filename`, `__dirname` для CJS-пакетов в ESM-бандле
- Плагин: `esbuild-plugin-pino` (корректная бандлизация pino с worker threads)

---

## 4. ФРОНТЕНД (artifacts/solvehub)

### Фреймворк и роутинг

- **Vite 7** (сборщик) + **React 19**
- **Роутинг**: Wouter v3 (не React Router)
- Роутер с базовым путём из `import.meta.env.BASE_URL`
- Защищённые пути: `/dashboard`, `/tasks`, `/profile`, `/sessions`, `/coursework`, `/tickets`, `/learn/summary`, `/subscriptions`, `/admin`, `/illustrations`, `/uniqueness`, `/statistics`, `/quiz`

### State Management

| Инструмент | Назначение |
|---|---|
| **TanStack Query v5** | Серверное состояние: все API-запросы через сгенерированные хуки |
| **React Context** | ThemeProvider (тёмная/светлая тема) |
| **localStorage** | `authToken` (Bearer токен) |
| Нет Zustand/Redux | Состояние локальное или через React Query |

### Страницы (pages/)

| Страница | Путь | Доступ |
|---|---|---|
| Landing | `/` | публичный |
| Login | `/login` | публичный |
| Register | `/register` | публичный |
| ForgotPassword | `/forgot-password` | публичный |
| ResetPassword | `/reset-password` | публичный |
| VerifyEmail | `/verify-email` | публичный |
| Hints | `/hints` | публичный |
| SharedTask | `/tasks/shared/:id` | публичный |
| Legal | `/terms`, `/offer`, `/oferta`, `/privacy`, `/refund`, `/cookies`, `/ai-disclaimer` | публичный |
| RefundRequest | `/refund-request` | публичный |
| **Dashboard** | `/dashboard` | авторизован |
| **Tasks** | `/tasks`, `/tasks/new`, `/tasks/:id` | авторизован |
| **Sessions** | `/sessions`, `/sessions/new`, `/sessions/:id` | авторизован |
| **Coursework** | `/coursework/new` | авторизован |
| **Tickets** | `/tickets/new` | авторизован |
| **Summary** | `/learn/summary` | авторизован |
| **Profile** | `/profile` | авторизован |
| **Subscriptions** | `/subscriptions` | авторизован |
| **Illustrations** | `/illustrations` | авторизован |
| **Uniqueness** | `/uniqueness` | авторизован |
| **Statistics** | `/statistics` | авторизован |
| **Quiz** | `/quiz` | авторизован |
| **Admin** | `/admin` | авторизован + admin |
| NotFound | `*` | — |

### Компоненты

```
components/
├── ui/              ← shadcn/ui компоненты (40+ штук: button, dialog, table, chart...)
├── layout/
│   ├── DashboardLayout.tsx    ← основной layout с сайдбаром
│   ├── MobileBottomNav.tsx    ← навигация для мобильных
│   ├── PublicLayout.tsx       ← layout для публичных страниц
│   └── PublicNavbar.tsx
├── session-expired-modal.tsx  ← модалка при истечении сессии
├── onboarding-modal.tsx       ← онбординг новых пользователей
├── SupportChat.tsx            ← виджет чата с поддержкой
├── error-boundary.tsx
└── zero-balance-hint.tsx
```

### Стилизация

- **Tailwind CSS v4** (через плагин `@tailwindcss/vite`)
- **shadcn/ui** компоненты (Radix UI primitives)
- **framer-motion** для анимаций
- **next-themes** для тёмной темы
- **Markdown**: react-markdown + remark-gfm + remark-math + rehype-katex + rehype-highlight
- **LaTeX**: react-katex + katex
- **Диаграммы**: mermaid (рендеринг в чате)
- **Кастомные `chart` блоки** в markdown → Recharts

### Build pipeline (Vite)

```bash
PORT=3000 pnpm run build
# → vite build → dist/public/index.html + dist/public/assets/
```

Требования:
- `PORT` обязателен при `vite dev` (не нужен при `build`)
- `BASE_PATH` — опциональный базовый путь (default `/`)
- Alias `@` → `src/`, `@assets` → `../../attached_assets/`
- Дедупликация react/react-dom

### Dev-режим

```bash
PORT=5173 pnpm run dev   # vite --host 0.0.0.0
```

Нет встроенного proxy в vite.config — в dev нужен nginx или единый PORT для бэка+фронта (не используется такой подход). В Replit использовался один порт, и nginx/роутинг Replit разруливал `/api/`.

---

## 5. БАЗА ДАННЫХ

### Провайдер: Supabase (PostgreSQL)

Все таблицы с префиксом `Neyrozachet_`.

| Таблица | Назначение |
|---|---|
| `Neyrozachet_users` | Пользователи: email, password_hash, balance, education_level, subscription_until, referral_code |
| `Neyrozachet_tokens` | Токены аутентификации (SHA-256 хэш, expires_at, user_id) |
| `Neyrozachet_tasks` | Учебные задачи: title, subject, task_type, solving_mode, status, result, costs |
| `Neyrozachet_transactions` | Финансовые транзакции: topup, debit, refund, external_payment_id (идемпотентность ЮKassa) |
| `Neyrozachet_sessions` | Чат-сессии: model_id, questions_used/total, package_type, expires_at, context |
| `Neyrozachet_messages` | Сообщения сессий: role, content, attachment_data/type/name, processing_time_ms |
| `Neyrozachet_referrals` | Реферальные связи referrer_id → referred_id, reward_given |
| `Neyrozachet_promo_codes` | Промокоды: code, amount, max_uses, uses_count, expires_at |
| `Neyrozachet_promo_redemptions` | Факты применения промокодов (UNIQUE user_id+promo_id) |
| `Neyrozachet_settings` | Настройки сайта (key TEXT PK, value JSONB) |

### ORM / доступ

Двойная стратегия — **Supabase-first, Drizzle-fallback**:

1. **Supabase JS SDK** (`@supabase/supabase-js`) — основной путь. Подключается service_role ключом (обходит RLS). Функции `getSupabaseAdmin()` возвращают клиент или null.
2. **Drizzle ORM + pg.Pool** (`@workspace/db`) — fallback, используется когда Supabase недоступен. Нужен `SUPABASE_DATABASE_URL` или `DATABASE_URL`.

Практически везде в коде: `if (sb) { /* supabase путь */ } else { /* drizzle/pool путь */ }`.

### Миграции

Место: `artifacts/api-server/src/lib/migrate.ts`

**Логика** (`runMigrations()`):
- Если Supabase доступен: проверяет наличие колонок через `select`, логирует нужные ALTER TABLE SQL в консоль — **не выполняет автоматически!** Требует ручного запуска в Supabase SQL Editor.
- Если Supabase недоступен: выполняет 9 `CREATE TABLE IF NOT EXISTS` через pg.Pool.

Дополнительные миграции (column checks) — `SUPABASE_COLUMN_CHECKS`:
- `email_verification_token`, `email_verification_expires_at` в users
- `external_payment_id` + SQL-функция `credit_yookassa_payment()` в transactions
- Таблица `Neyrozachet_settings`
- `subscription_until` в users

### RLS (Row Level Security)

В коде **нет RLS-политик**. Весь доступ осуществляется через `service_role` ключ, который обходит RLS. Supabase RLS фактически не настроен/не используется.

---

## 6. ENV-ПЕРЕМЕННЫЕ

### Переменные бэкенда (process.env)

| Переменная | Критичность | Файл | Назначение |
|---|---|---|---|
| `PORT` | 🔴 обязательна | `index.ts:20` | Порт для Express |
| `SUPABASE_URL` | 🔴 критична | `supabase.ts:40` | URL Supabase проекта |
| `SUPABASE_SERVICE_KEY` | 🔴 критична | `supabase.ts:46` | service_role ключ |
| `SUPABASE_ANON_KEY` | 🔴 критична | `supabase.ts:47` | anon ключ (fallback) |
| `SUPABASE_SERVICE_ROLE_KEY` | 🟡 alias | `supabase.ts:46` | Синоним SUPABASE_SERVICE_KEY |
| `SUPABASE_DATABASE_URL` | 🟡 optional | `db/src/index.ts:8` | Прямое подключение к Postgres (Drizzle) |
| `DATABASE_URL` | 🟡 optional | `db/src/index.ts:14` | Альтернативный Postgres URL |
| `OPENAI_API_KEY` | 🔴 критична | `ai.ts:5` | GPT-4o, DALL-E, vision |
| `OPENAI_BASE_URL` | 🟡 optional | `tasks.ts:687` | Переопределение base URL OpenAI |
| `ANTHROPIC_API_KEY` | 🔴 критична | `ai.ts:11` | Claude Sonnet/Opus |
| `DEEPSEEK_API_KEY` | 🔴 критична | `ai.ts:16` | DeepSeek-V3, DeepSeek-R1 |
| `OPENROUTER_API_KEY` | 🔴 критична | `ai.ts:22` | Gemini, Grok via OpenRouter |
| `XAI_API_KEY` | 🔴 критична | `ai.ts:29` | Grok 3 напрямую |
| `YOOKASSA_SHOP_ID` | 🔴 критична | `yookassa.ts:10` | ID магазина ЮKassa |
| `YOOKASSA_SECRET_KEY` | 🔴 критична | `yookassa.ts:11` | Secret-ключ ЮKassa |
| `APP_URL` | 🟡 optional | `config.ts:2` | Публичный URL (авто: REPLIT_DOMAINS → default) |
| `APP_NAME` | 🟡 optional | `config.ts:17` | Название в email (default: НейроЗачёт) |
| `SUPPORT_EMAIL` | 🟡 optional | `config.ts:18` | Email поддержки |
| `EMAIL_FROM` | 🟡 optional | `config.ts:19` | Адрес отправителя |
| `SMTP_HOST` | 🟡 optional | `config.ts:21` | SMTP хост (default: smtp.beget.com) |
| `SMTP_PORT` | 🟡 optional | `config.ts:22` | SMTP порт (default: 465) |
| `SMTP_INFO_USER` | 🟡 optional | `config.ts:24` | Логин инфо-ящика (default: info@neurozachet.ru) |
| `SMTP_INFO_PASS` | 🟠 semi-critical | `config.ts:25` | Пароль инфо-ящика (без него email = no-op) |
| `SMTP_SUPPORT_USER` | 🟡 optional | `config.ts:27` | Логин ящика поддержки |
| `SMTP_SUPPORT_PASS` | 🟠 semi-critical | `config.ts:28` | Пароль ящика поддержки |
| `SENTRY_DSN` | 🟡 optional | `app.ts:4` | Sentry DSN backend |
| `ADMIN_ERROR_EMAIL` | 🟡 optional | `errorMonitor.ts:3` | Email для error-алертов |
| `LOG_LEVEL` | 🟡 optional | `logger.ts:6` | Уровень логов pino (default: info) |
| `NODE_ENV` | 🟡 optional | `app.ts:8` | production/development |
| `FRONTEND_URL` | 🟡 optional | `payments.ts:14` | URL фронта для редиректа ЮKassa |
| `CHECK_YOOKASSA_IP` | 🟡 optional | `payments.ts:221` | Принудительная проверка IP ЮKassa в dev |
| `PRIVATE_OBJECT_DIR` | ⚫ Replit-only | `objectStorage.ts:63` | Путь в Replit GCS bucket |
| `PUBLIC_OBJECT_SEARCH_PATHS` | ⚫ Replit-only | `objectStorage.ts:44` | Пути поиска в Replit GCS |
| `REPLIT_DOMAINS` | ⚫ Replit-only | `config.ts:4` | Авто-определение APP_URL |
| `REPL_SLUG` | ⚫ Replit-only | `config.ts:8` | Авто-определение APP_URL (старый формат) |
| `REPL_OWNER` | ⚫ Replit-only | `config.ts:9` | Авто-определение APP_URL (старый формат) |
| `REPLIT_DEV_DOMAIN` | ⚫ Replit-only | `payments.ts:16` | URL для редиректа ЮKassa в dev |

### Переменные фронтенда (import.meta.env)

| Переменная | Критичность | Назначение |
|---|---|---|
| `VITE_SENTRY_DSN` | 🟡 optional | Sentry DSN фронтенда |
| `BASE_URL` | встроенный Vite | Базовый путь (из vite.config `base`) |
| `MODE` | встроенный Vite | production/development |

### Состояние .env на сервере (текущее)

| Статус | Переменная | Проблема |
|---|---|---|
| ⚠️ БАГ | `SUPABASE_URL` | Trailing dot: `https://superbase.aiinvestor360.ru.` — нужно убрать точку |
| ⚠️ БАГ | `ANTHROPIC_API_KEY` | Значение `sk-or-v1-...` — это OpenRouter ключ, не Anthropic! |
| ❌ Отсутствует | `PORT` | Не задан (обязателен для запуска) |
| ❌ Отсутствует | `APP_URL` | Ссылки в email будут неправильными |
| ❌ Отсутствует | `SENTRY_DSN` | Нет мониторинга бэкенда |
| ⚪ Пустой | `SUPABASE_DATABASE_URL` | OK — Drizzle fallback не нужен если Supabase работает |
| ⚪ Пустой | `VITE_SENTRY_DSN` | OK — Sentry фронтенда отключён |

### Актуальность .env.example

`.env.example` **неполный** — отсутствуют:
- `PORT` (обязательна!)
- `XAI_API_KEY`
- `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY`
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_INFO_USER` / `SMTP_SUPPORT_USER`
- `SENTRY_DSN` / `VITE_SENTRY_DSN`
- `NODE_ENV`
- `SUPABASE_DATABASE_URL`

---

## 7. КОМАНДЫ

### Все скрипты

| Воркспейс | Команда | Описание |
|---|---|---|
| root | `pnpm run build` | typecheck + рекурсивная сборка всех воркспейсов |
| root | `pnpm run typecheck` | typecheck libs + artifacts + scripts |
| root | `pnpm run typecheck:libs` | `tsc --build` для lib-пакетов |
| api-server | `pnpm run build` | esbuild → `dist/index.mjs` |
| api-server | `pnpm run start` | `node --enable-source-maps ./dist/index.mjs` |
| api-server | `pnpm run dev` | build + start в development mode |
| api-server | `pnpm run typecheck` | tsc без emit |
| solvehub | `pnpm run build` | `vite build` → `dist/public/` |
| solvehub | `pnpm run dev` | `vite --host 0.0.0.0` (нужен PORT в env) |
| solvehub | `pnpm run serve` | `vite preview` (превью сборки) |
| solvehub | `pnpm run typecheck` | tsc без emit |
| scripts | `pnpm run hello` | tsx ./src/hello.ts |

### Порядок production-сборки от чистого репо

```bash
# 0. Предварительно (если не установлено)
npm install -g pnpm
# Рекомендуется Node.js v24 (сейчас на сервере v20)

# 1. Перейти в корень проекта
cd /home/deploy/projects/nero6

# 2. Исправить .env (ПЕРЕД установкой)
#    - Убрать точку в конце SUPABASE_URL
#    - Исправить ANTHROPIC_API_KEY на настоящий ключ Anthropic (sk-ant-...)
#    - Добавить PORT=3001 (или другой порт для api-server)
#    - Добавить APP_URL=https://yourdomain.ru

# 3. Установить зависимости
pnpm install

# 4. Собрать всё (typecheck + все воркспейсы)
pnpm run build
# Если build падает из-за Replit-плагина:
# → Сначала исправить vite.config.ts (см. секцию 9)
# Затем повторить pnpm run build

# 5. Запустить бэкенд через PM2
PORT=3001 pm2 start artifacts/api-server/dist/index.mjs \
  --name api-server \
  --interpreter node \
  -- --enable-source-maps

# 6. Настроить nginx для раздачи фронтенда
#    (dist/public/ → статика, /api/ → proxy к localhost:3001)
```

---

## 8. ЗАВИСИМОСТИ

### Replit-специфичные пакеты

| Пакет | Где | Проблема для production |
|---|---|---|
| `@replit/vite-plugin-runtime-error-modal` | `solvehub/vite.config.ts` — всегда импортируется | **Сломает `vite build`** — нужно удалить или обернуть условием |
| `@replit/vite-plugin-cartographer` | `solvehub/vite.config.ts` — только если `REPL_ID` задан | Безопасно — не загружается вне Replit |
| `@replit/vite-plugin-dev-banner` | `solvehub/vite.config.ts` — только если `REPL_ID` задан | Безопасно |
| `@google-cloud/storage` | `api-server/lib/objectStorage.ts` | Использует Replit sidecar `127.0.0.1:1106` — не работает вне Replit |
| `google-auth-library` | api-server deps | Зависимость GCS |

### Нативные модули (требующие компиляции)

По содержимому `build.mjs` externals и фактическим зависимостям:

| Модуль | Используется? | Примечание |
|---|---|---|
| `pdf-parse` | ✅ | Реально используется в `file-extract.ts` |
| `nodemailer` | ✅ | Реально используется в `email.ts` |
| `@swc/core` | нет в зависимостях | В `onlyBuiltDependencies` (pnpm) |
| `esbuild` | ✅ dev | Нужна компиляция native binaries |
| `bcrypt`, `argon2` | ❌ | Не используются (есть в externals как защита) |
| `sharp`, `canvas` | ❌ | Не используются |
| `better-sqlite3` | ❌ | Не используется |

**Вывод**: нативных модулей в runtime нет. `esbuild` нужен только при сборке.

### Примечательные зависимости

- `xlsx` v0.18.5 — старая версия с известными CVE (используется для парсинга Excel-файлов в задачах)
- `mammoth` — парсинг DOCX
- `pdf-parse` — парсинг PDF
- `pptxgenjs` — генерация PPTX для экспорта презентаций
- `html2pdf.js` — экспорт в PDF на фронтенде
- `docx` — генерация DOCX на фронтенде
- `mermaid` — рендеринг диаграмм в чате

---

## 9. ИЗВЕСТНЫЕ ПРОБЛЕМЫ И ПОДВОДНЫЕ КАМНИ

### Критично: нужно исправить до сборки

#### 1. `@replit/vite-plugin-runtime-error-modal` в vite.config.ts

**Файл**: `artifacts/solvehub/vite.config.ts:4`

```ts
// Текущий код (СЛОМАЕТ vite build):
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
// ...
plugins: [
  react(),
  tailwindcss(),
  runtimeErrorOverlay(),  // ← всегда подключён
  ...
```

**Исправление**: удалить импорт и вызов, или обернуть условием:
```ts
// Вариант 1: просто удалить (рекомендуется для production)
// Вариант 2: условный импорт
...(process.env.REPL_ID ? [runtimeErrorOverlay()] : []),
```

#### 2. Google Cloud Storage — Replit sidecar

**Файл**: `artifacts/api-server/src/lib/objectStorage.ts:12`

```ts
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";  // Replit-only!
```

Весь `ObjectStorageService` (загрузка/раздача файлов, хранение DALL-E изображений) не будет работать вне Replit. Маршруты `/storage/*` вернут ошибки.

**Решение**: либо заменить на S3/другое хранилище, либо временно отключить `/storage/` роуты.

#### 3. Trailing dot в SUPABASE_URL

**Файл**: `.env:1`
```
SUPABASE_URL=https://superbase.aiinvestor360.ru.   ← точка в конце!
```
Это вызовет ошибку подключения. Убрать точку.

#### 4. Неверный ANTHROPIC_API_KEY

**Файл**: `.env:8`
```
ANTHROPIC_API_KEY=sk-or-v1-...  ← это OpenRouter ключ!
```
Claude Sonnet/Opus не будут работать. Нужен ключ `sk-ant-...` от console.anthropic.com.

#### 5. PORT не задан в .env

API-сервер и Vite dev упадут при старте без `PORT`.

#### 6. APP_URL не задан

Email-ссылки (сброс пароля, подтверждение email) будут использовать fallback `https://neurozachet.ru` вместо реального домена.

#### 7. CORS без ограничений

**Файл**: `artifacts/api-server/src/app.ts:48`
```ts
app.use(cors());  // все origins разрешены!
```
В production рекомендуется указать конкретный origin: `cors({ origin: process.env.APP_URL })`.

### Архитектурные особенности

- **Двойной путь к БД повсюду** — почти каждая функция содержит `if (sb) { supabase } else { drizzle }`. Это увеличивает объём кода в ~2 раза.
- **Авторизация не JWT** — кастомные токены в БД. Нет stateless-выхода; все токены нужно удалять из таблицы явно.
- **pino logger в ESM** — требует специального esbuild-plugin-pino; без него worker-потоки pino не работают в бандле.
- **Ансамблевый AI** — задачи в стандартном режиме делают 3 параллельных AI-вызова. Это дорого и медленно (~15-30 сек). Ожидаемое поведение.
- **Нет TODO/FIXME** — кодобаза чистая в этом плане.
- **PORT обязателен** для обоих процессов (бэк И vite dev). Бэк и фронт в проде слушают разные порты.
- **Фронт не имеет прокси в vite.config** — в production nginx должен проксировать `/api/*` на бэкенд.

---

## 10. РЕКОМЕНДАЦИИ ПО PRODUCTION DEPLOY

### Архитектура процессов

```
nginx (443/80)
  ├── /         → static: artifacts/solvehub/dist/public/
  └── /api/     → proxy: localhost:3001 (api-server)

PM2:
  └── api-server  (node --enable-source-maps dist/index.mjs, PORT=3001)
```

Фронтенд — **статика через nginx**, не отдельный процесс. После `vite build` файлы лежат в `artifacts/solvehub/dist/public/`.

### Рекомендуемая версия Node.js

**Node.js 24 LTS** (как в Replit). Текущий v20 вероятно тоже работает, но не тестировался.

```bash
# Через nvm:
nvm install 24
nvm use 24
nvm alias default 24
```

### Порты

| Сервис | Порт | Примечание |
|---|---|---|
| nginx | 80, 443 | Публичный |
| api-server | 3001 | Только localhost |
| Фронтенд | — | Статика через nginx |

### ecosystem.config.cjs для PM2

```js
module.exports = {
  apps: [
    {
      name: "api-server",
      script: "artifacts/api-server/dist/index.mjs",
      cwd: "/home/deploy/projects/nero6",
      interpreter: "node",
      interpreter_args: "--enable-source-maps",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      env_file: ".env",
      instances: 1,          // 1 инстанс (сессии в памяти, rate-limit в памяти)
      exec_mode: "fork",     // НЕ cluster — in-memory state несовместим с cluster
      max_memory_restart: "512M",
      error_file: "logs/api-server-error.log",
      out_file: "logs/api-server-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
```

> **Важно**: `exec_mode: "fork"` (не cluster), потому что rate-limiter и regAttempts хранятся in-memory Map. При cluster-режиме разные воркеры не разделяют состояние → лимиты не работают корректно.

### Конфиг nginx (пример)

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.ru;

    # SSL (certbot заполнит)
    ssl_certificate /etc/letsencrypt/live/yourdomain.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.ru/privkey.pem;

    root /home/deploy/projects/nero6/artifacts/solvehub/dist/public;
    index index.html;

    # API — проксируем на бэкенд
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;   # AI-вызовы могут быть долгими
        proxy_send_timeout 120s;
        client_max_body_size 75m;  # Для загрузки файлов/изображений
    }

    # SPA — всё остальное на index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статики
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

server {
    listen 80;
    server_name yourdomain.ru;
    return 301 https://$host$request_uri;
}
```

### Порядок первого запуска

```bash
# 1. Установить pnpm (если нет)
npm install -g pnpm

# 2. Исправить .env:
#    - Убрать точку в SUPABASE_URL
#    - Заменить ANTHROPIC_API_KEY на реальный ключ
#    - Добавить PORT=3001
#    - Добавить APP_URL=https://yourdomain.ru

# 3. Исправить vite.config.ts:
#    Удалить import runtimeErrorOverlay и его вызов из plugins[]

# 4. Установить зависимости
pnpm install

# 5. Сборка
pnpm run build

# 6. Запуск через PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # автозапуск при перезагрузке сервера

# 7. Настроить nginx и certbot
# 8. Проверить: curl https://yourdomain.ru/api/healthz
```

### Мониторинг

- Проверка живости: `GET /api/healthz` → `{"status":"ok"}`
- Полная проверка: `GET /api/healthz/full` (пингует БД)
- Логи PM2: `pm2 logs api-server`
- Sentry: настроить `SENTRY_DSN` для автоматических алертов

---

*Отчёт сгенерирован автоматически на основе статического анализа кода.*
