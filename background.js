// Background script to handle context menu webhook triggering
if (typeof importScripts === 'function') {
  importScripts('/utils/browser-polyfill.js', '/utils/sendWebhook.js', '/utils/webhookUtils.js');
}

const browserAPI = window.getBrowserAPI();
let webhookMap = {};
let cachedWebhooks = [];

let sendWebhook;
let loadWebhooks;
let filterWebhooksByUrl;
if (typeof module !== 'undefined' && module.exports) {
  sendWebhook = require('./utils/sendWebhook').sendWebhook;
  ({ loadWebhooks, filterWebhooksByUrl } = require('./utils/webhookUtils'));
} else {
  sendWebhook = window.sendWebhook;
  loadWebhooks = window.loadWebhooks;
  filterWebhooksByUrl = window.filterWebhooksByUrl;
}

async function refreshWebhooks() {
  const hooks = await loadWebhooks();
  cachedWebhooks = hooks;
  webhookMap = Object.fromEntries(hooks.map(w => [w.id, w]));
  return hooks;
}

async function createContextMenus() {
  if (browserAPI.contextMenus.removeAll) {
    await browserAPI.contextMenus.removeAll();
  }
  const hooks = await refreshWebhooks();
  hooks.forEach(hook => {
    const title = browserAPI.i18n.getMessage('contextMenuSend', hook.label) || hook.label;
    browserAPI.contextMenus.create({
      id: hook.id,
      title,
      contexts: ['all'],
    });
  });
}

browserAPI.contextMenus.onShown?.addListener(async (info, tab) => {
  const url = info.pageUrl || tab?.url || '';
  const visibleHooks = filterWebhooksByUrl(cachedWebhooks, url);
  cachedWebhooks.forEach(hook => {
    const visible = visibleHooks.includes(hook);
    try {
      browserAPI.contextMenus.update(hook.id, { visible });
    } catch (e) {
      // ignore if update fails
    }
  });
  browserAPI.contextMenus.refresh?.();
});


browserAPI.runtime.onInstalled?.addListener(createContextMenus);
browserAPI.runtime.onStartup?.addListener(createContextMenus);
browserAPI.storage.onChanged?.addListener(createContextMenus);

browserAPI.contextMenus.onClicked.addListener(async (info, tab) => {
  const hook = webhookMap[info.menuItemId];
  if (hook) {
    const url = info.pageUrl || tab?.url || '';
    if (!hook.urlFilter || url.includes(hook.urlFilter)) {
      await sendWebhook(hook, tab, info);
    }
  }
});

createContextMenus();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createContextMenus, sendWebhook };
}
