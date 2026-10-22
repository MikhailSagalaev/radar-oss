import type { Lead, RunRecord, SourceHealth, SourceRecord, Stats } from '../core/types.ts';
import { escapeHtml, firstLine } from '../core/text.ts';

export interface LeadsPageData {
  stats: Stats;
  health: SourceHealth[];
  leads: Lead[];
  query: string;
  status: string;
  version: string;
}

export interface SourcesPageData {
  health: SourceHealth[];
  version: string;
}

export interface SourcePageData {
  source: SourceRecord;
  health: SourceHealth;
  leads: Lead[];
  runs: RunRecord[];
  version: string;
  notice?: string;
}

export interface LeadPageData {
  lead: Lead;
  source?: SourceRecord;
  version: string;
}

export interface SourceFormValues {
  kind: string;
  title: string;
  url: string;
  channel: string;
  categoryId: string;
  city: string;
  includeKeywords: string;
  excludeKeywords: string;
  minBudget: string;
  limit: string;
  host: string;
  port: string;
  user: string;
  passwordEnv: string;
  mailbox: string;
  sinceDays: string;
  subjectIncludes: string;
}

export interface NewSourcePageData {
  version: string;
  kinds: string[];
  values: SourceFormValues;
  mode: 'create' | 'edit';
  action: string;
  submitLabel: string;
  sourceId?: string;
  error?: string;
}

export interface CreatedSourcePageData {
  version: string;
  source: SourceRecord;
  token: string;
}

const KIND_LABELS: Record<string, string> = {
  rss: 'RSS / Atom',
  telegram: 'Telegram',
  kwork: 'Kwork',
  imap: 'IMAP',
  webhook: 'Webhook',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'новый',
  delivered: 'доставлен',
  rejected: 'отклонён',
  failed: 'ошибка',
};

