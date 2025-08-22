// Shared utility functions

// Ensure browserAPI polyfill is loaded when running in a browser environment
if (typeof window !== 'undefined' && !window.browserAPI) {
  const script = document.createElement('script');
  script.src = '/utils/browser-polyfill.js';
  document.head.appendChild(script);
}

// Import or load the browser abstraction layer
const getBrowserAPI = () => {
  if (typeof window !== 'undefined') {
    if (window.browserAPI) return window.browserAPI;
    if (window.browser) return window.browser;
    if (window.chrome) return window.chrome;
  }
  if (typeof global !== 'undefined' && global.browser) {
    return global.browser;
  }
  try {
    return require('./browser-polyfill.js');
  } catch (e) {
    return typeof browser !== 'undefined' ? browser : typeof chrome !== 'undefined' ? chrome : {};
  }
};

/**
 * Replaces i18n placeholders in the HTML document.
 * It targets elements with the 'data-i18n' attribute,
 * text nodes containing '__MSG_...__', and the document title.
 */
function replaceI18nPlaceholders() {
  const browserAPI = getBrowserAPI();

  // Helper to replace __MSG_key__ tokens within a string
  const replaceTokens = (value) => {
    if (!value || typeof value !== 'string' || !value.includes('__MSG_')) return value;
    return value.replace(/__MSG_([^_]+)__/g, (match, key) => {
      const msg = browserAPI.i18n?.getMessage ? browserAPI.i18n.getMessage(key) : '';
      return msg || match;
    });
  };

  // Replace textContent of elements with data-i18n attribute
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      const message = browserAPI.i18n.getMessage(key);
      if (message) {
        element.textContent = message;
      }
    }
  });

  // Replace __MSG_...__ patterns in all text nodes
  document.querySelectorAll('body *').forEach(element => {
    if (element.childNodes && element.childNodes.length > 0) {
      element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.includes('__MSG_')) {
          node.nodeValue = replaceTokens(node.nodeValue);
        }
      });
    }
  });

  // Replace __MSG_...__ patterns in common attributes (e.g., placeholder, title, aria-label)
  document.querySelectorAll('*').forEach(el => {
    if (!el.attributes) return;
    Array.from(el.attributes).forEach(attr => {
      if (typeof attr.value === 'string' && attr.value.includes('__MSG_')) {
        const newVal = replaceTokens(attr.value);
        if (newVal !== attr.value) {
          el.setAttribute(attr.name, newVal);
        }
      }
    });
  });

  // Replace __MSG_...__ patterns in the document title
  if (document.title && document.title.includes('__MSG_')) {
    document.title = replaceTokens(document.title);
  }
}

async function sendWebhook(webhook, isTest = false) {
  const browserAPI = getBrowserAPI();

  try {
    let payload;

    if (isTest) {
      payload = {
        url: "https://example.com",
        test: true,
        triggeredAt: new Date().toISOString(),
      };
    } else {
      // Get info about the active tab
      const tabs = await browserAPI.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length === 0) {
        throw new Error(browserAPI.i18n.getMessage("popupErrorNoActiveTab"));
      }
      const activeTab = tabs[0];
      const currentUrl = activeTab.url;

      // Get browser and platform info
      const browserInfo = await browserAPI.runtime.getBrowserInfo?.() || {};
      const platformInfo = await browserAPI.runtime.getPlatformInfo?.() || {};

      // Create default payload
      payload = {
        tab: {
          title: activeTab.title,
          url: currentUrl,
          id: activeTab.id,
          windowId: activeTab.windowId,
          index: activeTab.index,
          pinned: activeTab.pinned,
          audible: activeTab.audible,
          mutedInfo: activeTab.mutedInfo,
          incognito: activeTab.incognito,
          status: activeTab.status,
        },
        browser: browserInfo,
        platform: platformInfo,
        triggeredAt: new Date().toISOString(),
      };

      if (webhook && webhook.identifier) {
        payload.identifier = webhook.identifier;
      }

      if (webhook && webhook.customPayload) {
        try {
          const replacements = {
            "{{tab.title}}": activeTab.title,
            "{{tab.url}}": currentUrl,
            "{{tab.id}}": activeTab.id,
            "{{tab.windowId}}": activeTab.windowId,
            "{{tab.index}}": activeTab.index,
            "{{tab.pinned}}": activeTab.pinned,
            "{{tab.audible}}": activeTab.audible,
            "{{tab.incognito}}": activeTab.incognito,
            "{{tab.status}}": activeTab.status,
            "{{browser}}": JSON.stringify(browserInfo),
            "{{platform.arch}}": platformInfo.arch || "unknown",
            "{{platform.os}}": platformInfo.os || "unknown",
            "{{platform.version}}": platformInfo.version,
            "{{triggeredAt}}": new Date().toISOString(),
            "{{identifier}}": webhook.identifier || ""
          };

          let customPayloadStr = webhook.customPayload;
          Object.entries(replacements).forEach(([placeholder, value]) => {
            const isPlaceholderInQuotes = customPayloadStr.match(new RegExp(`"[^"]*${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"`));

            const replaceValue = typeof value === 'string'
              ? (isPlaceholderInQuotes ? value.replace(/"/g, '\\"') : `"${value.replace(/"/g, '\\"')}"`)
              : (value === undefined ? 'null' : JSON.stringify(value));

            customPayloadStr = customPayloadStr.replace(
              new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              replaceValue
            );
          });

          const customPayload = JSON.parse(customPayloadStr);
          payload = customPayload;
        } catch (error) {
          throw new Error(browserAPI.i18n.getMessage("popupErrorCustomPayloadJsonParseError", error.message));
        }
      }
    }

    let headers = { "Content-Type": "application/json" };
    if (webhook && Array.isArray(webhook.headers)) {
      webhook.headers.forEach(h => {
        if (h.key && h.value) headers[h.key] = h.value;
      });
    }

    const method = webhook && webhook.method ? webhook.method : "POST";

    const fetchOpts = {
      method,
      headers,
    };

    const url = webhook.url;

    if (method === "POST") {
      fetchOpts.body = JSON.stringify(payload);
    } else if (method === "GET") {
      const urlObj = new URL(url);
      urlObj.searchParams.set("payload", encodeURIComponent(JSON.stringify(payload)));
      fetchOpts.body = undefined;
      fetchOpts._url = urlObj.toString();
    }

    const fetchUrl = fetchOpts._url || url;
    const response = await fetch(fetchUrl, fetchOpts);

    if (!response.ok) {
      throw new Error(browserAPI.i18n.getMessage("popupErrorHttp", response.status));
    }

    return response;

  } catch (error) {
    console.error("Error sending webhook:", error);
    throw error;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { replaceI18nPlaceholders, getBrowserAPI, sendWebhook };
} else {
  window.replaceI18nPlaceholders = replaceI18nPlaceholders;
  window.getBrowserAPI = getBrowserAPI;
  window.sendWebhook = sendWebhook;
}
