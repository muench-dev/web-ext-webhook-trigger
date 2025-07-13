// Polyfill for browser API to support Chrome and Firefox
if (typeof window.browser === "undefined") {
  window.browser = window.chrome;
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

      // Add edit button
      const editButton = document.createElement("button");
      editButton.textContent = browser.i18n.getMessage("optionsEditButton") || "Edit";
      editButton.classList.add("edit-btn");

      listItem.appendChild(textContent);
      listItem.appendChild(editButton);
      listItem.appendChild(deleteButton);
      list.appendChild(listItem);
    });
  }
};

// Function to save webhooks
const saveWebhooks = (webhooks) => {
  return browser.storage.sync.set({ webhooks });
};

// Track edit mode state
let editWebhookId = null;

// Event listener for adding or editing a webhook
const form = document.getElementById("add-webhook-form");
const labelInput = document.getElementById("webhook-label");
const urlInput = document.getElementById("webhook-url");
const methodSelect = document.getElementById("webhook-method");
const identifierInput = document.getElementById("webhook-identifier");
const headersListDiv = document.getElementById("headers-list");
const headerKeyInput = document.getElementById("header-key");
const headerValueInput = document.getElementById("header-value");
const addHeaderBtn = document.getElementById("add-header-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const customPayloadInput = document.getElementById("webhook-custom-payload");
const variablesAutocomplete = document.getElementById("variables-autocomplete");
const toggleCustomPayloadBtn = document.getElementById("toggle-custom-payload");
const customPayloadContent = document.getElementById("custom-payload-content");
let headers = [];

// Define available variables for autocompletion
const availableVariables = [
  "{{tab.title}}", "{{tab.url}}", "{{tab.id}}", "{{tab.windowId}}",
  "{{tab.index}}", "{{tab.pinned}}", "{{tab.audible}}", "{{tab.incognito}}",
  "{{tab.status}}", "{{browser}}", "{{platform}}", "{{triggeredAt}}", "{{identifier}}"
];

// Implement autocompletion for custom payload
customPayloadInput.addEventListener('input', function(e) {
  const cursorPosition = this.selectionStart;
  const text = this.value;
  const textBeforeCursor = text.substring(0, cursorPosition);

  // Check if we're typing a variable (starts with {{)
  const match = textBeforeCursor.match(/\{\{[\w\.\-]*$/);

  if (match) {
    const partialVar = match[0];
    const matchingVars = availableVariables.filter(v => v.startsWith(partialVar));

    if (matchingVars.length > 0) {
      // Show autocomplete dropdown
      variablesAutocomplete.innerHTML = '';
      variablesAutocomplete.classList.remove('hidden');

      matchingVars.forEach(variable => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = variable;
        item.addEventListener('click', () => {
          // Insert the variable at cursor position
          const beforeVar = text.substring(0, cursorPosition - partialVar.length);
          const afterVar = text.substring(cursorPosition);
          const newText = beforeVar + variable + afterVar;
          customPayloadInput.value = newText;

          // Move cursor after the inserted variable
          const newCursorPos = beforeVar.length + variable.length;
          customPayloadInput.focus();
          customPayloadInput.setSelectionRange(newCursorPos, newCursorPos);

          // Hide autocomplete
          variablesAutocomplete.classList.add('hidden');
        });
        variablesAutocomplete.appendChild(item);
      });
    } else {
      variablesAutocomplete.classList.add('hidden');
    }
  } else {
    variablesAutocomplete.classList.add('hidden');
  }
});

// Hide autocomplete when clicking outside
document.addEventListener('click', function(e) {
  if (!customPayloadInput.contains(e.target) && !variablesAutocomplete.contains(e.target)) {
    variablesAutocomplete.classList.add('hidden');
  }
});

// Add keyboard navigation for autocomplete
customPayloadInput.addEventListener('keydown', function(e) {
  if (variablesAutocomplete.classList.contains('hidden')) return;

  const items = variablesAutocomplete.querySelectorAll('.autocomplete-item');
  const activeItem = variablesAutocomplete.querySelector('.autocomplete-item.active');
  let activeIndex = -1;

  if (activeItem) {
    activeIndex = Array.from(items).indexOf(activeItem);
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (activeIndex < items.length - 1) {
        if (activeItem) activeItem.classList.remove('active');
        items[activeIndex + 1].classList.add('active');
        items[activeIndex + 1].scrollIntoView({ block: 'nearest' });
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (activeIndex > 0) {
        if (activeItem) activeItem.classList.remove('active');
        items[activeIndex - 1].classList.add('active');
        items[activeIndex - 1].scrollIntoView({ block: 'nearest' });
      }
      break;
    case 'Enter':
      e.preventDefault();
      if (activeItem) {
        activeItem.click();
      } else if (items.length > 0) {
        items[0].click();
      }
      break;
    case 'Escape':
      e.preventDefault();
      variablesAutocomplete.classList.add('hidden');
      break;
  }
});

function renderHeaders() {
  headersListDiv.textContent = '';
  headers.forEach((header, idx) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.style.marginBottom = '4px';

    // Create span for key:value
    const span = document.createElement('span');
    span.style.flex = '1';
    const strong = document.createElement('strong');
    strong.textContent = header.key;
    span.appendChild(strong);
    span.appendChild(document.createTextNode(`: ${header.value}`));
    div.appendChild(span);

    // Create remove button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.idx = idx;
    btn.className = 'remove-header-btn';
    btn.textContent = 'Remove';
    div.appendChild(btn);

    headersListDiv.appendChild(div);
  });
}

addHeaderBtn.addEventListener('click', () => {
  const key = headerKeyInput.value.trim();
  const value = headerValueInput.value.trim();
  if (key && value) {
    headers.push({ key, value });
    renderHeaders();
    headerKeyInput.value = '';
    headerValueInput.value = '';
    headerKeyInput.focus();
  }
});

headersListDiv.addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-header-btn')) {
    const idx = parseInt(e.target.getAttribute('data-idx'), 10);
    headers.splice(idx, 1);
    renderHeaders();
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const label = labelInput.value.trim();
  const url = urlInput.value.trim();
  const method = methodSelect.value;
  const identifier = identifierInput.value.trim();
  const customPayload = customPayloadInput.value.trim();
  let { webhooks = [] } = await browser.storage.sync.get("webhooks");

  if (editWebhookId) {
    // Edit mode: update existing webhook
    webhooks = webhooks.map((wh) =>
      wh.id === editWebhookId ? {
        ...wh,
        label,
        url,
        method,
        headers: [...headers],
        identifier,
        customPayload: customPayload || null
      } : wh
    );
    editWebhookId = null;
    cancelEditBtn.classList.add("hidden");
  } else {
    // Add mode: add new webhook
    const newWebhook = {
      id: crypto.randomUUID(),
      label,
      url,
      method,
      headers: [...headers],
      identifier,
      customPayload: customPayload || null
    };
    webhooks.push(newWebhook);
  }

  await saveWebhooks(webhooks);
  labelInput.value = "";
  urlInput.value = "";
  methodSelect.value = "POST";
  identifierInput.value = "";
  customPayloadInput.value = "";
  headerKeyInput.value = "";
  headerValueInput.value = "";
  headers = [];
  renderHeaders();
  // Always reset to save button after submit
  form.querySelector('button[type="submit"]').textContent = browser.i18n.getMessage("optionsSaveButton") || "Save Webhook";
  // Collapse custom payload section
  updateCustomPayloadVisibility();
  loadWebhooks();
});

