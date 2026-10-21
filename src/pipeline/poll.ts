import { randomUUID } from 'node:crypto';
import type { PollContext, SourceRecord } from '../core/types.ts';
import type { SourceRegistry } from '../sources/index.ts';
import { type IngestDeps, ingestRawLeads } from './ingest.ts';

export interface PollDeps extends IngestDeps {
  sources: SourceRegistry;
}

export interface PollSummary {
  sourceId: string;
  sourceTitle: string;
  found: number;
  inserted: number;
  duplicates: number;
  rejected: number;
  delivered: number;
  failed: number;
  durationMs: number;
  error?: string;
}

export async function pollSource(
  source: SourceRecord,
  deps: PollDeps,
): Promise<PollSummary> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const logger = deps.logger.child(`source:${source.id}`);
  const empty: PollSummary = {
    sourceId: source.id,
    sourceTitle: source.title,
    found: 0,
    inserted: 0,
    duplicates: 0,
    rejected: 0,
    delivered: 0,
    failed: 0,
    durationMs: 0,
  };

  const adapter = deps.sources.get(source.kind);
  if (!adapter) {
    const error = `No adapter registered for kind "${source.kind}"`;
    deps.store.recordRun({
      id: randomUUID(),
      sourceId: source.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      found: 0,
      inserted: 0,
      duplicates: 0,
      rejected: 0,
      delivered: 0,
      error,
    });
    return { ...empty, durationMs: Date.now() - startedMs, error };
  }

  if (!adapter.poll) {
    const error = `Source "${source.id}" is not pollable; POST to /api/ingest/${source.id}`;
    deps.store.recordRun({
      id: randomUUID(),
      sourceId: source.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      found: 0,
      inserted: 0,
      duplicates: 0,
      rejected: 0,
      delivered: 0,
      error,
    });
    return { ...empty, durationMs: Date.now() - startedMs, error };
  }

  const ctx: PollContext = {
    fetchImpl: deps.fetchImpl ?? fetch,
    userAgent: deps.env.RADAR_USER_AGENT,
    timeoutMs: deps.env.RADAR_HTTP_TIMEOUT_MS,
    logger,
    now: deps.now ?? (() => new Date()),
  };

  try {
    const raws = await adapter.poll(source, ctx);
    const summary = await ingestRawLeads(raws, source, deps);
    const result: PollSummary = {
      sourceId: source.id,
      sourceTitle: source.title,
      found: summary.found,
      inserted: summary.inserted,
      duplicates: summary.duplicates,
      rejected: summary.rejected,
      delivered: summary.delivered,
      failed: summary.failed,
      durationMs: Date.now() - startedMs,
    };

    deps.store.recordRun({
      id: randomUUID(),
      sourceId: source.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      found: result.found,
      inserted: result.inserted,
      duplicates: result.duplicates,
      rejected: result.rejected,
      delivered: result.delivered,
    });

    logger.info('poll finished', result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('poll failed', { error: message });
    deps.store.recordRun({
      id: randomUUID(),
      sourceId: source.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      found: 0,
      inserted: 0,
      duplicates: 0,
      rejected: 0,
      delivered: 0,
      error: message,
    });
    return { ...empty, durationMs: Date.now() - startedMs, error: message };
  }
}

export async function pollAll(deps: PollDeps): Promise<PollSummary[]> {
  const sources = deps.store.listSources().filter((source) => source.enabled);
  const summaries: PollSummary[] = [];
  for (const source of sources) {
    const adapter = deps.sources.get(source.kind);
    if (!adapter?.poll) continue;
    summaries.push(await pollSource(source, deps));
  }
  return summaries;
}
