import { createClassifier } from './classifier/openai.ts';
import { loadEnv } from './config.ts';
import { createLogger } from './core/logger.ts';
import type { Classifier, Env, Logger } from './core/types.ts';
import type { Store } from './core/store.ts';
import { createSinkRegistry, type SinkRegistry } from './sinks/index.ts';
import { createSourceRegistry, type SourceRegistry } from './sources/index.ts';
import { openStore } from './store/sqlite.ts';

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
  const store = overrides.store ?? openStore(env.RADAR_DB_PATH);
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
