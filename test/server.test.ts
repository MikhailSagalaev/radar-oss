import { describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.ts';
import type { Runtime } from '../src/runtime.ts';
import { loadEnv } from '../src/config.ts';
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

function formBody(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}

describe('http server', () => {
  it('fails fast in production when RADAR_ADMIN_TOKEN is missing or weak', () => {
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => loadEnv({ NODE_ENV: 'production', RADAR_ADMIN_TOKEN: undefined })).toThrow(
        /RADAR_ADMIN_TOKEN is missing/,
      );
      expect(() => loadEnv({ NODE_ENV: 'production', RADAR_ADMIN_TOKEN: 'change-me' })).toThrow(
        /RADAR_ADMIN_TOKEN is missing/,
      );
      expect(() => loadEnv({ NODE_ENV: 'production', RADAR_ADMIN_TOKEN: 'too-short' })).toThrow(
        /shorter than 32 characters/,
      );
      expect(() =>
        loadEnv({
          NODE_ENV: 'production',
          RADAR_ADMIN_TOKEN: '012345678901234567890123456789012',
        }),
      ).not.toThrow();
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('rejects unauthenticated requests to protected endpoints with 401 or redirect', async () => {
    const runtime = makeRuntime();
    const app = createApp(runtime);

    const apiLeads = await app.request('/api/leads');
    expect(apiLeads.status).toBe(401);

    const webSources = await app.request('/sources');
    expect(webSources.status).toBe(302);
    expect(webSources.headers.get('location')).toBe('/login');

    await runtime.store.close();
  });

  it('exposes health without auth', async () => {
    const runtime = makeRuntime();
    const app = createApp(runtime);
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    await runtime.store.close();
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
    await runtime.store.close();
  });

  it('redacts source tokens in read APIs', async () => {
    const runtime = makeRuntime();
    await runtime.store.createSource({
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
    await runtime.store.close();
  });

  it('serves source health and a source page', async () => {
    const runtime = makeRuntime();
    const source = await runtime.store.createSource({ kind: 'rss', title: 'Health feed' });
    await runtime.store.recordRun({
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
    await runtime.store.close();
  });

  it('accepts a webhook lead and stores it', async () => {
    const runtime = makeRuntime();
    const source = await runtime.store.createSource({
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
    await runtime.store.close();
  });

  async function makeAdminSession(runtime: Runtime): Promise<string> {
    const sessionId = 'test-session-123';
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    await runtime.store.createSession?.(sessionId, expiresAt);
    return sessionId;
  }

  it('creates a source from the dashboard form', async () => {
    const runtime = makeRuntime();
    const sessionId = await makeAdminSession(runtime);
    const app = createApp(runtime);

    const page = await app.request('/sources/new', {
      headers: { cookie: `radar_session=${sessionId}` },
    });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Новый источник');

    const response = await app.request('/sources', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `radar_session=${sessionId}`,
        origin: 'http://localhost',
      },
      body: formBody({
        kind: 'rss',
        title: 'UI feed',
        url: 'https://example.com/rss',
        includeKeywords: 'сантехник, электрик',
        city: 'Ставрополь',
      }),
    });

    expect(response.status).toBe(302);
    const sources = await runtime.store.listSources();
    expect(sources).toHaveLength(1);
    expect(sources[0]?.title).toBe('UI feed');
    expect(sources[0]?.config.includeKeywords).toEqual(['сантехник', 'электрик']);
    expect(response.headers.get('location')).toBe(`/sources/${sources[0]?.id}?created=1`);
    await runtime.store.close();
  });

  it('shows a webhook token once after creation', async () => {
    const runtime = makeRuntime();
    const sessionId = await makeAdminSession(runtime);
    const app = createApp(runtime);

    const response = await app.request('/sources', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `radar_session=${sessionId}`,
        origin: 'http://localhost',
      },
      body: formBody({ kind: 'webhook', title: 'Browser' }),
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Токен');
    const sources = await runtime.store.listSources();
    expect(sources[0]?.config.token).toMatch(/^[a-f0-9]{32}$/);
    await runtime.store.close();
  });

  it('sets a secure cookie behind an https proxy', async () => {
    const runtime = makeRuntime();
    const app = createApp(runtime);

    const response = await app.request('/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-forwarded-proto': 'https',
        origin: 'https://localhost',
      },
      body: formBody({ token: 'secret' }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(response.headers.get('set-cookie')).toContain('radar_session=');
    await runtime.store.close();
  });

  it('rejects cross-origin form posts', async () => {
    const runtime = makeRuntime();
    const sessionId = await makeAdminSession(runtime);
    const app = createApp(runtime);

    const response = await app.request('/sources', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `radar_session=${sessionId}`,
        origin: 'https://evil.example',
      },
      body: formBody({ kind: 'rss', title: 'Evil', url: 'https://example.com/rss' }),
    });

    expect(response.status).toBe(403);
    expect(await runtime.store.listSources()).toHaveLength(0);
    await runtime.store.close();
  });

  it('ignores ?token= query parameter for security', async () => {
    const runtime = makeRuntime();
    const app = createApp(runtime);

    const res = await app.request('/api/leads?token=secret');
    expect(res.status).toBe(401);

    const webRes = await app.request('/?token=secret');
    expect(webRes.status).toBe(302);
    expect(webRes.headers.get('location')).toBe('/login');

    await runtime.store.close();
  });

  it('serves the leads and sources pages', async () => {
    const runtime = makeRuntime();
    const sessionId = await makeAdminSession(runtime);
    const app = createApp(runtime);

    const leads = await app.request('/', {
      headers: { cookie: `radar_session=${sessionId}` },
    });
    expect(leads.status).toBe(200);
    expect(await leads.text()).toContain('Radar');

    const sources = await app.request('/sources', {
      headers: { cookie: `radar_session=${sessionId}` },
    });
    expect(sources.status).toBe(200);
    expect(await sources.text()).toContain('Источники');
    await runtime.store.close();
  });

  it('serves a lead detail page', async () => {
    const runtime = makeRuntime();
    const sessionId = await makeAdminSession(runtime);
    const source = await runtime.store.createSource({
      kind: 'webhook',
      title: 'Inbound',
      config: { token: 'hook-secret' },
    });
    const app = createApp(runtime);

    const ingest = await app.request(`/api/ingest/${source.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-radar-token': 'hook-secret' },
      body: JSON.stringify({
        title: 'Нужен сантехник',
        text: 'Прорвало трубу, Ставрополь, бюджет 5000 ₽',
      }),
    });
    const result = (await ingest.json()) as {
      outcomes: Array<{ lead?: { id: string } }>;
    };
    const leadId = result.outcomes[0]?.lead?.id;
    expect(leadId).toBeTruthy();

    const page = await app.request(`/leads/${leadId}`, {
      headers: { cookie: `radar_session=${sessionId}` },
    });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Прорвало трубу');
    await runtime.store.close();
  });

  it('edits a source and keeps a webhook token', async () => {
    const runtime = makeRuntime();
    const sessionId = await makeAdminSession(runtime);
    const source = await runtime.store.createSource({
      kind: 'webhook',
      title: 'Old title',
      config: { token: 'keep-me' },
    });
    const app = createApp(runtime);

    const form = await app.request(`/sources/${source.id}/edit`, {
      headers: { cookie: `radar_session=${sessionId}` },
    });
    expect(form.status).toBe(200);
    expect(await form.text()).toContain('Редактировать источник');

    const response = await app.request(`/sources/${source.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `radar_session=${sessionId}`,
        origin: 'http://localhost',
      },
      body: formBody({ title: 'New title', city: 'Ставрополь' }),
    });
    expect(response.status).toBe(302);
    const updated = await runtime.store.getSource(source.id);
    expect(updated?.title).toBe('New title');
    expect(updated?.config.token).toBe('keep-me');
    expect(updated?.config.city).toBe('Ставрополь');
    await runtime.store.close();
  });

  it('toggles and deletes a source from the dashboard', async () => {
    const runtime = makeRuntime();
    const sessionId = await makeAdminSession(runtime);
    const source = await runtime.store.createSource({ kind: 'rss', title: 'Toggle me' });
    const app = createApp(runtime);

    const toggle = await app.request(`/sources/${source.id}/toggle`, {
      method: 'POST',
      headers: {
        cookie: `radar_session=${sessionId}`,
        origin: 'http://localhost',
      },
    });
    expect(toggle.status).toBe(302);
    expect((await runtime.store.getSource(source.id))?.enabled).toBe(false);

    const remove = await app.request(`/sources/${source.id}/delete`, {
      method: 'POST',
      headers: {
        cookie: `radar_session=${sessionId}`,
        origin: 'http://localhost',
      },
    });
    expect(remove.status).toBe(302);
    expect(await runtime.store.getSource(source.id)).toBeNull();
    await runtime.store.close();
  });

  it('supports GDPR erasure with DELETE /api/leads/:id', async () => {
    const runtime = makeRuntime();
    const app = createApp(runtime);
    const source = await runtime.store.createSource({ kind: 'rss', title: 'Feed' });
    const now = new Date().toISOString();
    const leadId = 'lead-gdpr-1';
    await runtime.store.insertLead({
      id: leadId,
      sourceId: source.id,
      externalId: 'ext-gdpr-1',
      title: 'Удалить меня',
      titleKey: 'удалить меня',
      text: 'Персональные данные Иванова Ивана',
      fingerprint: 'fp-gdpr-1',
      status: 'new',
      score: 50,
      reasons: [],
      createdAt: now,
    });

    const notFound = await app.request('/api/leads/non-existent-id', {
      method: 'DELETE',
      headers: { authorization: 'Bearer secret', origin: 'http://localhost' },
    });
    expect(notFound.status).toBe(404);

    const deleted = await app.request(`/api/leads/${leadId}`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer secret', origin: 'http://localhost' },
    });
    expect(deleted.status).toBe(200);
    expect(await runtime.store.getLead(leadId)).toBeNull();
    await runtime.store.close();
  });

  it('updates lead funnel status and applies score feedback', async () => {
    const runtime = makeRuntime();
    const sessionId = await makeAdminSession(runtime);
    const source = await runtime.store.createSource({ kind: 'rss', title: 'Feed' });
    const now = new Date().toISOString();
    const leadId = 'lead-funnel-1';
    await runtime.store.insertLead({
      id: leadId,
      sourceId: source.id,
      title: 'Разработка на Svelte',
      titleKey: 'разработка на svelte',
      text: 'Нужно сделать компонент',
      fingerprint: 'fp-funnel-1',
      status: 'new',
      score: 50,
      reasons: [],
      createdAt: now,
    });

    const app = createApp(runtime);

    // 1. Change funnel status to "interesting"
    const statusRes = await app.request(`/leads/${leadId}/status`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `radar_session=${sessionId}`,
        origin: 'http://localhost',
      },
      body: formBody({ status: 'interesting' }),
    });
    expect(statusRes.status).toBe(302);
    expect((await runtime.store.getLead(leadId))?.status).toBe('interesting');

    // 2. Feedback "+10 Подходит"
    const feedbackUp = await app.request(`/leads/${leadId}/feedback`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `radar_session=${sessionId}`,
        origin: 'http://localhost',
      },
      body: formBody({ feedback: 'up' }),
    });
    expect(feedbackUp.status).toBe(302);
    expect((await runtime.store.getLead(leadId))?.score).toBe(60);

    // 3. API status patch
    const patchRes = await app.request(`/api/leads/${leadId}/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer secret',
        origin: 'http://localhost',
      },
      body: JSON.stringify({ status: 'applied' }),
    });
    expect(patchRes.status).toBe(200);
    expect((await runtime.store.getLead(leadId))?.status).toBe('applied');

    await runtime.store.close();
  });

  it('prevents stored XSS by sanitizing javascript: links', async () => {
    const runtime = makeRuntime();
    const sessionId = await makeAdminSession(runtime);
    const source = await runtime.store.createSource({
      kind: 'webhook',
      title: 'Hook',
      config: { token: 'hook-secret' },
    });
    const app = createApp(runtime);

    const ingest = await app.request(`/api/ingest/${source.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-radar-token': 'hook-secret' },
      body: JSON.stringify({
        title: 'XSS Test',
        text: 'Order description',
        url: 'javascript:alert(document.cookie)',
      }),
    });
    const result = (await ingest.json()) as { outcomes: Array<{ lead?: { id: string } }> };
    const leadId = result.outcomes[0]?.lead?.id;
    expect(leadId).toBeTruthy();

    const lead = await runtime.store.getLead(leadId!);
    expect(lead?.url).toBeUndefined();

    const page = await app.request(`/leads/${leadId}`, {
      headers: { cookie: `radar_session=${sessionId}` },
    });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).not.toContain('javascript:alert');

    await runtime.store.close();
  });
});
