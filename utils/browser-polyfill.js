/**
 * Browser API Abstraction Layer
 *
 * This module provides a unified interface for browser APIs across different browsers.
 * It detects whether the extension is running in Firefox (which uses the 'browser' object)
 * or Chrome (which uses the 'chrome' object) and provides appropriate implementations.
 */

// Determine if we're in a Firefox environment (has browser object)
const isFirefox = typeof browser !== 'undefined';

// Keep references to the native APIs to avoid recursive calls if this
// polyfill is re-used as the browser or chrome object itself
const nativeBrowser = typeof browser !== 'undefined' ? browser : undefined;
const nativeChrome = typeof chrome !== 'undefined' ? chrome : undefined;

// Create the browserAPI object that will be exported
const browserAPI = {};

// Storage API
browserAPI.storage = {
  sync: {
    get: function(keys) {
      const nativeGet = isFirefox
        ? nativeBrowser?.storage?.sync?.get
        : nativeChrome?.storage?.sync?.get;
      if (nativeGet && nativeGet !== browserAPI.storage.sync.get) {
        if (isFirefox) {
          return nativeGet.call(nativeBrowser.storage.sync, keys);
        }
        return new Promise(resolve => nativeGet.call(nativeChrome.storage.sync, keys, resolve));
      }
      return Promise.resolve({});
    },
    set: function(items) {
      const nativeSet = isFirefox
        ? nativeBrowser?.storage?.sync?.set
        : nativeChrome?.storage?.sync?.set;
      if (nativeSet && nativeSet !== browserAPI.storage.sync.set) {
        if (isFirefox) {
          return nativeSet.call(nativeBrowser.storage.sync, items);
        }
        return new Promise(resolve => nativeSet.call(nativeChrome.storage.sync, items, resolve));
      }
      return Promise.resolve();
    }
  },
  local: {
    get: function(keys) {
      const nativeGet = isFirefox
        ? nativeBrowser?.storage?.local?.get
        : nativeChrome?.storage?.local?.get;
      if (nativeGet && nativeGet !== browserAPI.storage.local.get) {
        if (isFirefox) {
          return nativeGet.call(nativeBrowser.storage.local, keys);
        }
        return new Promise(resolve => nativeGet.call(nativeChrome.storage.local, keys, resolve));
      }
      return Promise.resolve({});
    },
    set: function(items) {
      const nativeSet = isFirefox
        ? nativeBrowser?.storage?.local?.set
        : nativeChrome?.storage?.local?.set;
      if (nativeSet && nativeSet !== browserAPI.storage.local.set) {
        if (isFirefox) {
          return nativeSet.call(nativeBrowser.storage.local, items);
        }
        return new Promise(resolve => nativeSet.call(nativeChrome.storage.local, items, resolve));
      }
      return Promise.resolve();
    },
    remove: function(keys) {
      const nativeRemove = isFirefox
        ? nativeBrowser?.storage?.local?.remove
        : nativeChrome?.storage?.local?.remove;
      if (nativeRemove && nativeRemove !== browserAPI.storage.local.remove) {
        if (isFirefox) {
          return nativeRemove.call(nativeBrowser.storage.local, keys);
        }
        return new Promise(resolve => nativeRemove.call(nativeChrome.storage.local, keys, resolve));
      }
      return Promise.resolve();
    }
  }
};

// i18n API
browserAPI.i18n = {
  getMessage: function(messageName, substitutions) {
    if (isFirefox && nativeBrowser && nativeBrowser.i18n && nativeBrowser.i18n.getMessage !== browserAPI.i18n.getMessage) {
      return nativeBrowser.i18n.getMessage(messageName, substitutions);
    }
    if (!isFirefox && nativeChrome && nativeChrome.i18n && nativeChrome.i18n.getMessage !== browserAPI.i18n.getMessage) {
      return nativeChrome.i18n.getMessage(messageName, substitutions);
    }
    return '';
  }
};

// Tabs API
browserAPI.tabs = {
  query: function(queryInfo) {
    const nativeQuery = isFirefox
      ? nativeBrowser?.tabs?.query
      : nativeChrome?.tabs?.query;
    if (nativeQuery && nativeQuery !== browserAPI.tabs.query) {
      if (isFirefox) {
        return nativeQuery.call(nativeBrowser.tabs, queryInfo);
      }
      return new Promise(resolve => nativeQuery.call(nativeChrome.tabs, queryInfo, resolve));
    }
    return Promise.resolve([]);
  }
};

