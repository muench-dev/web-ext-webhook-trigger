// Utility to send a webhook request
if (typeof importScripts === 'function') {
  importScripts('/utils/browser-polyfill.js');
}

let getBrowserAPI;
try {
  ({ getBrowserAPI } = require('./utils'));
} catch (e) {
  if (typeof window !== 'undefined' && window.getBrowserAPI) {
    getBrowserAPI = window.getBrowserAPI;
  }
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function sendWebhook(hook, tab, info = {}) {
  const browserAPI = getBrowserAPI ? getBrowserAPI() : (window.getBrowserAPI && window.getBrowserAPI());
  const browserInfo = await (browserAPI.runtime.getBrowserInfo?.() || {});
  const platformInfo = await (browserAPI.runtime.getPlatformInfo?.() || {});
  const selectedText = info.selectionText || '';

  let payload = {
    tab: {
      title: tab.title,
      url: tab.url,
      id: tab.id,
      windowId: tab.windowId,
      index: tab.index,
      pinned: tab.pinned,
      audible: tab.audible,
      mutedInfo: tab.mutedInfo,
      incognito: tab.incognito,
      status: tab.status,
    },
    browser: browserInfo,
    platform: platformInfo,
    triggeredAt: new Date().toISOString(),
  };

  if (hook.sendSelectedText) {
    payload.selectedText = selectedText;
  }
  if (hook.identifier) {
    payload.identifier = hook.identifier;
  }

  if (hook.customPayload) {
    try {
      const replacements = {
        '{{tab.title}}': tab.title,
        '{{tab.url}}': tab.url,
        '{{tab.id}}': tab.id,
        '{{tab.windowId}}': tab.windowId,
        '{{tab.index}}': tab.index,
        '{{tab.pinned}}': tab.pinned,
        '{{tab.audible}}': tab.audible,
        '{{tab.incognito}}': tab.incognito,
        '{{tab.status}}': tab.status,
        '{{browser}}': JSON.stringify(browserInfo),
        '{{platform.arch}}': platformInfo.arch || 'unknown',
        '{{platform.os}}': platformInfo.os || 'unknown',
        '{{platform.version}}': platformInfo.version,
        '{{triggeredAt}}': new Date().toISOString(),
        '{{identifier}}': hook.identifier || '',
      };
      if (hook.sendSelectedText) {
        replacements['{{selectedText}}'] = selectedText;
      }
      let customPayloadStr = hook.customPayload;
      Object.entries(replacements).forEach(([ph, val]) => {
        const quoted = customPayloadStr.match(new RegExp(`"[^\"]*${escapeRegExp(ph)}[^\"]*"`, 'g'));
        const replaceValue = typeof val === 'string'
          ? (quoted ? val.replace(/"/g, '\\"') : `"${val.replace(/"/g, '\\"')}"`)
          : (val === undefined ? 'null' : JSON.stringify(val));
        customPayloadStr = customPayloadStr.replace(new RegExp(escapeRegExp(ph), 'g'), replaceValue);
      });
      payload = JSON.parse(customPayloadStr);
    } catch (err) {
      console.error('Failed to parse custom payload', err);
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (Array.isArray(hook.headers)) {
    hook.headers.forEach(h => { if (h.key && h.value) headers[h.key] = h.value; });
  }
  const method = hook.method || 'POST';
  const fetchOpts = { method, headers };
  let url = hook.url;
  if (method === 'POST') {
    fetchOpts.body = JSON.stringify(payload);
  } else if (method === 'GET') {
    const urlObj = new URL(url);
    urlObj.searchParams.set('payload', encodeURIComponent(JSON.stringify(payload)));
    url = urlObj.toString();
  }
  return fetch(url, fetchOpts);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sendWebhook };
} else if (typeof window !== 'undefined') {
  window.sendWebhook = sendWebhook;
}
