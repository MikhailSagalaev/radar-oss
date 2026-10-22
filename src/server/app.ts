import { Hono } from 'hono';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { escapeHtml } from '../core/text.ts';
import type { LeadStatus, RawLead, SourceConfig, SourceKind, SourceRecord } from '../core/types.ts';
import { pollAll, pollSource } from '../pipeline/poll.ts';
import { ingestRawLead, type IngestDeps } from '../pipeline/ingest.ts';
import type { Runtime } from '../runtime.ts';
import { SOURCE_PRESETS } from '../sources/presets.ts';
import { VERSION } from '../version.ts';
import {
  renderExtensionPage,
  renderLeadPage,
  renderLeadsPage,
  renderNewSourcePage,
  renderNotFound,
  renderSourceCreatedPage,
  renderSourcePage,
  renderSourcesPage,
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
<style>
:root{--bg:#ffffff;--surface:#ffffff;--ink:#09090b;--muted:#71717a;--line:#e4e4e7;--btn:#09090b;--btn-text:#ffffff;--error:#ef4444}
@media (prefers-color-scheme: dark){:root{--bg:#09090b;--surface:#121215;--ink:#f4f4f5;--muted:#a1a1aa;--line:#27272a;--btn:#f4f4f5;--btn-text:#09090b;--error:#f87171}}
body{font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;letter-spacing:-0.01em;background:var(--bg);color:var(--ink);display:grid;place-items:center;min-height:100vh;margin:0}
form{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:28px 24px;width:min(360px,90vw);box-shadow:0 4px 20px rgba(0,0,0,0.04)}
h1{font-size:22px;letter-spacing:-0.03em;margin:0 0 6px;font-weight:600}p{color:var(--muted);font-size:13px;margin:0 0 20px}
input{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid var(--line);border-radius:6px;font:inherit;font-size:13px;background:var(--bg);color:var(--ink);margin-bottom:14px;transition:all .15s ease}
input:focus{outline:0;border-color:var(--ink);box-shadow:0 0 0 1px var(--ink),0 1px 2px rgba(0,0,0,.04)}
button{width:100%;padding:9px;border:0;border-radius:6px;background:var(--btn);color:var(--btn-text);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:opacity .15s ease,transform .1s ease}
button:hover{opacity:0.9}button:active{transform:scale(0.98)}
.error{color:var(--error);font-size:12.5px;font-weight:500;margin-bottom:12px;background:rgba(239,68,68,0.08);padding:6px 10px;border-radius:5px}
</style></head>
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
  const origin = c.req.header('origin') ?? c.req.header('referer');
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

function formValuesFromSource(source: SourceRecord): SourceFormValues {
  const config = source.config;
  const text = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.join(', ');
    return '';
  };
  return {
    kind: source.kind,
    title: source.title,
    url: text(config.url),
    channel: text(config.channel),
    categoryId: text(config.categoryId),
    city: text(config.city),
    includeKeywords: text(config.includeKeywords),
    excludeKeywords: text(config.excludeKeywords),
    minBudget: text(config.minBudget),
    limit: text(config.limit),
    host: text(config.host),
    port: text(config.port),
    user: text(config.user),
    passwordEnv: text(config.passwordEnv),
    mailbox: text(config.mailbox),
    sinceDays: text(config.sinceDays),
    subjectIncludes: text(config.subjectIncludes),
  };
}

function buildSourceConfig(
  kind: SourceKind,
  body: Record<string, unknown>,
  existing?: SourceRecord,
): { config: SourceConfig; error?: string } {
  const config: SourceConfig = {};
  const city = formString(body, 'city');
  if (city) config.city = city;

  const include = parseList(formString(body, 'includeKeywords'));
  if (include.length) config.includeKeywords = include;
  const exclude = parseList(formString(body, 'excludeKeywords'));
  if (exclude.length) config.excludeKeywords = exclude;

  const minBudget = asNumber(formString(body, 'minBudget'));
  if (minBudget !== undefined) {
    if (minBudget < 0 || isNaN(minBudget)) return { config, error: 'Минимальный бюджет должен быть положительным числом.' };
    config.minBudget = minBudget;
  }
  const limit = asNumber(formString(body, 'limit'));
  if (limit !== undefined) {
    if (limit <= 0 || isNaN(limit) || limit > 500) return { config, error: 'Лимит должен быть от 1 до 500.' };
    config.limit = limit;
  }

  if (kind === 'rss') {
    const url = formString(body, 'url');
    if (!url) return { config, error: 'Для RSS нужен URL фида.' };
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { config, error: 'Разрешены только http:// и https:// ссылки.' };
      }
      if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsed.hostname)) {
        return { config, error: 'Локальные адреса запрещены.' };
      }
    } catch {
      return { config, error: 'Некорректный URL фида.' };
    }
    config.url = url;
  }

  if (kind === 'telegram') {
    const channel = formString(body, 'channel').replace(/^@/, '');
    if (!channel || !/^[a-zA-Z0-9_]{4,32}$/.test(channel)) {
      return { config, error: 'Укажите корректный публичный канал Telegram (4-32 символов a-z, 0-9, _).' };
    }
    config.channel = channel;
  }

  if (kind === 'kwork') {
    const categoryId = formString(body, 'categoryId');
    if (categoryId && !/^\d{1,8}$/.test(categoryId)) {
      return { config, error: 'ID категории Kwork должен быть числовым.' };
    }
    if (categoryId) config.categoryId = categoryId;
  }

  if (kind === 'webhook') {
    const existingToken =
      typeof existing?.config.token === 'string' ? existing.config.token : undefined;
    config.token = existingToken ?? randomBytes(16).toString('hex');
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
  const skills = Array.isArray(body.skills)
    ? body.skills.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : undefined;
  const metadata =
    typeof body.metadata === 'object' && body.metadata !== null
      ? (body.metadata as Record<string, unknown>)
      : undefined;

  return {
    sourceId,
    externalId: asString(body.externalId),
    url: asString(body.url),
    title: title ?? text ?? '',
    text: text ?? title ?? '',
    author: asString(body.author),
    city: asString(body.city),
    budget: asNumber(body.budget),
    currency: asString(body.currency) ?? 'RUB',
    category: asString(body.category),
    skills,
    isRemote: typeof body.isRemote === 'boolean' ? body.isRemote : true,
    metadata,
    publishedAt: asString(body.publishedAt),
    raw: body,
  };
}

