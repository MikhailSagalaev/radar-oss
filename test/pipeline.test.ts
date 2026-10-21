import { describe, expect, it } from 'vitest';
import type { Classifier } from '../src/core/types.ts';
import { ingestRawLead, type IngestDeps } from '../src/pipeline/ingest.ts';
import { makeTestRuntime, MemorySink, TEST_NOW } from './helpers.ts';

describe('ingest pipeline', () => {
  it('creates and delivers a relevant lead', async () => {
    const runtime = makeTestRuntime();
    const sink = new MemorySink();
    runtime.sinks.register(sink);
    const source = runtime.store.createSource({
      kind: 'rss',
      title: 'Feed',
      config: { includeKeywords: ['сантехник'] },
    });

    const outcome = await ingestRawLead(
      {
        sourceId: source.id,
        url: 'https://example.com/1?utm_source=rss',
        title: 'Нужен сантехник',
        text: 'Прорвало трубу, Ставрополь, бюджет 5000 ₽',
      },
      source,
      {
        store: runtime.store,
        sinks: runtime.sinks,
        logger: runtime.logger,
        env: runtime.env,
        now: () => TEST_NOW,
      },
    );

    expect(outcome.status).toBe('delivered');
    expect(sink.leads).toHaveLength(1);
    expect(runtime.store.getStats().deliveredLeads).toBe(1);
    runtime.store.close();
  });

  it('deduplicates the same lead twice', async () => {
    const runtime = makeTestRuntime();
    const sink = new MemorySink();
    runtime.sinks.register(sink);
    const source = runtime.store.createSource({
      kind: 'rss',
      title: 'Feed',
      config: { includeKeywords: ['сантехник'] },
    });
    const baseDeps: IngestDeps = {
      store: runtime.store,
      sinks: runtime.sinks,
      logger: runtime.logger,
      env: runtime.env,
      now: () => TEST_NOW,
    };
    const raw = {
      sourceId: source.id,
      url: 'https://example.com/1',
      title: 'Нужен сантехник',
      text: 'Прорвало трубу, Ставрополь, бюджет 5000 ₽',
    };

    expect((await ingestRawLead(raw, source, baseDeps)).status).toBe('delivered');
    expect((await ingestRawLead(raw, source, baseDeps)).status).toBe('duplicate');
    expect(sink.leads).toHaveLength(1);
    runtime.store.close();
  });

  it('deduplicates the same title from a different URL', async () => {
    const runtime = makeTestRuntime();
    const sink = new MemorySink();
    runtime.sinks.register(sink);
    const source = runtime.store.createSource({
      kind: 'rss',
      title: 'Feed',
      config: { includeKeywords: ['сантехник'] },
    });
    const baseDeps: IngestDeps = {
      store: runtime.store,
      sinks: runtime.sinks,
      logger: runtime.logger,
      env: runtime.env,
      now: () => TEST_NOW,
    };

    await ingestRawLead(
      {
        sourceId: source.id,
        url: 'https://example.com/1',
        title: 'Нужен сантехник',
        text: 'Прорвало трубу, Ставрополь, бюджет 5000 ₽',
      },
      source,
      baseDeps,
    );
    const second = await ingestRawLead(
      {
        sourceId: source.id,
        url: 'https://other.example.com/2',
        title: 'Нужен сантехник',
        text: 'Прорвало трубу, Ставрополь, бюджет 5000 ₽',
      },
      source,
      baseDeps,
    );

    expect(second.status).toBe('duplicate');
    expect(sink.leads).toHaveLength(1);
    runtime.store.close();
  });

  it('rejects spam and never delivers it', async () => {
    const runtime = makeTestRuntime();
    const sink = new MemorySink();
    runtime.sinks.register(sink);
    const source = runtime.store.createSource({ kind: 'rss', title: 'Feed' });

    const outcome = await ingestRawLead(
      {
        sourceId: source.id,
        title: 'Накрутка отзывов',
        text: 'Нужна накрутка отзывов на Авито, напишем 5 звезд за деньги',
      },
      source,
      {
        store: runtime.store,
        sinks: runtime.sinks,
        logger: runtime.logger,
        env: runtime.env,
        now: () => TEST_NOW,
      },
    );

    expect(outcome.status).toBe('rejected');
    expect(outcome.reasons).toContain('spam:FAKE_REVIEWS');
    expect(sink.leads).toHaveLength(0);
    runtime.store.close();
  });

  it('rejects a lead when the classifier says it is not an order', async () => {
    const runtime = makeTestRuntime();
    const sink = new MemorySink();
    runtime.sinks.register(sink);
    const source = runtime.store.createSource({ kind: 'rss', title: 'Feed' });
    const classifier: Classifier = {
      async classify() {
        return { isLead: false, confidence: 0.9 };
      },
    };

    const outcome = await ingestRawLead(
      {
        sourceId: source.id,
        title: 'Нужен сантехник',
        text: 'Прорвало трубу, Ставрополь, бюджет 5000 ₽',
      },
      source,
      {
        store: runtime.store,
        sinks: runtime.sinks,
        classifier,
        logger: runtime.logger,
        env: runtime.env,
        now: () => TEST_NOW,
      },
    );

    expect(outcome.status).toBe('rejected');
    expect(sink.leads).toHaveLength(0);
    runtime.store.close();
  });

  it('continues with rules when the classifier is unavailable', async () => {
    const runtime = makeTestRuntime();
    const sink = new MemorySink();
    runtime.sinks.register(sink);
    const source = runtime.store.createSource({ kind: 'rss', title: 'Feed' });
    const classifier: Classifier = {
      async classify() {
        throw new Error('offline');
      },
    };

    const outcome = await ingestRawLead(
      {
        sourceId: source.id,
        title: 'Нужен сантехник',
        text: 'Прорвало трубу, Ставрополь, бюджет 5000 ₽',
      },
      source,
      {
        store: runtime.store,
        sinks: runtime.sinks,
        classifier,
        logger: runtime.logger,
        env: runtime.env,
        now: () => TEST_NOW,
      },
    );

    expect(outcome.status).toBe('delivered');
    expect(sink.leads).toHaveLength(1);
    runtime.store.close();
  });
});
