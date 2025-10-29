(() => {
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;
  const MAX_SELECTORS_DEFAULT = 10;

  let isCapturing = false;
  let currentWebhookId = null;
  let selectorSet = new Set();
  let selectorLimit = MAX_SELECTORS_DEFAULT;
  let highlightBox = null;
  let tooltip = null;
  let lastHoveredElement = null;

  const TOOLTIP_ID = "webhook-trigger-selector-tooltip";
  const HIGHLIGHT_ID = "webhook-trigger-selector-highlight";

  const normalizeSelectors = (selectors) => {
    if (!Array.isArray(selectors)) return [];
    return selectors
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);
  };

  const persistSelectorLocally = async (selector) => {
    if (!currentWebhookId || !selector) return;
    try {
      const data = await browserAPI.storage.sync.get("webhooks");
      const webhooks = Array.isArray(data?.webhooks) ? data.webhooks : [];
      const index = webhooks.findIndex((wh) => wh.id === currentWebhookId);
      if (index === -1) {
        return;
      }
      const selectors = normalizeSelectors(webhooks[index].selectors);
      if (selectors.includes(selector)) {
        return;
      }
      if (selectors.length >= selectorLimit) {
        return;
      }
      selectors.push(selector);
      webhooks[index] = { ...webhooks[index], selectors };
      await browserAPI.storage.sync.set({ webhooks });
    } catch (error) {
      console.debug("Failed to persist selector locally", error);
    }
  };

  const sendRuntimeMessage = (payload) => {
    const message = { origin: "content-script", ...payload };
    try {
      const result = browserAPI.runtime.sendMessage(message);
      if (result && typeof result.then === "function" && typeof result.catch === "function") {
        result.catch((error) => {
          console.debug("Runtime message rejected", error);
        });
      }
    } catch (error) {
      // Ignore messaging errors when popup/background is unavailable
      console.debug("Failed to send runtime message", error);
    }
  };

  const createHighlightElements = () => {
    if (!highlightBox) {
      highlightBox = document.createElement("div");
      highlightBox.id = HIGHLIGHT_ID;
      Object.assign(highlightBox.style, {
        position: "fixed",
        pointerEvents: "none",
        border: "2px solid #2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.15)",
        zIndex: "2147483646",
        transition: "all 0.1s ease",
      });
      document.documentElement.appendChild(highlightBox);
    }

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = TOOLTIP_ID;
      Object.assign(tooltip.style, {
        position: "fixed",
        pointerEvents: "none",
        padding: "6px 10px",
        backgroundColor: "#2563eb",
        color: "#fff",
        borderRadius: "4px",
        fontSize: "12px",
        zIndex: "2147483647",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        maxWidth: "280px",
        lineHeight: "1.4",
      });
      tooltip.innerText = browserAPI?.i18n?.getMessage
        ? browserAPI.i18n.getMessage("selectorCaptureTooltip") || "Click elements to capture their text. Press Esc to stop."
        : "Click elements to capture their text. Press Esc to stop.";
      document.documentElement.appendChild(tooltip);
    }
  };

  const removeHighlightElements = () => {
    if (highlightBox && highlightBox.parentNode) {
      highlightBox.parentNode.removeChild(highlightBox);
    }
    if (tooltip && tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip);
    }
    highlightBox = null;
    tooltip = null;
  };

  const updateHighlightPosition = (element, pointerEvent) => {
    if (!highlightBox || !element) return;
    const rect = element.getBoundingClientRect();
    Object.assign(highlightBox.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      display: "block",
    });

    if (tooltip) {
      const padding = 8;
      let top = pointerEvent.clientY + padding;
      let left = pointerEvent.clientX + padding;

      if (left + tooltip.offsetWidth > window.innerWidth) {
        left = pointerEvent.clientX - tooltip.offsetWidth - padding;
      }
      if (top + tooltip.offsetHeight > window.innerHeight) {
        top = pointerEvent.clientY - tooltip.offsetHeight - padding;
      }

      tooltip.style.top = `${Math.max(top, 0)}px`;
      tooltip.style.left = `${Math.max(left, 0)}px`;
    }
  };

  const clearHighlight = () => {
    if (highlightBox) {
      highlightBox.style.display = "none";
    }
    if (tooltip) {
      tooltip.style.display = "none";
    }
  };

  const normalizeElement = (node) => {
    if (!node) return null;
    return node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  };

  const shouldIgnoreElement = (element) => {
    if (!element) return true;
    if (element === document.documentElement || element === document.body) return false;
    if (element.id === HIGHLIGHT_ID || element.id === TOOLTIP_ID) return true;
    if (element.closest(`#${HIGHLIGHT_ID}`) || element.closest(`#${TOOLTIP_ID}`)) return true;
    return false;
  };

  const buildSelector = (element) => {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;

    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    const parts = [];
    let el = element;
    while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.documentElement) {
      let selector = el.tagName.toLowerCase();
      if (el.classList.length > 0) {
        selector += [...el.classList].slice(0, 3).map(cls => `.${CSS.escape(cls)}`).join("");
      }

      const siblings = el.parentElement
        ? [...el.parentElement.children].filter(child => child.tagName === el.tagName)
        : [];
      if (siblings.length > 1) {
        const index = siblings.indexOf(el) + 1;
        selector += `:nth-of-type(${index})`;
      }

      parts.unshift(selector);
      el = el.parentElement;
    }

    parts.unshift("html");
    const selectorString = parts.join(" > ");

    try {
      const matches = document.querySelectorAll(selectorString);
      if (matches.length === 1) {
        return selectorString;
      }
    } catch (_) {
      // Invalid selector built, fallback to shorter strategy
    }

    // Fallback: rely on full path without uniqueness check
    return selectorString;
  };

  const extractPlainText = (element) => {
    if (!element) return "";
    const text = element.innerText || element.textContent || "";
    return text.replace(/\s+/g, " ").trim();
  };

  const stopCapture = (reason = "completed") => {
    if (!isCapturing) return;
    isCapturing = false;
    currentWebhookId = null;
    selectorSet = new Set();
    selectorLimit = MAX_SELECTORS_DEFAULT;
    lastHoveredElement = null;

    document.removeEventListener("mousemove", handleMouseMove, true);
    document.removeEventListener("mouseover", handleMouseMove, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", handleKeydown, true);

    clearHighlight();
    removeHighlightElements();

    sendRuntimeMessage({ type: "SELECTOR_CAPTURE_ENDED", reason });
  };

  const handleMouseMove = (event) => {
    if (!isCapturing) return;
    let element = normalizeElement(event.target);
    if (shouldIgnoreElement(element)) {
      element = null;
    }

    lastHoveredElement = element;
    if (element) {
      createHighlightElements();
      tooltip.style.display = "block";
      updateHighlightPosition(element, event);
    } else {
      clearHighlight();
    }
  };

  const handleClick = (event) => {
    if (!isCapturing) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const element = normalizeElement(event.target);
    if (!element || shouldIgnoreElement(element)) {
      return;
    }

    if (selectorSet.size >= selectorLimit) {
      sendRuntimeMessage({ type: "SELECTOR_CAPTURE_ERROR", reason: "limit-reached" });
      stopCapture("limit-reached");
      return;
    }

    const selector = buildSelector(element);
    if (!selector) {
      sendRuntimeMessage({ type: "SELECTOR_CAPTURE_ERROR", reason: "no-selector" });
      return;
    }

    if (selectorSet.has(selector)) {
      sendRuntimeMessage({ type: "SELECTOR_CAPTURE_ERROR", reason: "duplicate", selector });
      return;
    }

    const textContent = extractPlainText(element);
    if (!textContent) {
      sendRuntimeMessage({ type: "SELECTOR_CAPTURE_ERROR", reason: "empty-text", selector });
      return;
    }

    selectorSet.add(selector);

    persistSelectorLocally(selector);

    removeHighlightElements();
    lastHoveredElement = null;
    sendRuntimeMessage({
      type: "SELECTOR_CAPTURED",
      selector,
      textContent,
      webhookId: currentWebhookId,
      remaining: Math.max(selectorLimit - selectorSet.size, 0),
    });

    if (selectorSet.size >= selectorLimit) {
      stopCapture("limit-reached");
    }
  };

  const handleKeydown = (event) => {
    if (!isCapturing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      stopCapture("cancelled");
    }
  };

  const startCapture = async ({ webhookId, existingSelectors = [], maxSelectors = MAX_SELECTORS_DEFAULT }) => {
    if (!webhookId) {
      return { ok: false, error: "missing-webhook" };
    }

    if (isCapturing) {
      stopCapture("replaced");
    }

    isCapturing = true;
    currentWebhookId = webhookId;
    selectorSet = new Set(Array.isArray(existingSelectors) ? existingSelectors : []);
    selectorLimit = typeof maxSelectors === "number" && maxSelectors > 0 ? maxSelectors : MAX_SELECTORS_DEFAULT;

    createHighlightElements();
    document.addEventListener("mousemove", handleMouseMove, true);
    document.addEventListener("mouseover", handleMouseMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeydown, true);

    return { ok: true, remaining: Math.max(selectorLimit - selectorSet.size, 0) };
  };

  const getSelectorContent = (selectors = []) => {
    if (!Array.isArray(selectors) || selectors.length === 0) {
      return [];
    }
    return selectors.map((selector) => {
      try {
        const element = document.querySelector(selector);
        return extractPlainText(element);
      } catch (error) {
        console.warn("Failed to query selector", selector, error);
        return "";
      }
    });
  };

  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== "object" || !message.type) {
      return undefined;
    }

    if (message.type === "START_SELECTOR_CAPTURE") {
      startCapture(message).then(sendResponse);
      return true;
    }

    if (message.type === "STOP_SELECTOR_CAPTURE") {
      stopCapture("stopped");
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === "GET_SELECTOR_CONTENT") {
      try {
        const selectorContent = getSelectorContent(message.selectors);
        sendResponse({ ok: true, selectorContent });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || "failed-to-get-selector-content" });
      }
      return false;
    }

    return undefined;
  });

  // Clean up when the page is unloaded
  window.addEventListener("pagehide", () => {
    if (isCapturing) {
      stopCapture("page-hidden");
    }
  });
})();
