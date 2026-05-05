# BUGS.md — Известные проблемы и TODO

> Обновлён: 2026-05-05 после сессии переноса с Replit на VPS Beget.

---

## Критические (не работает в проде)

### Object Storage / Replit GCS

**Что:** маршруты `/api/storage/*`, функция `saveImageFromUrl`

**Симптом:**
- Кнопка «Сохранить» у иллюстраций DALL-E не работает
- Загрузка пользовательских изображений в задачи не работает
- В логах: ошибка подключения к `http://127.0.0.1:1106/token`

**Причина:** код использует Replit GCS sidecar — HTTP-сервис, который работал
только внутри Replit-контейнера. На VPS этого сервиса нет.

**Обходной путь:** функция деградирует gracefully (не крашит сервер),
но возвращает ошибку пользователю.

**Решение (TODO):**
- Заменить GCS sidecar на локальный диск: `/home/deploy/data/uploads/`
- Раздавать файлы через nginx: `location /uploads/ { alias /home/deploy/data/uploads/; }`
- Изменить `saveImageFromUrl` и маршруты `/api/storage/*` в `artifacts/api-server/src/routes/storage.ts`

---

## Исправлено в сессии 2026-05-05 (10 багов)

| # | Описание | Файлы |
|---|----------|-------|
| 1 | Баннер "Подтвердите email" не исчезал после подтверждения (поле `email_verified` vs `emailVerified`) | `dashboard.tsx`, `verify-email.tsx` |
| 2 | AI-классификатор рекомендовал Premium для простых школьных задач | `api-server/src/routes/tasks.ts` |
| 3 | Инлайн LaTeX `$...$` не рендерился (только блочный `$$...$$` работал) | `render-message.tsx` (рефакторинг на remark-math) |
| 4 | Ссылка "Поделиться" давала 404 (`/tasks/shared/` ошибочно попадал в protected-роуты) | `App.tsx` |
| 5 | Кнопка "Улучшить уникальность" отсутствовала в задаче | `tasks/[id].tsx` |
| 6 | Кнопка "Скачать" у DALL-E изображений открывала новую вкладку вместо скачивания | `tasks/[id].tsx` |
| 7 | Прогресс-бар застревал на 95% на 10–30 секунд перед завершением | `tasks/[id].tsx` |
| 8 | Markdown-таблицы рендерились как сырой текст с `|` (LaTeX в ячейках ломал segmentContent) | `render-message.tsx` |
| 9 | Все три уровня рерайта в `/uniqueness` показывали одинаковую цену 15₽ (`minRewrite` перекрывал разницу) | `api-server/src/lib/settings.ts` |
| 10 | LaTeX не рендерился в блоке "Текст с подсветкой" и в результате рерайта | `uniqueness.tsx` |

---

## TODO для следующих сессий

### Приоритет: высокий
- [ ] **Object Storage** — заменить Replit GCS на локальный диск + nginx (см. выше)
- [ ] **Унификация рендера markdown** — проверить страницы `/sessions/[id]` (чат),
  `/coursework/new` (курсовые), `/learn/summary` (конспекты) на те же проблемы
  с LaTeX и таблицами, что были в `/uniqueness`. Применить `RenderMessage` там где нужно.

### Приоритет: средний
- [ ] **ЮKassa боевой режим** — протестировать реальные платежи после регистрации
  ИП/самозанятого. Сейчас неизвестно работает ли webhook в проде.
- [ ] **Email DKIM-подпись** — настроить DKIM для домена neurozachet.ru для
  надёжности доставки писем (сейчас письма могут попадать в спам).
- [ ] **Diff-вид в `/uniqueness`** — в "Подсветка изменений" LaTeX не рендерится
  (там `dangerouslySetInnerHTML` с word-diff HTML). Добавить `renderMathInElement`
  или заменить подход.

### Приоритет: низкий
- [ ] **Разбить главный чанк** — `index.js` весит 3.7MB / gzip 1.1MB. Настроить
  `manualChunks` в Vite для разбивки (mermaid, mermaid-диаграммы — главные виновники).
- [ ] **Supabase JDBC** — `SUPABASE_DATABASE_URL` пустой, всё работает через REST.
  При масштабировании стоит подключить прямой коннект.

---

## Известные нюансы инфраструктуры

### PM2 systemd service
`pm2-deploy.service` (или аналог) фейлится при ручном `systemctl start`,
но при реальном ребуте сервера работает корректно через `pm2 resurrect`.
Не чинить без необходимости — лишние попытки могут нарушить работу.

### SSH и cloud-init на Beget
На Beget VPS файлы в `/etc/ssh/sshd_config.d/` могут содержать cloud-init
конфиги, которые переопределяют настройки из `/etc/ssh/sshd_config`.
При проблемах с SSH (например, `PasswordAuthentication` не работает)
проверять именно эту директорию.

### Прокси для Anthropic
`api.anthropic.com` недоступен с Beget без прокси. `HTTPS_PROXY` прописан
в `/home/deploy/.bashrc`. PM2 берёт переменную из shell-окружения при запуске
с флагом `--update-env`. Если Claude-запросы с сервера перестали работать —
перезапустить api-server из ssh-сессии с активным `.bashrc`.

### Supabase self-hosted
Проект использует self-hosted Supabase на `superbase.aiinvestor360.ru`.
Таблицы названы с префиксом `Neyrozachet_` (с заглавной N и заглавной N).
При запросах через REST API использовать именно это написание.
