export * from './core/types.ts';
export * from './core/store.ts';
export { canonicalizeUrl } from './core/url.ts';
export { fingerprintOf, titleKeyOf } from './core/fingerprint.ts';
export { applyRules, scoreLead } from './core/rules.ts';
export { prepareRawLead } from './core/prepare.ts';
export { defineSink, defineSource } from './sdk.ts';
export { VERSION } from './version.ts';

export { createRuntime, type Runtime } from './runtime.ts';
export { openStore, SqliteStore } from './store/sqlite.ts';

export { createSourceRegistry, SourceRegistry } from './sources/index.ts';
export { createSinkRegistry, SinkRegistry } from './sinks/index.ts';

export { ingestRawLead, ingestRawLeads } from './pipeline/ingest.ts';
export { pollAll, pollSource } from './pipeline/poll.ts';
export { createApp } from './server/app.ts';
