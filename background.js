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

try {
  importScripts('utils/portal-automation.js');
} catch (error) {
  console.error('Failed to load utils/portal-automation.js', error);
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

const sendMessageToTab = (tabId, message) => {
  if (browser.tabs && typeof browser.tabs.sendMessage === "function") {
    return browser.tabs.sendMessage(tabId, message);
  }
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve(response);
      }
    });
  });
};

const injectScriptIntoTab = async (tabId, file) => {
  if (browser.scripting && typeof browser.scripting.executeScript === "function") {
    return browser.scripting.executeScript({
      target: { tabId },
      files: [file],
    });
  }
  if (browser.tabs && typeof browser.tabs.executeScript === "function") {
    return browser.tabs.executeScript(tabId, { file });
  }
  throw new Error("Script injection is unavailable.");
};

const executeTabFunction = async (tabId, func, args = []) => {
  if (browser.scripting && typeof browser.scripting.executeScript === "function") {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      func,
      args,
    });
    const item = results?.[0];
    if (item?.error) {
      throw new Error(item.error);
    }
    return item?.result;
  }
  throw new Error("Script function execution is unavailable.");
};

const getAutomationRun = async () => {
  const key = typeof PORTAL_AUTOMATION_STORAGE_KEY !== "undefined"
    ? PORTAL_AUTOMATION_STORAGE_KEY
    : "portal_automation_run";
  const stored = await browser.storage.local.get(key);
  return stored[key] || null;
};

const saveAutomationRun = async (run) => {
  const key = typeof PORTAL_AUTOMATION_STORAGE_KEY !== "undefined"
    ? PORTAL_AUTOMATION_STORAGE_KEY
    : "portal_automation_run";
  await browser.storage.local.set({
    [key]: {
      ...run,
      updatedAt: new Date().toISOString(),
    },
  });
};

const getActiveTab = async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs?.[0] || null;
};

const getMessageWebhook = async (webhookId) => {
  const { webhooks = [] } = await browser.storage.sync.get("webhooks");
  return webhooks.find((webhook) => webhook.id === webhookId) || null;
};

const recordAutomationFailure = async (run, candidate, error) => {
  const failures = Array.isArray(run.failures) ? [...run.failures] : [];
  failures.push({
    candidate,
    error: error?.message || String(error),
    failedAt: new Date().toISOString(),
  });
  const updated = {
    ...run,
    status: "failed",
    currentCandidate: candidate,
    message: error?.message || String(error),
    failureCount: (run.failureCount || 0) + 1,
    failures,
  };
  await saveAutomationRun(updated);
  return updated;
};

const getPortalDisplayName = (portal) => {
  if (portal === "linkedin") return "LinkedIn";
  return "Xing";
};

const extractPortalCandidateProfile = async (run, candidate, portal) => {
  if (!run || run.status === "stopped" || run.status === "complete") {
    return candidate;
  }

  const portalLabel = getPortalDisplayName(portal);
  return normalizeCandidate(await executeTabFunction(run.tabId, async (inputCandidate, inputPortal) => {
    const portalName = inputPortal || "xing";
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const getCleanProfileHtml = () => {
      const main = document.querySelector("main") || document.body;
      if (!main) return "";
      const clone = main.cloneNode(true);
      clone.querySelectorAll("script, style, noscript, iframe, svg").forEach((element) => element.remove());
      return clone.outerHTML || "";
    };
    const waitForProfileText = async (timeoutMs = 20000) => {
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const main = document.querySelector("main") || document.body;
        const text = String(main?.innerText || "").trim();
        if (text.length > 200) return main;
        await sleep(350);
      }
      return null;
    };
    const main = await waitForProfileText();
    if (!main) {
      throw new Error(`Timed out waiting for ${portalLabel} profile content.`);
    }
    const profileText = String(main?.innerText || document.body?.innerText || "")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 20000);
    const titleName = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
    return {
      ...inputCandidate,
      name: titleName || inputCandidate.name,
      profileText,
      profileHtml: getCleanProfileHtml().slice(0, 50000),
      extractedAt: new Date().toISOString(),
      portal: portalName,
    };
  }, [candidate, portal]) || candidate);
};

const preparingRuns = new Set();

