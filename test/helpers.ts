import { loadEnv } from '../src/config.ts';
import { createLogger } from '../src/core/logger.ts';
import type { Env, Lead, PollContext, SinkAdapter, SourceRecord } from '../src/core/types.ts';
import { createSourceRegistry, type SourceRegistry } from '../src/sources/index.ts';
import { SinkRegistry } from '../src/sinks/index.ts';
import { openStore, type SqliteStore } from '../src/store/sqlite.ts';

export const TEST_NOW = new Date('2026-10-21T12:00:00.000Z');

export function testEnv(overrides: Partial<Env> = {}): Env {
  return loadEnv({
    RADAR_DB_PATH: ':memory:',
    RADAR_ADMIN_TOKEN: undefined,
    RADAR_CONSOLE_SINK: false,
    RADAR_LOG_LEVEL: 'error',
    TELEGRAM_BOT_TOKEN: undefined,
    TELEGRAM_CHAT_ID: undefined,
    WEBHOOK_URL: undefined,
    WEBHOOK_SECRET: undefined,
    RADAR_LLM_ENABLED: false,
    OPENAI_API_KEY: undefined,
    ...overrides,
  });
}

export function makeSource(overrides: Partial<SourceRecord> = {}): SourceRecord {
  const now = TEST_NOW.toISOString();
  return {
    id: 'source-1',
    kind: 'rss',
    title: 'Test source',
    enabled: true,
    config: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function pollContext(body: string, now: Date = TEST_NOW): PollContext {
  return {
    fetchImpl: async () => new Response(body, { status: 200 }),
    userAgent: 'radar-test',
    timeoutMs: 5_000,
    logger: createLogger('error'),
    now: () => now,
  };
}

export class MemorySink implements SinkAdapter {
  readonly kind = 'memory';
  readonly leads: Lead[] = [];

  async deliver(lead: Lead): Promise<void> {
    this.leads.push(lead);
  }
}

export interface TestRuntime {
  store: SqliteStore;
  env: Env;
  logger: ReturnType<typeof createLogger>;
  sources: SourceRegistry;
  sinks: SinkRegistry;
}

export function makeTestRuntime(overrides: Partial<Env> = {}): TestRuntime {
  return {
    store: openStore(':memory:'),
    env: testEnv(overrides),
    logger: createLogger('error'),
    sources: createSourceRegistry(),
    sinks: new SinkRegistry(),
  };
}
