# Архитектура базы данных и хранилища Radar (PostgreSQL 17 + pgvector)

Данный документ описывает структуру, изоляцию и взаимодействие хранилища Radar в production-окружении.

---

## 1. Принцип изоляции (Database per Service)

Radar развернут как полностью обособленный сервис:
- **Никаких общих баз с ProfiPass:** Radar использует собственную выделенную СУБД **PostgreSQL 17** (`radar_postgres`) с расширением `vector` (`pgvector 0.8.7`).
- **Изолированный том:** данные хранятся в томе `radar_test_radar_pgdata`, независимом от данных других проектов на сервере.
- **Связь с ProfiPass только по API:** отправка лидов в ProfiPass осуществляется через Webhook-эндпоинт (`POST /api/internal/leads`), не создавая прямых связей на уровне SQL.

---

## 2. Схема базы данных Radar

```sql
-- Расширение для семантического векторного поиска
CREATE EXTENSION IF NOT EXISTS vector;

-- Источники (RSS, Kwork, Telegram, IMAP, Webhook)
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Заказы и лиды
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  external_id TEXT,
  url TEXT,
  canonical_url TEXT,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  author TEXT,
  city TEXT,
  budget DOUBLE PRECISION,
  currency TEXT DEFAULT 'RUB',
  category TEXT,
  skills_json JSONB DEFAULT '[]'::jsonb,
  is_remote BOOLEAN DEFAULT TRUE,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  fingerprint TEXT NOT NULL UNIQUE,
  title_key TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- Полнотекстовые GIN-индексы на русском и английском языках (BM25 / TsVector)
CREATE INDEX idx_leads_fts_ru ON leads USING GIN (to_tsvector('russian', title || ' ' || text));
CREATE INDEX idx_leads_fts_en ON leads USING GIN (to_tsvector('english', title || ' ' || text));

-- Transactional Outbox Pattern для гарантированной доставки событий (Event-Driven)
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

---

## 3. Производительность и масштабируемость

- **Высокая параллельная запись:** благодаря MVCC в PostgreSQL 17 одновременный опрос 10+ бирж и прием входящих вебхуков происходят без блокировок чтения/записи.
- **Поддержка pgvector:** таблица подготовлена для вычисления семантических эмбеддингов заказов с использованием HNSW-индексов.
- **Событийная шина (Outbox):** каждая вставка заказа атомарно фиксирует событие `lead.created` в таблице `outbox_events`, гарантируя доставку в downstream-системы без потерь.