const prepareAutomationCandidate = async (run) => {
  if (!run || run.status === "stopped" || run.status === "complete") {
    return run;
  }

  const candidate = run.currentCandidate;
  if (!candidate) {
    return run;
  }

  if (preparingRuns.has(run.id)) {
    console.log(`prepareAutomationCandidate already running for run ${run.id}, skipping`);
    return run;
  }
  preparingRuns.add(run.id);

  try {
    const webhook = await getMessageWebhook(run.webhookId);
    if (!webhook) {
      throw new Error("Selected message webhook was not found.");
    }

    const tab = run.tabId ? await browser.tabs.get(run.tabId) : await getActiveTab();
    const portal = run.portal || "xing";
    const candidateWithProfile = await extractPortalCandidateProfile(run, candidate, portal);
    const stored = await browser.storage.local.get(JOBPOSTING_STORAGE_KEY);
    const message = await fetchCandidateMessage(webhook, candidateWithProfile, {
      portal,
      jobKid: stored?.[JOBPOSTING_STORAGE_KEY]?.kid || null,
      tab: {
        title: tab?.title || "",
        url: tab?.url || "",
      },
    });

    const tabBefore = await browser.tabs.get(run.tabId);
    const urlBefore = tabBefore?.url || "";

    const clickResult = await executeTabFunction(run.tabId, async (inputPortal) => {
      const portalName = inputPortal || "xing";
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const waitForElement = async (findElement, timeoutMs = 18000) => {
        const startedAt = Date.now();
        let found = findElement();
        while (!found && Date.now() - startedAt < timeoutMs) {
          await sleep(350);
          found = findElement();
        }
        return found;
      };
      const clickElement = (element) => {
        element.scrollIntoView({ block: "center", inline: "center" });
        element.focus?.();
        if (element.tagName === 'A' && element.href) {
          element.click();
          return;
        }
        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
          element.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
          }));
        });
      };
      const textOf = (element) => `${element?.textContent || ""} ${element?.getAttribute("aria-label") || ""} ${element?.getAttribute("title") || ""}`.toLowerCase();

      if (portalName === "linkedin") {
        const directMessageButton = await waitForElement(() => {
          const messagingLink = document.querySelector('a[href*="/messaging/compose/"]');
          if (messagingLink && isVisible(messagingLink)) return messagingLink;

          return Array.from(document.querySelectorAll('button, [role="button"], a')).find((element) => isVisible(element) && (
            textOf(element).includes("message") ||
            textOf(element).includes("nachricht") ||
            element.getAttribute("data-control-name")?.toLowerCase().includes("message") ||
            element.getAttribute("aria-label")?.toLowerCase().includes("nachricht")
          )) || null;
        }, 10000);

        if (directMessageButton) {
          if (directMessageButton.tagName === 'A' && directMessageButton.href) {
            return { shouldNavigateTo: directMessageButton.href };
          }
          clickElement(directMessageButton);
        } else {
          const moreButton = await waitForElement(() => (
            document.querySelector('button[aria-label="Mehr"], button[aria-label="More actions"], button[data-control-name="overflow_menu_trigger"]')
            || Array.from(document.querySelectorAll('button, [role="button"], a')).find((element) => isVisible(element) && (
              textOf(element).includes("mehr") ||
              textOf(element).includes("more") ||
              element.getAttribute("aria-haspopup") === "menu"
            ))
            || null
          ), 18000);
          if (!moreButton) {
            throw new Error("Could not find the LinkedIn more actions button.");
          }
          clickElement(moreButton);
          await sleep(1200);
          const messageItem = await waitForElement(() => {
            const menus = Array.from(document.querySelectorAll('[role="dialog"], [data-qa*="menu"], [data-test-modal], [data-test-dialog]'));
            const buttons = menus.flatMap((menu) => Array.from(menu.querySelectorAll('button, [role="button"], a, [role="menuitem"]')));
            return buttons.find((element) => isVisible(element) && (
              textOf(element).includes("send message") ||
              textOf(element).includes("message") ||
              textOf(element).includes("nachricht senden") ||
              textOf(element).includes("nachricht schreiben")
            )) || null;
          }, 12000);
          if (!messageItem) {
            throw new Error('Could not find a LinkedIn message action in the menu.');
          }
          clickElement(messageItem);
        }
      } else {
        const directMessageButton = await waitForElement(() => (
          document.querySelector('button[data-qa="profile-primary-action"]')
          || Array.from(document.querySelectorAll('button, [role="button"], a')).find((element) => isVisible(element) && (
            textOf(element).includes("nachricht schreiben") ||
            textOf(element).includes("write message")
          ))
          || null
        ), 8000);

        if (directMessageButton) {
          clickElement(directMessageButton);
        } else {
          const menuButton = await waitForElement(() => (
            document.querySelector('button[data-qa="more-button"][aria-label="Mehr"], button[data-qa="more-button"]')
            || Array.from(document.querySelectorAll('button, [role="button"], a')).find((element) => isVisible(element) && (
              textOf(element).includes("mehr") ||
              textOf(element).includes("more") ||
              element.getAttribute("aria-haspopup") === "menu"
            ))
            || null
          ));
          if (!menuButton) {
            throw new Error("Could not find the Xing three-dots actions button.");
          }
          clickElement(menuButton);
          await sleep(1200);
          const messageItem = await waitForElement(() => {
            const menu = document.querySelector('[data-qa="more-menu"]');
            const buttons = menu ? Array.from(menu.querySelectorAll('button, [role="button"], a, [role="menuitem"]')) : [];
            return buttons.find((element) => isVisible(element) && textOf(element).includes("nachricht schreiben")) || null;
          }, 12000);
          if (!messageItem) {
            throw new Error('Could not find "Nachricht schreiben" in the Xing actions menu.');
          }
          clickElement(messageItem);
        }
      }

      await sleep(1200);
      return { urlAfterClick: window.location.href };
    }, [portal]);

    if (clickResult?.error) {
      throw new Error(clickResult.error);
    }

    let didNavigate = false;

    if (clickResult?.shouldNavigateTo) {
      await browser.tabs.update(run.tabId, { url: clickResult.shouldNavigateTo });
      didNavigate = true;
    } else {
      const urlAfter = clickResult?.urlAfterClick || "";
      didNavigate = urlAfter && urlAfter !== urlBefore;
    }

    if (didNavigate) {
      const waitForTabLoad = async (tabId, timeoutMs = 15000) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
          const t = await browser.tabs.get(tabId).catch(() => null);
          if (t && t.status === "complete") return t;
          await new Promise((r) => setTimeout(r, 300));
        }
        return null;
      };
      await waitForTabLoad(run.tabId);
      await new Promise((r) => setTimeout(r, 1500));
    }

    const prepared = await executeTabFunction(run.tabId, async (inputMessage, inputPortal) => {
      const portalName = inputPortal || "xing";
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const waitForElement = async (findElement, timeoutMs = 18000) => {
        const startedAt = Date.now();
        let found = findElement();
        while (!found && Date.now() - startedAt < timeoutMs) {
          await sleep(350);
          found = findElement();
        }
        return found;
      };
      const setNativeValue = (element, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
        if (descriptor?.set) {
          descriptor.set.call(element, value);
        } else {
          element.value = value;
        }
      };
      const findComposerInput = () => {
        if (portalName === "linkedin") {
          const selectors = [
            'textarea[data-test-modal-message-input]',
            'textarea[name="message"]',
            'textarea[aria-label*="message"]',
            'textarea[aria-label*="nachricht"]',
            'div.msg-form__contenteditable[contenteditable="true"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[aria-label*="Nachricht verfassen"]',
            'div[aria-label*="Write a message"]',
          ];
          for (const selector of selectors) {
            const exact = document.querySelector(selector);
            if (exact && isVisible(exact) && !exact.disabled) return exact;
          }
          return null;
        }
        const selectors = [
          'textarea[data-qa="message-composer-textarea"]',
          'textarea[data-element="message-composer-textarea"]',
          'textarea[aria-label*="Nachricht"]',
          'textarea[placeholder*="Nachricht"]',
          'textarea[data-xds="InputBar"]',
        ];
        for (const selector of selectors) {
          const exact = document.querySelector(selector);
          if (exact && isVisible(exact) && !exact.disabled) return exact;
        }
        return null;
      };

      const input = await waitForElement(findComposerInput, 18000);
      if (!input) {
        throw new Error(`Could not find the ${portalName === "linkedin" ? "LinkedIn" : "Xing"} message composer.`);
      }
      input.focus();
      input.dispatchEvent(new Event("focus", { bubbles: true }));
      if (input.matches('textarea, input')) {
        setNativeValue(input, inputMessage);
        input.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: inputMessage,
        }));
        input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "a" }));
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "a" }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
      } else if (input.isContentEditable || input.contentEditable === "true") {
        // LinkedIn Draft.js contenteditable - simulate real typing
        input.focus();

        // 1. Select all and delete
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(input);
        selection.removeAllRanges();
        selection.addRange(range);

        if (document.queryCommandSupported && document.queryCommandSupported('delete')) {
          document.execCommand('delete', false, null);
        } else {
          input.innerHTML = '';
        }

        // 2. Insert text via execCommand (Draft.js listens to this)
        if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
          document.execCommand('insertText', false, inputMessage);
        } else {
          const p = document.createElement('p');
          p.textContent = inputMessage;
          input.appendChild(p);
        }

        // 3. Move cursor to end
        const p = input.querySelector('p') || input;
        const endRange = document.createRange();
        endRange.selectNodeContents(p);
        endRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(endRange);

        // 4. Dispatch events that Draft.js expects
        input.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: inputMessage,
        }));
        input.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: inputMessage,
        }));
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter' }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        input.textContent = inputMessage;
        input.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: inputMessage,
        }));
      }
      return { ok: true };
    }, [message, portal]);

    if (!prepared?.ok) {
      throw new Error(prepared?.error || `Failed to prepare ${getPortalDisplayName(portal)} candidate.`);
    }

    const updated = {
      ...run,
      status: "awaiting_user",
      message: "",
    };
    await saveAutomationRun(updated);
    return updated;
  } catch (error) {
    console.error("Failed to prepare automation candidate:", error);
    return recordAutomationFailure(run, candidate, error);
  } finally {
    preparingRuns.delete(run.id);
  }
};