const STYLE = `
:root{--bg:#fff;--ink:#111;--muted:#6b6b6b;--line:#e5e5e5;--soft:#f5f5f5}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1040px;margin:0 auto;padding:0 20px 72px;min-height:100vh;display:flex;flex-direction:column}
.top{display:flex;align-items:center;gap:20px;padding:18px 0;border-bottom:1px solid var(--line);margin-bottom:32px}
.brand{font-weight:700;letter-spacing:-.02em;text-decoration:none;color:var(--ink);font-size:16px}
.version{color:var(--muted);font-size:11px}
.nav{display:flex;gap:18px;margin-left:10px}
.nav a{font-size:13px;color:var(--muted);text-decoration:none;padding:3px 0;border-bottom:1px solid transparent}
.nav a:hover{color:var(--ink);text-decoration:none}
.nav a.active{color:var(--ink);border-color:var(--ink)}
.actions{margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px}
h1{font-size:26px;line-height:1.2;letter-spacing:-.03em;margin:0 0 4px}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 10px;font-weight:600}
p{margin:0}
a{color:var(--ink);text-decoration:none}
a:hover{text-decoration:underline}
.muted{color:var(--muted)}
.small{font-size:12px}
.filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 18px;min-width:0}
.metrics{display:flex;flex-wrap:wrap;gap:28px;margin:0 0 30px}
.metric b{display:block;font-size:22px;line-height:1.2;letter-spacing:-.03em}
.metric span{font-size:12px;color:var(--muted)}
.inline{display:inline}
.chips{display:flex;gap:8px;flex-wrap:wrap;min-width:0}
.chip{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:4px 10px;text-decoration:none;color:var(--muted);white-space:nowrap}
.chip:hover{color:var(--ink);border-color:var(--ink);text-decoration:none}
.chip.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.search{display:flex;gap:6px;margin-left:auto}
.search input{width:190px;min-width:0;padding:6px 8px;border:1px solid var(--line);border-radius:5px;font:inherit;font-size:12px;background:#fff;color:var(--ink)}
.search input:focus{outline:1px solid var(--ink);border-color:var(--ink)}
.search button{flex:0 0 auto}
.list{border-top:1px solid var(--line)}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;padding:14px 0;border-bottom:1px solid var(--line);text-decoration:none;color:inherit}
.row:hover{text-decoration:none}
.row:hover .row-title{text-decoration:underline}
.row-title{font-weight:600;font-size:15px;line-height:1.3}
.row-meta{color:var(--muted);font-size:12px;margin-top:3px}
.row-side{display:flex;align-items:center;gap:14px;font-size:12px;color:var(--muted);white-space:nowrap}
.score{font-weight:700;color:var(--ink);font-size:14px;font-variant-numeric:tabular-nums}
.dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;vertical-align:1px;background:#c9c9c9}
.dot.ok{background:var(--ink)}
.dot.err{background:transparent;box-shadow:inset 0 0 0 1px var(--ink)}
.dot.warn{background:var(--muted)}
.btn{display:inline-block;background:var(--ink);color:#fff;border:1px solid var(--ink);border-radius:5px;padding:6px 11px;font:inherit;font-size:12px;cursor:pointer;text-decoration:none;line-height:1.4}
.btn:hover{background:#2b2b2b;text-decoration:none}
.btn.ghost{background:#fff;color:var(--ink)}
.btn.ghost:hover{background:var(--soft)}
.btn.danger{border-style:dashed}
.btn:disabled{opacity:.45;cursor:default}
.empty{border:1px dashed var(--line);padding:32px 20px;text-align:center;color:var(--muted)}
.empty h2{color:var(--ink);font-size:15px;text-transform:none;letter-spacing:-.01em;margin-bottom:6px}
.empty p{max-width:460px;margin:0 auto 14px;font-size:13px}
.detail-grid{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:36px;margin-top:26px}
.lead-text{white-space:pre-wrap;font-size:15px;line-height:1.65;margin:10px 0 0}
.meta-list{margin:0}
.meta-list div{display:flex;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13px}
.meta-list dt{color:var(--muted)}
.meta-list dd{margin:0;text-align:right;word-break:break-word}
.meta-list a{color:var(--ink)}
.reasons{margin:8px 0 0;padding-left:18px;font-size:12px;color:var(--muted)}
.reasons li{margin:3px 0}
section{margin-bottom:32px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;padding:0 10px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
table a{color:inherit;text-decoration:none}
table a:hover{text-decoration:underline}
.error{color:var(--ink);font-weight:600}
.back{display:inline-block;margin-bottom:16px;color:var(--muted);font-size:12px}
.back:hover{color:var(--ink);text-decoration:none}
.form{display:grid;gap:14px;max-width:720px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.field{display:grid;gap:5px;color:var(--muted);font-size:12px}
.field input,.field select{width:100%;padding:7px 8px;border:1px solid var(--line);border-radius:5px;background:#fff;color:var(--ink);font:inherit;font-size:13px}
.field input:focus,.field select:focus{outline:1px solid var(--ink);border-color:var(--ink)}
.field input:disabled,.field select:disabled{background:var(--soft);color:var(--muted)}
fieldset{border:1px solid var(--line);border-radius:6px;padding:14px;margin:0;display:grid;gap:12px}
legend{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:0 6px}
.hint{color:var(--muted);font-size:12px}
.error-box{border:1px dashed var(--ink);padding:10px 12px;border-radius:5px;font-size:13px;font-weight:600}
.notice{border:1px solid var(--line);background:var(--soft);padding:10px 12px;border-radius:5px;font-size:13px;margin-bottom:20px}
pre.token{background:var(--soft);border:1px solid var(--line);border-radius:5px;padding:12px;overflow:auto;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}
[hidden]{display:none!important}
footer{color:var(--muted);font-size:11px;margin-top:auto;padding-top:48px}
@media(max-width:700px){
  main{padding:0 14px 56px}
  .top{flex-wrap:wrap;gap:10px 14px}
  .nav{order:3;width:100%;margin-left:0}
  .actions{margin-left:0}
  .page-head{flex-direction:column;align-items:flex-start}
  .detail-grid{grid-template-columns:1fr;gap:24px}
  .grid{grid-template-columns:1fr}
  .search{margin-left:0;width:100%;min-width:0;max-width:calc(100vw - 28px)}
  .search input{flex:1 1 0;width:0;min-width:0}
  .filters{display:grid;grid-template-columns:1fr;align-items:stretch;gap:8px;max-width:calc(100vw - 28px)}
  .chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));width:100%;max-width:calc(100vw - 28px);gap:6px}
  .chip{text-align:center;padding:4px 6px}
  .row{grid-template-columns:1fr;gap:8px}
  .row-side{justify-content:flex-start}
}
`;

