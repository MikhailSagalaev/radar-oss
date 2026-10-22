import { describe, expect, it } from 'vitest';
import type { Lead } from '../src/core/types.ts';
import { openStore } from '../src/store/sqlite.ts';
import { TEST_NOW } from './helpers.ts';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    sourceId: 'source-1',
    externalId: 'external-1',
    url: 'https://example.com/1',
    canonicalUrl: 'https://example.com/1',
    title: 'Нужен сантехник в Ставрополе',
    text: 'Прорвало трубу, бюджет 5000 ₽',
    city: 'Ставрополь',
    budget: 5000,
    publishedAt: TEST_NOW.toISOString(),
    fingerprint: 'fingerprint-1',
    titleKey: 'нужен сантехник в ставрополе',
    status: 'new',
    score: 75,
    reasons: [],
    createdAt: TEST_NOW.toISOString(),
    ...overrides,
  };
}

describe('sqlite store', () => {
  it('creates, updates and deletes sources', () => {
    const store = openStore(':memory:');
    const source = store.createSource({
      kind: 'rss',
      title: 'Feed',
      config: { url: 'https://example.com/rss' },
    });
    expect(source.id).toMatch(/^rss_/);
    expect(store.listSources()).toHaveLength(1);

    const updated = store.updateSource(source.id, { enabled: false, title: 'Renamed' });
    expect(updated?.enabled).toBe(false);
    expect(updated?.title).toBe('Renamed');

    expect(store.deleteSource(source.id)).toBe(true);
    expect(store.listSources()).toHaveLength(0);
    store.close();
  });

  it('deduplicates by fingerprint and title key', () => {
    const store = openStore(':memory:');
    const source = store.createSource({ kind: 'rss', title: 'Feed' });
    const lead = makeLead({ sourceId: source.id });

    expect(store.insertLead(lead)).toBe(true);
    expect(store.insertLead({ ...lead, id: 'lead-2' })).toBe(false);
    expect(store.findLeadByFingerprint(lead.fingerprint)?.id).toBe(lead.id);

    const recent = store.findRecentByTitleKey(
      lead.titleKey,
      lead.city,
      new Date(TEST_NOW.getTime() - 24 * 3600 * 1000).toISOString(),
    );
    expect(recent?.id).toBe(lead.id);

    store.close();
  });

  it('lists leads and computes stats', () => {
    const store = openStore(':memory:');
    const source = store.createSource({ kind: 'rss', title: 'Feed' });
    store.insertLead(makeLead({ sourceId: source.id, id: 'lead-new' }));
    store.insertLead(
      makeLead({
        sourceId: source.id,
        id: 'lead-rejected',
        externalId: 'external-2',
        fingerprint: 'fingerprint-2',
        titleKey: 'накрутка отзывов',
        status: 'rejected',
      }),
    );

    expect(store.listLeads({ status: 'new' })).toHaveLength(1);
    expect(store.listLeads({ status: 'rejected' })).toHaveLength(1);
    const stats = store.getStats();
    expect(stats.sources).toBe(1);
    expect(stats.leads).toBe(2);
    expect(stats.newLeads).toBe(1);
    expect(stats.rejectedLeads).toBe(1);

    store.close();
  });

  it('records runs', () => {
    const store = openStore(':memory:');
    store.recordRun({
      id: 'run-1',
      sourceId: 'source-1',
      startedAt: TEST_NOW.toISOString(),
      finishedAt: TEST_NOW.toISOString(),
      found: 3,
      inserted: 2,
      duplicates: 1,
      rejected: 0,
      delivered: 2,
    });
    expect(store.listRuns()).toHaveLength(1);
    expect(store.listRuns()[0]?.found).toBe(3);
    store.close();
  });

  it('filters leads by a normalized query', () => {
    const store = openStore(':memory:');
    const source = store.createSource({ kind: 'rss', title: 'Feed' });
    store.insertLead(makeLead({ sourceId: source.id, id: 'lead-1', title: 'Нужен сантехник' }));
    store.insertLead(
      makeLead({
        sourceId: source.id,
        id: 'lead-2',
        externalId: 'external-2',
        fingerprint: 'fingerprint-2',
        titleKey: 'нужен электрик',
        title: 'Нужен электрик',
      }),
    );

    expect(store.listLeads({ query: 'САНТЕХНИК' })).toHaveLength(1);
    expect(store.listLeads({ query: 'электрик' })[0]?.title).toBe('Нужен электрик');
    store.close();
  });

  it('aggregates source health', () => {
    const store = openStore(':memory:');
    const source = store.createSource({ kind: 'rss', title: 'Health feed' });
    const base = {
      sourceId: source.id,
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      finishedAt: new Date(Date.now() - 60_000).toISOString(),
      found: 3,
      inserted: 2,
      duplicates: 1,
      rejected: 0,
      delivered: 2,
    };
    store.recordRun({ ...base, id: 'run-ok' });
    store.recordRun({
      ...base,
      id: 'run-fail',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      found: 0,
      inserted: 0,
      delivered: 0,
      error: 'timeout',
    });

    const health = store.getSourceHealth();
    expect(health).toHaveLength(1);
    expect(health[0]?.last24h.runs).toBe(2);
    expect(health[0]?.last24h.errors).toBe(1);
    expect(health[0]?.last24h.found).toBe(3);
    expect(health[0]?.successRate).toBe(50);
    expect(health[0]?.lastRun?.error).toBe('timeout');
    expect(store.listRuns(10, source.id)).toHaveLength(2);
    store.close();
  });
});