export function createApp(runtime: Runtime): Hono {
  const app = new Hono();

  // Security Headers: Clickjacking, MIME-sniffing, XSS
  app.use('*', async (c, next) => {
    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    await next();
  });

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
    const rawStatus = c.req.query('status') ?? '';
    const status = ['new', 'delivered', 'rejected', 'failed'].includes(rawStatus)
      ? (rawStatus as LeadStatus)
      : '';
    const query = (c.req.query('q') ?? '').trim();

    return c.html(
      renderLeadsPage({
        stats: runtime.store.getStats(),
        health: runtime.store.getSourceHealth(),
        leads: runtime.store.listLeads({
          limit: 50,
          status: status || undefined,
          query: query || undefined,
        }),
        query,
        status,
        version: VERSION,
      }),
    );
  });

  app.get('/extension', (c) => {
    if (!canRead(c, runtime.env)) return c.redirect('/login');
    const webhookSources = runtime.store
      .listSources()
      .filter((s) => s.kind === 'webhook' && s.enabled);
    return c.html(
      renderExtensionPage({
        version: VERSION,
        webhookSources,
      }),
    );
  });

  app.get('/sources', (c) => {
    if (!canRead(c, runtime.env)) return c.redirect('/login');
    return c.html(
      renderSourcesPage({
        health: runtime.store.getSourceHealth(),
        version: VERSION,
      }),
    );
  });

  app.post('/sources/presets', async (c) => {
    if (!isAdmin(c, runtime.env)) return c.redirect('/login');
    if (!sameOrigin(c)) return c.text('Forbidden', 403);
    const existing = runtime.store.listSources();
    for (const preset of SOURCE_PRESETS) {
      const already = existing.some(
        (s) =>
          s.title === preset.title ||
          (preset.config.url && s.config.url === preset.config.url) ||
          (preset.config.channel && s.config.channel === preset.config.channel),
      );
      if (already) continue;
      runtime.store.createSource({
        kind: preset.kind,
        title: preset.title,
        config: preset.config,
        enabled: true,
      });
    }
    return c.redirect('/sources');
  });

  app.get('/sources/new', (c) => {
    if (!isAdmin(c, runtime.env)) return c.redirect('/login');
    return c.html(
      renderNewSourcePage({
        version: VERSION,
        kinds: runtime.sources.list().map((adapter) => adapter.kind),
        values: formValues({}),
        mode: 'create',
        action: '/sources',
        submitLabel: 'Создать источник',
      }),
    );
  });

  app.get('/sources/:id/edit', (c) => {
    if (!isAdmin(c, runtime.env)) return c.redirect('/login');
    const source = runtime.store.getSource(c.req.param('id'));
    if (!source) return c.html(renderNotFound(VERSION), 404);
    return c.html(
      renderNewSourcePage({
        version: VERSION,
        kinds: runtime.sources.list().map((adapter) => adapter.kind),
        values: formValuesFromSource(source),
        mode: 'edit',
        action: `/sources/${source.id}`,
        submitLabel: 'Сохранить',
        sourceId: source.id,
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
          mode: 'create',
          action: '/sources',
          submitLabel: 'Создать источник',
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

    return c.redirect(`/sources/${created.id}?created=1`);
  });

  app.post('/sources/:id', async (c) => {
    if (!isAdmin(c, runtime.env)) return c.redirect('/login');
    if (!sameOrigin(c)) return c.text('Forbidden', 403);
    const source = runtime.store.getSource(c.req.param('id'));
    if (!source) return c.html(renderNotFound(VERSION), 404);

    const body = (await c.req.parseBody()) as Record<string, unknown>;
    const values = formValues(body);
    values.kind = source.kind;

    const fail = (error: string): Response =>
      c.html(
        renderNewSourcePage({
          version: VERSION,
          kinds: runtime.sources.list().map((adapter) => adapter.kind),
          values,
          error,
          mode: 'edit',
          action: `/sources/${source.id}`,
          submitLabel: 'Сохранить',
          sourceId: source.id,
        }),
        400,
      );

    if (!values.title) return fail('Название источника обязательно.');
    const built = buildSourceConfig(source.kind, body, source);
    if (built.error) return fail(built.error);

    runtime.store.updateSource(source.id, {
      title: values.title,
      config: built.config,
    });
    return c.redirect(`/sources/${source.id}?updated=1`);
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
        notice:
          c.req.query('created') === '1'
            ? 'Источник создан.'
            : c.req.query('updated') === '1'
              ? 'Изменения сохранены.'
              : undefined,
      }),
    );
  });

  app.get('/leads/:id', (c) => {
    if (!canRead(c, runtime.env)) return c.redirect('/login');
    const lead = runtime.store.getLead(c.req.param('id'));
    if (!lead) return c.html(renderNotFound(VERSION), 404);
    return c.html(
      renderLeadPage({
        lead,
        source: runtime.store.getSource(lead.sourceId) ?? undefined,
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
    return c.redirect('/sources');
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
    const query = c.req.query('q')?.trim() || undefined;
    return c.json(runtime.store.listLeads({ limit, status, sourceId, query }));
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
