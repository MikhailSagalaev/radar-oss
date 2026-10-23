import type { Lead, RunRecord, SourceHealth, SourceRecord, Stats } from '../core/types.ts';
import { escapeHtml, firstLine } from '../core/text.ts';

export interface LeadsPageData {
  stats: Stats;
  health: SourceHealth[];
  leads: Lead[];
  query: string;
  status: string;
  type?: string;
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
  interesting: 'интересно',
  applied: 'откликнулся',
  in_work: 'в работе',
  delivered: 'доставлен',
  rejected: 'отклонён',
  failed: 'ошибка',
};

const STYLE = `
:root {
  --bg: #ffffff;
  --surface: #fafafa;
  --surface-hover: #f4f4f5;
  --ink: #09090b;
  --muted: #71717a;
  --line: #e4e4e7;
  --line-strong: #d4d4d8;
  --soft: #f4f4f5;
  --emerald: #10b981;
  --rose: #ef4444;
  --amber: #f59e0b;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #09090b;
    --surface: #121215;
    --surface-hover: #1c1c22;
    --ink: #f4f4f5;
    --muted: #a1a1aa;
    --line: #27272a;
    --line-strong: #3f3f46;
    --soft: #18181b;
    --emerald: #34d399;
    --rose: #f87171;
    --amber: #fbbf24;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; color-scheme: light dark; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-dot {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.45); }
  70% { box-shadow: 0 0 0 5px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
main {
  max-width: 1040px;
  margin: 0 auto;
  padding: 0 24px 80px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.top {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 18px 0;
  border-bottom: 1px solid var(--line);
  margin-bottom: 32px;
}
.brand {
  font-weight: 700;
  letter-spacing: -0.03em;
  text-decoration: none;
  color: var(--ink);
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.15s ease;
}
.brand:hover { opacity: 0.8; }
.version {
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 1px 5px;
}
.nav { display: flex; gap: 20px; margin-left: 12px; }
.nav a {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  padding: 4px 0;
  border-bottom: 1.5px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.nav a:hover { color: var(--ink); text-decoration: none; }
.nav a.active { color: var(--ink); border-color: var(--ink); }
.actions { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
h1 {
  font-size: 26px;
  line-height: 1.2;
  letter-spacing: -0.03em;
  margin: 0 0 4px;
  font-weight: 600;
}
h2 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 0 0 10px;
  font-weight: 600;
}
p { margin: 0; }
a { color: var(--ink); text-decoration: none; transition: color 0.15s ease; }
a:hover { text-decoration: underline; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0 0 20px;
  min-width: 0;
}
.metrics { display: flex; flex-wrap: wrap; gap: 32px; margin: 0 0 32px; }
.metric b {
  display: block;
  font-size: 24px;
  line-height: 1.15;
  letter-spacing: -0.03em;
  font-weight: 700;
}
.metric span { font-size: 12px; color: var(--muted); margin-top: 2px; display: block; }
.inline { display: inline; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; min-width: 0; }
.chip {
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--line);
  border-radius: 9999px;
  padding: 4px 12px;
  text-decoration: none;
  color: var(--muted);
  background: transparent;
  white-space: nowrap;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.chip:hover {
  color: var(--ink);
  border-color: var(--line-strong);
  background: var(--surface-hover);
  text-decoration: none;
}
.chip:active { transform: scale(0.96); }
.chip.active {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
.search { display: flex; gap: 6px; margin-left: auto; }
.search input {
  width: 200px;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font: inherit;
  font-size: 12.5px;
  background: var(--bg);
  color: var(--ink);
  transition: all 0.15s ease;
}
.search input:focus {
  outline: 0;
  border-color: var(--ink);
  box-shadow: 0 0 0 1px var(--ink), 0 1px 2px rgba(0, 0, 0, 0.04);
}
.search button { flex: 0 0 auto; }
.list { border-top: 1px solid var(--line); }
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
  text-decoration: none;
  color: inherit;
  transition: opacity 0.12s ease;
}
.row:hover {
  text-decoration: none;
  opacity: 0.72;
}
.row:hover .row-title { text-decoration: underline; }
.row-title {
  font-weight: 600;
  font-size: 14.5px;
  line-height: 1.35;
  letter-spacing: -0.015em;
}
.row-meta {
  color: var(--muted);
  font-size: 12px;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.row-side {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
.score {
  font-weight: 700;
  color: var(--ink);
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
}
.dot {
  display: inline-block;
  width: 6.5px;
  height: 6.5px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: 1px;
  background: #a1a1aa;
}
.dot.ok {
  background: var(--emerald);
  animation: pulse-dot 2.4s infinite cubic-bezier(0.45, 0, 0.55, 1);
}
.dot.err {
  background: var(--rose);
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}
.dot.warn { background: var(--amber); }
.dot.info { background: #3b82f6; }
.search-hero {
  margin: 12px 0 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.search-bar {
  display: flex;
  gap: 8px;
  width: 100%;
}
.search-bar input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font: inherit;
  font-size: 13.5px;
  background: var(--bg);
  color: var(--ink);
  transition: all 0.15s ease;
}
.search-bar input:focus {
  outline: 0;
  border-color: var(--ink);
  box-shadow: 0 0 0 1px var(--ink), 0 2px 4px rgba(0, 0, 0, 0.04);
}
.funnel-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-bottom: 24px;
}
.funnel-btn {
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.funnel-btn:hover {
  color: var(--ink);
  border-color: var(--line-strong);
}
.funnel-btn.active {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
  font-weight: 600;
}
.type-tabs {
  display: inline-flex;
  gap: 2px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 3px;
  width: fit-content;
}
.type-tab {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  text-decoration: none;
  padding: 5px 14px;
  border-radius: 6px;
  transition: all 0.15s ease;
}
.type-tab:hover {
  color: var(--ink);
  text-decoration: none;
}
.type-tab.active {
  background: var(--bg);
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.community-votes {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.vote-btn {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}
.vote-btn:hover {
  background: var(--surface-hover);
  border-color: var(--line-strong);
}
.vote-btn:active {
  transform: scale(0.97);
}
.vote-btn .vote-count {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  font-size: 11px;
}
.vote-btn-danger:hover {
  border-color: var(--rose);
  color: var(--rose);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--ink);
  color: var(--bg);
  border: 1px solid var(--ink);
  border-radius: 6px;
  padding: 6px 12px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: -0.01em;
  cursor: pointer;
  text-decoration: none;
  line-height: 1.4;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.btn:hover {
  opacity: 0.9;
  text-decoration: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.btn:active { transform: scale(0.97); }
.btn.ghost {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--line);
  box-shadow: none;
}
.btn.ghost:hover {
  background: var(--surface-hover);
  border-color: var(--line-strong);
  opacity: 1;
}
.btn.ghost:active { transform: scale(0.97); }
.btn.danger { border-style: dashed; }
.btn:disabled { opacity: 0.4; cursor: default; }
.empty {
  border: 1px dashed var(--line);
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  color: var(--muted);
  background: var(--surface);
}
.empty h2 {
  color: var(--ink);
  font-size: 15px;
  text-transform: none;
  letter-spacing: -0.01em;
  margin-bottom: 6px;
}
.empty p { max-width: 460px; margin: 0 auto 16px; font-size: 13px; }
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 36px;
  margin-top: 26px;
}
.lead-text {
  white-space: pre-wrap;
  font-size: 14.5px;
  line-height: 1.65;
  margin: 10px 0 0;
  color: var(--ink);
}
.meta-list { margin: 0; }
.meta-list div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.meta-list dt { color: var(--muted); }
.meta-list dd { margin: 0; text-align: right; word-break: break-word; font-weight: 500; }
.meta-list a { color: var(--ink); }
.reasons { margin: 8px 0 0; padding-left: 18px; font-size: 12px; color: var(--muted); }
.reasons li { margin: 3px 0; }
section { margin-bottom: 32px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th {
  text-align: left;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
  padding: 0 10px 10px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
td { padding: 10px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
table a { color: inherit; text-decoration: none; }
table a:hover { text-decoration: underline; }
.error { color: var(--rose); font-weight: 600; }
.back {
  display: inline-block;
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 500;
  transition: all 0.15s ease;
}
.back:hover { color: var(--ink); text-decoration: none; transform: translateX(-2px); }
.form { display: grid; gap: 14px; max-width: 720px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: grid; gap: 5px; color: var(--muted); font-size: 12px; }
.field input, .field select {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  transition: all 0.15s ease;
}
.field input:focus, .field select:focus {
  outline: 0;
  border-color: var(--ink);
  box-shadow: 0 0 0 1px var(--ink), 0 1px 2px rgba(0, 0, 0, 0.04);
}
.field input:disabled, .field select:disabled { background: var(--soft); color: var(--muted); }
fieldset {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
  margin: 0;
  display: grid;
  gap: 12px;
  background: var(--surface);
}
legend {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-weight: 600;
  padding: 0 6px;
}
.hint { color: var(--muted); font-size: 12px; }
.error-box {
  border: 1px solid var(--rose);
  background: rgba(239, 68, 68, 0.06);
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--rose);
}
.notice {
  border: 1px solid var(--line);
  background: var(--surface);
  padding: 12px 14px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 20px;
}
.ai-box {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}
.tag {
  display: inline-flex;
  align-items: center;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 2px 8px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--ink);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
pre.token {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 12px;
  overflow: auto;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
  color: var(--ink);
}
[hidden] { display: none !important; }
footer {
  color: var(--muted);
  font-size: 11px;
  margin-top: auto;
  padding-top: 48px;
  border-top: 1px solid var(--line);
}
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
@media (max-width: 700px) {
  main { padding: 0 16px 56px; }
  .top { flex-wrap: wrap; gap: 10px 14px; }
  .nav { order: 3; width: 100%; margin-left: 0; }
  .actions { margin-left: 0; }
  .page-head { flex-direction: column; align-items: flex-start; }
  .detail-grid { grid-template-columns: 1fr; gap: 24px; }
  .grid { grid-template-columns: 1fr; }
  .search { margin-left: 0; width: 100%; min-width: 0; max-width: calc(100vw - 32px); }
  .search input { flex: 1 1 0; width: 0; min-width: 0; }
  .filters { display: grid; grid-template-columns: 1fr; align-items: stretch; gap: 8px; max-width: calc(100vw - 32px); }
  .chips { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; max-width: calc(100vw - 32px); gap: 6px; }
  .chip { text-align: center; padding: 4px 6px; }
  .row { grid-template-columns: 1fr; gap: 8px; padding: 10px 6px; }
  .row-side { justify-content: flex-start; }
}
`;

