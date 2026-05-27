# DEPLOY.md — Runbook деплоя НейроЗачёт

> VPS: Beget Москва · Пользователь: `deploy` · Домен: `neurozachet.ru`
> Обновлён: 2026-05-27

---

## Стандартное обновление (git pull → prod)

```bash
# 1. Зайти на сервер
ssh deploy@neurozachet.ru

# 2. Перейти в репо
cd ~/projects/nero6

# 3. Получить изменения
git pull

# 4. Обновить зависимости (только если изменились package.json / pnpm-lock.yaml)
pnpm install

# 5. Собрать бэкенд (если изменения в artifacts/api-server/)
pnpm --filter @workspace/api-server run build

# 6. Собрать фронтенд (если изменения в artifacts/solvehub/)
pnpm --filter @workspace/solvehub run build

# 7. Перезапустить api-server (только если менялся бэкенд или .env)
pm2 restart api-server --update-env

# 8. Nginx НЕ трогать — статика раздаётся напрямую из dist/public/
#    nginx подхватывает новые файлы автоматически
```

---

## Проверка после деплоя

```bash
# API отвечает
curl https://neurozachet.ru/api/healthz
# ожидается: {"status":"ok"}

# PM2 процессы
pm2 list
# api-server должен быть status=online, ↺ (restarts) не растёт

# Браузер
# Открыть https://neurozachet.ru — убедиться что SPA загрузилась
# Войти в аккаунт — убедиться что /dashboard открывается
```

---

## Откат при проблеме

```bash
# Вернуться на предыдущий коммит
git reset --hard HEAD~1

# Пересобрать (то что было изменено)
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/solvehub run build

# Перезапустить
pm2 restart api-server --update-env
```

---

## Логи

```bash
# Последние 50 строк лога api-server (stdout + stderr вместе)
pm2 logs api-server --lines 50

# Только ошибки
pm2 logs api-server --err --lines 100

# Лог файлы напрямую
tail -f ~/projects/nero6/logs/api-server-error.log
tail -f ~/projects/nero6/logs/api-server-out.log

# Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

---

## Если api-server упал и не поднимается

1. `pm2 logs api-server --err --lines 100` — найти причину
2. Типичные причины:
   - **Новая env-переменная в коде, не добавленная в `.env`** — добавить и `pm2 restart --update-env`
   - **Синтаксическая ошибка в TS → JS компиляции** — проверить билд вручную
   - **Порт 3001 занят** — `lsof -i :3001`, убить процесс, `pm2 start`
3. После исправления: `pm2 start ecosystem.config.cjs` или `pm2 restart api-server`

---

## Прокси для Anthropic

Beget блокирует прямые запросы к `api.anthropic.com`.
Перед работой с Claude Code или при проблемах с Anthropic API убедиться:

```bash
echo $HTTPS_PROXY
# должно вернуть адрес прокси, не пустую строку
```

Если пустая строка — `source ~/.bashrc` или переоткрыть SSH-сессию.

При запуске `pm2 restart api-server --update-env` переменная берётся из
текущего shell-окружения, поэтому важно запускать именно из сессии с активным прокси.

---

## Структура сборки

| Что | Команда | Результат |
|-----|---------|-----------|
| API-сервер | `pnpm --filter @workspace/api-server run build` | `artifacts/api-server/dist/index.mjs` |
| Фронтенд | `pnpm --filter @workspace/solvehub run build` | `artifacts/solvehub/dist/public/` |
| Оба сразу | `pnpm run build` (если настроен в root) | — |

Nginx конфигурация:
- Статика → `artifacts/solvehub/dist/public/`
- `/api/*` → `proxy_pass http://localhost:3001`
- SPA fallback → `try_files $uri $uri/ /index.html`

---

## PM2 — полезные команды

```bash
pm2 list                        # все процессы
pm2 status                      # краткий статус
pm2 restart api-server          # перезапуск (без обновления env)
pm2 restart api-server --update-env  # перезапуск с обновлением env из shell
pm2 stop api-server             # остановить
pm2 start ecosystem.config.cjs  # запустить по конфигу (первый раз или после pm2 delete)
pm2 save                        # сохранить список процессов для автостарта
pm2 resurrect                   # поднять сохранённые процессы (после ребута)
```

---

## После ребута сервера

PM2 настроен на автостарт через systemd (`pm2 resurrect`).
Если процессы не поднялись сами:

```bash
pm2 resurrect
# или
pm2 start ecosystem.config.cjs
pm2 save
```

---

## Docker — установка и первый запуск

> Используется вместо PM2 для запуска бэкенда в изолированном контейнере.
> Nginx и фронтенд остаются на хосте без изменений.

### 1. Установить Docker (однократно)

```bash
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl enable --now docker
sudo usermod -aG docker deploy   # чтобы не писать sudo каждый раз
# после usermod — выйти и зайти снова по SSH
```

### 2. Собрать образ

```bash
cd ~/projects/nero6
docker build -t nero6-api .
```

Первая сборка занимает 5–10 минут (скачивает node:20-alpine, устанавливает pnpm).
Повторные сборки — быстрее из-за кэширования слоёв.

### 3. Запустить контейнер

```bash
# Один раз вручную (для теста):
docker run -d \
  --name nero6-api \
  -p 3001:3001 \
  --env-file /home/deploy/projects/nero6/.env \
  -v /home/deploy/data/uploads:/app/uploads \
  --restart unless-stopped \
  nero6-api

# Или через docker-compose:
docker compose up -d
```

### 4. Проверка

```bash
docker ps                          # контейнер должен быть Up
docker logs nero6-api --tail 30    # логи запуска
curl http://localhost:3001/api/healthz  # {"status":"ok"}
```

### 5. Обновление после изменений в коде

```bash
cd ~/projects/nero6
git pull

# Фронтенд (nginx подхватывает сам):
pnpm --filter @workspace/solvehub run build

# Бэкенд — пересобрать образ и перезапустить:
docker build -t nero6-api .
docker stop nero6-api && docker rm nero6-api
docker run -d \
  --name nero6-api \
  -p 3001:3001 \
  --env-file /home/deploy/projects/nero6/.env \
  -v /home/deploy/data/uploads:/app/uploads \
  --restart unless-stopped \
  nero6-api

# Или через compose:
docker compose up -d --build
```

### 6. Отладка контейнера

```bash
docker logs nero6-api -f            # стримить логи
docker exec -it nero6-api sh        # войти в контейнер
docker inspect nero6-api            # полная конфигурация
```
