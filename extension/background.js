chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'radar-send-selection',
    title: 'Отправить заказ в Radar',
    contexts: ['selection'],
  });
});

async function sendToRadar(payload) {
  const stored = await chrome.storage.local.get('radarConfig');
  const config = stored.radarConfig;
  if (!config?.base || !config?.sourceId || !config?.token) {
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Radar',
      message: 'Настройте расширение: укажите адрес сервера и токен источника в попапе.',
    }).catch(() => {});
    return false;
  }

  const base = config.base.replace(/\/+$/, '');
  const response = await fetch(`${base}/api/ingest/${encodeURIComponent(config.sourceId)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-radar-token': config.token,
    },
    body: JSON.stringify(payload),
  });

  return response.ok;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'radar-send-selection') {
    const text = info.selectionText?.trim();
    if (!text) return;

    const stored = await chrome.storage.local.get('radarConfig');
    const contributor = stored.radarConfig?.contributor;
    const author = contributor ? `${contributor} (community)` : 'Community Extension';

    const ok = await sendToRadar({
      title: tab?.title || 'Заказ из браузера',
      text,
      url: tab?.url || info.pageUrl,
      author,
      externalId: `browser:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
    });

    if (chrome.action) {
      chrome.action.setBadgeText({ text: ok ? 'OK' : 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: ok ? '#111111' : '#dc2626' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
    }
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'send-page') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const [injection] = await chrome.scripting.executeScript({
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

    const page = injection?.result;
    if (!page) return;

    const stored = await chrome.storage.local.get('radarConfig');
    const contributor = stored.radarConfig?.contributor;
    const author = contributor ? `${contributor} (community)` : 'Community Extension';

    const ok = await sendToRadar({
      title: page.title,
      text: page.selection || page.description || page.title,
      url: page.url,
      author,
      externalId: `browser:${page.url}`,
    });

    if (chrome.action) {
      chrome.action.setBadgeText({ text: ok ? 'OK' : 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: ok ? '#111111' : '#dc2626' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
    }
  }
});
