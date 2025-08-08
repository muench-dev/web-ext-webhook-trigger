

document.addEventListener("DOMContentLoaded", async () => {
  const browserAPI = window.getBrowserAPI();
  // Replace i18n placeholders
  replaceI18nPlaceholders();

  const buttonsContainer = document.getElementById("buttons-container");

  // Load webhooks and groups from storage
  const { webhooks = [], groups = [] } = await browserAPI.storage.sync.get(["webhooks", "groups"]);
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
    // Group webhooks by group ID
    const groupedWebhooks = {};
    visibleWebhooks.forEach(webhook => {
      const groupId = webhook.groupId || "ungrouped";
      if (!groupedWebhooks[groupId]) {
        groupedWebhooks[groupId] = [];
      }
      groupedWebhooks[groupId].push(webhook);
    });

    // Create a map of group ID to group name for easy lookup
    const groupMap = Object.fromEntries(groups.map(group => [group.id, group.name]));

    // Display webhooks grouped by group in the order defined by the groups array
    // First display groups in their defined order
    groups.forEach(group => {
      const groupId = group.id;
      const groupWebhooks = groupedWebhooks[groupId];
      if (groupWebhooks && groupWebhooks.length > 0) {
        // Create group header
        const groupHeader = document.createElement("h3");
        groupHeader.className = "group-header";
        groupHeader.textContent = group.name;
        buttonsContainer.appendChild(groupHeader);

        // Create a button for each webhook in this group
        groupWebhooks.forEach((webhook) => {
          const button = document.createElement("button");
          button.textContent = webhook.label;
          button.dataset.url = webhook.url;
          button.dataset.label = webhook.label;
          button.dataset.webhookId = webhook.id;
          button.classList.add("webhook-btn");
          buttonsContainer.appendChild(button);
        });
      }
    });

    // Then display ungrouped webhooks if they exist
    const ungroupedWebhooks = groupedWebhooks["ungrouped"];
    if (ungroupedWebhooks && ungroupedWebhooks.length > 0) {
      // Create ungrouped header
      const ungroupedHeader = document.createElement("h3");
      ungroupedHeader.className = "group-header";
      ungroupedHeader.textContent = browserAPI.i18n.getMessage("popupNoGroup") || "No Group";
      buttonsContainer.appendChild(ungroupedHeader);

      // Create a button for each ungrouped webhook
      ungroupedWebhooks.forEach((webhook) => {
        const button = document.createElement("button");
        button.textContent = webhook.label;
        button.dataset.url = webhook.url;
        button.dataset.label = webhook.label;
        button.dataset.webhookId = webhook.id;
        button.classList.add("webhook-btn");
        buttonsContainer.appendChild(button);
      });
    }

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
    button.textContent = browserAPI.i18n.getMessage("popupSending");
    statusMessage.textContent = "";
    statusMessage.className = "";

    try {
      await window.sendWebhook(webhook, false);

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
