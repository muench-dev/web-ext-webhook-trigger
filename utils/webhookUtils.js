let getBrowserAPI;
try {
  ({ getBrowserAPI } = require('./utils'));
} catch (e) {
  if (typeof window !== 'undefined' && window.getBrowserAPI) {
    getBrowserAPI = window.getBrowserAPI;
  }
}

async function loadWebhooks() {
  const browserAPI = getBrowserAPI ? getBrowserAPI() : (typeof window !== 'undefined' && window.getBrowserAPI ? window.getBrowserAPI() : {});
  const { webhooks = [] } = await browserAPI.storage.sync.get('webhooks');
  return webhooks;
}

function filterWebhooksByUrl(webhooks = [], url = '') {
  return webhooks.filter((wh) => !wh.urlFilter || url.includes(wh.urlFilter));
}

async function getVisibleWebhooks(url) {
  const hooks = await loadWebhooks();
  return filterWebhooksByUrl(hooks, url);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadWebhooks, filterWebhooksByUrl, getVisibleWebhooks };
} else if (typeof window !== 'undefined') {
  window.loadWebhooks = loadWebhooks;
  window.filterWebhooksByUrl = filterWebhooksByUrl;
  window.getVisibleWebhooks = getVisibleWebhooks;
}