function layout(input: {
  title: string;
  version: string;
  active?: 'leads' | 'sources' | 'extension';
  body: string;
  actions?: string;
  script?: string;
}): string {
  const nav = (key: 'leads' | 'sources' | 'extension', label: string, href: string): string =>
    `<a href="${href}"${input.active === key ? ' class="active"' : ''}>${label}</a>`;

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)} · Open Radar</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<header class="top">
  <a class="brand" href="/">Open Radar</a>
  <span class="version">v${escapeHtml(input.version)}</span>
  <nav class="nav">
    ${nav('leads', 'Заказы', '/')}
    ${nav('sources', 'Источники', '/sources')}
  </nav>
  <div class="actions">${input.actions ?? ''}</div>
</header>
${input.body}
<footer>Данные не покидают ваш сервер · <a href="/health">health</a></footer>
</main>
<dialog id="add-source-dialog" style="border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);padding:24px;max-width:480px;width:90vw;box-shadow:0 16px 40px rgba(0,0,0,0.18)">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
    <h3 style="margin:0;font-size:16px;font-weight:600">Добавить источник</h3>
    <button type="button" onclick="document.getElementById('add-source-dialog').close()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;line-height:1">&times;</button>
  </div>
  <form method="post" action="/sources" style="display:grid;gap:14px">
    <div style="display:grid;gap:5px">
      <label style="font-size:12px;color:var(--muted)">Тип источника</label>
      <select name="kind" id="dlg-kind" style="padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit" onchange="
        const val = this.value;
        document.getElementById('dlg-url-grp').style.display = val === 'rss' ? 'grid' : 'none';
        document.getElementById('dlg-kwork-grp').style.display = val === 'kwork' ? 'grid' : 'none';
        document.getElementById('dlg-tg-grp').style.display = val === 'telegram' ? 'grid' : 'none';
      ">
        <option value="rss">RSS / Atom фид</option>
        <option value="kwork">Kwork категория</option>
        <option value="telegram">Telegram канал</option>
        <option value="webhook">Входящий Webhook</option>
      </select>
    </div>
    <div style="display:grid;gap:5px">
      <label style="font-size:12px;color:var(--muted)">Название</label>
      <input name="title" required placeholder="Например: FL.ru — Разработка" style="padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit">
    </div>
    <div id="dlg-url-grp" style="display:grid;gap:5px">
      <label style="font-size:12px;color:var(--muted)">URL фида</label>
      <input name="url" placeholder="https://www.fl.ru/rss/all.xml" style="padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit">
    </div>
    <div id="dlg-kwork-grp" style="display:none;gap:5px">
      <label style="font-size:12px;color:var(--muted)">ID категории Kwork</label>
      <input name="categoryId" placeholder="11" style="padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit">
    </div>
    <div id="dlg-tg-grp" style="display:none;gap:5px">
      <label style="font-size:12px;color:var(--muted)">Канал Telegram</label>
      <input name="channel" placeholder="freelance_orders" style="padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit">
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
      <button class="btn ghost" type="button" onclick="document.getElementById('add-source-dialog').close()">Отмена</button>
      <button class="btn" type="submit">Создать</button>
    </div>
  </form>
