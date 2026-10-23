import pg from 'pg';
import { randomUUID } from 'node:crypto';
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
  LeadDeliveryRecord,
  ListLeadsOptions,
  Store,
  UpdateSourceInput,
} from '../core/store.ts';

import { checkMigrations } from './migrator.ts';

const { Pool } = pg;

export class PostgresStore implements Store {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async init(): Promise<void> {
    const { ok, pending } = await checkMigrations(this.pool);
    if (!ok) {
      throw new Error(
        `Database schema is not up to date! Pending migrations: ${pending.join(', ')}. ` +
        `Please run 'radar migrate' before starting the application.`
      );
    }
  }

  private closed = false;

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.pool.end();
  }

  async truncate(): Promise<void> {
    await this.pool.query('TRUNCATE TABLE deliveries, runs, leads, sources CASCADE');
  }

  async listSources(): Promise<SourceRecord[]> {
    const res = await this.pool.query(
      `SELECT id, kind, title, enabled, config_json, created_at, updated_at FROM sources ORDER BY created_at ASC`
    );
    return res.rows.map(r => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      enabled: Boolean(r.enabled),
      config: r.config_json || {},
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }

  async getSource(id: string): Promise<SourceRecord | null> {
    const res = await this.pool.query(
      `SELECT id, kind, title, enabled, config_json, created_at, updated_at FROM sources WHERE id = $1`,
      [id]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      enabled: Boolean(r.enabled),
      config: r.config_json || {},
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  }

  async createSource(input: CreateSourceInput): Promise<SourceRecord> {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();
    const enabled = input.enabled ?? true;
    const config = JSON.stringify(input.config ?? {});

    await this.pool.query(
      `INSERT INTO sources (id, kind, title, enabled, config_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [id, input.kind, input.title, enabled, config, now, now]
    );

    return {
      id,
      kind: input.kind,
      title: input.title,
      enabled,
      config: input.config ?? {},
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateSource(id: string, patch: UpdateSourceInput): Promise<SourceRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query<{
        id: string;
        kind: SourceKind;
        title: string;
        enabled: boolean;
        config_json: unknown;
        created_at: string;
        updated_at: string;
      }>(`SELECT * FROM sources WHERE id = $1 FOR UPDATE`, [id]);

      const current = res.rows[0];
      if (!current) {
        await client.query('ROLLBACK');
        return null;
      }

      const parsedConfig =
        typeof current.config_json === 'string'
          ? JSON.parse(current.config_json)
          : (current.config_json as Record<string, unknown>) ?? {};

      const title = patch.title ?? current.title;
      const enabled = patch.enabled ?? current.enabled;
      const newConfig = patch.config ? { ...parsedConfig, ...patch.config } : parsedConfig;
      const now = new Date().toISOString();

      const updateRes = await client.query<{
        id: string;
        kind: SourceKind;
        title: string;
        enabled: boolean;
        config_json: unknown;
        created_at: string;
        updated_at: string;
      }>(
        `UPDATE sources SET title = $1, enabled = $2, config_json = $3::jsonb, updated_at = $4 WHERE id = $5 RETURNING *`,
        [title, enabled, JSON.stringify(newConfig), now, id],
      );

      await client.query('COMMIT');

      const updated = updateRes.rows[0]!;
      return {
        id: updated.id,
        kind: updated.kind,
        title: updated.title,
        enabled: Boolean(updated.enabled),
        config: (typeof updated.config_json === 'string' ? JSON.parse(updated.config_json) : updated.config_json) as Record<string, unknown>,
        createdAt: new Date(updated.created_at).toISOString(),
        updatedAt: new Date(updated.updated_at).toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteSource(id: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM sources WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async findLeadByFingerprint(fingerprint: string): Promise<Lead | null> {
    const res = await this.pool.query(`SELECT * FROM leads WHERE fingerprint = $1`, [fingerprint]);
    return res.rows[0] ? this.rowToLead(res.rows[0]) : null;
  }

  async getLead(id: string): Promise<Lead | null> {
    const res = await this.pool.query(`SELECT * FROM leads WHERE id = $1`, [id]);
    return res.rows[0] ? this.rowToLead(res.rows[0]) : null;
  }

  async findRecentByTitleKey(titleKey: string, city: string | undefined, sinceIso: string): Promise<Lead | null> {
    const query = city
      ? `SELECT * FROM leads WHERE title_key = $1::text AND city = $2::text AND created_at >= $3::timestamptz ORDER BY created_at DESC LIMIT 1`
      : `SELECT * FROM leads WHERE title_key = $1::text AND created_at >= $2::timestamptz ORDER BY created_at DESC LIMIT 1`;
    const params = city ? [titleKey, city, sinceIso] : [titleKey, sinceIso];
    const res = await this.pool.query(query, params);
    return res.rows[0] ? this.rowToLead(res.rows[0]) : null;
  }

  async insertLead(lead: Lead): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const res = await client.query(
        `INSERT INTO leads (
          id, source_id, external_id, url, canonical_url, title, text,
          author, city, budget, currency, category, skills_json, is_remote,
          metadata_json, published_at, fingerprint, title_key, status, score,
          reasons_json, created_at, delivered_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13::jsonb, $14,
          $15::jsonb, $16, $17, $18, $19, $20,
          $21::jsonb, $22, $23
        ) ON CONFLICT (fingerprint) DO NOTHING`,
        [
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
          lead.currency ?? 'RUB',
          lead.category ?? null,
          JSON.stringify(lead.skills ?? []),
          lead.isRemote ?? true,
          JSON.stringify(lead.metadata ?? {}),
          lead.publishedAt ? new Date(lead.publishedAt) : null,
          lead.fingerprint,
          lead.titleKey,
          lead.status,
          lead.score,
          JSON.stringify(lead.reasons ?? []),
          new Date(lead.createdAt),
          lead.deliveredAt ? new Date(lead.deliveredAt) : null,
        ]
      );

      const inserted = (res.rowCount ?? 0) > 0;

      // Transactional Outbox: публикуем событие о новом лиде
      if (inserted) {
        await client.query(
          `INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2::jsonb)`,
          ['lead.created', JSON.stringify({ leadId: lead.id, status: lead.status, score: lead.score })]
        );
      }

      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateLeadStatus(id: string, status: LeadStatus, deliveredAt?: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE leads SET status = $1, delivered_at = $2 WHERE id = $3`,
        [status, deliveredAt ? new Date(deliveredAt) : null, id]
      );
      await client.query(
        `INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2::jsonb)`,
        ['lead.status_updated', JSON.stringify({ leadId: id, status, deliveredAt })]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listLeads(options: ListLeadsOptions = {}): Promise<Lead[]> {
    const limit = options.limit ?? 50;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (options.status) {
      conditions.push(`status = $${idx++}`);
      params.push(options.status);
    }
    if (options.sourceId) {
      conditions.push(`source_id = $${idx++}`);
      params.push(options.sourceId);
    }
    if (options.query && options.query.trim().length > 0) {
      const trimmed = options.query.trim();
      if (trimmed.length >= 3) {
        conditions.push(`(
          to_tsvector('russian', title || ' ' || text) @@ websearch_to_tsquery('russian', $${idx})
          OR title ILIKE $${idx + 1}
          OR text ILIKE $${idx + 1}
          OR city ILIKE $${idx + 1}
          OR category ILIKE $${idx + 1}
        )`);
        params.push(trimmed);
        params.push(`%${trimmed}%`);
        idx += 2;
      } else {
        const q = `%${trimmed}%`;
        conditions.push(`(
          title ILIKE $${idx} OR
          text ILIKE $${idx} OR
          city ILIKE $${idx} OR
          category ILIKE $${idx} OR
          title_key ILIKE $${idx}
        )`);
        params.push(q);
        idx++;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);
    const query = `SELECT * FROM leads ${whereClause} ORDER BY created_at DESC LIMIT $${idx}`;

    const res = await this.pool.query(query, params);
    return res.rows.map(r => this.rowToLead(r));
  }

  async getStats(): Promise<Stats> {
    const one = async (sql: string, params: any[] = []): Promise<number> => {
      const res = await this.pool.query(sql, params);
      return parseInt(res.rows[0]?.count, 10) || 0;
    };
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [sources, enabledSources, leads, newLeads, deliveredLeads, rejectedLeads, last24h] =
      await Promise.all([
        one('SELECT COUNT(*) AS count FROM sources'),
        one('SELECT COUNT(*) AS count FROM sources WHERE enabled = TRUE'),
        one('SELECT COUNT(*) AS count FROM leads'),
        one("SELECT COUNT(*) AS count FROM leads WHERE status = 'new'"),
        one("SELECT COUNT(*) AS count FROM leads WHERE status = 'delivered'"),
        one("SELECT COUNT(*) AS count FROM leads WHERE status = 'rejected'"),
        one('SELECT COUNT(*) AS count FROM leads WHERE created_at >= $1::timestamptz', [since]),
      ]);

    return {
      sources,
      enabledSources,
      leads,
      newLeads,
      deliveredLeads,
      rejectedLeads,
      last24h,
    };
  }

  async getSourceHealth(): Promise<SourceHealth[]> {
    const sources = await this.listSources();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const aggregateRes = await this.pool.query(
      `SELECT source_id,
              COALESCE(SUM(found), 0) AS found,
              COALESCE(SUM(inserted), 0) AS inserted,
              COALESCE(SUM(duplicates), 0) AS duplicates,
              COALESCE(SUM(rejected), 0) AS rejected,
              COALESCE(SUM(delivered), 0) AS delivered,
              COALESCE(SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END), 0) AS errors,
              COUNT(*) AS runs
       FROM runs
       WHERE started_at >= $1::timestamptz
       GROUP BY source_id`,
      [since]
    );

    const aggregate = new Map(aggregateRes.rows.map(r => [r.source_id, r]));

    const lastRunsRes = await this.pool.query(
      `SELECT r.* FROM runs r
       JOIN (
         SELECT source_id, MAX(started_at) AS max_started
         FROM runs GROUP BY source_id
       ) latest
         ON latest.source_id = r.source_id AND latest.max_started = r.started_at`
    );

    const lastBySource = new Map(lastRunsRes.rows.map(r => [r.source_id, this.rowToRun(r)]));

    return sources.map((source) => {
      const row = aggregate.get(source.id);
      const runs = parseInt(row?.runs, 10) || 0;
      const errors = parseInt(row?.errors, 10) || 0;
      return {
        source,
        lastRun: lastBySource.get(source.id),
        last24h: {
          found: parseInt(row?.found, 10) || 0,
          inserted: parseInt(row?.inserted, 10) || 0,
          duplicates: parseInt(row?.duplicates, 10) || 0,
          rejected: parseInt(row?.rejected, 10) || 0,
          delivered: parseInt(row?.delivered, 10) || 0,
          errors,
          runs,
        },
        successRate: runs === 0 ? 1 : Math.max(0, (runs - errors) / runs),
      };
    });
  }

  async recordDelivery(leadId: string, sink: string, status: 'sent' | 'failed', error?: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO deliveries (id, lead_id, sink, status, error)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), leadId, sink, status, error ?? null]
    );
  }

  async recordRun(run: RunRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO runs (id, source_id, started_at, finished_at, found, inserted, duplicates, rejected, delivered, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        run.id,
        run.sourceId,
        new Date(run.startedAt),
        run.finishedAt ? new Date(run.finishedAt) : null,
        run.found,
        run.inserted,
        run.duplicates,
        run.rejected,
        run.delivered,
        run.error ?? null,
      ]
    );
  }

  async listRuns(limit = 20, sourceId?: string): Promise<RunRecord[]> {
    const query = sourceId
      ? `SELECT * FROM runs WHERE source_id = $1 ORDER BY started_at DESC LIMIT $2`
      : `SELECT * FROM runs ORDER BY started_at DESC LIMIT $1`;
    const params = sourceId ? [sourceId, limit] : [limit];
    const res = await this.pool.query(query, params);

    return res.rows.map(r => this.rowToRun(r));
  }

  private rowToRun(r: any): RunRecord {
    return {
      id: r.id,
      sourceId: r.source_id,
      startedAt: new Date(r.started_at).toISOString(),
      finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : undefined,
      found: parseInt(r.found, 10) || 0,
      inserted: parseInt(r.inserted, 10) || 0,
      duplicates: parseInt(r.duplicates, 10) || 0,
      rejected: parseInt(r.rejected, 10) || 0,
      delivered: parseInt(r.delivered, 10) || 0,
      error: r.error || undefined,
    };
  }

  private rowToLead(r: any): Lead {
    return {
      id: r.id,
      sourceId: r.source_id,
      externalId: r.external_id || undefined,
      url: r.url || undefined,
      canonicalUrl: r.canonical_url || undefined,
      title: r.title,
      text: r.text,
      author: r.author || undefined,
      city: r.city || undefined,
      budget: r.budget !== null ? Number(r.budget) : undefined,
      currency: r.currency || 'RUB',
      category: r.category || undefined,
      skills: Array.isArray(r.skills_json) ? r.skills_json : (typeof r.skills_json === 'string' ? JSON.parse(r.skills_json) : []),
      isRemote: r.is_remote !== null ? Boolean(r.is_remote) : true,
      metadata: typeof r.metadata_json === 'object' && r.metadata_json !== null ? r.metadata_json : JSON.parse(r.metadata_json || '{}'),
      publishedAt: r.published_at ? new Date(r.published_at).toISOString() : undefined,
      fingerprint: r.fingerprint,
      titleKey: r.title_key,
      status: r.status as LeadStatus,
      score: r.score,
      reasons: Array.isArray(r.reasons_json) ? r.reasons_json : JSON.parse(r.reasons_json || '[]'),
      createdAt: new Date(r.created_at).toISOString(),
      deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : undefined,
    };
  }

  async initLeadDeliveries(leadId: string, sinks: string[]): Promise<void> {
    for (const sink of sinks) {
      await this.pool.query(
        `INSERT INTO lead_deliveries (lead_id, sink, status, attempts, next_attempt_at, created_at, updated_at)
         VALUES ($1, $2, 'pending', 0, NOW(), NOW(), NOW())
         ON CONFLICT (lead_id, sink) DO NOTHING`,
        [leadId, sink]
      );
    }
  }

  async updateLeadDelivery(
    leadId: string,
    sink: string,
    status: 'sent' | 'failed',
    error?: string,
    nextAttemptAt?: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE lead_deliveries
       SET status = $3,
           attempts = attempts + 1,
           last_error = $4,
           next_attempt_at = COALESCE($5::timestamptz, NOW()),
           updated_at = NOW()
       WHERE lead_id = $1 AND sink = $2`,
      [leadId, sink, status, error || null, nextAttemptAt || null]
    );
  }

  async getPendingDeliveries(limit = 50): Promise<LeadDeliveryRecord[]> {
    const res = await this.pool.query(
      `SELECT lead_id, sink, status, attempts, next_attempt_at, last_error, created_at, updated_at
       FROM lead_deliveries
       WHERE status != 'sent' AND attempts < 5 AND next_attempt_at <= NOW()
       ORDER BY next_attempt_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    return res.rows.map((r: any) => ({
      leadId: r.lead_id,
      sink: r.sink,
      status: r.status,
      attempts: parseInt(r.attempts, 10) || 0,
      nextAttemptAt: new Date(r.next_attempt_at).toISOString(),
      lastError: r.last_error || undefined,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }

  async getLeadDeliveries(leadId: string): Promise<LeadDeliveryRecord[]> {
    const res = await this.pool.query(
      `SELECT lead_id, sink, status, attempts, next_attempt_at, last_error, created_at, updated_at
       FROM lead_deliveries
       WHERE lead_id = $1
       ORDER BY sink ASC`,
      [leadId]
    );
    return res.rows.map((r: any) => ({
      leadId: r.lead_id,
      sink: r.sink,
      status: r.status,
      attempts: parseInt(r.attempts, 10) || 0,
      nextAttemptAt: new Date(r.next_attempt_at).toISOString(),
      lastError: r.last_error || undefined,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }

  async createSession(sessionId: string, expiresAt: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions (id, expires_at)
       VALUES ($1, $2::timestamptz)
       ON CONFLICT (id) DO UPDATE SET expires_at = $2::timestamptz`,
      [sessionId, expiresAt]
    );
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM sessions WHERE id = $1 AND expires_at > NOW()`,
      [sessionId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
  }

  async deleteLead(id: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM leads WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async cleanupOldLeads(retentionDays: number): Promise<number> {
    const res = await this.pool.query(
      `DELETE FROM leads WHERE created_at < NOW() - ($1 || ' days')::interval`,
      [retentionDays]
    );
    return res.rowCount ?? 0;
  }
}