// Runtime API
browserAPI.runtime = {
  getBrowserInfo: function() {
    const nativeGetInfo = nativeBrowser?.runtime?.getBrowserInfo;
    if (isFirefox && nativeGetInfo && nativeGetInfo !== browserAPI.runtime.getBrowserInfo) {
      return nativeGetInfo.call(nativeBrowser.runtime);
    }
    // Chrome doesn't have getBrowserInfo, so we'll return a basic object
    return Promise.resolve({
      name: 'Chrome',
      vendor: 'Google',
      version: navigator.userAgent.match(/Chrome\/([0-9.]+)/)[1] || '',
      buildID: ''
    });
  },
  getPlatformInfo: function() {
    const nativeGetPlatform = isFirefox
      ? nativeBrowser?.runtime?.getPlatformInfo
      : nativeChrome?.runtime?.getPlatformInfo;
    if (nativeGetPlatform && nativeGetPlatform !== browserAPI.runtime.getPlatformInfo) {
      if (isFirefox) {
        return nativeGetPlatform.call(nativeBrowser.runtime);
      }
      return new Promise(resolve => nativeGetPlatform.call(nativeChrome.runtime, resolve));
    }
    // Fallback if neither API is available
    return Promise.resolve({
      os: navigator.platform,
      arch: navigator.userAgent.includes('x64') ? 'x86-64' : 'x86-32'
    });
  },
  openOptionsPage: function() {
    const nativeOpen = isFirefox
      ? nativeBrowser?.runtime?.openOptionsPage
      : nativeChrome?.runtime?.openOptionsPage;
    if (nativeOpen && nativeOpen !== browserAPI.runtime.openOptionsPage) {
      if (isFirefox) {
        return nativeOpen.call(nativeBrowser.runtime);
      }
      return new Promise(resolve => nativeOpen.call(nativeChrome.runtime, resolve));
    }
    return Promise.resolve();
  },
  sendMessage: function(message) {
    const nativeSendMessage = isFirefox
      ? nativeBrowser?.runtime?.sendMessage
      : nativeChrome?.runtime?.sendMessage;
    if (nativeSendMessage && nativeSendMessage !== browserAPI.runtime.sendMessage) {
      if (isFirefox) {
        return nativeSendMessage.call(nativeBrowser.runtime, message);
      }
      return new Promise((resolve, reject) => {
        nativeSendMessage.call(nativeChrome.runtime, message, (response) => {
          const error = nativeChrome.runtime?.lastError;
          if (error) {
            reject(new Error(error.message));
          } else {
            resolve(response);
          }
        });
      });
    }
    return Promise.resolve();
  },
  onMessage: {
    addListener: function(callback) {
      const nativeAPI = isFirefox ? nativeBrowser?.runtime : nativeChrome?.runtime;
      if (nativeAPI?.onMessage?.addListener) {
        nativeAPI.onMessage.addListener(callback);
      }
    }
  }
};

// Tabs API
browserAPI.tabs = {
  query: function(queryInfo) {
    const nativeQuery = isFirefox
      ? nativeBrowser?.tabs?.query
      : nativeChrome?.tabs?.query;
    if (nativeQuery && nativeQuery !== browserAPI.tabs.query) {
      if (isFirefox) {
        return nativeQuery.call(nativeBrowser.tabs, queryInfo);
      }
      return new Promise(resolve => nativeQuery.call(nativeChrome.tabs, queryInfo, resolve));
    }
    return Promise.resolve([]);
  },
  sendMessage: function(tabId, message) {
    const nativeSendMessage = isFirefox
      ? nativeBrowser?.tabs?.sendMessage
      : nativeChrome?.tabs?.sendMessage;
    if (nativeSendMessage && nativeSendMessage !== browserAPI.tabs.sendMessage) {
      if (isFirefox) {
        return nativeSendMessage.call(nativeBrowser.tabs, tabId, message);
      }
      return new Promise(resolve => nativeSendMessage.call(nativeChrome.tabs, tabId, message, resolve));
    }
    return Promise.resolve();
  },
  executeScript: function(tabId, details) {
    const nativeExecuteScript = isFirefox
      ? nativeBrowser?.tabs?.executeScript
      : nativeChrome?.tabs?.executeScript;
    if (nativeExecuteScript && nativeExecuteScript !== browserAPI.tabs.executeScript) {
      if (isFirefox) {
        return nativeExecuteScript.call(nativeBrowser.tabs, tabId, details);
      }
      return new Promise(resolve => nativeExecuteScript.call(nativeChrome.tabs, tabId, details, resolve));
    }
    return Promise.resolve([]);
  },
  onUpdated: {
    addListener: function(callback) {
      const nativeAPI = isFirefox ? nativeBrowser?.tabs : nativeChrome?.tabs;
      if (nativeAPI?.onUpdated?.addListener) {
        nativeAPI.onUpdated.addListener(callback);
      }
    }
  },
  onActivated: {
    addListener: function(callback) {
      const nativeAPI = isFirefox ? nativeBrowser?.tabs : nativeChrome?.tabs;
      if (nativeAPI?.onActivated?.addListener) {
        nativeAPI.onActivated.addListener(callback);
      }
    }
  }
};

// Windows API
browserAPI.windows = {
  onFocusChanged: {
    addListener: function(callback) {
      const nativeAPI = isFirefox ? nativeBrowser?.windows : nativeChrome?.windows;
      if (nativeAPI?.onFocusChanged?.addListener) {
        nativeAPI.onFocusChanged.addListener(callback);
      }
    }
  }
};

// Export the browserAPI object
if (typeof module !== 'undefined' && module.exports) {
  module.exports = browserAPI;
} else {
  window.browserAPI = browserAPI;
}
