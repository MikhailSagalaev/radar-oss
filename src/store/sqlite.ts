import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type {
  Lead,
  LeadStatus,
  RunRecord,
  SourceConfig,
  SourceHealth,
  SourceKind,
  SourceRecord,
  Stats,
} from '../core/types.ts';
import type {
  CreateSourceInput,
  ListLeadsOptions,
  Store,
  UpdateSourceInput,
} from '../core/store.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  external_id TEXT,
  url TEXT,
  canonical_url TEXT,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  author TEXT,
  city TEXT,
  budget REAL,
  published_at TEXT,
  fingerprint TEXT NOT NULL,
  title_key TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_fingerprint ON leads(fingerprint);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_external
  ON leads(source_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source_created ON leads(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_title_key ON leads(title_key, created_at DESC);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  sink TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  found INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,
  rejected INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_source ON runs(source_id, started_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

interface SourceRow {
  id: string;
  kind: string;
  title: string;
  enabled: number;
  config_json: string;
  created_at: string;
  updated_at: string;
}

interface LeadRow {
  id: string;
  source_id: string;
  external_id: string | null;
  url: string | null;
  canonical_url: string | null;
  title: string;
  text: string;
  author: string | null;
  city: string | null;
  budget: number | null;
  published_at: string | null;
  fingerprint: string;
  title_key: string;
  status: string;
  score: number;
  reasons_json: string;
  created_at: string;
  delivered_at: string | null;
}

interface RunRow {
  id: string;
  source_id: string;
  started_at: string;
  finished_at: string | null;
  found: number;
  inserted: number;
  duplicates: number;
  rejected: number;
  delivered: number;
  error: string | null;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToSource(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    kind: row.kind as SourceKind,
    title: row.title,
    enabled: row.enabled === 1,
    config: parseJson<SourceConfig>(row.config_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    sourceId: row.source_id,
    externalId: row.external_id ?? undefined,
    url: row.url ?? undefined,
    canonicalUrl: row.canonical_url ?? undefined,
    title: row.title,
    text: row.text,
    author: row.author ?? undefined,
    city: row.city ?? undefined,
    budget: row.budget ?? undefined,
    publishedAt: row.published_at ?? undefined,
    fingerprint: row.fingerprint,
    titleKey: row.title_key,
    status: row.status as LeadStatus,
    score: row.score,
    reasons: parseJson<string[]>(row.reasons_json, []),
    createdAt: row.created_at,
    deliveredAt: row.delivered_at ?? undefined,
  };
}

function rowToRun(row: RunRow): RunRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    found: row.found,
    inserted: row.inserted,
    duplicates: row.duplicates,
    rejected: row.rejected,
    delivered: row.delivered,
    error: row.error ?? undefined,
  };
}

export class SqliteStore implements Store {
  private readonly db: Database.Database;

  constructor(path: string) {
    const resolved = path === ':memory:' ? path : resolve(path);
    if (resolved !== ':memory:') {
      mkdirSync(dirname(resolved), { recursive: true });
    }
    this.db = new Database(resolved);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA);
  }

  listSources(): SourceRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM sources ORDER BY created_at ASC')
      .all() as SourceRow[];
    return rows.map(rowToSource);
  }

  getSource(id: string): SourceRecord | null {
    const row = this.db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as
      | SourceRow
      | undefined;
    return row ? rowToSource(row) : null;
  }

  createSource(input: CreateSourceInput): SourceRecord {
    const now = new Date().toISOString();
    const id = input.id?.trim() || `${input.kind}_${randomUUID().slice(0, 8)}`;
    const record: SourceRecord = {
      id,
      kind: input.kind,
      title: input.title.trim(),
      enabled: input.enabled ?? true,
      config: input.config ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO sources (id, kind, title, enabled, config_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.kind,
        record.title,
        record.enabled ? 1 : 0,
        JSON.stringify(record.config),
        record.createdAt,
        record.updatedAt,
      );
    return record;
  }

  updateSource(id: string, patch: UpdateSourceInput): SourceRecord | null {
    const current = this.getSource(id);
    if (!current) return null;
    const next: SourceRecord = {
      ...current,
      title: patch.title?.trim() || current.title,
      enabled: patch.enabled ?? current.enabled,
      config: patch.config ?? current.config,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `UPDATE sources
         SET title = ?, enabled = ?, config_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.title,
        next.enabled ? 1 : 0,
        JSON.stringify(next.config),
        next.updatedAt,
        id,
      );
    return next;
  }

  deleteSource(id: string): boolean {
    const result = this.db.prepare('DELETE FROM sources WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findLeadByFingerprint(fingerprint: string): Lead | null {
    const row = this.db
      .prepare('SELECT * FROM leads WHERE fingerprint = ?')
      .get(fingerprint) as LeadRow | undefined;
    return row ? rowToLead(row) : null;
  }

  findRecentByTitleKey(
    titleKey: string,
    city: string | undefined,
    sinceIso: string,
  ): Lead | null {
    const row = city
      ? (this.db
          .prepare(
            `SELECT * FROM leads
             WHERE title_key = ? AND city = ? AND created_at >= ?
             ORDER BY created_at DESC LIMIT 1`,
          )
          .get(titleKey, city, sinceIso) as LeadRow | undefined)
      : (this.db
          .prepare(
            `SELECT * FROM leads
             WHERE title_key = ? AND city IS NULL AND created_at >= ?
             ORDER BY created_at DESC LIMIT 1`,
          )
          .get(titleKey, sinceIso) as LeadRow | undefined);
    return row ? rowToLead(row) : null;
  }

  insertLead(lead: Lead): boolean {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO leads (
           id, source_id, external_id, url, canonical_url, title, text, author,
           city, budget, published_at, fingerprint, title_key, status, score,
           reasons_json, created_at, delivered_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        lead.id,
        lead.sourceId,
        lead.externalId ?? null,
        lead.url ?? null,
        lead.canonicalUrl ?? null,
        lead.title,
        lead.text,
        lead.author ?? null,
        lead.city ?? null,
        lead.budget ?? null,
        lead.publishedAt ?? null,
        lead.fingerprint,
        lead.titleKey,
        lead.status,
        lead.score,
        JSON.stringify(lead.reasons),
        lead.createdAt,
        lead.deliveredAt ?? null,
      );
    return result.changes > 0;
  }

  updateLeadStatus(id: string, status: LeadStatus, deliveredAt?: string): void {
    this.db
      .prepare('UPDATE leads SET status = ?, delivered_at = ? WHERE id = ?')
      .run(status, deliveredAt ?? null, id);
  }

  listLeads(options: ListLeadsOptions = {}): Lead[] {
    const limit = Math.max(1, Math.min(options.limit ?? 50, 5000));
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (options.status) {
      clauses.push('status = ?');
      params.push(options.status);
    }
    if (options.sourceId) {
      clauses.push('source_id = ?');
      params.push(options.sourceId);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT ?`)
      .all(...params, limit) as LeadRow[];
    return rows.map(rowToLead);
  }

  getStats(): Stats {
    const one = (sql: string, ...params: Array<string | number>): number => {
      const row = this.db.prepare(sql).get(...params) as { count: number } | undefined;
      return row?.count ?? 0;
    };
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    return {
      sources: one('SELECT COUNT(*) AS count FROM sources'),
      enabledSources: one('SELECT COUNT(*) AS count FROM sources WHERE enabled = 1'),
      leads: one('SELECT COUNT(*) AS count FROM leads'),
      newLeads: one("SELECT COUNT(*) AS count FROM leads WHERE status = 'new'"),
      deliveredLeads: one("SELECT COUNT(*) AS count FROM leads WHERE status = 'delivered'"),
      rejectedLeads: one("SELECT COUNT(*) AS count FROM leads WHERE status = 'rejected'"),
      last24h: one('SELECT COUNT(*) AS count FROM leads WHERE created_at >= ?', since),
    };
  }

  getSourceHealth(): SourceHealth[] {
    const sources = this.listSources();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const aggregateRows = this.db
      .prepare(
        `SELECT source_id,
                COALESCE(SUM(found), 0) AS found,
                COALESCE(SUM(inserted), 0) AS inserted,
                COALESCE(SUM(duplicates), 0) AS duplicates,
                COALESCE(SUM(rejected), 0) AS rejected,
                COALESCE(SUM(delivered), 0) AS delivered,
                COALESCE(SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END), 0) AS errors,
                COUNT(*) AS runs
         FROM runs
         WHERE started_at >= ?
         GROUP BY source_id`,
      )
      .all(since) as Array<{
      source_id: string;
      found: number;
      inserted: number;
      duplicates: number;
      rejected: number;
      delivered: number;
      errors: number;
      runs: number;
    }>;

    const aggregate = new Map(aggregateRows.map((row) => [row.source_id, row]));
    const lastRows = this.db
      .prepare(
        `SELECT r.* FROM runs r
         JOIN (
           SELECT source_id, MAX(started_at) AS max_started
           FROM runs GROUP BY source_id
         ) latest
           ON latest.source_id = r.source_id AND latest.max_started = r.started_at`,
      )
      .all() as RunRow[];
    const lastBySource = new Map(lastRows.map((row) => [row.source_id, rowToRun(row)]));

    return sources.map((source) => {
      const row = aggregate.get(source.id);
      const runs = row?.runs ?? 0;
      const errors = row?.errors ?? 0;
      return {
        source,
        lastRun: lastBySource.get(source.id),
        last24h: {
          found: row?.found ?? 0,
          inserted: row?.inserted ?? 0,
          duplicates: row?.duplicates ?? 0,
          rejected: row?.rejected ?? 0,
          delivered: row?.delivered ?? 0,
          errors,
          runs,
        },
        successRate: runs > 0 ? Math.round(((runs - errors) / runs) * 100) : 0,
      };
    });
  }

  recordRun(run: RunRecord): void {
    this.db
      .prepare(
        `INSERT INTO runs (
           id, source_id, started_at, finished_at, found, inserted, duplicates,
           rejected, delivered, error
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.id,
        run.sourceId,
        run.startedAt,
        run.finishedAt ?? null,
        run.found,
        run.inserted,
        run.duplicates,
        run.rejected,
        run.delivered,
        run.error ?? null,
      );
  }

  listRuns(limit = 20, sourceId?: string): RunRecord[] {
    const bounded = Math.max(1, Math.min(limit, 200));
    const rows = sourceId
      ? (this.db
          .prepare(
            'SELECT * FROM runs WHERE source_id = ? ORDER BY started_at DESC LIMIT ?',
          )
          .all(sourceId, bounded) as RunRow[])
      : (this.db
          .prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ?')
          .all(bounded) as RunRow[]);
    return rows.map(rowToRun);
  }

  recordDelivery(
    leadId: string,
    sink: string,
    status: 'sent' | 'failed',
    error?: string,
  ): void {
    this.db
      .prepare(
        `INSERT INTO deliveries (id, lead_id, sink, status, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(randomUUID(), leadId, sink, status, error ?? null, new Date().toISOString());
  }

  close(): void {
    this.db.close();
  }
}

export function openStore(path: string): SqliteStore {
  return new SqliteStore(path);
}