const processNextAutomationCandidate = async (run) => {
  if (!run || run.status === "stopped") {
    return run;
  }

  const nextIndex = (run.currentIndex ?? -1) + 1;
  const candidates = Array.isArray(run.candidates) ? run.candidates : [];
  if (nextIndex >= candidates.length) {
    const completeRun = {
      ...run,
      status: "complete",
      currentIndex: nextIndex,
      currentCandidate: null,
      message: "Automation complete.",
    };
    await saveAutomationRun(completeRun);
    return completeRun;
  }

  const candidate = candidates[nextIndex];
  const nextRun = {
    ...run,
    status: "preparing",
    currentIndex: nextIndex,
    currentCandidate: candidate,
    message: `Preparing ${candidate.name}`,
  };
  await saveAutomationRun(nextRun);

  const currentTab = await browser.tabs.get(nextRun.tabId);
  if (normalizeUrlForCompare(currentTab?.url) !== normalizeUrlForCompare(candidate.url)) {
    await browser.tabs.update(nextRun.tabId, { url: candidate.url });
    return nextRun;
  }

  return prepareAutomationCandidate(nextRun);
};

const startPortalAutomation = async ({ tabId, webhookId, limit, portal }) => {
  const tab = tabId ? await browser.tabs.get(tabId) : await getActiveTab();
  const tabPortal = detectPortalFromUrl(tab.url);
  const selectedPortal = portal || tabPortal;
  if (!tab?.id || tabPortal !== selectedPortal || !selectedPortal) {
    throw new Error(`Open a ${getPortalDisplayName(selectedPortal)} candidate list page before starting automation.`);
  }

  if (!webhookId) {
    throw new Error("Select a message webhook before starting automation.");
  }

  const candidates = await executeTabFunction(tab.id, (inputPortal, inputLimit) => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const textOf = (element) => `${element?.textContent || ""} ${element?.getAttribute("aria-label") || ""} ${element?.getAttribute("title") || ""}`.toLowerCase();
    const candidateNameFromAnchor = (anchor) => {
      const banned = [
        "message", "send message", "nachricht", "nachricht schreiben", "nachricht senden",
        "more", "mehr", "profil ansehen", "connect", "verbinden", "follow", "folgen",
        "accept", "ablehnen", "decline", "delete", "löschen", "invite", "einladen"
      ];
      const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const isUsefulName = (value) => {
        const text = clean(value);
        if (!text || text.length < 2) return false;
        const lower = text.toLowerCase();
        return !banned.some((term) => lower === term || lower.includes(term));
      };

      const testId = anchor.getAttribute("data-testid") || "";
      const recruiterMatch = testId.match(/^recruiter-(.+)-cta$/);
      if (recruiterMatch?.[1]) {
        const candidate = recruiterMatch[1]
          .replace(/[0-9]+$/g, "")
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (isUsefulName(candidate)) return candidate;
      }
      const href = anchor.getAttribute("href") || "";
      const profileMatch = href.match(/\/(in|profile|pub)\/([^/?#]+)/);
      if (profileMatch?.[2]) {
        const slugName = decodeURIComponent(profileMatch[2])
          .replace(/[0-9]+$/g, "")
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (isUsefulName(slugName)) return slugName;
      }

      const anchorText = clean(textOf(anchor));
      if (isUsefulName(anchorText)) return anchorText;

      const card = anchor.closest('li, article, section, [role="listitem"], .mn-connection-card, .entity-result, .reusable-search__result-container, .artdeco-card, div');
      if (card) {
        const lines = clean(card.innerText)
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        for (const line of lines) {
          if (isUsefulName(line)) {
            return line;
          }
        }
      }

      const aria = clean(anchor.getAttribute("aria-label"));
      if (isUsefulName(aria)) return aria;
      const title = clean(anchor.getAttribute("title"));
      if (isUsefulName(title)) return title;
      return anchorText || aria || title || "";
    };
    const isRenderable = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    };

    const isInNavOrHeader = (element) => {
      let el = element.parentElement;
      while (el) {
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute("role");
        if (tag === "nav" || tag === "header" || role === "navigation" || role === "banner" || role === "menubar") return true;
        el = el.parentElement;
      }
      return false;
    };

    const isOwnProfileLink = (href) => {
      return /\/in\/(me|self)\//i.test(href) || /\/in\/(me|self)$/i.test(href);
    };

    const extractVisibleCandidates = (portalName, limit = 10) => {
      const seen = new Set();
      const candidates = [];
      const isConnectionsPage = /\/mynetwork\/invite-connect\/connections\//.test(window.location.href);

      const addCandidate = (name, url) => {
        if (!name || name.length < 2 || !url) return false;
        try {
          const parsed = new URL(url);
          if (seen.has(parsed.pathname)) return false;
          seen.add(parsed.pathname);
          candidates.push({ id: parsed.pathname, name, url, source: `${portalName}-visible-list` });
          return true;
        } catch (_) {
          return false;
        }
      };

      // ── Phase 1: collect every anchor that looks like a profile link ──
      if (!isConnectionsPage) {
        const allAnchors = Array.from(document.querySelectorAll('a[href]'));
        const profileAnchors = allAnchors.filter((a) => {
          const href = a.getAttribute("href") || "";
          return href && !href.startsWith("javascript:") && !isOwnProfileLink(href) && /\/(in|pub|profile)\//.test(href);
        });

        const anchors = profileAnchors.sort((a, b) => {
          const aPreferred = portalName === "linkedin"
            ? /message|more|profil ansehen/i.test(textOf(a))
            : a.matches('a[data-testid^="recruiter-"][data-testid$="-cta"]') || /profil ansehen/i.test(textOf(a));
          const bPreferred = portalName === "linkedin"
            ? /message|more|profil ansehen/i.test(textOf(b))
            : b.matches('a[data-testid^="recruiter-"][data-testid$="-cta"]') || /profil ansehen/i.test(textOf(b));
          return Number(bPreferred) - Number(aPreferred);
        });

        for (const anchor of anchors) {
          if (!isRenderable(anchor)) continue;
          if (isInNavOrHeader(anchor)) continue;
          const rawHref = anchor.getAttribute("href") || "";
          const url = new URL(rawHref, window.location.href).toString();
          const name = candidateNameFromAnchor(anchor);
          if (addCandidate(name, url) && candidates.length >= limit) break;
        }
      }

      // ── Phase 2: LinkedIn connection-card extraction ──
      if (portalName === "linkedin") {
        // Strategy A: find message buttons with "Nachricht senden an: NAME" aria-label
        const msgLinks = Array.from(document.querySelectorAll('a[aria-label*="Nachricht senden an:"], a[aria-label*="Message"]'));
        for (const msgLink of msgLinks) {
          if (!isRenderable(msgLink)) continue;
          const aria = msgLink.getAttribute("aria-label") || "";
          const nameMatch = aria.match(/(?:Nachricht senden an|Message)\s*:\s*(.+)/i);
          if (!nameMatch?.[1]) continue;
          const profileName = nameMatch[1].trim();

          // Walk up to find the card container and the profile link inside it
          let container = msgLink.parentElement;
          let profileUrl = null;
          for (let i = 0; i < 10 && container; i++, container = container.parentElement) {
            const profileAnchors = Array.from(container.querySelectorAll('a[href*="/in/"]'));
            for (const pa of profileAnchors) {
              const href = pa.getAttribute("href") || "";
              if (!href || href.startsWith("javascript:") || isOwnProfileLink(href)) continue;
              // make sure this profile anchor is not the message link itself
              if (pa === msgLink) continue;
              profileUrl = new URL(href, window.location.href).toString();
              break;
            }
            if (profileUrl) break;
          }

          if (addCandidate(profileName, profileUrl) && candidates.length >= limit) break;
        }

        // Strategy B: generic card selectors (only if still empty)
        if (candidates.length === 0) {
          const cardSelectors = [
            '[data-testid="lazy-column"] > div > div',
            '[data-testid="connections-list"] > div',
            '.mn-connection-card',
            '.mn-connections .artdeco-list__item',
            '[data-testid="connection-card"]',
            'li.mn-connection-card',
            '.connections-list li',
            '[class*="connection"]',
          ];
          const connectionCards = cardSelectors.flatMap((sel) => Array.from(document.querySelectorAll(sel)));

          for (const card of connectionCards) {
            if (!isRenderable(card)) continue;

            let profileUrl = null;
            let profileName = null;
            const cardAnchors = Array.from(card.querySelectorAll('a[href]'));
            for (const a of cardAnchors) {
              const href = a.getAttribute("href") || "";
              if (!href || href.startsWith("javascript:") || isOwnProfileLink(href)) continue;
              if (/\/(in|pub|profile)\//.test(href)) {
                profileUrl = new URL(href, window.location.href).toString();
                const name = candidateNameFromAnchor(a);
                if (name && name.length >= 2) {
                  profileName = name;
                  break;
                }
              }
            }

            if (!profileName) {
              const msgButton = card.querySelector('button[aria-label*="Nachricht"], button[aria-label*="Message"], a[aria-label*="Nachricht"], a[aria-label*="Message"]');
              if (msgButton) {
                const aria = msgButton.getAttribute("aria-label") || "";
                const nameMatch = aria.match(/^(.+?)\s+(?:eine\s+)?(?:Nachricht|Message)/i);
                if (nameMatch?.[1]) {
                  profileName = nameMatch[1].trim();
                }
              }
            }

            if (profileName && !profileUrl) {
              const slug = profileName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
              if (slug) {
                profileUrl = new URL(`/in/${slug}`, window.location.href).toString();
              }
            }

            if (addCandidate(profileName, profileUrl) && candidates.length >= limit) break;
          }
        }
      }

      return candidates;
    };
    return extractVisibleCandidates(inputPortal || "xing", inputLimit);
  }, [selectedPortal, Math.max(1, Math.min(Number(limit) || 10, 100))]);

  const normalizedCandidates = (Array.isArray(candidates) ? candidates : []).map((candidate, index) =>
    normalizeCandidate(candidate, index)
  ).filter((candidate) => candidate.url);

  if (normalizedCandidates.length === 0) {
    throw new Error(`No visible ${getPortalDisplayName(selectedPortal)} candidates were found on this page.`);
  }

  const run = {
    id: crypto.randomUUID(),
    portal: selectedPortal,
    status: "running",
    tabId: tab.id,
    webhookId,
    candidates: normalizedCandidates,
    currentIndex: -1,
    currentCandidate: null,
    total: normalizedCandidates.length,
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
    failures: [],
    message: `Starting ${getPortalDisplayName(selectedPortal)} automation.`,
    startedAt: new Date().toISOString(),
  };

  await saveAutomationRun(run);
  return processNextAutomationCandidate(run);
};

const startXingAutomation = async ({ tabId, webhookId, limit }) => {
  return startPortalAutomation({ tabId, webhookId, limit, portal: "xing" });
};

const completeCurrentAutomationCandidate = async () => {
  const run = await getAutomationRun();
  if (!run || run.status !== "awaiting_user") {
    return run;
  }
  const updated = {
    ...run,
    successCount: (run.successCount || 0) + 1,
    status: "running",
  };
  await saveAutomationRun(updated);
  return processNextAutomationCandidate(updated);
};

const skipCurrentAutomationCandidate = async () => {
  const run = await getAutomationRun();
  if (!run || (run.status !== "awaiting_user" && run.status !== "preparing" && run.status !== "failed")) {
    return run;
  }
  const updated = {
    ...run,
    skippedCount: (run.skippedCount || 0) + 1,
    status: "running",
  };
  await saveAutomationRun(updated);
  return processNextAutomationCandidate(updated);
};

const normalizeUrlForCompare = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return url || "";
  }
};

