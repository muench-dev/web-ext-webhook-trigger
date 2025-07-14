/**
 * Browser API Abstraction Layer
 *
 * This module provides a unified interface for browser APIs across different browsers.
 * It detects whether the extension is running in Firefox (which uses the 'browser' object)
 * or Chrome (which uses the 'chrome' object) and provides appropriate implementations.
 */

// Determine if we're in a Firefox environment (has browser object)
const isFirefox = typeof browser !== 'undefined';

// Create the browserAPI object that will be exported
const browserAPI = {};

// Storage API
browserAPI.storage = {
  sync: {
    get: function(keys) {
      if (isFirefox) {
        return browser.storage.sync.get(keys);
      } else {
        return new Promise((resolve) => {
          chrome.storage.sync.get(keys, resolve);
        });
      }
    },
    set: function(items) {
      if (isFirefox) {
        return browser.storage.sync.set(items);
      } else {
        return new Promise((resolve) => {
          chrome.storage.sync.set(items, resolve);
        });
      }
    }
  }
};

// i18n API
browserAPI.i18n = {
  getMessage: function(messageName, substitutions) {
    if (isFirefox) {
      return browser.i18n.getMessage(messageName, substitutions);
    } else {
      return chrome.i18n.getMessage(messageName, substitutions);
    }
  }
};

// Tabs API
browserAPI.tabs = {
  query: function(queryInfo) {
    if (isFirefox) {
      return browser.tabs.query(queryInfo);
    } else {
      return new Promise((resolve) => {
        chrome.tabs.query(queryInfo, resolve);
      });
    }
  }
};

// Runtime API
browserAPI.runtime = {
  getBrowserInfo: function() {
    if (isFirefox && browser.runtime.getBrowserInfo) {
      return browser.runtime.getBrowserInfo();
    } else {
      // Chrome doesn't have getBrowserInfo, so we'll return a basic object
      return Promise.resolve({
        name: 'Chrome',
        vendor: 'Google',
        version: navigator.userAgent.match(/Chrome\/([0-9.]+)/)[1] || '',
        buildID: ''
      });
    }
  },
  getPlatformInfo: function() {
    if (isFirefox && browser.runtime.getPlatformInfo) {
      return browser.runtime.getPlatformInfo();
    } else if (chrome.runtime.getPlatformInfo) {
      return new Promise((resolve) => {
        chrome.runtime.getPlatformInfo(resolve);
      });
    } else {
      // Fallback if neither API is available
      return Promise.resolve({
        os: navigator.platform,
        arch: navigator.userAgent.includes('x64') ? 'x86-64' : 'x86-32'
      });
    }
  },
  openOptionsPage: function() {
    if (isFirefox) {
      return browser.runtime.openOptionsPage();
    } else {
      return new Promise((resolve) => {
        chrome.runtime.openOptionsPage(resolve);
      });
    }
  }
};

// Export the browserAPI object
if (typeof module !== 'undefined' && module.exports) {
  module.exports = browserAPI;
} else {
  window.browserAPI = browserAPI;
}
