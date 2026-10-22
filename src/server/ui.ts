import type { Lead, RunRecord, SourceHealth, SourceRecord, Stats } from '../core/types.ts';
import { escapeHtml, firstLine } from '../core/text.ts';

export interface DashboardData {
  stats: Stats;
  health: SourceHealth[];
  leads: Lead[];
  runs: RunRecord[];
  version: string;
}

export interface SourcePageData {
  source: SourceRecord;
  health: SourceHealth;
  leads: Lead[];
  runs: RunRecord[];
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
  error?: string;
}

export interface CreatedSourcePageData {
  version: string;
  source: SourceRecord;
  token: string;
}

const KIND_LABELS: Record<string, string> = {
  rss: 'RSS / Atom',
  telegram: 'Telegram-канал',
  kwork: 'Kwork',
  imap: 'IMAP-почта',
  webhook: 'Webhook / расширение',
};

const STYLE = `
:root{--bg:#fafafa;--ink:#171717;--muted:#737373;--line:#e5e5e5;--ok:#15803d;--err:#b91c1c;--warn:#a16207}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1040px;margin:0 auto;padding:32px 20px 72px}
.top{display:flex;align-items:center;gap:10px;padding-bottom:16px;border-bottom:1px solid var(--line);margin-bottom:28px}
.brand{font-weight:650;letter-spacing:-.02em;color:var(--ink);text-decoration:none;font-size:16px}
.version{color:var(--muted);font-size:12px}
.actions{margin-left:auto;display:flex;gap:8px;align-items:center}
h1{font-size:20px;letter-spacing:-.02em;margin:0 0 4px}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 10px;font-weight:600}
p{margin:0}
.muted{color:var(--muted)}
.small{font-size:12px}
.metrics{display:flex;flex-wrap:wrap;gap:28px;margin:0 0 30px}
.metric b{display:block;font-size:22px;line-height:1.2;letter-spacing:-.03em}
.metric span{font-size:12px;color:var(--muted)}
section{margin-bottom:34px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;padding:0 10px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
a{color:inherit;text-decoration:none}
a:hover{text-decoration:underline}
.dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;vertical-align:1px;background:#a3a3a3}
.dot.ok{background:var(--ok)}
.dot.err{background:var(--err)}
.dot.warn{background:var(--warn)}
.btn{display:inline-block;background:var(--ink);color:#fff;border:0;border-radius:5px;padding:7px 12px;font:inherit;font-size:12px;cursor:pointer;text-decoration:none}
.btn:hover{opacity:.85;text-decoration:none}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.btn:disabled{opacity:.45;cursor:default}
.empty{color:var(--muted);padding:16px 0;font-size:13px}
details{border-top:1px solid var(--line);padding-top:12px}
summary{cursor:pointer;color:var(--muted);font-size:12px}
dl{display:grid;grid-template-columns:180px 1fr;gap:6px 16px;margin:0;font-size:13px}
dt{color:var(--muted)}
dd{margin:0;word-break:break-word}
.error{color:var(--err)}
code{font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;background:#f0f0f0;padding:1px 5px;border-radius:3px}
.back{display:inline-block;margin-bottom:14px;color:var(--muted);font-size:12px}
.form{display:grid;gap:16px;max-width:760px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.field{display:grid;gap:5px;color:var(--muted);font-size:12px}
.field input,.field select{width:100%;padding:8px;border:1px solid var(--line);border-radius:5px;background:#fff;color:var(--ink);font:inherit;font-size:13px}
.field input:focus,.field select:focus{outline:1px solid var(--ink);border-color:var(--ink)}
fieldset{border:1px solid var(--line);border-radius:6px;padding:14px;margin:0;display:grid;gap:12px}
legend{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:0 6px}
.hint{color:var(--muted);font-size:12px}
.error-box{border:1px solid #fecaca;background:#fef2f2;color:var(--err);padding:10px 12px;border-radius:5px;font-size:13px}
.inline{display:inline}
.btn.danger{color:var(--err);border-color:#fecaca}
pre.token{background:#f0f0f0;border:1px solid var(--line);border-radius:5px;padding:12px;overflow:auto;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}
[hidden]{display:none!important}
@media(max-width:700px){dl{grid-template-columns:1fr}.metrics{gap:18px}main{padding:24px 14px 56px}.grid{grid-template-columns:1fr}}
`;