</dialog>
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
    status === 'in_work' || status === 'delivered'
      ? 'ok'
      : status === 'interesting' || status === 'applied'
        ? 'info'
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
    lead.type === 'job' ? 'Вакансия' : 'Заказ',
    source?.title,
    lead.category,
    lead.city ?? (lead.isRemote !== false ? 'Удаленно' : undefined),
    typeof lead.budget === 'number' ? formatBudget(lead.budget) : undefined,
    formatRelative(lead.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');

  const skillsChips = lead.skills?.length
    ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
        ${lead.skills.slice(0, 4).map((s) => `<span class="tag" style="font-size:10.5px;padding:1px 6px">${escapeHtml(s)}</span>`).join('')}
      </div>`
    : '';

  return `<a class="row" href="/leads/${escapeHtml(lead.id)}">
    <div>
      <div class="row-title">${escapeHtml(leadTitle(lead))}</div>
      <div class="row-meta">${escapeHtml(meta)}</div>
      ${skillsChips}
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
  const { stats, health, leads, query, status, type = '', version } = data;
  const sourceById = new Map(health.map((item) => [item.source.id, item.source]));

  const typeTabs: Array<{ key: string; label: string }> = [
    { key: '', label: 'Все' },
    { key: 'gig', label: 'Заказы' },
    { key: 'job', label: 'Вакансии' },
  ];

  const statusFilters: Array<{ key: string; label: string }> = [
    { key: '', label: 'Все' },
    { key: 'new', label: 'Новые' },
    { key: 'interesting', label: 'Интересно' },
    { key: 'applied', label: 'Отклики' },
    { key: 'in_work', label: 'В работе' },
    { key: 'delivered', label: 'Доставленные' },
    { key: 'rejected', label: 'Отклонённые' },
  ];

  const hrefForType = (nextType: string): string => {
    const params = new URLSearchParams();
    if (nextType) params.set('type', nextType);
    if (status) params.set('status', status);
    if (query) params.set('q', query);
    const suffix = params.toString();
    return suffix ? `/?${suffix}` : '/';
  };

  const hrefForStatus = (nextStatus: string): string => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (nextStatus) params.set('status', nextStatus);
    if (query) params.set('q', query);
    const suffix = params.toString();
    return suffix ? `/?${suffix}` : '/';
  };

  const tabs = typeTabs
    .map(
      (item) =>
        `<a class="type-tab${item.key === type ? ' active' : ''}" href="${escapeHtml(hrefForType(item.key))}">${item.label}</a>`,
    )
    .join('');

  const chips = statusFilters
    .map(
      (item) =>
        `<a class="chip${item.key === status ? ' active' : ''}" href="${escapeHtml(hrefForStatus(item.key))}">${item.label}</a>`,
    )
    .join('');

  const rows = leads.map((lead) => leadRow(lead, sourceById.get(lead.sourceId))).join('');

  const empty =
    stats.sources === 0
      ? `<div class="empty">
          <h2>Начните с источника</h2>
          <p>RSS, IMAP или webhook. Дальше Radar сам собирает заказы, убирает дубли и присылает только подходящие.</p>
          <button class="btn" type="button" onclick="document.getElementById('add-source-dialog')?.showModal()">Добавить источник</button>
        </div>`
      : `<div class="empty">
          <h2>Лидов пока нет</h2>
          <p>Источники уже настроены. Запустите опрос — первые заказы появятся здесь.</p>
          <button class="btn" data-poll="/api/poll">Опросить все</button>
        </div>`;

  const body = `
<div class="search-hero">
  <div class="type-tabs">${tabs}</div>
  <form class="search-form" method="get" action="/">
    ${type ? `<input type="hidden" name="type" value="${escapeHtml(type)}">` : ''}
    ${status ? `<input type="hidden" name="status" value="${escapeHtml(status)}">` : ''}
    <div class="search-bar">
      <input name="q" id="search-input" value="${escapeHtml(query)}" placeholder="Поиск по задачам, навыкам, категориям или городам... (нажмите / для фокуса)" aria-label="Поиск по заказам">
      <button class="btn" type="submit">Найти</button>
    </div>
  </form>
  <div class="chips">${chips}</div>
</div>

<div class="list">${rows || empty}</div>`;

  const searchHotkeyScript = `
${POLL_SCRIPT}
<script>
window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
    document.getElementById('search-input')?.focus();
  }
});
</script>`;

  const pageTitle = query
    ? `${query} — Поиск`
    : type === 'job'
    ? 'Вакансии'
    : type === 'gig'
    ? 'Заказы'
    : 'Заказы';

  return layout({
    title: pageTitle,
    version,
    active: 'leads',
    body,
    actions:
      '<button class="btn ghost" type="button" onclick="document.getElementById(\'add-source-dialog\')?.showModal()">Добавить источник</button><button class="btn" data-poll="/api/poll">Опросить все</button>',
    script: searchHotkeyScript,
  });
}

function safeHttpUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {}
  return undefined;
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

  const aiSummary = lead.reasons.find((r) => r.startsWith('llm:summary:'))?.slice(12);
  const aiCategory = lead.reasons.find((r) => r.startsWith('llm:category:'))?.slice(13);
  const aiSkills = lead.reasons.find((r) => r.startsWith('llm:skills:'))?.slice(11);
  const aiUrgency = lead.reasons.find((r) => r.startsWith('llm:urgency:'))?.slice(12);
  const aiConfidence = lead.reasons.find((r) => r.startsWith('llm:lead:'))?.slice(9);

  const aiBox = (aiSummary || aiCategory || aiSkills)
    ? `<div class="ai-box">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
          <span style="font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">AI Анализ заказа</span>
          ${aiConfidence ? `<span class="muted small">${Math.round(Number(aiConfidence) * 100)}% совпадение</span>` : ''}
        </div>
        ${aiSummary ? `<p style="font-weight:600;margin:0 0 10px">${escapeHtml(aiSummary)}</p>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          ${aiCategory ? `<span class="tag">Категория: <b>${escapeHtml(aiCategory)}</b></span>` : ''}
          ${aiUrgency ? `<span class="tag">Срочность: <b>${escapeHtml(aiUrgency)}</b></span>` : ''}
          ${aiSkills ? aiSkills.split(',').map((s) => `<span class="tag">${escapeHtml(s.trim())}</span>`).join('') : ''}
        </div>
      </div>`
    : '';

  const cleanUrl = safeHttpUrl(lead.url);

  const body = `
