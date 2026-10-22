import { createClassifier } from './classifier/openai.ts';
import { loadEnv } from './config.ts';
import { createLogger } from './core/logger.ts';
import type { Classifier, Env, Logger } from './core/types.ts';
import type { Store } from './core/store.ts';
import { createSinkRegistry, type SinkRegistry } from './sinks/index.ts';
import { createSourceRegistry, type SourceRegistry } from './sources/index.ts';
import { openStore as openSqliteStore } from './store/sqlite.ts';
import { PostgresStore } from './store/postgres.ts';

export interface Runtime {
  env: Env;
  logger: Logger;
  store: Store;
  sources: SourceRegistry;
  sinks: SinkRegistry;
  classifier?: Classifier;
  fetchImpl: typeof fetch;
}

export interface RuntimeOverrides {
  store?: Store;
  fetchImpl?: typeof fetch;
}

export function createRuntime(env: Env = loadEnv(), overrides: RuntimeOverrides = {}): Runtime {
  const logger = createLogger(env.RADAR_LOG_LEVEL);
  let store: Store;
  if (overrides.store) {
    store = overrides.store;
  } else if (env.DATABASE_URL) {
    logger.info('Using PostgreSQL storage engine', { url: env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') });
    const pgStore = new PostgresStore(env.DATABASE_URL);
    // Инициализируем схему синхронно/асинхронно при старте
    pgStore.init().catch(err => {
      logger.error('Failed to initialize PostgreSQL schema', { error: err.message });
    });
    store = pgStore;
  } else {
    store = openSqliteStore(env.RADAR_DB_PATH);
  }
  const sources = createSourceRegistry();
  const sinks = createSinkRegistry(env);
  const classifier = createClassifier(env, logger);

  return {
    env,
    logger,
    store,
    sources,
    sinks,
    classifier,
    fetchImpl: overrides.fetchImpl ?? fetch,
  };
}