function layout(input: {
  title: string;
  version: string;
  body: string;
  actions?: string;
  script?: string;
}): string {
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
  <div class="actions">${input.actions ?? ''}</div>
</header>
${input.body}
<footer class="small muted" style="margin-top:36px">
  Данные не покидают ваш сервер · <a href="/health">health</a>
</footer>
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

function formatBudget(value: number | undefined): string {
  if (typeof value !== 'number') return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;
}

function statusBadge(status: string): string {
  const labels: Record<string, string> = {
    new: 'новый',
    delivered: 'доставлен',
    rejected: 'отклонён',
    failed: 'ошибка',
  };
  const cls =
    status === 'delivered'
      ? 'ok'
      : status === 'failed'
        ? 'warn'
        : status === 'rejected'
          ? 'err'
          : '';
  return `<span class="dot ${cls}"></span>${escapeHtml(labels[status] ?? status)}`;
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

function sourceLink(source: SourceRecord): string {
  return `<a href="/sources/${escapeHtml(source.id)}">${escapeHtml(source.title)}</a>`;
}

function leadsTable(leads: Lead[], sourceById?: Map<string, SourceRecord>): string {
  if (!leads.length) return '<div class="empty">Лидов пока нет.</div>';
  const rows = leads
    .map((lead) => {
      const source = sourceById?.get(lead.sourceId);
      const titleText = lead.title.trim() || firstLine(lead.text, 100) || 'Без заголовка';
      const title = lead.url
        ? `<a href="${escapeHtml(lead.url)}" target="_blank" rel="noreferrer">${escapeHtml(titleText)}</a>`
        : escapeHtml(titleText);
      const meta = [source?.title, lead.city].filter(Boolean).join(' · ');
      return `<tr>
        <td class="muted">${lead.score}</td>
        <td>${title}${meta ? `<div class="small muted">${escapeHtml(meta)}</div>` : ''}</td>
        <td class="small">${formatBudget(lead.budget)}</td>
        <td class="small">${statusBadge(lead.status)}</td>
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

function textField(
  name: string,
  label: string,
  value: string,
  placeholder = '',
  type = 'text',
  hint?: string,
): string {
  return `<label class="field">${escapeHtml(label)}
    <input type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">
    ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ''}
  </label>`;
}

export function renderNewSourcePage(data: NewSourcePageData): string {
  const { kinds, values, error, version } = data;
  const options = kinds
    .map(
      (kind) =>
        `<option value="${escapeHtml(kind)}"${kind === values.kind ? ' selected' : ''}>${escapeHtml(KIND_LABELS[kind] ?? kind)}</option>`,
    )
    .join('');

  const body = `
<a class="back" href="/">← Все источники</a>
<h1>Новый источник</h1>
<p class="hint" style="margin-bottom:20px">RSS и IMAP — самые устойчивые. Telegram и Kwork зависят от публичной вёрстки. Webhook принимает данные от расширения или другого сервиса.</p>
${error ? `<div class="error-box" style="margin-bottom:16px">${escapeHtml(error)}</div>` : ''}

<form class="form" method="post" action="/sources">
  <div class="grid">
    <label class="field">Тип
      <select name="kind" id="kind">${options}</select>
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
    <p class="hint">Токен источника будет сгенерирован автоматически и показан один раз после создания.</p>
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
    <button class="btn" type="submit">Создать источник</button>
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
    title: 'Новый источник',
    version,
    body,
    actions: '<a class="btn ghost" href="/">Отмена</a>',
  });
}

export function renderSourceCreatedPage(data: CreatedSourcePageData): string {
  const { source, token, version } = data;
  const body = `
<a class="back" href="/">← Все источники</a>
<h1>Источник создан</h1>
<p class="hint">Токен показывается один раз. Сохраните его — он понадобится расширению или внешнему сервису.</p>
<pre class="token">${escapeHtml(token)}</pre>
<p style="margin-top:16px"><a class="btn" href="/sources/${escapeHtml(source.id)}">Открыть источник</a></p>`;

  return layout({
    title: 'Источник создан',
    version,
    body,
  });
}

export function renderDashboard(data: DashboardData): string {
  const { stats, health, leads, runs, version } = data;
  const sourceById = new Map(health.map((item) => [item.source.id, item.source]));

  const sourceRows = health
    .map((item) => {
      const status = healthStatus(item);
      return `<tr>
        <td>${sourceLink(item.source)}<div class="small muted">${escapeHtml(item.source.id)}</div></td>
        <td class="small">${escapeHtml(item.source.kind)}</td>
        <td class="small"><span class="dot ${status.dot}"></span>${status.label}</td>
        <td class="small muted">${formatRelative(item.lastRun?.startedAt)}</td>
        <td class="small">${item.last24h.found} / ${item.last24h.inserted} / ${item.last24h.delivered}</td>
        <td class="small error">${escapeHtml(item.lastRun?.error ?? '')}</td>
      </tr>`;
    })
    .join('');

  const body = `
<h1>Лиды</h1>
<p class="muted small" style="margin-bottom:22px">Один поток из ваших источников. Без рекламы и лишних экранов.</p>

<div class="metrics">
  ${metric(`${stats.enabledSources}/${stats.sources}`, 'источники')}
  ${metric(stats.leads, 'лидов')}
  ${metric(stats.deliveredLeads, 'доставлено')}
  ${metric(stats.rejectedLeads, 'отклонено')}
  ${metric(stats.last24h, 'за 24 часа')}
</div>

<section>
  <h2>Источники</h2>
  ${health.length
    ? `<table>
        <thead><tr><th>Источник</th><th>Тип</th><th>Статус</th><th>Последний запуск</th><th>24ч найдено / новых / доставлено</th><th>Ошибка</th></tr></thead>
        <tbody>${sourceRows}</tbody>
      </table>`
    : '<div class="empty">Источников нет. <a href="/sources/new">Добавьте первый</a> или используйте <code>radar source add</code>.</div>'}
</section>

<section>
  <h2>Последние лиды</h2>
  ${leadsTable(leads, sourceById)}
</section>

<section>
  <details>
    <summary>Последние запуски</summary>
    <div style="margin-top:12px">${runsTable(runs, sourceById)}</div>
  </details>
</section>`;

  return layout({
    title: 'Лиды',
    version,
    body,
    actions: '<a class="btn ghost" href="/sources/new">Добавить</a><button class="btn" data-poll="/api/poll">Опросить все</button>',
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

export function renderSourcePage(data: SourcePageData): string {
  const { source, health, leads, runs, version } = data;
  const status = healthStatus(health);
  const config = configEntries(source.config)
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join('');

  const webhook = source.kind === 'webhook'
    ? `<p class="small muted" style="margin-top:12px">Приём: <code>POST /api/ingest/${escapeHtml(source.id)}</code> с заголовком <code>x-radar-token</code>.</p>`
    : '';

  const body = `
<a class="back" href="/">← Все источники</a>
<h1>${escapeHtml(source.title)}</h1>
<p class="small muted">${escapeHtml(source.kind)} · ${source.enabled ? 'включён' : 'выключен'} · <span class="dot ${status.dot}"></span>${status.label}</p>

<div class="metrics" style="margin-top:22px">
  ${metric(health.last24h.found, 'найдено за 24ч')}
  ${metric(health.last24h.inserted, 'новых')}
  ${metric(health.last24h.delivered, 'доставлено')}
  ${metric(health.last24h.rejected, 'отклонено')}
  ${metric(`${health.successRate}%`, 'успешных запусков')}
  ${metric(formatRelative(health.lastRun?.startedAt), 'последний запуск')}
</div>

<section>
  <h2>Конфигурация</h2>
  <dl>${config || '<dt>—</dt><dd>пусто</dd>'}</dl>
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
    body,
    actions: `<button class="btn" data-poll="/api/sources/${escapeHtml(source.id)}/poll">Опросить</button>
      <form class="inline" method="post" action="/sources/${escapeHtml(source.id)}/toggle">
        <button class="btn ghost" type="submit">${source.enabled ? 'Выключить' : 'Включить'}</button>
      </form>
      <form class="inline" method="post" action="/sources/${escapeHtml(source.id)}/delete" onsubmit="return confirm('Удалить источник?')">
        <button class="btn ghost danger" type="submit">Удалить</button>
      </form>`,
    script: POLL_SCRIPT,
  });
}

export function renderNotFound(version: string): string {
  return layout({
    title: 'Не найдено',
    version,
    body: `<h1>Источник не найден</h1><p class="muted" style="margin-top:8px"><a href="/">Вернуться на главную</a></p>`,
  });
}
