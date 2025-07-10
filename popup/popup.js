document.addEventListener("DOMContentLoaded", async () => {
  // Replace i18n placeholders
  replaceI18nPlaceholders();

  const buttonsContainer = document.getElementById("buttons-container");

  // Load webhooks from storage
  const { webhooks = [] } = await browser.storage.sync.get("webhooks");

  if (webhooks.length === 0) {
    // Use textContent instead of innerHTML for security
    const p = document.createElement("p");
    p.className = "no-hooks-msg";
    p.textContent = browser.i18n.getMessage("popupNoWebhooksConfigured");
    buttonsContainer.textContent = ""; // Clear any existing content
    buttonsContainer.appendChild(p);
  } else {
    // Create a button for each webhook
    webhooks.forEach((webhook) => {
      const button = document.createElement("button");
      button.textContent = webhook.label;
      button.dataset.url = webhook.url;
      button.dataset.label = webhook.label;
      button.dataset.webhookId = webhook.id;
      button.classList.add("webhook-btn");
      buttonsContainer.appendChild(button);
    });
    // Store webhooks in a map for quick lookup by id
    window._webhookMap = Object.fromEntries(webhooks.map(w => [w.id, w]));
  }
});

// Event listener for webhook button clicks
document
  .getElementById("buttons-container")
  .addEventListener("click", async (e) => {
    if (!e.target.classList.contains("webhook-btn")) {
      return;
    }

    const button = e.target;
    const url = button.dataset.url;
    const originalLabel = button.dataset.label;
    const statusMessage = document.getElementById("status-message");
    const webhookId = button.dataset.webhookId;
    const webhook = window._webhookMap ? window._webhookMap[webhookId] : null;

    // Prevent multiple clicks
    if (button.disabled) {
      return;
    }

    button.disabled = true;
    button.textContent = browser.i18n.getMessage("popupSending");
    statusMessage.textContent = "";
    statusMessage.className = "";

    try {
      // Get info about the active tab
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length === 0) {
        throw new Error(browser.i18n.getMessage("popupErrorNoActiveTab"));
      }
      const activeTab = tabs[0];
      const currentUrl = activeTab.url;

      // Get browser and platform info
      const browserInfo = await browser.runtime.getBrowserInfo?.() || {};
      const platformInfo = await browser.runtime.getPlatformInfo?.() || {};

      const payload = {
        tab: {
          title: activeTab.title,
          url: currentUrl,
          id: activeTab.id,
          windowId: activeTab.windowId,
          index: activeTab.index,
          pinned: activeTab.pinned,
          audible: activeTab.audible,
          mutedInfo: activeTab.mutedInfo,
          incognito: activeTab.incognito,
          status: activeTab.status,
        },
        browser: browserInfo,
        platform: platformInfo,
        triggeredAt: new Date().toISOString(),
      };
      if (webhook && webhook.identifier) {
        payload.identifier = webhook.identifier;
      }
      // Prepare headers
      let headers = { "Content-Type": "application/json" };
      if (webhook && Array.isArray(webhook.headers)) {
        webhook.headers.forEach(h => {
          if (h.key && h.value) headers[h.key] = h.value;
        });
      }
      // Determine method
      const method = webhook && webhook.method ? webhook.method : "POST";
      // Prepare fetch options
      const fetchOpts = {
        method,
        headers,
      };
      if (method === "POST") {
        fetchOpts.body = JSON.stringify(payload);
      } else if (method === "GET") {
        // For GET, append payload as query param
        const urlObj = new URL(url);
        urlObj.searchParams.set("payload", encodeURIComponent(JSON.stringify(payload)));
        fetchOpts.body = undefined;
        // Overwrite url for fetch
        fetchOpts._url = urlObj.toString();
      }
      // Send the request
      const fetchUrl = fetchOpts._url || url;
      const response = await fetch(fetchUrl, fetchOpts);

      if (!response.ok) {
        throw new Error(browser.i18n.getMessage("popupErrorHttp", response.status));
      }

      // Success feedback
      statusMessage.textContent = browser.i18n.getMessage("popupStatusSuccess");
      statusMessage.classList.add("success");
      button.textContent = browser.i18n.getMessage("popupBtnTextSent");
    } catch (error) {
      console.error("Error sending webhook:", error);
      statusMessage.textContent = `${browser.i18n.getMessage("popupStatusErrorPrefix")} ${error.message}`;
      statusMessage.classList.add("error");
      button.textContent = browser.i18n.getMessage("popupBtnTextFailed");
    } finally {
      // Re-enable button after a delay and restore state
      setTimeout(() => {
        button.disabled = false;
        button.textContent = originalLabel;
        statusMessage.textContent = "";
        statusMessage.className = "";
      }, 2500);
    }
  });

// Link to open the options page
document.getElementById("open-options").addEventListener("click", (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

// Export for testing in Node environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
