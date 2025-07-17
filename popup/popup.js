

document.addEventListener("DOMContentLoaded", async () => {
  const browserAPI = window.getBrowserAPI();
  // Replace i18n placeholders
  replaceI18nPlaceholders();

  const buttonsContainer = document.getElementById("buttons-container");

  // Load webhooks from storage
  const { webhooks = [] } = await browserAPI.storage.sync.get("webhooks");
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  const currentUrl = tabs[0]?.url || "";
  const visibleWebhooks = webhooks.filter(
    (wh) => !wh.urlFilter || currentUrl.includes(wh.urlFilter)
  );

  if (visibleWebhooks.length === 0) {
    // Use textContent instead of innerHTML for security
    const p = document.createElement("p");
    p.className = "no-hooks-msg";
    p.textContent = browserAPI.i18n.getMessage("popupNoWebhooksConfigured");
    buttonsContainer.textContent = ""; // Clear any existing content
    buttonsContainer.appendChild(p);
  } else {
    // Create a button for each webhook
    visibleWebhooks.forEach((webhook) => {
      const button = document.createElement("button");
      button.textContent = webhook.label;
      button.dataset.url = webhook.url;
      button.dataset.label = webhook.label;
      button.dataset.webhookId = webhook.id;
      button.classList.add("webhook-btn");
      buttonsContainer.appendChild(button);
    });
    // Store webhooks in a map for quick lookup by id
    window._webhookMap = Object.fromEntries(visibleWebhooks.map(w => [w.id, w]));
  }
});

// Event listener for webhook button clicks
document
  .getElementById("buttons-container")
  .addEventListener("click", async (e) => {
    const browserAPI = window.getBrowserAPI();
    if (!e.target.classList.contains("webhook-btn")) {
      return;
    }

    const button = e.target;
    const originalLabel = button.dataset.label;
    const statusMessage = document.getElementById("status-message");
    const webhookId = button.dataset.webhookId;
    const webhook = window._webhookMap ? window._webhookMap[webhookId] : null;

    // Prevent multiple clicks
    if (button.disabled) {
      return;
    }

    button.disabled = true;
    button.textContent = browserAPI.i18n.getMessage("popupSending");
    statusMessage.textContent = "";
    statusMessage.className = "";

    try {
      // Get info about the active tab
      const tabs = await browserAPI.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs.length === 0) {
        throw new Error(browserAPI.i18n.getMessage("popupErrorNoActiveTab"));
      }
      const activeTab = tabs[0];

      let selectedText = '';
      if (webhook && webhook.sendSelectedText) {
        try {
          if (browserAPI.scripting && browserAPI.scripting.executeScript) {
            const [{ result }] = await browserAPI.scripting.executeScript({
              target: { tabId: activeTab.id },
              func: () => window.getSelection().toString(),
            });
            selectedText = result || '';
          } else if (browserAPI.tabs.executeScript) {
            const [result] = await browserAPI.tabs.executeScript({
              code: 'window.getSelection().toString();',
            });
            selectedText = result || '';
          }
        } catch (err) {
          console.error('Failed to get selected text', err);
        }
      }

      const response = await window.sendWebhook(
        webhook,
        activeTab,
        { selectionText: selectedText }
      );
      if (!response.ok) {
        throw new Error(
          browserAPI.i18n.getMessage("popupErrorHttp", response.status)
        );
      }

      // Success feedback
      statusMessage.textContent = browserAPI.i18n.getMessage("popupStatusSuccess");
      statusMessage.classList.add("success");
      button.textContent = browserAPI.i18n.getMessage("popupBtnTextSent");
    } catch (error) {
      console.error("Error sending webhook:", error);
      statusMessage.textContent = `${browserAPI.i18n.getMessage("popupStatusErrorPrefix")} ${error.message}`;
      statusMessage.classList.add("error");
      button.textContent = browserAPI.i18n.getMessage("popupBtnTextFailed");
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
  const browserAPI = window.getBrowserAPI();
  browserAPI.runtime.openOptionsPage();
});

// Export for testing in Node environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = {};
}
