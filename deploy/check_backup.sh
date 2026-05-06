#!/bin/bash
# Проверка что последний бэкап БД был не старше 25 часов
LATEST=$(find /home/deploy/backups -name "db_*.sql.gz" -mmin -1500 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
    echo "[$(date)] ⚠️ ВНИМАНИЕ: бэкап БД старше 25 часов!" >> /home/deploy/backups/backup.log
fi
