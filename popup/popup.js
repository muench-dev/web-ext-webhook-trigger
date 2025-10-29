const MAX_SELECTORS_PER_WEBHOOK = 10;
const STATUS_VARIANTS = ["success", "error", "info", "hidden"];

document.addEventListener("DOMContentLoaded", async () => {
  const browserAPI = window.getBrowserAPI();
  replaceI18nPlaceholders();

  const buttonsContainer = document.getElementById("buttons-container");
  const statusMessageEl = document.getElementById("status-message");
  const responseContainer = document.getElementById("response-container");
  const responseContent = document.getElementById("response-content");
  const copyResponseBtn = document.getElementById("copy-response-btn");
  const captureButtonMap = new Map();

  let activeCaptureWebhookId = null;
  let currentResponseText = "";

  const setStatus = (variant, message) => {
    if (!statusMessageEl) return;
    STATUS_VARIANTS.forEach(v => statusMessageEl.classList.remove(v));
    const text = message || "";
    statusMessageEl.textContent = text;
    if (!text) {
      statusMessageEl.classList.add("hidden");
      return;
    }
    const effectiveVariant = STATUS_VARIANTS.includes(variant) ? variant : "info";
    statusMessageEl.classList.add(effectiveVariant);
  };

  const hideResponse = () => {
    currentResponseText = "";
    if (responseContent) {
      responseContent.textContent = "";
    }
    if (responseContainer) {
      responseContainer.classList.add("hidden");
    }
  };

  const showResponse = (text) => {
    currentResponseText = text || "";
    if (!responseContainer || !responseContent) return;
    if (!currentResponseText) {
      hideResponse();
      return;
    }
    responseContent.textContent = currentResponseText;
    responseContainer.classList.remove("hidden");
  };

  const getCaptureLabel = (count) => {
    const localized = browserAPI.i18n.getMessage("popupCaptureButtonLabel", [
      String(count),
      String(MAX_SELECTORS_PER_WEBHOOK),
    ]);
    return localized || `Capture (${count}/${MAX_SELECTORS_PER_WEBHOOK})`;
  };

  const getLimitTooltip = () => {
    return (
      browserAPI.i18n.getMessage("popupCaptureLimitReachedTooltip", [
        String(MAX_SELECTORS_PER_WEBHOOK),
      ]) || `Maximum of ${MAX_SELECTORS_PER_WEBHOOK} selectors reached`
    );
  };

  const ensureSelectorContentScript = async (tabId) => {
    try {
      if (browserAPI.scripting && typeof browserAPI.scripting.executeScript === "function") {
        await browserAPI.scripting.executeScript({
          target: { tabId },
          files: ["content-scripts/selector-capture.js"],
        });
        return true;
      }
      if (browserAPI.tabs && typeof browserAPI.tabs.executeScript === "function") {
        await browserAPI.tabs.executeScript(tabId, {
          file: "content-scripts/selector-capture.js",
        });
        return true;
      }
    } catch (error) {
      console.debug("Failed to inject selector capture script", error);
    }
    return false;
  };

  const sendMessageToTab = (tabId, message) => {
    if (browserAPI.tabs && typeof browserAPI.tabs.sendMessage === "function") {
      return browserAPI.tabs.sendMessage(tabId, message);
    }
    if (typeof browser !== "undefined" && browser.tabs?.sendMessage) {
      return browser.tabs.sendMessage(tabId, message);
    }
    if (typeof chrome !== "undefined" && chrome.tabs?.sendMessage) {
      return new Promise((resolve, reject) => {
        try {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            const error = chrome.runtime?.lastError;
            if (error) {
              reject(new Error(error.message));
            } else {
              resolve(response);
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    }
    throw new Error("tabs.sendMessage API is unavailable");
  };

  const updateCaptureButtonState = (webhookId) => {
    const button = captureButtonMap.get(webhookId);
    const webhook = window._webhookMap ? window._webhookMap[webhookId] : null;
    if (!button || !webhook) return;
    const count = Array.isArray(webhook.selectors) ? webhook.selectors.length : 0;
    button.textContent = getCaptureLabel(count);
    const limitReached = count >= MAX_SELECTORS_PER_WEBHOOK;
    button.disabled = limitReached;
    if (limitReached) {
      button.title = getLimitTooltip();
    } else {
      button.removeAttribute("title");
    }
    if (activeCaptureWebhookId === webhookId) {
      button.dataset.capturing = "true";
      button.disabled = false;
    } else {
      button.dataset.capturing = "false";
    }
  };

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Fallback: use a hidden textarea
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const result = document.execCommand("copy");
      document.body.removeChild(textarea);
      return result;
    } catch (error) {
      console.error("Failed to copy response", error);
      return false;
    }
  };

  if (copyResponseBtn) {
    copyResponseBtn.addEventListener("click", async () => {
      if (!currentResponseText) return;
      const ok = await copyToClipboard(currentResponseText);
      const successMsg =
        browserAPI.i18n.getMessage("popupCopySuccess") || "Copied to clipboard.";
      const errorMsg =
        browserAPI.i18n.getMessage("popupCopyError") || "Failed to copy response.";
      setStatus(ok ? "success" : "error", ok ? successMsg : errorMsg);
    });
  }

  const ensureSelectors = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
      .slice(0, MAX_SELECTORS_PER_WEBHOOK);
  };

  const applyThemePreference = async () => {
    try {
      const themeResult = await browserAPI.storage.sync.get("theme");
      const theme = themeResult && themeResult.theme ? themeResult.theme : "system";
      const root = document.documentElement;
      if (theme === "light" || theme === "dark") {
        root.setAttribute("data-theme", theme);
      } else {
        root.removeAttribute("data-theme");
      }
    } catch (error) {
      console.warn("Failed to load theme preference", error);
    }
  };

  const renderWebhooks = async () => {
    captureButtonMap.clear();
    buttonsContainer.textContent = "";
    hideResponse();
    setStatus("hidden", "");

    const [{ webhooks = [], groups = [] }, tabs] = await Promise.all([
      browserAPI.storage.sync.get(["webhooks", "groups"]),
      browserAPI.tabs.query({ active: true, currentWindow: true }),
    ]);

    const currentUrl = tabs[0]?.url || "";
    const normalizedWebhooks = webhooks.map((wh) => ({
      ...wh,
      selectors: ensureSelectors(wh.selectors),
    }));

    const visibleWebhooks = normalizedWebhooks.filter(
      (wh) => !wh.urlFilter || currentUrl.includes(wh.urlFilter)
    );

    window._webhookMap = Object.fromEntries(
      visibleWebhooks.map((wh) => [wh.id, { ...wh, selectors: [...wh.selectors] }])
    );

    if (visibleWebhooks.length === 0) {
      const p = document.createElement("p");
      p.className = "no-hooks-msg";
      p.textContent = browserAPI.i18n.getMessage("popupNoWebhooksConfigured");
      buttonsContainer.appendChild(p);
      return;
    }

    const groupedWebhooks = visibleWebhooks.reduce((acc, webhook) => {
      const groupKey = webhook.groupId || "ungrouped";
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(webhook);
      return acc;
    }, {});

    const groupMap = Object.fromEntries(groups.map((group) => [group.id, group.name]));

    const appendWebhookRow = (webhook) => {
      const row = document.createElement("div");
      row.className = "webhook-row";

      const displayLabel = `${webhook.emoji ? `${webhook.emoji} ` : ""}${webhook.label}`;

      const triggerBtn = document.createElement("button");
      triggerBtn.dataset.action = "trigger";
      triggerBtn.dataset.webhookId = webhook.id;
      triggerBtn.dataset.label = displayLabel;
      triggerBtn.classList.add("webhook-btn");
      triggerBtn.textContent = displayLabel;

      const captureBtn = document.createElement("button");
      captureBtn.dataset.action = "capture";
      captureBtn.dataset.webhookId = webhook.id;
      captureBtn.classList.add("capture-btn");
      captureButtonMap.set(webhook.id, captureBtn);

      row.appendChild(triggerBtn);
      row.appendChild(captureBtn);
      buttonsContainer.appendChild(row);

      updateCaptureButtonState(webhook.id);
    };

    groups.forEach((group) => {
      const groupWebhooks = groupedWebhooks[group.id];
      if (!groupWebhooks || groupWebhooks.length === 0) {
        return;
      }
      const header = document.createElement("h3");
      header.className = "group-header";
      header.textContent = group.name;
      buttonsContainer.appendChild(header);
      groupWebhooks.forEach(appendWebhookRow);
    });

    const ungrouped = groupedWebhooks["ungrouped"] || [];
    if (ungrouped.length > 0) {
      const header = document.createElement("h3");
      header.className = "group-header";
      header.textContent =
        browserAPI.i18n.getMessage("popupNoGroup") || "No Group";
      buttonsContainer.appendChild(header);
      ungrouped.forEach(appendWebhookRow);
    }
  };

  const handleTrigger = async (webhook, button) => {
    if (!button || !webhook) return;
    const originalLabel = button.dataset.label || button.textContent;
    if (button.disabled) return;

    hideResponse();
    setStatus("info", browserAPI.i18n.getMessage("popupSending") || "Sending…");

    button.disabled = true;
    button.textContent = browserAPI.i18n.getMessage("popupSending") || "Sending…";

    try {
      const response = await window.sendWebhook(webhook, false);
      const message = await extractResponseMessage(response);
      if (message) {
        showResponse(message);
      } else {
        hideResponse();
      }
      setStatus(
        "success",
        browserAPI.i18n.getMessage("popupStatusSuccess") || "Webhook sent!"
      );
      button.textContent =
        browserAPI.i18n.getMessage("popupBtnTextSent") || "Sent!";
    } catch (error) {
      console.error("Error sending webhook:", error);
      hideResponse();
      const prefix =
        browserAPI.i18n.getMessage("popupStatusErrorPrefix") || "Error:";
      setStatus("error", `${prefix} ${error.message}`);
      button.textContent =
        browserAPI.i18n.getMessage("popupBtnTextFailed") || "Failed";
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = originalLabel;
        setStatus("hidden", "");
      }, 2500);
    }
  };

  const startCapture = async (webhook, button) => {
    const selectors = Array.isArray(webhook.selectors) ? webhook.selectors : [];
    if (selectors.length >= MAX_SELECTORS_PER_WEBHOOK) {
      setStatus("error", getLimitTooltip());
      updateCaptureButtonState(webhook.id);
      return;
    }

    let tabs = [];
    if (browserAPI.tabs?.query) {
      tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    } else if (browserAPI.tabs?.getCurrent) {
      const tab = await browserAPI.tabs.getCurrent();
      if (tab) tabs = [tab];
    }
    if (!tabs.length) {
      setStatus(
        "error",
        browserAPI.i18n.getMessage("popupNoActiveTabError") ||
          "Unable to find an active tab."
      );
      return;
    }

    const tabId = tabs[0].id;
    const attemptStart = async () => {
      const response = await sendMessageToTab(tabId, {
        type: "START_SELECTOR_CAPTURE",
        webhookId: webhook.id,
        existingSelectors: selectors,
        maxSelectors: MAX_SELECTORS_PER_WEBHOOK,
      });
      activeCaptureWebhookId = webhook.id;
      if (button) {
        button.disabled = false;
        button.dataset.capturing = "true";
      }
      const remaining = response?.remaining ?? MAX_SELECTORS_PER_WEBHOOK - selectors.length;
      const captureMsg =
        browserAPI.i18n.getMessage("popupCaptureStarted", [
          String(remaining),
        ]) ||
        `Capture mode active. ${remaining} remaining. Click elements to save text, press Esc to stop.`;
      setStatus("info", captureMsg);
    };

    let lastError = null;
    try {
      await attemptStart();
      return;
    } catch (firstError) {
      lastError = firstError;
    }

    const shouldRetry =
      lastError &&
      typeof lastError.message === "string" &&
      (lastError.message.includes("Receiving end does not exist") ||
        lastError.message.includes("Could not establish connection"));

    if (shouldRetry) {
      const injected = await ensureSelectorContentScript(tabId);
      if (injected) {
        try {
          await attemptStart();
          return;
        } catch (retryError) {
          console.debug("Selector capture retry failed", retryError);
          lastError = retryError;
        }
      }
    }

    const errorMsg =
      lastError && typeof lastError.message === "string" && lastError.message.includes("Receiving end does not exist")
        ? browserAPI.i18n.getMessage("popupCaptureContentNotAvailable") ||
          "No eligible content on this page. Try reloading or switch to a supported tab."
        : browserAPI.i18n.getMessage("popupCaptureStartError") ||
          "Failed to start selector capture. Try reloading the page.";
    setStatus("error", errorMsg);
    updateCaptureButtonState(webhook.id);
  };

  const handleCapturedSelector = (message) => {
    if (message.origin && message.origin !== "background") {
      return;
    }
    const { selector, textContent, webhookId, selectors = [], remaining } = message;
    if (!selector || !webhookId) return;

    if (window._webhookMap && window._webhookMap[webhookId]) {
      window._webhookMap[webhookId].selectors = Array.isArray(selectors)
        ? [...selectors]
        : [];
    }
    updateCaptureButtonState(webhookId);

    const preview =
      typeof textContent === "string" && textContent.length > 0
        ? textContent.slice(0, 80)
        : selector;
    const selectorsLength = Array.isArray(selectors) ? selectors.length : 0;
    const successMsg =
      browserAPI.i18n.getMessage("popupCaptureSaved", [
        preview,
        String(remaining ?? Math.max(MAX_SELECTORS_PER_WEBHOOK - selectorsLength, 0)),
      ]) ||
      `Captured: "${preview}"`;
    setStatus("success", successMsg);
  };

  const handleCaptureError = (message) => {
    if (message.origin && message.origin !== "background") {
      return;
    }
    const { reason } = message;
    let key = "popupCaptureGenericError";
    switch (reason) {
      case "duplicate":
        key = "popupCaptureDuplicate";
        break;
      case "limit":
      case "limit-reached":
        key = "popupCaptureLimitReachedTooltip";
        break;
      case "empty-text":
        key = "popupCaptureEmptyText";
        break;
      case "no-selector":
        key = "popupCaptureNoSelector";
        break;
      case "not-found":
        key = "popupCaptureGenericError";
        break;
      default:
        key = "popupCaptureGenericError";
        break;
    }
    const text =
      browserAPI.i18n.getMessage(key, [String(MAX_SELECTORS_PER_WEBHOOK)]) ||
      "Unable to capture this element.";
    setStatus("error", text);
  };

  const handleCaptureEnded = (message) => {
    if (message.origin && message.origin !== "background") {
      return;
    }
    if (!activeCaptureWebhookId) {
      return;
    }
    const webhookId = activeCaptureWebhookId;
    activeCaptureWebhookId = null;
    updateCaptureButtonState(webhookId);

    let key = "popupCaptureEnded";
    switch (message?.reason) {
      case "limit-reached":
        key = "popupCaptureLimitReachedTooltip";
        break;
      case "cancelled":
        key = "popupCaptureCancelled";
        break;
      default:
        key = "popupCaptureEnded";
        break;
    }
    const text =
      browserAPI.i18n.getMessage(key, [String(MAX_SELECTORS_PER_WEBHOOK)]) ||
      "Capture mode ended.";
    setStatus("info", text);
  };

  buttonsContainer.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    const webhookId = button.dataset.webhookId;
    const webhook =
      window._webhookMap && webhookId ? window._webhookMap[webhookId] : null;
    if (!webhook) return;

    if (action === "trigger") {
      await handleTrigger(webhook, button);
    } else if (action === "capture") {
      await startCapture(webhook, button);
    }
  });

  const addRuntimeListener = (runtime) => {
    if (!runtime || !runtime.onMessage || typeof runtime.onMessage.addListener !== "function") {
      return false;
    }
    runtime.onMessage.addListener((message) => {
      if (!message || typeof message !== "object") {
        return false;
      }
      switch (message.type) {
        case "SELECTOR_CAPTURED":
          if (
            activeCaptureWebhookId &&
            message.webhookId === activeCaptureWebhookId
          ) {
            handleCapturedSelector(message);
          }
          break;
        case "SELECTOR_CAPTURE_ERROR":
          handleCaptureError(message);
          break;
        case "SELECTOR_CAPTURE_ENDED":
          handleCaptureEnded(message);
          break;
        default:
          break;
      }
      return false;
    });
    return true;
  };

  const runtimeCandidates = [
    browserAPI.runtime,
    typeof browser !== "undefined" ? browser.runtime : undefined,
    typeof chrome !== "undefined" ? chrome.runtime : undefined,
  ];
  runtimeCandidates.some(addRuntimeListener);

  document.getElementById("open-options").addEventListener("click", (event) => {
    event.preventDefault();
    browserAPI.runtime.openOptionsPage();
  });

  await applyThemePreference();
  await renderWebhooks();
});

const extractResponseMessage = async (response) => {
  if (!response) return "";
  try {
    const text = await response.clone().text();
    if (!text) return "";
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "string") {
        return parsed;
      }
      if (parsed && typeof parsed.message === "string") {
        return parsed.message;
      }
      return JSON.stringify(parsed, null, 2);
    } catch (_) {
      return text;
    }
  } catch (error) {
    console.warn("Failed to extract response message", error);
    return "";
  }
};

// Export for testing in Node environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    extractResponseMessage,
  };
}