function layout(input: {
  title: string;
  version: string;
  active?: 'leads' | 'sources';
  body: string;
  actions?: string;
  script?: string;
}): string {
  const nav = (key: 'leads' | 'sources', label: string, href: string): string =>
    `<a href="${href}"${input.active === key ? ' class="active"' : ''}>${label}</a>`;

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)} · Radar</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<header class="top">
  <a class="brand" href="/">Radar</a>
  <span class="version">v${escapeHtml(input.version)}</span>
  <nav class="nav">
    ${nav('leads', 'Лиды', '/')}
    ${nav('sources', 'Источники', '/sources')}
  </nav>
  <div class="actions">${input.actions ?? ''}</div>
</header>
${input.body}
<footer>Данные не покидают ваш сервер · <a href="/health">health</a></footer>
</main>
${input.script ?? ''}
</body>
</html>`;
}

const POLL_SCRIPT = `<script>
async function poll(url, button) {
  if (!button) return;
  button.disabled = true;
  try {
    const response = await fetch(url, { method: 'POST', headers: { accept: 'application/json' } });
    if (!response.ok) {
      alert('Ошибка: ' + (await response.text()).slice(0, 300));
      return;
    }
    location.reload();
  } finally {
    button.disabled = false;
  }
}
document.querySelectorAll('[data-poll]').forEach((button) => {
  button.addEventListener('click', () => poll(button.dataset.poll, button));
});
</script>`;

function formatRelative(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffSec = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'только что';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} мин назад`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)} ч назад`;
  return `${Math.floor(diffSec / 86_400)} дн назад`;
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatBudget(value: number | undefined): string {
  if (typeof value !== 'number') return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;
}

function plural(value: number, forms: [string, string, string]): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function statusDot(status: string): string {
  const cls =
    status === 'delivered'
      ? 'ok'
      : status === 'failed'
        ? 'warn'
        : status === 'rejected'
          ? 'err'
          : '';
  return `<span class="dot ${cls}"></span>${escapeHtml(statusLabel(status))}`;
}

function healthStatus(health: SourceHealth): { dot: string; label: string } {
  if (!health.source.enabled) return { dot: '', label: 'выключен' };
  if (health.lastRun?.error) return { dot: 'err', label: 'ошибка' };
  if (health.lastRun) return { dot: 'ok', label: 'работает' };
  if (health.source.kind === 'webhook') return { dot: '', label: 'ожидает данных' };
  return { dot: '', label: 'нет запусков' };
}

function metric(value: string | number, label: string): string {
  return `<div class="metric"><b>${escapeHtml(String(value))}</b><span>${escapeHtml(label)}</span></div>`;
}

function metricRow(values: Array<{ value: string | number; label: string }>): string {
  return `<div class="metrics">${values.map((item) => metric(item.value, item.label)).join('')}</div>`;
}

function leadTitle(lead: Lead): string {
  return lead.title.trim() || firstLine(lead.text, 100) || 'Без заголовка';
}

function leadRow(lead: Lead, source?: SourceRecord): string {
  const meta = [
    source?.title,
    lead.city,
    typeof lead.budget === 'number' ? formatBudget(lead.budget) : undefined,
    formatRelative(lead.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return `<a class="row" href="/leads/${escapeHtml(lead.id)}">
    <div>
      <div class="row-title">${escapeHtml(leadTitle(lead))}</div>
      <div class="row-meta">${escapeHtml(meta)}</div>
    </div>
    <div class="row-side">
      <span class="score">${lead.score}</span>
      <span>${statusDot(lead.status)}</span>
    </div>
  </a>`;
}

function leadsTable(leads: Lead[], sourceById?: Map<string, SourceRecord>): string {
  if (!leads.length) return '<div class="empty">Лидов пока нет.</div>';
  const rows = leads
    .map((lead) => {
      const source = sourceById?.get(lead.sourceId);
      return `<tr>
        <td class="muted">${lead.score}</td>
        <td><a href="/leads/${escapeHtml(lead.id)}">${escapeHtml(leadTitle(lead))}</a>
          <div class="small muted">${escapeHtml([source?.title, lead.city].filter(Boolean).join(' · '))}</div>
        </td>
        <td class="small">${formatBudget(lead.budget)}</td>
        <td class="small">${statusDot(lead.status)}</td>
        <td class="small muted">${formatRelative(lead.createdAt)}</td>
      </tr>`;
    })
    .join('');
  return `<table>
    <thead><tr><th>Скор</th><th>Заказ</th><th>Бюджет</th><th>Статус</th><th>Когда</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function runsTable(
  runs: RunRecord[],
  sourceById?: Map<string, SourceRecord>,
  showSource = true,
): string {
  if (!runs.length) return '<div class="empty">Запусков ещё не было.</div>';
  const rows = runs
    .map((run) => {
      const source = sourceById?.get(run.sourceId);
      return `<tr>
        ${showSource ? `<td>${source ? escapeHtml(source.title) : escapeHtml(run.sourceId)}</td>` : ''}
        <td>${run.found}</td>
        <td>${run.inserted}</td>
        <td>${run.duplicates}</td>
        <td>${run.rejected}</td>
        <td>${run.delivered}</td>
        <td class="small muted">${formatRelative(run.startedAt)}</td>
        <td class="small error">${escapeHtml(run.error ?? '')}</td>
      </tr>`;
    })
    .join('');
  return `<table>
    <thead><tr>${showSource ? '<th>Источник</th>' : ''}<th>Найдено</th><th>Новых</th><th>Дубли</th><th>Отклонено</th><th>Доставлено</th><th>Когда</th><th>Ошибка</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function renderLeadsPage(data: LeadsPageData): string {
  const { stats, health, leads, query, status, version } = data;
  const sourceById = new Map(health.map((item) => [item.source.id, item.source]));
  const statusFilters: Array<{ key: string; label: string }> = [
    { key: '', label: 'Все' },
    { key: 'new', label: 'Новые' },
    { key: 'delivered', label: 'Доставленные' },
    { key: 'rejected', label: 'Отклонённые' },
    { key: 'failed', label: 'С ошибкой' },
  ];

  const hrefFor = (nextStatus: string): string => {
    const params = new URLSearchParams();
    if (nextStatus) params.set('status', nextStatus);
    if (query) params.set('q', query);
    const suffix = params.toString();
    return suffix ? `/?${suffix}` : '/';
  };

  const chips = statusFilters
    .map(
      (item) =>
        `<a class="chip${item.key === status ? ' active' : ''}" href="${escapeHtml(hrefFor(item.key))}">${item.label}</a>`,
    )
    .join('');

  const rows = leads.map((lead) => leadRow(lead, sourceById.get(lead.sourceId))).join('');

  const empty =
    stats.sources === 0
      ? `<div class="empty">
          <h2>Начните с источника</h2>
          <p>RSS, IMAP или webhook. Дальше Radar сам собирает заказы, убирает дубли и присылает только подходящие.</p>
          <a class="btn" href="/sources/new">Добавить источник</a>
        </div>`
      : `<div class="empty">
          <h2>Лидов пока нет</h2>
          <p>Источники уже настроены. Запустите опрос — первые заказы появятся здесь.</p>
          <button class="btn" data-poll="/api/poll">Опросить все</button>
        </div>`;

  const body = `
<div class="page-head">
  <div>
    <h1>Лиды</h1>
    <p class="muted small">${stats.leads} ${plural(stats.leads, ['лид', 'лида', 'лидов'])} · ${stats.last24h} за 24 часа · ${stats.enabledSources}/${stats.sources} источников</p>
  </div>
</div>

<div class="filters">
  <div class="chips">${chips}</div>
  <form class="search" method="get" action="/">
    ${status ? `<input type="hidden" name="status" value="${escapeHtml(status)}">` : ''}
    <input name="q" value="${escapeHtml(query)}" placeholder="Поиск по лидам" aria-label="Поиск по лидам">
    <button class="btn ghost" type="submit">Найти</button>
  </form>
</div>

<div class="list">${rows || empty}</div>`;

  return layout({
    title: 'Лиды',
    version,
    active: 'leads',
    body,
    actions:
      '<a class="btn ghost" href="/sources/new">Добавить источник</a><button class="btn" data-poll="/api/poll">Опросить все</button>',
    script: POLL_SCRIPT,
  });
}

export function renderLeadPage(data: LeadPageData): string {
  const { lead, source, version } = data;
  const copyScript = `<script>
document.getElementById('copy-lead')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(document.getElementById('lead-text')?.innerText ?? '');
    button.textContent = 'Скопировано';
  } catch {
    button.textContent = 'Не удалось';
  }
});
</script>`;

  const body = `