const retryCurrentAutomationCandidate = async () => {
  const run = await getAutomationRun();
  if (!run || (run.status !== "failed" && run.status !== "preparing")) {
    return run;
  }

  // Ensure this run is not stuck in the preparing lock
  preparingRuns.delete(run.id);

  const updated = {
    ...run,
    status: "preparing",
    message: `Retrying ${run.currentCandidate?.name || "candidate"}`,
  };
  await saveAutomationRun(updated);

  // Check if we need to navigate to the candidate's profile first
  if (run.tabId && run.currentCandidate?.url) {
    try {
      const currentTab = await browser.tabs.get(run.tabId);
      if (normalizeUrlForCompare(currentTab?.url) !== normalizeUrlForCompare(run.currentCandidate.url)) {
        await browser.tabs.update(run.tabId, { url: run.currentCandidate.url });
        return updated;
      }
    } catch {
      // Tab may have been closed; try to open in active tab
      const activeTab = await getActiveTab();
      if (activeTab?.id) {
        await browser.tabs.update(activeTab.id, { url: run.currentCandidate.url });
        const withNewTabId = { ...updated, tabId: activeTab.id };
        await saveAutomationRun(withNewTabId);
        return withNewTabId;
      }
    }
  }

  return prepareAutomationCandidate(updated);
};