// Edit and delete event listeners
const webhookList = document.getElementById("webhook-list");
webhookList.addEventListener("click", async (e) => {
  const listItem = e.target.closest("li");
  if (!listItem) return;
  const webhookId = listItem.dataset.id;
  let { webhooks = [] } = await browser.storage.sync.get("webhooks");

  if (e.target.classList.contains("delete-btn")) {
    // Delete webhook
    webhooks = webhooks.filter((webhook) => webhook.id !== webhookId);
    await saveWebhooks(webhooks);
    loadWebhooks();
    // If deleting the one being edited, reset form
    if (editWebhookId === webhookId) {
      editWebhookId = null;
      labelInput.value = "";
      urlInput.value = "";
      methodSelect.value = "POST";
      identifierInput.value = "";
      headerKeyInput.value = "";
      headerValueInput.value = "";
      headers = [];
      renderHeaders();
      cancelEditBtn.classList.add("hidden");
      form.querySelector('button[type="submit"]').textContent = browser.i18n.getMessage("optionsSaveButton") || "Save Webhook";
    }
  } else if (e.target.classList.contains("edit-btn")) {
    // Edit webhook
    const webhook = webhooks.find((wh) => wh.id === webhookId);
    if (webhook) {
      editWebhookId = webhookId;
      labelInput.value = webhook.label;
      urlInput.value = webhook.url;
      methodSelect.value = webhook.method || "POST";
      identifierInput.value = webhook.identifier || "";
      customPayloadInput.value = webhook.customPayload || "";
      headers = Array.isArray(webhook.headers) ? [...webhook.headers] : [];
      renderHeaders();
      cancelEditBtn.classList.remove("hidden");
      // Always set to save button when entering edit mode
      form.querySelector('button[type="submit"]').textContent = browser.i18n.getMessage("optionsSaveButton") || "Save Webhook";

      // Update custom payload section visibility based on content
      updateCustomPayloadVisibility();

      labelInput.focus();
    }
  }
});

