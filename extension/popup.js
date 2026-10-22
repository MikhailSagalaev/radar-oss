const fields = {
  contributor: document.getElementById('contributor'),
  base: document.getElementById('base'),
  sourceId: document.getElementById('sourceId'),
  token: document.getElementById('token'),
  status: document.getElementById('status'),
  send: document.getElementById('send'),
  pageTitle: document.getElementById('page-title'),
  pageUrl: document.getElementById('page-url'),
  details: document.getElementById('settings-details'),
};

function normalizeBase(value) {
  return value.trim().replace(/\/+$/, '');
}

function setStatus(message, kind = '') {
  fields.status.textContent = message;
  fields.status.className = `status ${kind}`.trim();
}

async function loadConfig() {
  const stored = await chrome.storage.local.get('radarConfig');
  const config = stored.radarConfig ?? {};
  fields.contributor.value = config.contributor ?? '';
  fields.base.value = config.base ?? 'http://127.0.0.1:8787';
  fields.sourceId.value = config.sourceId ?? '';
  fields.token.value = config.token ?? '';

  if (!config.sourceId || !config.token) {
    fields.details.open = true;
  }
  return config;
}

async function readConfig() {
  return {
    contributor: fields.contributor.value.trim(),
    base: normalizeBase(fields.base.value),
    sourceId: fields.sourceId.value.trim(),
    token: fields.token.value.trim(),
  };
}

async function saveConfig(event) {
  event.preventDefault();
  const config = await readConfig();
  if (!config.base || !config.sourceId || !config.token) {
    setStatus('Заполните адрес, ID и токен.', 'err');
    return;
  }
  await chrome.storage.local.set({ radarConfig: config });
  setStatus('Настройки сохранены.', 'ok');
  fields.details.open = false;
}

async function readPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Нет активной вкладки.');

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const description =
        document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
      return {
        title: document.title,
        url: location.href,
        selection: String(window.getSelection() ?? '').trim().slice(0, 4000),
        description,
      };
    },
  });
  return result.result;
}

async function initPreview() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      fields.pageTitle.textContent = tab.title || 'Вкладка без названия';
      fields.pageUrl.textContent = tab.url ? new URL(tab.url).hostname : '';
    }
  } catch {
    fields.pageTitle.textContent = 'Текущая страница';
  }
}

async function sendPage() {
  const config = await readConfig();
  if (!config.base || !config.sourceId || !config.token) {
    fields.details.open = true;
    setStatus('Сначала сохраните настройки сервера.', 'err');
    return;
  }

  fields.send.disabled = true;
  setStatus('Отправляем в Radar...');
  try {
    const page = await readPage();
    const text = page.selection || page.description || page.title;
    if (!text) throw new Error('На странице нет текста для отправки.');

    const author = config.contributor
      ? `${config.contributor} (community)`
      : 'Community Extension';

    const response = await fetch(
      `${config.base}/api/ingest/${encodeURIComponent(config.sourceId)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-radar-token': config.token,
        },
        body: JSON.stringify({
          title: page.title,
          text,
          url: page.url,
          author,
          externalId: `browser:${page.url}`,
        }),
      },
    );

    if (!response.ok) {
      throw new Error((await response.text()).slice(0, 200) || `HTTP ${response.status}`);
    }
    setStatus('✓ Успешно отправлено в Radar!', 'ok');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'err');
  } finally {
    fields.send.disabled = false;
  }
}

document.getElementById('config').addEventListener('submit', saveConfig);
fields.send.addEventListener('click', sendPage);
loadConfig().catch((error) => setStatus(String(error), 'err'));
initPreview();
