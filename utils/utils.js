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
  if (document.documentElement) {
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
    let el = walker.currentNode;
    while (el) {
      if (el.hasAttributes()) {
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          if (typeof attr.value === 'string' && attr.value.includes('__MSG_')) {
            const newVal = replaceTokens(attr.value);
            if (newVal !== attr.value) {
              el.setAttribute(attr.name, newVal);
            }
          }
        }
      }
      el = walker.nextNode();
    }
  }

  // Replace __MSG_...__ patterns in the document title
  if (document.title && document.title.includes('__MSG_')) {
    document.title = replaceTokens(document.title);
  }
}

const padDatePart = (value, length = 2) => String(value).padStart(length, '0');

const toLocalIsoString = (date) => {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());
  const second = padDatePart(date.getSeconds());
  const millisecond = padDatePart(date.getMilliseconds(), 3);
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHour = padDatePart(Math.floor(absoluteOffset / 60));
  const offsetMinute = padDatePart(absoluteOffset % 60);

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${millisecond}${sign}${offsetHour}:${offsetMinute}`;
};

const buildDateTimeVariables = (date = new Date()) => {
  const nowIso = date.toISOString();
  const timestampMs = date.getTime();

  return {
    nowIso,
    values: {
      "{{now.iso}}": nowIso,
      "{{now.date}}": nowIso.slice(0, 10),
      "{{now.time}}": nowIso.slice(11, 19),
      "{{now.unix}}": Math.floor(timestampMs / 1000),
      "{{now.unix_ms}}": timestampMs,
      "{{now.year}}": date.getUTCFullYear(),
      "{{now.month}}": date.getUTCMonth() + 1,
      "{{now.day}}": date.getUTCDate(),
      "{{now.hour}}": date.getUTCHours(),
      "{{now.minute}}": date.getUTCMinutes(),
      "{{now.second}}": date.getUTCSeconds(),
      "{{now.millisecond}}": date.getUTCMilliseconds(),
      "{{now.local.iso}}": toLocalIsoString(date),
      "{{now.local.date}}": `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`,
      "{{now.local.time}}": `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`,
      "{{triggeredAt}}": nowIso,
    },
  };
};

async function sendWebhook(webhook, isTest = false) {
  const browserAPI = getBrowserAPI();
  let selectors = Array.isArray(webhook?.selectors) ? [...webhook.selectors] : [];
  let selectorContent = [];

  try {
    let payload;

    const dateTimeVariables = buildDateTimeVariables();

    if (isTest) {
      payload = {
        url: "https://example.com",
        test: true,
        triggeredAt: dateTimeVariables.nowIso,
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

      if ((!selectors || selectors.length === 0) && webhook?.id) {
        try {
          const stored = await browserAPI.storage.sync.get("webhooks");
          const storedHooks = Array.isArray(stored?.webhooks) ? stored.webhooks : [];
          const storedMatch = storedHooks.find((w) => w.id === webhook.id);
          if (storedMatch && Array.isArray(storedMatch.selectors)) {
            selectors = storedMatch.selectors.filter((value) => typeof value === "string" && value.trim().length > 0);
          }
        } catch (error) {
          console.debug("Failed to load stored selectors", error);
        }
      }

      const canSendMessage =
        typeof browserAPI.tabs?.sendMessage === "function" ||
        (typeof browser !== "undefined" && typeof browser.tabs?.sendMessage === "function") ||
        (typeof chrome !== "undefined" && typeof chrome.tabs?.sendMessage === "function");

      if (selectors.length > 0 && canSendMessage) {
        try {
          let response;
          if (browserAPI.tabs && typeof browserAPI.tabs.sendMessage === "function") {
            response = await browserAPI.tabs.sendMessage(activeTab.id, {
              type: "GET_SELECTOR_CONTENT",
              selectors,
            });
          } else if (typeof browser !== "undefined" && typeof browser.tabs?.sendMessage === "function") {
            response = await browser.tabs.sendMessage(activeTab.id, {
              type: "GET_SELECTOR_CONTENT",
              selectors,
            });
          } else if (typeof chrome !== "undefined" && typeof chrome.tabs?.sendMessage === "function") {
            response = await new Promise((resolve, reject) => {
              chrome.tabs.sendMessage(activeTab.id, {
                type: "GET_SELECTOR_CONTENT",
                selectors,
              }, (res) => {
                const err = chrome.runtime?.lastError;
                if (err) {
                  reject(new Error(err.message));
                } else {
                  resolve(res);
                }
              });
            });
          }
          if (response && Array.isArray(response.selectorContent)) {
            selectorContent = response.selectorContent.map((value) =>
              typeof value === "string" ? value.trim() : ""
            );
          }
        } catch (error) {
          console.warn("Failed to retrieve selector content", error);
        }
      }

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
        triggeredAt: dateTimeVariables.nowIso,
      };

      if (webhook && webhook.identifier) {
        payload.identifier = webhook.identifier;
      }

      if (selectors.length > 0) {
        payload.selectorContent = selectorContent;
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
            "{{identifier}}": webhook.identifier || "",
            "{{selectorContent}}": selectorContent,
            ...dateTimeVariables.values,
          };

          const customPayloadTemplate = webhook.customPayload;
          const placeholders = Object.keys(replacements).sort((a, b) => b.length - a.length);
          const escapedPlaceholders = placeholders.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          const combinedRegex = new RegExp(escapedPlaceholders.join('|'), 'g');

          // Cache which placeholders are inside quotes in the template
          const isInQuotesCache = new Map();

          const customPayloadStr = customPayloadTemplate.replace(combinedRegex, (match) => {
            if (!isInQuotesCache.has(match)) {
              const escaped = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const quoteRegex = new RegExp(`"[^"]*${escaped}[^"]*"`);
              isInQuotesCache.set(match, !!customPayloadTemplate.match(quoteRegex));
            }

            const value = replacements[match];
            const isPlaceholderInQuotes = isInQuotesCache.get(match);

            let replaceValue;
            if (typeof value === 'string') {
              replaceValue = JSON.stringify(value);
              if (isPlaceholderInQuotes) {
                // Remove the surrounding quotes added by JSON.stringify
                replaceValue = replaceValue.slice(1, -1);
              }
            } else {
              replaceValue = value === undefined ? 'null' : JSON.stringify(value);
            }

            // In a callback-based replacement, the return value is treated literally,
            // EXCEPT that '$' still needs to be escaped by '$$' to result in a literal '$'.
            // If we returned 'replaceValue' directly, '$&' in it would be interpreted.
            return replaceValue.replace(/\$/g, '$$');
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

    if (!url) {
      throw new Error(browserAPI.i18n.getMessage("optionsErrorUrlRequired") || "URL is required.");
    }

    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        const schemeError = new Error(browserAPI.i18n.getMessage("optionsErrorInvalidUrlScheme") || "Invalid URL scheme. Only http:// and https:// are allowed.");
        schemeError.name = "SchemeError";
        throw schemeError;
      }
    } catch (e) {
      if (e.name === "SchemeError") {
        throw e;
      }
      throw new Error(browserAPI.i18n.getMessage("optionsErrorInvalidUrl") || "Invalid URL.");
    }

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
