// Shared helpers for the "active jobposting" feature.
//
// A "Jobposting" is identified by a 9-character lowercase-alphanumeric ID
// ("KID") embedded in URLs of the form:
//   https://admin.schnellestelle.{de,club}/jobpostings/<kid>
//
// The "active" jobposting is a user-pinned KID stored in
// browser.storage.local["active_jobposting"]. This file exposes:
//
//   * extractJobpostingKid(url)            -- pure: URL -> KID|null
//   * computeJobpostingStatus(active, cur) -- pure: KIDs -> 'none'|'match'|'mismatch'
//   * computeCurrentJobpostingState(api)   -- async: queries active tab + storage
//
// The module is exported via CommonJS (for Jest tests) and as globals on
// `self` (for both window contexts and the MV3 service worker).

const ADMIN_JOBPOSTING_PATTERN =
  /^https:\/\/admin\.schnellestelle\.(?:de|club)\/jobpostings\/(?<kid>[a-z0-9]{9})/;
const JOBPOSTING_STORAGE_KEY = "active_jobposting";
const CURRENT_TAB_JOBPOSTING_STORAGE_KEY = "current_tab_jobposting";

/**
 * Extract the jobposting KID from a URL, or null if it's not a jobposting URL.
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
function extractJobpostingKid(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(ADMIN_JOBPOSTING_PATTERN);
  return match?.groups?.kid || null;
}

/**
 * Compute the relationship between the pinned (active) KID and the
 * current tab's KID. This is the *machine-readable* status used to
 * drive the toolbar badge:
 *
 *   - 'none'     : nothing pinned, OR pinned but current tab is not a jobposting
 *   - 'match'    : pinned KID equals current tab's KID
 *   - 'mismatch' : pinned KID exists and current tab is a different jobposting
 *
 * The popup derives its own current-tab-focused header label from
 * `(status, currentKid)` — see popup.js — so the badge and header can
 * have different "no pin but on a jobposting" wording without
 * duplicating the comparison logic.
 *
 * @param {string|null|undefined} activeKid
 * @param {string|null|undefined} currentKid
 * @returns {'none'|'match'|'mismatch'}
 */
function computeJobpostingStatus(activeKid, currentKid) {
  if (!activeKid) return "none";
  if (currentKid === activeKid) return "match";
  if (currentKid) return "mismatch";
  return "none";
}

/**
 * Read the active tab + stored active jobposting and compute the
 * current state in one shot. Used by both the popup and the background
 * script so the regex/storage logic lives in one place.
 *
 * @param {object} browserAPI - extension API root (browser/chrome)
 * @returns {Promise<{active: object|null, current: {kid:string|null, url:string|null, status:string}}>}
 */
async function computeCurrentJobpostingState(browserAPI) {
  let currentKid = null;
  let currentUrl = null;
  try {
    if (browserAPI?.tabs?.query) {
      const tabs = await browserAPI.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs && tabs.length > 0) {
        currentUrl = tabs[0].url || null;
        currentKid = extractJobpostingKid(currentUrl);
      }
    }
  } catch (error) {
    // Swallow: callers still want a usable state object on failure.
    if (typeof console !== "undefined") {
      console.debug("computeCurrentJobpostingState: tabs.query failed", error);
    }
  }

  let active = null;
  try {
    if (browserAPI?.storage?.local) {
      const stored = await browserAPI.storage.local.get(JOBPOSTING_STORAGE_KEY);
      active = stored?.[JOBPOSTING_STORAGE_KEY] || null;
    }
  } catch (error) {
    if (typeof console !== "undefined") {
      console.debug("computeCurrentJobpostingState: storage.local.get failed", error);
    }
  }

  const status = computeJobpostingStatus(active?.kid, currentKid);

  return {
    active,
    current: {
      kid: currentKid,
      url: currentUrl,
      status,
    },
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ADMIN_JOBPOSTING_PATTERN,
    JOBPOSTING_STORAGE_KEY,
    CURRENT_TAB_JOBPOSTING_STORAGE_KEY,
    extractJobpostingKid,
    computeJobpostingStatus,
    computeCurrentJobpostingState,
  };
} else if (typeof self !== "undefined") {
  // Works in both Window and ServiceWorkerGlobalScope.
  self.ADMIN_JOBPOSTING_PATTERN = ADMIN_JOBPOSTING_PATTERN;
  self.JOBPOSTING_STORAGE_KEY = JOBPOSTING_STORAGE_KEY;
  self.CURRENT_TAB_JOBPOSTING_STORAGE_KEY = CURRENT_TAB_JOBPOSTING_STORAGE_KEY;
  self.extractJobpostingKid = extractJobpostingKid;
  self.computeJobpostingStatus = computeJobpostingStatus;
  self.computeCurrentJobpostingState = computeCurrentJobpostingState;
}
