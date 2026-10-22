#!/usr/bin/env bash
# ==============================================================================
# Radar Auto-Deploy Script for Server ( рядом с ProfiPass )
# ==============================================================================
set -e

echo "🚀 [Radar Deploy] Начинаем развертывание Radar..."

# 1. Проверяем наличие директории
TARGET_DIR="/opt/radar"
if [ ! -d "$TARGET_DIR" ]; then
  echo "📦 Клонируем репозиторий в $TARGET_DIR..."
  git clone https://github.com/MikhailSagalaev/radar-oss.git "$TARGET_DIR"
else
  echo "🔄 Обновляем репозиторий в $TARGET_DIR..."
  cd "$TARGET_DIR"
  git pull origin main
fi

cd "$TARGET_DIR"

# 2. Создаем production .env если его нет
if [ ! -f .env ]; then
  echo "⚙️ Создаем .env файл конфигурации..."
  cat << 'EOF' > .env
PORT=8787
NODE_ENV=production
ADMIN_TOKEN=radar_admin_super_secret_2026
SESSION_SECRET=radar_session_random_secret_string_12345
WEBHOOK_TOKEN=radar_ext_token_777

# Подключение к PostgreSQL 17 (pgvector)
DATABASE_URL=postgres://radar:radar_secure_password@postgres:5432/radar

# Интеграция с ProfiPass (авто-отправка лидов)
WEBHOOK_URL=http://127.0.0.1:3000/api/internal/leads
EOF
  echo "✅ .env файл создан."
fi

# 3. Запуск через Docker Compose
echo "🐳 Сборка и запуск контейнеров (PostgreSQL 17 + pgvector + Radar Node app)..."
docker compose down || true
docker compose up -d --build

# 4. Проверка статуса
echo "⏳ Ожидаем запуск сервисов..."
sleep 5
docker compose ps

echo "🩺 Проверяем healthcheck..."
curl -f http://127.0.0.1:8787/health && echo " 🎉 Radar успешно работает!" || echo "⚠️ Сервис стартует..."

echo "=============================================================================="
echo " Radar доступен локально на http://127.0.0.1:8787"
echo " Настройте Nginx для проксирования на домен (например, radar.profipass.ru):"
echo "   proxy_pass http://127.0.0.1:8787;"
echo "=============================================================================="