<a class="back" href="/">← Все лиды</a>
<div class="page-head">
  <div>
    <h1>${escapeHtml(leadTitle(lead))}</h1>
    <p class="muted small">${statusDot(lead.status)} · ${formatRelative(lead.createdAt)}</p>
  </div>
  <div class="actions">
    ${lead.url ? `<a class="btn" href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">Открыть источник</a>` : ''}
    <button class="btn ghost" id="copy-lead" type="button">Копировать текст</button>
  </div>
</div>

<div class="detail-grid">
  <section>
    <h2>Текст заказа</h2>
    <p class="lead-text" id="lead-text">${escapeHtml(lead.text)}</p>
    ${lead.reasons.length ? `<h2 style="margin-top:26px">Почему так</h2><ul class="reasons">${lead.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}
  </section>
  <aside>
    <h2>Детали</h2>
    <dl class="meta-list">
      <div><dt>Источник</dt><dd>${source ? `<a href="/sources/${escapeHtml(source.id)}">${escapeHtml(source.title)}</a>` : escapeHtml(lead.sourceId)}</dd></div>
      <div><dt>Город</dt><dd>${escapeHtml(lead.city ?? '—')}</dd></div>
      <div><dt>Бюджет</dt><dd>${formatBudget(lead.budget)}</dd></div>
      <div><dt>Скор</dt><dd>${lead.score}</dd></div>
      <div><dt>Опубликован</dt><dd>${formatDate(lead.publishedAt)}</dd></div>
      <div><dt>Добавлен</dt><dd>${formatDate(lead.createdAt)}</dd></div>
      ${lead.author ? `<div><dt>Автор</dt><dd>${escapeHtml(lead.author)}</dd></div>` : ''}
    </dl>
  </aside>
</div>`;

  return layout({
    title: leadTitle(lead),
    version,
    active: 'leads',
    body,
    script: copyScript,
  });
}

