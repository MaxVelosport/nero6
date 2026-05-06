# Backup scripts

Place these scripts to /home/deploy/scripts/:

```bash
cp deploy/*.sh /home/deploy/scripts/
chmod 700 /home/deploy/scripts/*.sh
```

Required env vars (in /home/deploy/projects/nero6/.env):
- `SUPABASE_DATABASE_URL=postgresql://...`
- `YANDEX_DISK_TOKEN=y0_...`

Required tools: `pg_dump`, `jq`, `curl`

Cron setup (user deploy):

```
0 4 * * * /home/deploy/scripts/backup.sh > /dev/null 2>&1
0 9 * * 1 /home/deploy/scripts/check_backup.sh
```