<a class="back" href="/">Все заказы</a>
<div class="page-head">
  <div>
    <h1>${escapeHtml(leadTitle(lead))}</h1>
    <p class="muted small">${statusDot(lead.status)} · ${formatRelative(lead.createdAt)}</p>
  </div>
  <div class="actions">
    ${cleanUrl ? `<a class="btn" href="${escapeHtml(cleanUrl)}" target="_blank" rel="noopener noreferrer">Открыть оригинал</a>` : ''}
    <button class="btn ghost" id="copy-lead" type="button">Копировать текст</button>
  </div>
</div>

<div class="funnel-bar">
  <form method="post" action="/leads/${escapeHtml(lead.id)}/status" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
    <span class="small muted" style="margin-right:4px">Статус:</span>
    <button name="status" value="new" class="funnel-btn ${lead.status === 'new' ? 'active' : ''}">Новый</button>
    <button name="status" value="interesting" class="funnel-btn ${lead.status === 'interesting' ? 'active' : ''}">Интересно</button>
    <button name="status" value="applied" class="funnel-btn ${lead.status === 'applied' ? 'active' : ''}">Откликнулся</button>
    <button name="status" value="in_work" class="funnel-btn ${lead.status === 'in_work' ? 'active' : ''}">В работе</button>
    <button name="status" value="rejected" class="funnel-btn ${lead.status === 'rejected' ? 'active' : ''}">Отклонён</button>
  </form>
  <form method="post" action="/leads/${escapeHtml(lead.id)}/vote" class="community-votes">
    <span class="small muted" style="margin-right:4px">Сообщество:</span>
    <button name="signal" value="useful" class="vote-btn" type="submit">Полезно <span class="vote-count">${lead.votes_up ?? 0}</span></button>
    <button name="signal" value="junk" class="vote-btn" type="submit">Мусор <span class="vote-count">${lead.votes_down ?? 0}</span></button>
    <button name="signal" value="scam" class="vote-btn vote-btn-danger" type="submit">Скам <span class="vote-count">${lead.votes_scam ?? 0}</span></button>
    <button name="signal" value="closed" class="vote-btn" type="submit">Закрыто <span class="vote-count">${lead.votes_closed ?? 0}</span></button>
  </form>
  <form method="post" action="/leads/${escapeHtml(lead.id)}/feedback" style="display:flex;gap:6px;align-items:center">
    <span class="small muted" style="margin-right:4px">Оценка:</span>
    <button name="feedback" value="up" class="btn ghost small" title="Подходит">+10 Подходит</button>
    <button name="feedback" value="down" class="btn ghost small" title="Мусор">-20 Мусор</button>
  </form>