const stopAutomation = async () => {
  const run = await getAutomationRun();
  if (!run) return null;
  const updated = {
    ...run,
    status: "stopped",
    message: "Automation stopped.",
  };
  await saveAutomationRun(updated);
  return updated;
};

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
    if (changeInfo.status === "complete") {
      try {
        const run = await getAutomationRun();
        if (run?.status === "preparing" && run.tabId === tabId && run.currentCandidate) {
          await prepareAutomationCandidate(run);
        }
      } catch (error) {
        console.error("Failed to continue portal automation after tab update:", error);
      }
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

        case 'GET_PORTAL_AUTOMATION_STATUS': {
          const activeTab = await getActiveTab();
          const run = await getAutomationRun();
          return {
            success: true,
            portal: detectPortalFromUrl(activeTab?.url),
            tab: activeTab ? { id: activeTab.id, url: activeTab.url, title: activeTab.title } : null,
            run,
          };
        }

        case 'START_XING_AUTOMATION': {
          const run = await startXingAutomation({
            tabId: message.tabId,
            webhookId: message.webhookId,
            limit: message.limit,
          });
          return { success: true, run };
        }

        case 'START_PORTAL_AUTOMATION': {
          const run = await startPortalAutomation({
            tabId: message.tabId,
            webhookId: message.webhookId,
            limit: message.limit,
            portal: message.portal,
          });
          return { success: true, run };
        }

        case 'STOP_PORTAL_AUTOMATION': {
          const run = await stopAutomation();
          return { success: true, run };
        }

        case 'COMPLETE_CURRENT_AUTOMATION_CANDIDATE': {
          const run = await completeCurrentAutomationCandidate();
          return { success: true, run };
        }

        case 'SKIP_CURRENT_AUTOMATION_CANDIDATE': {
          const run = await skipCurrentAutomationCandidate();
          return { success: true, run };
        }

        case 'RETRY_CURRENT_AUTOMATION_CANDIDATE': {
          const run = await retryCurrentAutomationCandidate();
          return { success: true, run };
        }
      }
    };

    handleMessage().then(response => {
      console.log('Sending response:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });

    return true; // Keep channel open for async response
  });
  console.log('Message listener set up successfully');
}

// Initial check on startup
checkActiveTab();
