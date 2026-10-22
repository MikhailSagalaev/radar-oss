import { Hono } from 'hono';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { escapeHtml } from '../core/text.ts';
import type { LeadStatus, RawLead, SourceConfig, SourceKind } from '../core/types.ts';
import { pollAll, pollSource } from '../pipeline/poll.ts';
import { ingestRawLead, type IngestDeps } from '../pipeline/ingest.ts';
import type { Runtime } from '../runtime.ts';
import { VERSION } from '../version.ts';
import {
  renderDashboard,
  renderNewSourcePage,
  renderNotFound,
  renderSourceCreatedPage,
  renderSourcePage,
  type SourceFormValues,
} from './ui.ts';

function tokenFromRequest(c: Context): string | undefined {
  const authorization = c.req.header('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  const headerToken = c.req.header('x-radar-token');
  if (headerToken) return headerToken;
  const queryToken = c.req.query('token');
  if (queryToken) return queryToken;
  return getCookie(c, 'radar_token');
}

function safeEqual(left: string | undefined, right: string): boolean {
  if (!left) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isAdmin(c: Context, env: Runtime['env']): boolean {
  if (!env.RADAR_ADMIN_TOKEN) return true;
  return safeEqual(tokenFromRequest(c), env.RADAR_ADMIN_TOKEN);
}

function canRead(c: Context, env: Runtime['env']): boolean {
  return env.RADAR_PUBLIC_READ || isAdmin(c, env);
}

function loginPage(error?: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Radar — вход</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#f5f5f4;color:#1c1917;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:24px;width:min(360px,90vw)}
h1{font-size:20px;margin:0 0 6px}p{color:#78716c;font-size:13px;margin:0 0 16px}
input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d6d3d1;border-radius:8px;font:inherit;margin-bottom:12px}
button{width:100%;padding:10px;border:0;border-radius:8px;background:#0f766e;color:#fff;font:inherit;cursor:pointer}
.error{color:#b91c1c;font-size:13px;margin-bottom:10px}</style></head>
<body><form method="post" action="/login">
<h1>Radar</h1><p>Введите админ-токен из RADAR_ADMIN_TOKEN</p>
${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
<input name="token" type="password" autofocus autocomplete="current-password" placeholder="Токен">
<button type="submit">Войти</button>
</form></body></html>`;
}

function deps(runtime: Runtime): IngestDeps {
  return {
    store: runtime.store,
    sinks: runtime.sinks,
    classifier: runtime.classifier,
    logger: runtime.logger,
    env: runtime.env,
    fetchImpl: runtime.fetchImpl,
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function redactSource<T extends { config: Record<string, unknown> }>(source: T): T {
  const config = { ...source.config };
  for (const key of ['token', 'password', 'pass', 'secret']) {
    if (key in config) config[key] = '***';
  }
  return { ...source, config };
}

function formString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseList(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sameOrigin(c: Context): boolean {
  const origin = c.req.header('origin');
  if (!origin) return true;
  const host = c.req.header('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function formValues(body: Record<string, unknown>): SourceFormValues {
  return {
    kind: formString(body, 'kind') || 'rss',
    title: formString(body, 'title'),
    url: formString(body, 'url'),
    channel: formString(body, 'channel'),
    categoryId: formString(body, 'categoryId'),
    city: formString(body, 'city'),
    includeKeywords: formString(body, 'includeKeywords'),
    excludeKeywords: formString(body, 'excludeKeywords'),
    minBudget: formString(body, 'minBudget'),
    limit: formString(body, 'limit'),
    host: formString(body, 'host'),
    port: formString(body, 'port'),
    user: formString(body, 'user'),
    passwordEnv: formString(body, 'passwordEnv'),
    mailbox: formString(body, 'mailbox'),
    sinceDays: formString(body, 'sinceDays'),
    subjectIncludes: formString(body, 'subjectIncludes'),
  };
}

function buildSourceConfig(
  kind: SourceKind,
  body: Record<string, unknown>,
): { config: SourceConfig; error?: string } {
  const config: SourceConfig = {};
  const city = formString(body, 'city');
  if (city) config.city = city;

  const include = parseList(formString(body, 'includeKeywords'));
  if (include.length) config.includeKeywords = include;
  const exclude = parseList(formString(body, 'excludeKeywords'));
  if (exclude.length) config.excludeKeywords = exclude;

  const minBudget = asNumber(formString(body, 'minBudget'));
  if (minBudget !== undefined) config.minBudget = minBudget;
  const limit = asNumber(formString(body, 'limit'));
  if (limit !== undefined) config.limit = limit;

  if (kind === 'rss') {
    const url = formString(body, 'url');
    if (!url) return { config, error: 'Для RSS нужен URL фида.' };
    config.url = url;
  }

  if (kind === 'telegram') {
    const channel = formString(body, 'channel').replace(/^@/, '');
    if (!channel) return { config, error: 'Для Telegram нужен публичный канал.' };
    config.channel = channel;
  }

  if (kind === 'kwork') {
    const categoryId = formString(body, 'categoryId');
    if (categoryId) config.categoryId = categoryId;
  }

  if (kind === 'webhook') {
    config.token = randomBytes(16).toString('hex');
  }

  if (kind === 'imap') {
    const host = formString(body, 'host');
    const user = formString(body, 'user');
    const passwordEnv = formString(body, 'passwordEnv');
    if (!host || !user || !passwordEnv) {
      return {
        config,
        error: 'Для IMAP нужны хост, пользователь и имя переменной с паролем.',
      };
    }
    config.host = host;
    config.user = user;
    config.passwordEnv = passwordEnv;
    const port = asNumber(formString(body, 'port'));
    if (port !== undefined) config.port = port;
    const mailbox = formString(body, 'mailbox');
    if (mailbox) config.mailbox = mailbox;
    const sinceDays = asNumber(formString(body, 'sinceDays'));
    if (sinceDays !== undefined) config.sinceDays = sinceDays;
    const subjectIncludes = parseList(formString(body, 'subjectIncludes'));
    if (subjectIncludes.length) config.subjectIncludes = subjectIncludes;
  }

  return { config };
}

function toRawLead(body: Record<string, unknown>, sourceId: string): RawLead | null {
  const text = asString(body.text);
  const title = asString(body.title);
  if (!text && !title) return null;
  return {
    sourceId,
    externalId: asString(body.externalId),
    url: asString(body.url),
    title: title ?? text ?? '',
    text: text ?? title ?? '',
    author: asString(body.author),
    city: asString(body.city),
    budget: asNumber(body.budget),
    publishedAt: asString(body.publishedAt),
    raw: body,
  };
}

export function createApp(runtime: Runtime): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    runtime.logger.error('http handler failed', {
      error: error instanceof Error ? error.message : String(error),
      path: c.req.path,
    });
    return c.json({ error: 'internal_error' }, 500);
  });

  app.get('/health', (c) =>
    c.json({
      ok: true,
      version: VERSION,
      uptimeSec: Math.round(process.uptime()),
      sources: runtime.store.getStats().sources,
    }),
  );

  app.get('/login', (c) => {
    if (!runtime.env.RADAR_ADMIN_TOKEN) return c.redirect('/');
    if (isAdmin(c, runtime.env)) return c.redirect('/');
    return c.html(loginPage());
  });

  app.post('/login', async (c) => {
    const expected = runtime.env.RADAR_ADMIN_TOKEN;
    if (!expected) return c.redirect('/');
    const body = await c.req.parseBody();
    const token = typeof body.token === 'string' ? body.token : '';
    if (!safeEqual(token, expected)) return c.html(loginPage('Неверный токен'), 401);
    setCookie(c, 'radar_token', token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: c.req.header('x-forwarded-proto') === 'https',
      path: '/',
      maxAge: 30 * 24 * 3600,
    });
    return c.redirect('/');
  });

  app.get('/logout', (c) => {
    deleteCookie(c, 'radar_token', { path: '/' });
    return c.redirect('/login');
  });

  app.get('/', (c) => {
    if (!canRead(c, runtime.env)) return c.redirect('/login');
    return c.html(
      renderDashboard({
        stats: runtime.store.getStats(),
        health: runtime.store.getSourceHealth(),
        leads: runtime.store.listLeads({ limit: 50 }),
        runs: runtime.store.listRuns(8),
        version: VERSION,
      }),
    );
  });

  app.get('/sources/new', (c) => {
    if (!isAdmin(c, runtime.env)) return c.redirect('/login');
    return c.html(
      renderNewSourcePage({
        version: VERSION,
        kinds: runtime.sources.list().map((adapter) => adapter.kind),
        values: formValues({}),
      }),
    );
  });

  app.post('/sources', async (c) => {
    if (!isAdmin(c, runtime.env)) return c.redirect('/login');
    if (!sameOrigin(c)) return c.text('Forbidden', 403);

    const body = (await c.req.parseBody()) as Record<string, unknown>;
    const values = formValues(body);
    const kind = values.kind as SourceKind;

    const fail = (error: string): Response =>
      c.html(
        renderNewSourcePage({
          version: VERSION,
          kinds: runtime.sources.list().map((adapter) => adapter.kind),
          values,
          error,
        }),
        400,
      );

    if (!runtime.sources.get(kind)) return fail('Неизвестный тип источника.');
    if (!values.title) return fail('Название источника обязательно.');

    const built = buildSourceConfig(kind, body);
    if (built.error) return fail(built.error);

    const created = runtime.store.createSource({
      kind,
      title: values.title,
      config: built.config,
    });

    if (kind === 'webhook') {
      return c.html(
        renderSourceCreatedPage({
          version: VERSION,
          source: created,
          token: String(created.config.token ?? ''),
        }),
      );
    }

    return c.redirect(`/sources/${created.id}`);
  });

  app.get('/sources/:id', (c) => {
    if (!canRead(c, runtime.env)) return c.redirect('/login');
    const source = runtime.store.getSource(c.req.param('id'));
    if (!source) return c.html(renderNotFound(VERSION), 404);
    const health = runtime.store
      .getSourceHealth()
      .find((item) => item.source.id === source.id) ?? {
      source,
      last24h: {
        found: 0,
        inserted: 0,
        duplicates: 0,
        rejected: 0,
        delivered: 0,
        errors: 0,
        runs: 0,
      },
      successRate: 0,
    };
    return c.html(
      renderSourcePage({
        source,
        health,
        leads: runtime.store.listLeads({ sourceId: source.id, limit: 20 }),
        runs: runtime.store.listRuns(20, source.id),
        version: VERSION,
      }),
    );
  });

  app.post('/sources/:id/toggle', (c) => {
    if (!isAdmin(c, runtime.env)) return c.redirect('/login');
    if (!sameOrigin(c)) return c.text('Forbidden', 403);
    const source = runtime.store.getSource(c.req.param('id'));
    if (!source) return c.html(renderNotFound(VERSION), 404);
    runtime.store.updateSource(source.id, { enabled: !source.enabled });
    return c.redirect(`/sources/${source.id}`);
  });

  app.post('/sources/:id/delete', (c) => {
    if (!isAdmin(c, runtime.env)) return c.redirect('/login');
    if (!sameOrigin(c)) return c.text('Forbidden', 403);
    const source = runtime.store.getSource(c.req.param('id'));
    if (!source) return c.html(renderNotFound(VERSION), 404);
    runtime.store.deleteSource(source.id);
    return c.redirect('/');
  });

  app.get('/api/sources/health', (c) => {
    if (!canRead(c, runtime.env)) return c.json({ error: 'unauthorized' }, 401);
    return c.json(
      runtime.store.getSourceHealth().map((item) => ({
        ...item,
        source: redactSource(item.source),
      })),
    );
  });

  app.get('/api/stats', (c) => {
    if (!canRead(c, runtime.env)) return c.json({ error: 'unauthorized' }, 401);
    return c.json(runtime.store.getStats());
  });

  app.get('/api/sources', (c) => {
    if (!canRead(c, runtime.env)) return c.json({ error: 'unauthorized' }, 401);
    return c.json(runtime.store.listSources().map(redactSource));
  });

  app.post('/api/sources', async (c) => {
    if (!isAdmin(c, runtime.env)) return c.json({ error: 'unauthorized' }, 401);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'invalid_json' }, 400);

    const kind = asString(body.kind) as SourceKind | undefined;
    if (!kind || !runtime.sources.get(kind)) {
      return c.json({ error: 'unknown_kind', available: runtime.sources.list().map((a) => a.kind) }, 400);
    }
    const title = asString(body.title);
    if (!title) return c.json({ error: 'title_required' }, 400);

    const config =
      body.config && typeof body.config === 'object' && !Array.isArray(body.config)
        ? (body.config as Record<string, unknown>)
        : {};
    const created = runtime.store.createSource({
      kind,
      title,
      config,
      enabled: body.enabled === false ? false : true,
    });
    return c.json(created, 201);
  });

  app.patch('/api/sources/:id', async (c) => {
    if (!isAdmin(c, runtime.env)) return c.json({ error: 'unauthorized' }, 401);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: 'invalid_json' }, 400);
    const updated = runtime.store.updateSource(c.req.param('id'), {
      title: asString(body.title),
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      config:
        body.config && typeof body.config === 'object' && !Array.isArray(body.config)
          ? (body.config as Record<string, unknown>)
          : undefined,
    });
    if (!updated) return c.json({ error: 'not_found' }, 404);
    return c.json(redactSource(updated));
  });

  app.delete('/api/sources/:id', (c) => {
    if (!isAdmin(c, runtime.env)) return c.json({ error: 'unauthorized' }, 401);
    return runtime.store.deleteSource(c.req.param('id'))
      ? c.json({ ok: true })
      : c.json({ error: 'not_found' }, 404);
  });

  app.get('/api/leads', (c) => {
    if (!canRead(c, runtime.env)) return c.json({ error: 'unauthorized' }, 401);
    const limit = Math.max(1, Math.min(Number(c.req.query('limit') ?? 50) || 50, 500));
    const status = c.req.query('status') as LeadStatus | undefined;
    const sourceId = c.req.query('source') || undefined;
    return c.json(runtime.store.listLeads({ limit, status, sourceId }));
  });

  app.get('/api/runs', (c) => {
    if (!canRead(c, runtime.env)) return c.json({ error: 'unauthorized' }, 401);
    return c.json(runtime.store.listRuns(Number(c.req.query('limit') ?? 20) || 20));
  });

  app.post('/api/poll', async (c) => {
    if (!isAdmin(c, runtime.env)) return c.json({ error: 'unauthorized' }, 401);
    const summaries = await pollAll({
      ...deps(runtime),
      sources: runtime.sources,
    });
    return c.json({ summaries });
  });

  app.post('/api/sources/:id/poll', async (c) => {
    if (!isAdmin(c, runtime.env)) return c.json({ error: 'unauthorized' }, 401);
    const source = runtime.store.getSource(c.req.param('id'));
    if (!source) return c.json({ error: 'not_found' }, 404);
    const summary = await pollSource(source, {
      ...deps(runtime),
      sources: runtime.sources,
    });
    return c.json(summary);
  });

  app.post('/api/ingest/:sourceId', async (c) => {
    const source = runtime.store.getSource(c.req.param('sourceId'));
    if (!source) return c.json({ error: 'not_found' }, 404);

    const sourceToken =
      typeof source.config.token === 'string' ? source.config.token : undefined;
    const provided = c.req.header('x-radar-token');
    const allowed =
      isAdmin(c, runtime.env) || Boolean(sourceToken && safeEqual(provided, sourceToken));
    if (!allowed) return c.json({ error: 'unauthorized' }, 401);

    const body = (await c.req.json().catch(() => null)) as
      | Record<string, unknown>
      | Array<Record<string, unknown>>
      | null;
    if (!body) return c.json({ error: 'invalid_json' }, 400);

    const items = Array.isArray(body)
      ? body
      : Array.isArray((body as Record<string, unknown>).items)
        ? ((body as Record<string, unknown>).items as Array<Record<string, unknown>>)
        : [body as Record<string, unknown>];

    if (items.length === 0) return c.json({ error: 'no_items' }, 400);
    if (items.length > 100) return c.json({ error: 'too_many_items' }, 400);

    const outcomes = [];
    for (const item of items) {
      const raw = toRawLead(item, source.id);
      if (!raw) {
        outcomes.push({ status: 'rejected', reasons: ['missing_text'] });
        continue;
      }
      outcomes.push(await ingestRawLead(raw, source, deps(runtime)));
    }
    return c.json({ sourceId: source.id, accepted: outcomes.length, outcomes });
  });

  return app;
}
