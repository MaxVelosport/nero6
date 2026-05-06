#!/bin/bash
set -e

# Загрузка переменных окружения
set -a
source /home/deploy/projects/nero6/.env
set +a

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups"
LOG_FILE="$BACKUP_DIR/backup.log"
YANDEX_FOLDER="Backups/Neurozachet"

mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== Начало бэкапа $DATE ==="

# 1. БД
DB_FILE="$BACKUP_DIR/db_$DATE.sql.gz"
log "pg_dump → $DB_FILE"
if pg_dump "$SUPABASE_DATABASE_URL" --no-owner --no-acl 2>>"$LOG_FILE" | gzip > "$DB_FILE"; then
    DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
    log "БД: $DB_SIZE"
else
    log "ОШИБКА: pg_dump упал"
    exit 1
fi

# 2. Uploads
UPLOADS_FILE="$BACKUP_DIR/uploads_$DATE.tar.gz"
log "tar uploads → $UPLOADS_FILE"
if tar czf "$UPLOADS_FILE" -C /home/deploy/data uploads 2>>"$LOG_FILE"; then
    UPLOADS_SIZE=$(du -h "$UPLOADS_FILE" | cut -f1)
    log "Uploads: $UPLOADS_SIZE"
else
    log "ОШИБКА: tar упал"
    exit 1
fi

# 3. Загрузка на Яндекс Диск
upload_to_yandex() {
    local file="$1"
    local filename=$(basename "$file")
    local path="$YANDEX_FOLDER/$filename"
    local encoded_path=$(printf '%s' "$path" | jq -sRr @uri)

    # Получить URL для загрузки
    local upload_url=$(curl -s -H "Authorization: OAuth $YANDEX_DISK_TOKEN" \
        "https://cloud-api.yandex.net/v1/disk/resources/upload?path=$encoded_path&overwrite=true" \
        | jq -r '.href // empty')

    if [ -z "$upload_url" ]; then
        log "ОШИБКА: не получен upload_url для $filename"
        return 1
    fi

    # Загрузить файл
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" -T "$file" "$upload_url")
    if [ "$http_code" = "201" ] || [ "$http_code" = "202" ]; then
        log "✅ $filename загружен (HTTP $http_code)"
    else
        log "ОШИБКА: загрузка $filename вернула HTTP $http_code"
        return 1
    fi
}

log "Загрузка на Яндекс Диск..."
upload_to_yandex "$DB_FILE"
upload_to_yandex "$UPLOADS_FILE"

# 4. Удаление локальных бэкапов старше 7 дней
log "Очистка локальных бэкапов старше 7 дней..."
DELETED=$(find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +7 -delete -print | wc -l)
DELETED=$((DELETED + $(find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +7 -delete -print | wc -l)))
log "Удалено локально: $DELETED файл(а)"

log "=== Бэкап завершён ==="
