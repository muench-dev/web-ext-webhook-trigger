// Shared utility functions

// Load browser polyfill when running in a browser environment
if (typeof window !== 'undefined' && !window.browserAPI) {
  const script = document.createElement('script');
  script.src = '/utils/browser-polyfill.js';
  document.head.appendChild(script);
}

// Import or load the browser abstraction layer
const getBrowserAPI = () => {
  if (typeof window !== 'undefined') {
    if (window.browserAPI) return window.browserAPI;
    if (window.getBrowserAPI) return window.getBrowserAPI();
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
          const matches = node.nodeValue.match(/__MSG_([^_]+)__/g);
          if (matches) {
            let newValue = node.nodeValue;
            matches.forEach(match => {
              const key = match.replace('__MSG_', '').replace('__', '');
              const message = browserAPI.i18n.getMessage(key);
              if (message) {
                newValue = newValue.replace(match, message);
              }
            });
            node.nodeValue = newValue;
          }
        }
      });
    }
  });

  // Replace __MSG_...__ patterns in the document title
  if (document.title && document.title.includes('__MSG_')) {
    const matches = document.title.match(/__MSG_([^_]+)__/g);
    if (matches) {
      let newTitle = document.title;
      matches.forEach(match => {
        const key = match.replace('__MSG_', '').replace('__', '');
        const message = browserAPI.i18n.getMessage(key);
        if (message) {
          newTitle = newTitle.replace(match, message);
        }
      });
      document.title = newTitle;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { replaceI18nPlaceholders, getBrowserAPI };
} else {
  window.replaceI18nPlaceholders = replaceI18nPlaceholders;
  window.getBrowserAPI = getBrowserAPI;
}
