(() => {
  if (globalThis.__webhookTriggerXingAutomationLoaded) {
    return;
  }
  globalThis.__webhookTriggerXingAutomationLoaded = true;

  const browserAPI = typeof browser !== "undefined" ? browser : chrome;
  const PROFILE_PATH_RE = /^\/profile\/[^/?#]+/;
  const DEFAULT_WAIT_MS = 1200;

  function absoluteUrl(href) {
    try {
      return new URL(href, window.location.href).toString();
    } catch (_) {
      return "";
    }
  }

  function candidateNameFromAnchor(anchor) {
    const testId = anchor.getAttribute("data-testid") || "";
    const recruiterMatch = testId.match(/^recruiter-(.+)-cta$/);
    if (recruiterMatch?.[1]) {
      return recruiterMatch[1]
        .replace(/[0-9]+$/g, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const href = anchor.getAttribute("href") || "";
    const profileMatch = href.match(/\/profile\/([^/?#]+)/);
    if (profileMatch?.[1]) {
      const slugName = decodeURIComponent(profileMatch[1])
        .replace(/[0-9]+$/g, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (slugName) return slugName;
    }

    const aria = anchor.getAttribute("aria-label");
    const text = anchor.textContent;
    return String(aria || text || "").replace(/\s+/g, " ").trim();
  }

  function extractVisibleCandidates(limit = 10) {
    const seen = new Set();
    const candidates = [];
    const profileViewAnchors = Array.from(document.querySelectorAll(
      'a[data-testid^="recruiter-"][data-testid$="-cta"][href*="/profile/"], a[href*="/profile/"]'
    ));
    const anchors = profileViewAnchors.sort((a, b) => {
      const aIsCta = a.matches('a[data-testid^="recruiter-"][data-testid$="-cta"]') || textMatches(a, ["profil ansehen"]);
      const bIsCta = b.matches('a[data-testid^="recruiter-"][data-testid$="-cta"]') || textMatches(b, ["profil ansehen"]);
      return Number(bIsCta) - Number(aIsCta);
    });

    for (const anchor of anchors) {
      if (!isVisible(anchor)) continue;
      const url = absoluteUrl(anchor.getAttribute("href"));
      if (!url) continue;

      let parsed;
      try {
        parsed = new URL(url);
      } catch (_) {
        continue;
      }

      if (!PROFILE_PATH_RE.test(parsed.pathname) || seen.has(parsed.pathname)) {
        continue;
      }

      const name = candidateNameFromAnchor(anchor);
      if (!name || name.length < 2) {
        continue;
      }

      seen.add(parsed.pathname);
      candidates.push({
        id: parsed.pathname,
        name,
        url,
        source: "xing-visible-list",
      });

      if (candidates.length >= limit) {
        break;
      }
    }

    return candidates;
  }

  function getCleanProfileHtml() {
    const main = document.querySelector("main") || document.body;
    if (!main) return "";
    const clone = main.cloneNode(true);
    clone.querySelectorAll("script, style, noscript, iframe, svg").forEach((element) => element.remove());
    return clone.outerHTML || "";
  }

  function extractProfileContext(candidate = {}) {
    const main = document.querySelector("main") || document.body;
    const profileText = String(main?.innerText || document.body?.innerText || "")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 20000);

    const titleName = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
    return {
      ...candidate,
      name: titleName || candidate.name,
      profileText,
      profileHtml: getCleanProfileHtml().slice(0, 50000),
      extractedAt: new Date().toISOString(),
    };
  }

  function isVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function textMatches(element, terms) {
    const text = `${element.textContent || ""} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`;
    const normalized = text.toLowerCase();
    return terms.some((term) => normalized.includes(term));
  }

  async function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForElement(findElement, timeoutMs = 15000) {
    const startedAt = Date.now();
    let found = findElement();
    while (!found && Date.now() - startedAt < timeoutMs) {
      await wait(350);
      found = findElement();
    }
    return found;
  }

  async function waitForProfileText(timeoutMs = 20000) {
    return waitForElement(() => {
      const main = document.querySelector("main") || document.body;
      const text = String(main?.innerText || "").trim();
      return text.length > 200 ? main : null;
    }, timeoutMs);
  }

  function clickableElements() {
    return Array.from(document.querySelectorAll('button, [role="button"], a, [role="menuitem"]'));
  }

  function clickElement(element) {
    element.scrollIntoView({ block: "center", inline: "center" });
    element.focus?.();
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      element.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
    });
  }

  function findThreeDotsButton() {
    const exact = document.querySelector('button[data-qa="more-button"][aria-label="Mehr"], button[data-qa="more-button"]');
    if (isVisible(exact)) return exact;

    const terms = [
      "mehr",
      "more",
      "weitere",
      "aktionen",
      "actions",
      "option",
      "menu",
      "menü",
    ];
    const explicit = clickableElements().find((element) => (
      isVisible(element) &&
      (
        textMatches(element, terms) ||
        element.getAttribute("aria-haspopup") === "menu" ||
        element.getAttribute("data-testid")?.toLowerCase().includes("more")
      )
    ));
    if (explicit) return explicit;

    const topButtons = clickableElements()
      .filter((element) => isVisible(element))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.top < Math.max(420, window.innerHeight * 0.6);
      });

    return topButtons.find((element) => {
      const label = `${element.textContent || ""}${element.getAttribute("aria-label") || ""}`.trim();
      return label === "..." || label === "…" || label === "•••" || label.length === 0;
    }) || null;
  }

  function findWriteMessageButton() {
    const exact = document.querySelector('button[data-qa="profile-primary-action"]');
    if (isVisible(exact) && textMatches(exact, ["nachricht schreiben", "message", "write message"])) {
      return exact;
    }

    return clickableElements().find((element) => (
      isVisible(element) &&
      textMatches(element, ["nachricht schreiben", "message", "write message"])
    )) || null;
  }

  function findWriteMessageMenuItem() {
    const menu = document.querySelector('[data-qa="more-menu"]');
    const menuButtons = menu
      ? Array.from(menu.querySelectorAll('button, [role="button"], a, [role="menuitem"]'))
      : clickableElements();

    return menuButtons.find((element) => (
      isVisible(element) &&
      textMatches(element, [
        "nachricht schreiben",
        "nachricht senden",
        "message",
        "write message",
        "send message",
        "anschreiben",
      ])
    ));
  }

  async function openMessageComposer() {
    await wait(DEFAULT_WAIT_MS);

    const directButton = await waitForElement(findWriteMessageButton, 8000);
    if (directButton) {
      clickElement(directButton);
      await wait(2000);
      return;
    }

    const menuButton = await waitForElement(findThreeDotsButton, 18000);
    if (!menuButton) {
      throw new Error("Could not find the Xing three-dots actions button.");
    }

    clickElement(menuButton);
    await wait(DEFAULT_WAIT_MS);

    const messageItem = await waitForElement(findWriteMessageMenuItem, 12000);
    if (!messageItem) {
      throw new Error('Could not find "Nachricht schreiben" in the Xing actions menu.');
    }

    clickElement(messageItem);
    await wait(DEFAULT_WAIT_MS);
  }

  function setNativeValue(element, value) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  async function fillComposer(message) {
    const input = await waitForElement(() => {
      const selectors = [
        'textarea[data-qa="message-composer-textarea"]',
        'textarea[data-element="message-composer-textarea"]',
        'textarea[aria-label*="Nachricht"]',
        'textarea[placeholder*="Nachricht"]',
        'textarea[data-xds="InputBar"]',
      ];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && isVisible(el) && !el.disabled) return el;
      }
      return null;
    }, 18000);

    if (!input) {
      throw new Error("Could not find a Xing message input.");
    }

    input.focus();
    input.dispatchEvent(new Event("focus", { bubbles: true }));

    setNativeValue(input, message);

    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: message,
    }));

    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "a" }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: "a" }));

    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));

    return true;
  }

  function ensureReviewBanner(candidate) {
    let banner = document.getElementById("webhook-trigger-xing-review");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "webhook-trigger-xing-review";
      banner.style.position = "fixed";
      banner.style.right = "16px";
      banner.style.bottom = "16px";
      banner.style.zIndex = "2147483647";
      banner.style.maxWidth = "340px";
      banner.style.padding = "12px";
      banner.style.border = "1px solid #2563eb";
      banner.style.borderRadius = "8px";
      banner.style.background = "#ffffff";
      banner.style.color = "#111827";
      banner.style.boxShadow = "0 10px 30px rgba(0,0,0,0.18)";
      banner.style.fontFamily = "Arial, sans-serif";
      banner.style.fontSize = "13px";
      document.body.appendChild(banner);
    }

    banner.textContent = "";
    const title = document.createElement("strong");
    title.textContent = "Webhook Trigger";
    const body = document.createElement("p");
    body.style.margin = "8px 0 0";
    body.textContent = `Draft filled for ${candidate?.name || "candidate"}. Send it in Xing, then continue from the extension popup.`;
    banner.appendChild(title);
    banner.appendChild(body);
  }

  async function prepareCandidate(candidate, message) {
    await openMessageComposer();
    await fillComposer(message);
    ensureReviewBanner(candidate);
    return { ok: true };
  }

  globalThis.__webhookTriggerXingAutomationApi = {
    extractVisibleCandidates,
    extractProfileContext,
    waitForProfileText,
    prepareCandidate,
  };
})();
