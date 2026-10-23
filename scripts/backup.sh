#!/usr/bin/env bash
# ==============================================================================
# Radar Automated PostgreSQL Backup Script
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./data/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/radar_${TIMESTAMP}.dump"
ENCRYPTED_FILE="${BACKUP_FILE}.age"

# 1. Загрузка переменных окружения если есть .env
if [ -f .env ]; then
  # shellcheck disable=SC1091
  source .env
fi

POSTGRES_USER="${POSTGRES_USER:-radar}"
POSTGRES_DB="${POSTGRES_DB:-radar}"
CONTAINER_NAME="${PG_CONTAINER:-radar_postgres}"

echo "📦 [Radar Backup] Создание резервной копии базы данных ${POSTGRES_DB}..."

# 2. Выгрузка pg_dump -Fc
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker exec -t "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > "$BACKUP_FILE"
elif command -v pg_dump >/dev/null 2>&1; then
  pg_dump -Fc "$DATABASE_URL" > "$BACKUP_FILE"
else
  echo "❌ Ошибка: Не найден запущенный контейнер ${CONTAINER_NAME} или утилита pg_dump"
  exit 1
fi

echo "✅ Дамп сохранен: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# 3. Опциональное шифрование через age
if [ -n "${BACKUP_AGE_RECIPIENT:-}" ] && command -v age >/dev/null 2>&1; then
  echo "🔒 Шифрование бэкапа с помощью age..."
  age -r "$BACKUP_AGE_RECIPIENT" -o "$ENCRYPTED_FILE" "$BACKUP_FILE"
  rm -f "$BACKUP_FILE"
  UPLOAD_TARGET="$ENCRYPTED_FILE"
  echo "✅ Зашифровано: $ENCRYPTED_FILE"
else
  UPLOAD_TARGET="$BACKUP_FILE"
fi

# 4. Опциональная загрузка в S3 / MinIO / Timeweb S3
if [ -n "${S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  echo "☁️ Отправка в S3-хранилище (${S3_BUCKET})..."
  ENDPOINT_FLAG=""
  if [ -n "${S3_ENDPOINT:-}" ]; then
    ENDPOINT_FLAG="--endpoint-url ${S3_ENDPOINT}"
  fi
  aws s3 cp "$UPLOAD_TARGET" "s3://${S3_BUCKET}/radar/$(basename "$UPLOAD_TARGET")" ${ENDPOINT_FLAG}
  echo "✅ Бэкап выгружен в облачное хранилище."
fi

# 5. Ротация: удаление локальных бэкапов старше 14 дней
echo "🧹 Удаление локальных копий старше 14 дней..."
find "$BACKUP_DIR" -type f \( -name "radar_*.dump" -o -name "radar_*.dump.age" \) -mtime +14 -delete

echo "🎉 Резервное копирование успешно завершено!"
