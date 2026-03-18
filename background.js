// Background script for jobposting detection and storage

// Polyfill for browser API compatibility
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') {
  globalThis.browser = chrome;
} else if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  globalThis.chrome = browser;
}

console.log('=== BACKGROUND SCRIPT LOADED ===');

const ADMIN_JOBPOSTING_PATTERN = /^https:\/\/admin\.schnellestelle\.(?:de|club)\/jobpostings\/(?<kid>[a-z0-9]{9})/;
const JOBPOSTING_STORAGE_KEY = 'active_jobposting';

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
      'none': '',
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
 * Extract jobposting KID from URL if it matches the admin jobposting pattern
 * @param {string} url
 * @returns {string|null}
 */
function extractJobpostingKid(url) {
  if (!url) return null;
  console.debug('Extracting KID from URL:', url);
  console.debug('Using pattern:', ADMIN_JOBPOSTING_PATTERN);
  const match = url.match(ADMIN_JOBPOSTING_PATTERN);
  console.debug('Match result:', match);
  return match?.groups?.kid || null;
}

/**
 * Check if the active jobposting tab has changed and notify popup
 */
async function checkActiveTab() {
  try {
    console.debug('Checking active tab...');
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;

    const currentTab = tabs[0];
    const currentKid = extractJobpostingKid(currentTab.url);
    console.debug('Current tab KID:', currentKid);

    // Get stored active jobposting
    const stored = await browser.storage.local.get(JOBPOSTING_STORAGE_KEY);
    const activeJobposting = stored[JOBPOSTING_STORAGE_KEY];
    console.debug('Active jobposting:', activeJobposting);

    // Calculate status
    let status = 'none'; // 'none', 'match', 'mismatch'
    if (!activeJobposting?.kid) {
      status = 'none';
    } else if (currentKid === activeJobposting.kid) {
      status = 'match';
    } else if (currentKid) {
      status = 'mismatch';
    }

    console.debug('Jobposting status:', status);

    // Update extension icon to show status
    updateIcon(status);

    // Store current tab info for popup
    await browser.storage.local.set({
      current_tab_jobposting: {
        kid: currentKid,
        url: currentTab.url,
        status: status
      }
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
            'current_tab_jobposting'
          ]);
          return {
            active: stored[JOBPOSTING_STORAGE_KEY] || null,
            current: stored.current_tab_jobposting || null
          };

        case 'CLEAR_ACTIVE_JOBPOSTING':
          await browser.storage.local.remove(JOBPOSTING_STORAGE_KEY);
          await checkActiveTab();
          return { success: true };

        case 'CHECK_ACTIVE_TAB':
          await checkActiveTab();
          const result = await browser.storage.local.get([
            JOBPOSTING_STORAGE_KEY,
            'current_tab_jobposting'
          ]);
          return {
            active: result[JOBPOSTING_STORAGE_KEY] || null,
            current: result.current_tab_jobposting || null
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