export function renderSourcesPage(data: SourcesPageData): string {
  const { health, version } = data;
  const rows = health
    .map((item) => {
      const status = healthStatus(item);
      const error = item.lastRun?.error;
      return `<a class="row" href="/sources/${escapeHtml(item.source.id)}">
        <div>
          <div class="row-title">${escapeHtml(item.source.title)}</div>
          <div class="row-meta">${escapeHtml(KIND_LABELS[item.source.kind] ?? item.source.kind)} · <span class="dot ${status.dot}"></span>${status.label} · ${formatRelative(item.lastRun?.startedAt)}</div>
          ${error ? `<div class="row-meta error">${escapeHtml(error)}</div>` : ''}
        </div>
        <div class="row-side">${item.last24h.found} / ${item.last24h.inserted} / ${item.last24h.delivered}</div>
      </a>`;
    })
    .join('');

  const empty = `<div class="empty">
    <h2>Источников пока нет</h2>
    <p>Начните с RSS-фида или почты с оповещениями. Telegram и Kwork тоже можно добавить, но они зависят от публичной вёрстки.</p>
    <a class="btn" href="/sources/new">Добавить источник</a>
  </div>`;

  const body = `
<div class="page-head">
  <div>
    <h1>Источники</h1>
    <p class="muted small">${health.length} ${plural(health.length, ['источник', 'источника', 'источников'])} · ${health.filter((item) => item.source.enabled).length} активных · 24ч: найдено / новых / доставлено</p>
  </div>
</div>
<div class="list">${rows || empty}</div>`;

  return layout({
    title: 'Источники',
    version,
    active: 'sources',
    body,
    actions: '<a class="btn" href="/sources/new">Добавить источник</a>',
  });
}