</div>

<div class="detail-grid">
  <section>
    ${aiBox}
    <h2>Текст заказа</h2>
    <p class="lead-text" id="lead-text">${escapeHtml(lead.text)}</p>
    ${lead.reasons.length ? `<h2 style="margin-top:26px">Почему так</h2><ul class="reasons">${lead.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}
  </section>
  <aside>
    <h2>Детали</h2>
    <dl class="meta-list">
      <div><dt>Тип</dt><dd>${lead.type === 'job' ? 'Вакансия' : 'Заказ'}</dd></div>
      <div><dt>Голоса</dt><dd>+${lead.votes_up ?? 0} / -${lead.votes_down ?? 0} / скам: ${lead.votes_scam ?? 0} / закрыто: ${lead.votes_closed ?? 0}</dd></div>
      <div><dt>Источник</dt><dd>${source ? `<a href="/sources/${escapeHtml(source.id)}">${escapeHtml(source.title)}</a>` : escapeHtml(lead.sourceId)}</dd></div>
      ${lead.category ? `<div><dt>Категория</dt><dd><b>${escapeHtml(lead.category)}</b></dd></div>` : ''}
      <div><dt>Локация</dt><dd>${escapeHtml(lead.city ?? (lead.isRemote !== false ? 'Удалённо' : '—'))}</dd></div>
      <div><dt>Формат</dt><dd>${lead.isRemote !== false ? 'Удалённая работа' : 'На объекте / Офлайн'}</dd></div>
      <div><dt>Бюджет</dt><dd>${formatBudget(lead.budget)}</dd></div>
      <div><dt>Скор</dt><dd>${lead.score}</dd></div>
      <div><dt>Опубликован</dt><dd>${formatDate(lead.publishedAt)}</dd></div>
      <div><dt>Добавлен</dt><dd>${formatDate(lead.createdAt)}</dd></div>
      ${lead.author ? `<div><dt>Автор</dt><dd>${escapeHtml(lead.author)}</dd></div>` : ''}
    </dl>
    ${lead.skills?.length ? `
      <h2 style="margin-top:20px">Навыки и стек</h2>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${lead.skills.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join('')}
      </div>` : ''}
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
    <p>Начните с готового набора популярных бирж (FL.ru, Хабр, Kwork, Telegram) или добавьте свой источник вручную.</p>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
      <form method="post" action="/sources/presets">
        <button class="btn" type="submit">Загрузить популярные биржи</button>
      </form>
      <a class="btn ghost" href="/sources/new">Добавить вручную</a>
    </div>
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
    actions:
      '<form method="post" action="/sources/presets" style="display:inline"><button class="btn ghost" type="submit">Загрузить биржи</button></form><a class="btn" href="/sources/new">Добавить источник</a>',
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

export interface ExtensionPageData {
  version: string;
  webhookSources: SourceRecord[];
}

export function renderExtensionPage(data: ExtensionPageData): string {
  const { version, webhookSources } = data;
  const script = `<script>
document.addEventListener('DOMContentLoaded', () => {
  const urlEl = document.getElementById('detected-url');
  if (urlEl) urlEl.textContent = window.location.origin;

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-copy');
      const target = document.getElementById(targetId);
      if (target) {
        await navigator.clipboard.writeText(target.textContent || target.value || '');
        const prev = btn.textContent;
        btn.textContent = 'Скопировано!';
        setTimeout(() => { btn.textContent = prev; }, 2000);
      }
    });
  });
});
</script>`;

  const sourcesList = webhookSources.length
    ? webhookSources
        .map(
          (s) => `
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-weight:600;font-size:13.5px">${escapeHtml(s.title)}</div>
          <div class="muted small">ID источника: <code id="src-id-${escapeHtml(s.id)}">${escapeHtml(s.id)}</code></div>
        </div>
        <button class="btn ghost" data-copy="src-id-${escapeHtml(s.id)}" type="button">Копировать ID</button>
      </div>`
        )
        .join('')
    : `<div class="empty" style="padding:24px 16px">
        <h2>Нет активного вебхук-источника</h2>
        <p>Создайте источник типа Webhook, чтобы принимать заказы из браузера.</p>
        <a class="btn" href="/sources/new">Создать Webhook источник</a>
      </div>`;

  const body = `