// Cancel edit
cancelEditBtn.addEventListener("click", () => {
  editWebhookId = null;
  labelInput.value = "";
  urlInput.value = "";
  methodSelect.value = "POST";
  identifierInput.value = "";
  customPayloadInput.value = "";
  headerKeyInput.value = "";
  headerValueInput.value = "";
  headers = [];
  renderHeaders();
  cancelEditBtn.classList.add("hidden");
  form.querySelector('button[type="submit"]').textContent = browser.i18n.getMessage("optionsSaveButton") || "Save Webhook";
  // Collapse custom payload section
  updateCustomPayloadVisibility();
});

// Toggle custom payload section
function toggleCustomPayloadSection() {
  const isExpanded = toggleCustomPayloadBtn.getAttribute('aria-expanded') === 'true';
  toggleCustomPayloadBtn.setAttribute('aria-expanded', !isExpanded);

  if (isExpanded) {
    customPayloadContent.classList.add('collapsed');
  } else {
    customPayloadContent.classList.remove('collapsed');
  }
}

// Event listener for toggle button
toggleCustomPayloadBtn.addEventListener('click', toggleCustomPayloadSection);

// Event listener for collapsible header (title click)
const collapsibleHeader = document.querySelector('.collapsible-header');
collapsibleHeader.addEventListener('click', (e) => {
  // Only toggle if the click is not on the toggle button itself
  if (!e.target.closest('#toggle-custom-payload')) {
    toggleCustomPayloadSection();
  }
});

// Event listener for custom payload input to keep section expanded when typing
customPayloadInput.addEventListener('input', () => {
  if (customPayloadInput.value.trim() !== '') {
    toggleCustomPayloadBtn.setAttribute('aria-expanded', 'true');
    customPayloadContent.classList.remove('collapsed');
  }
});

// Function to check if custom payload is configured and show/hide accordingly
function updateCustomPayloadVisibility() {
  const hasContent = customPayloadInput.value.trim() !== '';

  if (hasContent) {
    // If there's content, expand the section
    toggleCustomPayloadBtn.setAttribute('aria-expanded', 'true');
    customPayloadContent.classList.remove('collapsed');
  } else {
    // If there's no content, collapse the section
    toggleCustomPayloadBtn.setAttribute('aria-expanded', 'false');
    customPayloadContent.classList.add('collapsed');
  }
}

// Show webhooks on page load
document.addEventListener("DOMContentLoaded", () => {
  // Replace i18n placeholders
  replaceI18nPlaceholders();

  // Set localized placeholder for webhook-label input
  labelInput.placeholder = browser.i18n.getMessage("optionsLabelInputPlaceholder");

  // Set localized label for cancel edit button
  cancelEditBtn.textContent = browser.i18n.getMessage("optionsCancelEditButton") || "Cancel";

  // Initialize custom payload section (collapsed by default)
  updateCustomPayloadVisibility();

  // Load webhooks
  loadWebhooks();
});

// Export functions for testing in Node environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = { loadWebhooks, saveWebhooks, renderHeaders };
}
