import { describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.ts';
import type { Runtime } from '../src/runtime.ts';
import { makeTestRuntime } from './helpers.ts';

function makeRuntime(): Runtime {
  const base = makeTestRuntime({ RADAR_ADMIN_TOKEN: 'secret' });
  return {
    env: base.env,
    logger: base.logger,
    store: base.store,
    sources: base.sources,
    sinks: base.sinks,
    fetchImpl: fetch,
  };
}

function makeOpenRuntime(): Runtime {
  const base = makeTestRuntime();
  return {
    env: base.env,
    logger: base.logger,
    store: base.store,
    sources: base.sources,
    sinks: base.sinks,
    fetchImpl: fetch,
  };
}

function formBody(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}

describe('http server', () => {
  it('exposes health without auth', async () => {
    const runtime = makeRuntime();
    const app = createApp(runtime);
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    runtime.store.close();
  });

  it('protects the api when an admin token is configured', async () => {
    const runtime = makeRuntime();
    const app = createApp(runtime);

    const unauthorized = await app.request('/api/sources');
    expect(unauthorized.status).toBe(401);

    const authorized = await app.request('/api/sources', {
      headers: { authorization: 'Bearer secret' },
    });
    expect(authorized.status).toBe(200);
    runtime.store.close();
  });

  it('redacts source tokens in read APIs', async () => {
    const runtime = makeRuntime();
    runtime.store.createSource({
      kind: 'webhook',
      title: 'Secret source',
      config: { token: 'super-secret' },
    });
    const app = createApp(runtime);

    const response = await app.request('/api/sources', {
      headers: { authorization: 'Bearer secret' },
    });
    const sources = (await response.json()) as Array<{ config: { token?: string } }>;
    expect(sources[0]?.config.token).toBe('***');
    runtime.store.close();
  });

  it('serves source health and a source page', async () => {
    const runtime = makeRuntime();
    const source = runtime.store.createSource({ kind: 'rss', title: 'Health feed' });
    runtime.store.recordRun({
      id: 'run-1',
      sourceId: source.id,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      found: 2,
      inserted: 1,
      duplicates: 1,
      rejected: 0,
      delivered: 1,
    });
    const app = createApp(runtime);

    const api = await app.request('/api/sources/health', {
      headers: { authorization: 'Bearer secret' },
    });
    expect(api.status).toBe(200);
    const health = (await api.json()) as Array<{ source: { id: string }; successRate: number }>;
    expect(health[0]?.source.id).toBe(source.id);
    expect(health[0]?.successRate).toBe(100);

    const page = await app.request(`/sources/${source.id}`, {
      headers: { authorization: 'Bearer secret' },
    });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Health feed');
    runtime.store.close();
  });

  it('accepts a webhook lead and stores it', async () => {
    const runtime = makeRuntime();
    const source = runtime.store.createSource({
      kind: 'webhook',
      title: 'Inbound',
      config: { token: 'hook-secret' },
    });
    const app = createApp(runtime);

    const response = await app.request(`/api/ingest/${source.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-radar-token': 'hook-secret',
      },
      body: JSON.stringify({
        title: 'Нужен сантехник',
        text: 'Прорвало трубу, Ставрополь, бюджет 5000 ₽',
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      outcomes: Array<{ status: string }>;
    };
    expect(body.outcomes).toHaveLength(1);
    expect(body.outcomes[0]?.status).toBe('inserted');

    const leads = await app.request('/api/leads', {
      headers: { authorization: 'Bearer secret' },
    });
    const list = (await leads.json()) as Array<{ title: string }>;
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toContain('сантехник');
    runtime.store.close();
  });

  it('creates a source from the dashboard form', async () => {
    const runtime = makeOpenRuntime();
    const app = createApp(runtime);

    const page = await app.request('/sources/new');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Новый источник');

    const response = await app.request('/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody({
        kind: 'rss',
        title: 'UI feed',
        url: 'https://example.com/rss',
        includeKeywords: 'сантехник, электрик',
        city: 'Ставрополь',
      }),
    });

    expect(response.status).toBe(302);
    const sources = runtime.store.listSources();
    expect(sources).toHaveLength(1);
    expect(sources[0]?.title).toBe('UI feed');
    expect(sources[0]?.config.includeKeywords).toEqual(['сантехник', 'электрик']);
    expect(response.headers.get('location')).toBe(`/sources/${sources[0]?.id}`);
    runtime.store.close();
  });

  it('shows a webhook token once after creation', async () => {
    const runtime = makeOpenRuntime();
    const app = createApp(runtime);

    const response = await app.request('/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: formBody({ kind: 'webhook', title: 'Browser' }),
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Токен');
    const sources = runtime.store.listSources();
    expect(sources[0]?.config.token).toMatch(/^[a-f0-9]{32}$/);
    runtime.store.close();
  });

  it('rejects cross-origin form posts', async () => {
    const runtime = makeOpenRuntime();
    const app = createApp(runtime);

    const response = await app.request('/sources', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://evil.example',
      },
      body: formBody({ kind: 'rss', title: 'Evil', url: 'https://example.com/rss' }),
    });

    expect(response.status).toBe(403);
    expect(runtime.store.listSources()).toHaveLength(0);
    runtime.store.close();
  });

  it('toggles and deletes a source from the dashboard', async () => {
    const runtime = makeOpenRuntime();
    const source = runtime.store.createSource({ kind: 'rss', title: 'Toggle me' });
    const app = createApp(runtime);

    const toggle = await app.request(`/sources/${source.id}/toggle`, { method: 'POST' });
    expect(toggle.status).toBe(302);
    expect(runtime.store.getSource(source.id)?.enabled).toBe(false);

    const remove = await app.request(`/sources/${source.id}/delete`, { method: 'POST' });
    expect(remove.status).toBe(302);
    expect(runtime.store.getSource(source.id)).toBeNull();
    runtime.store.close();
  });
});