export function renderSourcePage(data: SourcePageData): string {
  const { source, health, leads, runs, version, notice } = data;
  const status = healthStatus(health);
  const config = configEntries(source.config)
    .map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('');

  const webhook = source.kind === 'webhook'
    ? `<p class="hint" style="margin-top:12px">Приём: <code>POST /api/ingest/${escapeHtml(source.id)}</code> с заголовком <code>x-radar-token</code>.</p>`
    : '';

  const body = `
<a class="back" href="/sources">← Источники</a>
${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ''}
<div class="page-head">
  <div>
    <h1>${escapeHtml(source.title)}</h1>
    <p class="muted small">${escapeHtml(KIND_LABELS[source.kind] ?? source.kind)} · ${source.enabled ? 'включён' : 'выключен'} · <span class="dot ${status.dot}"></span>${status.label}</p>
  </div>
</div>

${metricRow([
  { value: health.last24h.found, label: 'найдено за 24ч' },
  { value: health.last24h.inserted, label: 'новых' },
  { value: health.last24h.delivered, label: 'доставлено' },
  { value: health.last24h.rejected, label: 'отклонено' },
  { value: `${health.successRate}%`, label: 'успешных запусков' },
  { value: formatRelative(health.lastRun?.startedAt), label: 'последний запуск' },
])}

<section>
  <h2>Конфигурация</h2>
  <dl class="meta-list">${config || '<div><dt>—</dt><dd>пусто</dd></div>'}</dl>
  ${webhook}
</section>

<section>
  <h2>Лиды источника</h2>
  ${leadsTable(leads)}
</section>

<section>
  <h2>Запуски</h2>
  ${runsTable(runs, undefined, false)}
</section>`;

  return layout({
    title: source.title,
    version,
    active: 'sources',
    body,
    actions: `<button class="btn" data-poll="/api/sources/${escapeHtml(source.id)}/poll">Опросить</button>
      <a class="btn ghost" href="/sources/${escapeHtml(source.id)}/edit">Редактировать</a>
      <form class="inline" method="post" action="/sources/${escapeHtml(source.id)}/toggle">
        <button class="btn ghost" type="submit">${source.enabled ? 'Выключить' : 'Включить'}</button>
      </form>
      <form class="inline" method="post" action="/sources/${escapeHtml(source.id)}/delete" onsubmit="return confirm('Удалить источник?')">
        <button class="btn ghost danger" type="submit">Удалить</button>
      </form>`,
    script: POLL_SCRIPT,
  });
}

function configEntries(config: SourceRecord['config']): Array<[string, string]> {
  const hidden = new Set(['token', 'password', 'pass', 'secret']);
  return Object.entries(config)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      if (hidden.has(key)) return [key, 'скрыто'];
      if (key === 'passwordEnv') return [key, `env: ${String(value)}`];
      if (Array.isArray(value)) return [key, value.join(', ')];
      if (typeof value === 'object') return [key, JSON.stringify(value)];
      if (typeof value === 'boolean') return [key, value ? 'да' : 'нет'];
      return [key, String(value)];
    });
}

function textField(
  name: string,
  label: string,
  value: string,
  placeholder = '',
  type = 'text',
  hint?: string,
  disabled = false,
): string {
  return `<label class="field">${escapeHtml(label)}
    <input type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${disabled ? ' disabled' : ''}>
    ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ''}
  </label>`;
}

