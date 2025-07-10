// Shared utility functions

/**
 * Replaces i18n placeholders in the HTML document.
 * It targets elements with the 'data-i18n' attribute,
 * text nodes containing '__MSG_...__', and the document title.
 */
function replaceI18nPlaceholders() {
  // Replace textContent of elements with data-i18n attribute
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      const message = browser.i18n.getMessage(key);
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
              const message = browser.i18n.getMessage(key);
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
        const message = browser.i18n.getMessage(key);
        if (message) {
          newTitle = newTitle.replace(match, message);
        }
      });
      document.title = newTitle;
    }
  }
}

// If using modules and need to export:
// export { replaceI18nPlaceholders };
// However, for simple script inclusion, it will be globally available.
// Adding a console log to confirm loading, can be removed later.
console.log("utils.js loaded, replaceI18nPlaceholders defined.");
