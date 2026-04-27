#!/usr/bin/env bash
# Резервное копирование self-hosted Supabase Postgres для НейроЗачёт
#
# Использование (на вашем сервере):
#   1. Скопируйте этот скрипт на сервер: /opt/neyrozachet/backup.sh
#   2. chmod +x /opt/neyrozachet/backup.sh
#   3. Заполните переменные ниже (или передайте через env)
#   4. Добавьте в crontab: 0 3 * * * /opt/neyrozachet/backup.sh
#
# Переменные окружения:
#   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE — параметры подключения
#   BACKUP_DIR — куда сохранять (по умолчанию /var/backups/neyrozachet)
#   RETENTION_DAYS — сколько дней хранить (по умолчанию 14)
#   S3_BUCKET — опционально: загружать в S3-совместимое хранилище через rclone

set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/neyrozachet}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

TS=$(date +"%Y%m%d_%H%M%S")
FILE="$BACKUP_DIR/neyrozachet_${TS}.sql.gz"

echo "[$(date -Is)] === Старт бэкапа ==="
echo "  → $FILE"

# pg_dump только нужных таблиц (префикс Neyrozachet_)
PGPASSWORD="${PGPASSWORD:-}" pg_dump \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --no-owner --no-acl --clean --if-exists \
  -t '"Neyrozachet_*"' \
  | gzip -9 > "$FILE"

SIZE=$(du -h "$FILE" | cut -f1)
echo "[$(date -Is)] ✅ Бэкап готов ($SIZE)"

# Опционально: выгрузка в S3/Object Storage через rclone
if [[ -n "${S3_BUCKET:-}" ]] && command -v rclone >/dev/null 2>&1; then
  echo "[$(date -Is)] → Выгружаю в $S3_BUCKET"
  rclone copy "$FILE" "$S3_BUCKET" --quiet
  echo "[$(date -Is)] ✅ Выгружено"
fi

# Очистка старых бэкапов
echo "[$(date -Is)] Удаляю бэкапы старше $RETENTION_DAYS дней..."
find "$BACKUP_DIR" -name "neyrozachet_*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete

echo "[$(date -Is)] === Готово ==="