<div class="page-head">
  <div>
    <h1>Расширение для браузера</h1>
    <p class="muted small">Отправляйте заказы в Radar в один клик с любых сайтов, бирж и чатов.</p>
  </div>
</div>

<div class="detail-grid">
  <section>
    <h2>Возможности</h2>
    <div style="display:grid;gap:12px;margin-bottom:28px">
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px">
        <div style="font-weight:600;margin-bottom:4px">Контекстное меню по правому клику</div>
        <div class="muted small">Выделите текст любого заказа на странице (Авито, Telegram Web, форум) → правый клик → «Отправить заказ в Radar». Заказ мгновенно сохраняется в общую базу.</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px">
        <div style="font-weight:600;margin-bottom:4px">Быстрая отправка всей страницы (Alt+Shift+R)</div>
        <div class="muted small">Нажмите горячие клавиши или иконку на панели расширений для автоматического захвата заголовка, URL и описания страницы.</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px">
        <div style="font-weight:600;margin-bottom:4px">Авторство контрибьютора комьюнити</div>
        <div class="muted small">В настройках расширения каждый участник вводит свой никнейм (@telegram), и все найденные им лиды в базе подписываются его именем.</div>
      </div>
    </div>

    <h2>Установка расширения (3 простых шага)</h2>
    <div style="display:grid;gap:12px;margin-bottom:28px">
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px">
        <div style="font-weight:600;margin-bottom:4px">Шаг 1. Получите папку extension/</div>
        <div class="muted small">Расширение готово и находится прямо в корне проекта в папке <code>extension/</code>. Если раздаёте участникам — заархивируйте эту папку в ZIP.</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px">
        <div style="font-weight:600;margin-bottom:4px">Шаг 2. Откройте chrome://extensions</div>
        <div class="muted small">В Chrome, Edge или Яндекс.Браузере откройте <code>chrome://extensions/</code> и включите тумблер <b>«Режим разработчика»</b> (в правом верхнем углу).</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px">
        <div style="font-weight:600;margin-bottom:4px">Шаг 3. Загрузите расширение</div>
        <div class="muted small">Нажмите кнопку <b>«Загрузить распакованное расширение»</b> и укажите папку <code>extension</code>. Иконка Radar появится в панели браузера!</div>
      </div>
    </div>
  </section>

  <aside>
    <h2>Настройки подключения</h2>
    <dl class="meta-list" style="margin-bottom:20px">
      <div>
        <dt>Адрес сервера</dt>
        <dd><code id="detected-url">http://127.0.0.1:8787</code></dd>
      </div>
    </dl>
    <button class="btn ghost" style="width:100%;margin-bottom:20px" data-copy="detected-url" type="button">Копировать адрес сервера</button>

    <h2>Источники Webhook</h2>
    ${sourcesList}
  </aside>
</div>`;

  return layout({
    title: 'Расширение для браузера',
    version,
    active: 'extension',
    body,
    script,
  });
}