export function renderNewSourcePage(data: NewSourcePageData): string {
  const { kinds, values, error, version, mode, action, submitLabel, sourceId } = data;
  const editing = mode === 'edit';
  const options = kinds
    .map(
      (kind) =>
        `<option value="${escapeHtml(kind)}"${kind === values.kind ? ' selected' : ''}>${escapeHtml(KIND_LABELS[kind] ?? kind)}</option>`,
    )
    .join('');

  const body = `
<a class="back" href="${editing && sourceId ? `/sources/${escapeHtml(sourceId)}` : '/sources'}">← Источники</a>
<div class="page-head">
  <div>
    <h1>${editing ? 'Редактировать источник' : 'Новый источник'}</h1>
    <p class="muted small">${editing ? 'Название и фильтры можно менять. Тип источника фиксирован.' : 'RSS и IMAP — самые устойчивые. Telegram и Kwork зависят от публичной вёрстки. Webhook принимает данные от расширения или другого сервиса.'}</p>
  </div>
</div>
${error ? `<div class="error-box" style="margin-bottom:16px">${escapeHtml(error)}</div>` : ''}

<form class="form" method="post" action="${escapeHtml(action)}">
  <div class="grid">
    <label class="field">Тип
      <select name="${editing ? 'kind-disabled' : 'kind'}" id="kind"${editing ? ' disabled' : ''}>${options}</select>
      ${editing ? `<input type="hidden" name="kind" value="${escapeHtml(values.kind)}">` : ''}
    </label>
    <label class="field">Название
      <input name="title" value="${escapeHtml(values.title)}" placeholder="Например, Городские чаты" required>
    </label>
  </div>

  <div data-kind="rss">
    ${textField('url', 'URL фида', values.url, 'https://example.com/rss', 'url', 'RSS или Atom. Самый безопасный источник.')}
  </div>

  <div data-kind="telegram">
    ${textField('channel', 'Публичный канал', values.channel, 'stavropol_jobs', 'text', 'Без @. Читается только публичный preview t.me/s/.')}
  </div>

  <div data-kind="kwork">
    ${textField('categoryId', 'ID рубрики Kwork', values.categoryId, '11', 'text', 'Необязательно. Пусто — все проекты.')}
  </div>

  <div data-kind="webhook">
    <p class="hint">${editing ? 'Токен источника не меняется. Он остался тем же, что был при создании.' : 'Токен источника будет сгенерирован автоматически и показан один раз после создания.'}</p>
  </div>

  <div data-kind="imap">
    <fieldset>
      <legend>IMAP</legend>
      <div class="grid">
        ${textField('host', 'Хост', values.host, 'imap.example.com')}
        ${textField('port', 'Порт', values.port || '993', '993', 'number')}
        ${textField('user', 'Пользователь', values.user, 'radar@example.com')}
        ${textField('passwordEnv', 'Переменная с паролем', values.passwordEnv, 'RADAR_IMAP_PASSWORD', 'text', 'Имя env-переменной, не сам пароль.')}
        ${textField('mailbox', 'Папка', values.mailbox || 'INBOX', 'INBOX')}
        ${textField('sinceDays', 'Дней назад', values.sinceDays || '7', '7', 'number')}
      </div>
      ${textField('subjectIncludes', 'Фильтр по теме', values.subjectIncludes, 'заказ, срочно', 'text', 'Через запятую. Пусто — все письма.')}
    </fieldset>
  </div>

  <fieldset>
    <legend>Общие фильтры</legend>
    <div class="grid">
      ${textField('city', 'Город', values.city, 'Ставрополь')}
      ${textField('minBudget', 'Минимальный бюджет, ₽', values.minBudget, '1000', 'number')}
      ${textField('limit', 'Лимит за опрос', values.limit, '20', 'number')}
    </div>
    ${textField('includeKeywords', 'Обязательные слова', values.includeKeywords, 'сантехник, электрик', 'text', 'Через запятую. Лид без них будет отклонён.')}
    ${textField('excludeKeywords', 'Стоп-слова', values.excludeKeywords, 'бесплатно, вакансия', 'text', 'Через запятую.')}
  </fieldset>

  <div>
    <button class="btn" type="submit">${escapeHtml(submitLabel)}</button>
  </div>
</form>

<script>
const kind = document.getElementById('kind');
function syncKind() {
  if (!kind) return;
  for (const group of document.querySelectorAll('[data-kind]')) {
    group.hidden = group.dataset.kind !== kind.value;
  }
}
kind?.addEventListener('change', syncKind);
syncKind();
</script>`;

  return layout({
    title: editing ? 'Редактировать источник' : 'Новый источник',
    version,
    active: 'sources',
    body,
    actions: '<a class="btn ghost" href="/sources">Отмена</a>',
  });
}

export function renderSourceCreatedPage(data: CreatedSourcePageData): string {
  const { source, token, version } = data;
  const body = `
<a class="back" href="/sources">← Источники</a>
<div class="page-head">
  <div>
    <h1>Источник создан</h1>
    <p class="muted small">Токен показывается один раз. Сохраните его — он понадобится расширению или внешнему сервису.</p>
  </div>
</div>
<pre class="token">${escapeHtml(token)}</pre>
<p style="margin-top:16px"><a class="btn" href="/sources/${escapeHtml(source.id)}">Открыть источник</a></p>`;

  return layout({
    title: 'Источник создан',
    version,
    active: 'sources',
    body,
  });
}

export function renderNotFound(version: string): string {
  return layout({
    title: 'Не найдено',
    version,
    body: `<div class="page-head"><div><h1>Не найдено</h1><p class="muted small">Страница или источник не существует.</p></div></div><a class="btn" href="/">К лидам</a>`,
  });
}
