// Background script for jobposting detection and storage

// Polyfill for browser API compatibility
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  globalThis.browser = chrome;
} else if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  globalThis.chrome = browser;
}

// Load shared jobposting helpers (extractJobpostingKid,
// computeJobpostingStatus, computeCurrentJobpostingState,
// JOBPOSTING_STORAGE_KEY). The script attaches them to `self`,
// which in a service worker is the global scope.
try {
  importScripts('utils/jobposting.js');
} catch (error) {
  console.error('Failed to load utils/jobposting.js', error);
}

console.log('=== BACKGROUND SCRIPT LOADED ===');

async function captureVisibleTabForFullPage(windowId, options = {}) {
  if (!browser?.tabs?.captureVisibleTab) {
    throw new Error('tabs.captureVisibleTab API is unavailable');
  }

  try {
    const result = browser.tabs.captureVisibleTab(windowId, options);
    if (result && typeof result.then === 'function') {
      return await result;
    }
  } catch (error) {
    if (typeof chrome === 'undefined' || !chrome.tabs?.captureVisibleTab) {
      throw error;
    }
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, options, (dataUrl) => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve(dataUrl);
      }
    });
  });
}

/**
 * Update the extension icon to reflect jobposting status
 * @param {string} status - 'none', 'match', or 'mismatch'
 */
async function updateIcon(status) {
  try {
    // Use badge to show status color
    const badgeColors = {
      'none': '#9ca3af',    // Gray
      'match': '#22c55e',   // Green
      'mismatch': '#ef4444' // Red
    };

    const badgeTexts = {
      'none': 'X',
      'match': '✓',
      'mismatch': '!'
    };

    if (browser.action) {
      await browser.action.setBadgeBackgroundColor({ color: badgeColors[status] || '#9ca3af' });
      await browser.action.setBadgeText({ text: badgeTexts[status] || '' });
    } else if (browser.browserAction) {
      await browser.browserAction.setBadgeBackgroundColor({ color: badgeColors[status] || '#9ca3af' });
      await browser.browserAction.setBadgeText({ text: badgeTexts[status] || '' });
    }
  } catch (error) {
    console.debug('Failed to update icon:', error);
  }
}

/**
 * Check if the active jobposting tab has changed and update the badge.
 * Delegates the regex/storage/comparison work to the shared helper.
 */
async function checkActiveTab() {
  try {
    if (typeof computeCurrentJobpostingState !== 'function') {
      // Helper failed to load — bail without crashing the SW.
      console.debug('computeCurrentJobpostingState helper not available');
      return;
    }
    const state = await computeCurrentJobpostingState(browser);
    console.debug('Jobposting state:', state);

    // Update extension icon to show status
    await updateIcon(state.current.status);

    // Cache current tab info so other code paths can read it without
    // re-running the regex.
    await browser.storage.local.set({
      [CURRENT_TAB_JOBPOSTING_STORAGE_KEY]: state.current,
    });
  } catch (error) {
    console.debug('Failed to check active tab:', error);
  }
}

// Listen for tab updates
if (browser.tabs) {
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      await checkActiveTab();
    }
  });

  // Listen for tab switches
  browser.tabs.onActivated.addListener(async () => {
    await checkActiveTab();
  });
}

// Listen for window focus changes
if (browser.windows) {
  browser.windows.onFocusChanged.addListener(async () => {
    await checkActiveTab();
  });
}

// Handle messages from popup
console.log('Setting up message listener...');
if (browser.runtime) {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.type);

    const handleMessage = async () => {
      switch (message.type) {
        case 'CAPTURE_VISIBLE_TAB_FOR_FULL_PAGE': {
          const windowId = sender?.tab?.windowId;
          if (typeof windowId !== 'number') {
            throw new Error('Unable to determine source tab window.');
          }
          const dataUrl = await captureVisibleTabForFullPage(windowId, message.options || {});
          return { success: true, ok: true, dataUrl };
        }

        case 'SET_ACTIVE_JOBPOSTING':
          await browser.storage.local.set({
            [JOBPOSTING_STORAGE_KEY]: {
              kid: message.kid,
              url: message.url,
              setAt: new Date().toISOString()
            }
          });
          await checkActiveTab();
          return { success: true };

        case 'GET_ACTIVE_JOBPOSTING':
          const stored = await browser.storage.local.get([
            JOBPOSTING_STORAGE_KEY,
            CURRENT_TAB_JOBPOSTING_STORAGE_KEY,
          ]);
          return {
            active: stored[JOBPOSTING_STORAGE_KEY] || null,
            current: stored[CURRENT_TAB_JOBPOSTING_STORAGE_KEY] || null,
          };

        case 'CLEAR_ACTIVE_JOBPOSTING':
          await browser.storage.local.remove(JOBPOSTING_STORAGE_KEY);
          await checkActiveTab();
          return { success: true };

        case 'CHECK_ACTIVE_TAB':
          await checkActiveTab();
          const result = await browser.storage.local.get([
            JOBPOSTING_STORAGE_KEY,
            CURRENT_TAB_JOBPOSTING_STORAGE_KEY,
          ]);
          return {
            active: result[JOBPOSTING_STORAGE_KEY] || null,
            current: result[CURRENT_TAB_JOBPOSTING_STORAGE_KEY] || null,
          };
      }
    };

    handleMessage().then(response => {
      console.log('Sending response:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('Error handling message:', error);
      sendResponse(null);
    });

    return true; // Keep channel open for async response
  });
  console.log('Message listener set up successfully');
}

// Initial check on startup
checkActiveTab();
