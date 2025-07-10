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

// Function to load and display webhooks
const loadWebhooks = async () => {
  const { webhooks = [] } = await browser.storage.sync.get("webhooks");
  const list = document.getElementById("webhook-list");
  const message = document.getElementById("no-webhooks-message");
  list.innerHTML = "";

  if (webhooks.length === 0) {
    message.classList.remove("hidden");
    message.textContent = browser.i18n.getMessage("optionsNoWebhooksMessage");
  } else {
    message.classList.add("hidden");
    webhooks.forEach((webhook) => {
      const listItem = document.createElement("li");
      listItem.dataset.id = webhook.id;

      const textContent = document.createElement("div");
      textContent.classList.add("webhook-info");

      const labelSpan = document.createElement("span");
      labelSpan.classList.add("label");
      labelSpan.textContent = webhook.label;

      const urlSpan = document.createElement("span");
      urlSpan.classList.add("url");
      urlSpan.textContent = webhook.url;

      textContent.appendChild(labelSpan);
      textContent.appendChild(urlSpan);

      const deleteButton = document.createElement("button");
      // Use localized text for the button
      deleteButton.textContent = browser.i18n.getMessage("optionsDeleteButton");
      deleteButton.classList.add("delete-btn");

      listItem.appendChild(textContent);
      listItem.appendChild(deleteButton);
      list.appendChild(listItem);
    });
  }
};

// Function to save webhooks
const saveWebhooks = (webhooks) => {
  return browser.storage.sync.set({ webhooks });
};

// Event listener for adding a new webhook
document
  .getElementById("add-webhook-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const labelInput = document.getElementById("webhook-label");
    const urlInput = document.getElementById("webhook-url");

    const newWebhook = {
      id: crypto.randomUUID(), // Unique ID for easy deletion
      label: labelInput.value.trim(),
      url: urlInput.value.trim(),
    };

    const { webhooks = [] } = await browser.storage.sync.get("webhooks");
    webhooks.push(newWebhook);

    await saveWebhooks(webhooks);

    // Reset form and reload list
    labelInput.value = "";
    urlInput.value = "";
    loadWebhooks();
  });

// Event listener for deleting a webhook
document.getElementById("webhook-list").addEventListener("click", async (e) => {
  if (e.target.classList.contains("delete-btn")) {
    const webhookId = e.target.parentElement.dataset.id;
    let { webhooks = [] } = await browser.storage.sync.get("webhooks");

    // Filter out the webhook to be deleted
    webhooks = webhooks.filter((webhook) => webhook.id !== webhookId);

    await saveWebhooks(webhooks);
    loadWebhooks(); // Reload list
  }
});

// Show webhooks on page load
document.addEventListener("DOMContentLoaded", () => {
  // Replace i18n placeholders
  replaceI18nPlaceholders();

  // Set localized placeholder for webhook-label input
  const labelInput = document.getElementById("webhook-label");
  if (labelInput) {
    labelInput.placeholder = browser.i18n.getMessage("optionsLabelInputPlaceholder");
  }

  // Load webhooks
  loadWebhooks();
});
