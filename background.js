// Background script to handle context menu webhook triggering
if (typeof importScripts === 'function') {
  importScripts('/utils/browser-polyfill.js', '/utils/sendWebhook.js');
}

const browserAPI = window.getBrowserAPI();
let webhookMap = {};

let sendWebhook;
if (typeof module !== 'undefined' && module.exports) {
  sendWebhook = require('./utils/sendWebhook').sendWebhook;
} else {
  sendWebhook = window.sendWebhook;
}

async function loadWebhooks() {
  const { webhooks = [] } = await browserAPI.storage.sync.get('webhooks');
  webhookMap = Object.fromEntries(webhooks.map(w => [w.id, w]));
  return webhooks;
}

async function createContextMenus() {
  if (browserAPI.contextMenus.removeAll) {
    await browserAPI.contextMenus.removeAll();
  }
  const hooks = await loadWebhooks();
  hooks.forEach(hook => {
    const title = browserAPI.i18n.getMessage('contextMenuSend', hook.label) || hook.label;
    browserAPI.contextMenus.create({
      id: hook.id,
      title,
      contexts: ['all'],
    });
  });
}


browserAPI.runtime.onInstalled?.addListener(createContextMenus);
browserAPI.runtime.onStartup?.addListener(createContextMenus);
browserAPI.storage.onChanged?.addListener(createContextMenus);

browserAPI.contextMenus.onClicked.addListener(async (info, tab) => {
  const hook = webhookMap[info.menuItemId];
  if (hook) {
    await sendWebhook(hook, tab, info);
  }
});

createContextMenus();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createContextMenus, sendWebhook };
}
