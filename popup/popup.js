// Function to replace i18n placeholders in HTML
function replaceI18nPlaceholders() {
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = browser.i18n.getMessage(key);
  });

  // Also replace placeholders in the HTML content
  document.querySelectorAll('*').forEach(element => {
    if (element.childNodes && element.childNodes.length > 0) {
      element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.includes('__MSG_')) {
          const matches = node.nodeValue.match(/__MSG_([^_]+)__/g);
          if (matches) {
            let newValue = node.nodeValue;
            matches.forEach(match => {
              const key = match.replace('__MSG_', '').replace('__', '');
              newValue = newValue.replace(match, browser.i18n.getMessage(key));
            });
            node.nodeValue = newValue;
          }
        }
      });
    }
  });

  // Replace title
  if (document.title && document.title.includes('__MSG_')) {
    const matches = document.title.match(/__MSG_([^_]+)__/g);
    if (matches) {
      let newTitle = document.title;
      matches.forEach(match => {
        const key = match.replace('__MSG_', '').replace('__', '');
        newTitle = newTitle.replace(match, browser.i18n.getMessage(key));
      });
      document.title = newTitle;
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Replace i18n placeholders
  replaceI18nPlaceholders();

  const buttonsContainer = document.getElementById("buttons-container");

  // Load webhooks from storage
  const { webhooks = [] } = await browser.storage.sync.get("webhooks");

  if (webhooks.length === 0) {
    buttonsContainer.innerHTML = `<p class="no-hooks-msg">${browser.i18n.getMessage("popupNoWebhooksConfigured")}</p>`;
  } else {
    // Create a button for each webhook
    webhooks.forEach((webhook) => {
      const button = document.createElement("button");
      button.textContent = webhook.label;
      button.dataset.url = webhook.url;
      button.dataset.label = webhook.label;
      button.classList.add("webhook-btn");
      buttonsContainer.appendChild(button);
    });
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
          favIconUrl: activeTab.favIconUrl,
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

      // Send the POST request
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

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
