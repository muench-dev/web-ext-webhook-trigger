// Polyfill for browser API to support Chrome and Firefox
if (typeof window.browser === "undefined") {
  window.browser = window.chrome;
}

// Helper to build a webhook list item
const createWebhookListItem = (webhook) => {
  const listItem = document.createElement("li");
  listItem.dataset.id = webhook.id;
  listItem.draggable = true;

  const dragHandle = document.createElement("span");
  dragHandle.classList.add("drag-handle");
  dragHandle.textContent = "\u2630";

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
  deleteButton.textContent = browser.i18n.getMessage("optionsDeleteButton");
  deleteButton.classList.add("delete-btn");

  const editButton = document.createElement("button");
  editButton.textContent = browser.i18n.getMessage("optionsEditButton") || "Edit";
  editButton.classList.add("edit-btn");

  listItem.appendChild(dragHandle);
  listItem.appendChild(textContent);
  listItem.appendChild(editButton);
  listItem.appendChild(deleteButton);
  return listItem;
};

// Function to load and display webhooks grouped
const loadWebhooks = async () => {
  const { webhooks = [], groupOrder = [] } = await browser.storage.sync.get([
    "webhooks",
    "groupOrder",
  ]);
  const container = document.getElementById("webhook-groups-container");
  const message = document.getElementById("no-webhooks-message");
  container.innerHTML = "";

  if (webhooks.length === 0) {
    message.classList.remove("hidden");
    message.textContent = browser.i18n.getMessage("optionsNoWebhooksMessage");
    return;
  }

  message.classList.add("hidden");

  const groups = {};
  webhooks.forEach((wh) => {
    const grp = wh.group || "";
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(wh);
  });
  const orderedGroups = groupOrder.filter((g) => g in groups).concat(
    Object.keys(groups).filter((g) => !groupOrder.includes(g))
  );

  orderedGroups.forEach((group) => {
    const groupDiv = document.createElement("div");
    groupDiv.classList.add("webhook-group");
    groupDiv.dataset.group = group;
    groupDiv.draggable = true;

    const header = document.createElement("div");
    header.classList.add("group-header");

    const drag = document.createElement("span");
    drag.classList.add("group-drag-handle");
    drag.textContent = "\u2630";

    const h3 = document.createElement("h3");
    h3.textContent = group || "Default";

    header.appendChild(drag);
    header.appendChild(h3);
    groupDiv.appendChild(header);

    const ul = document.createElement("ul");
    ul.classList.add("webhook-list");
    groups[group].forEach((wh) => ul.appendChild(createWebhookListItem(wh)));
    groupDiv.appendChild(ul);

    container.appendChild(groupDiv);
  });
};

// Function to save webhooks and optionally group order
const saveWebhooks = (webhooks, groupOrder) => {
  const data = { webhooks };
  if (groupOrder) data.groupOrder = groupOrder;
  return browser.storage.sync.set(data);
};

// Track edit mode state
let editWebhookId = null;

// Event listener for adding or editing a webhook
const form = document.getElementById("add-webhook-form");
const labelInput = document.getElementById("webhook-label");
const urlInput = document.getElementById("webhook-url");
const methodSelect = document.getElementById("webhook-method");
const identifierInput = document.getElementById("webhook-identifier");
const groupInput = document.getElementById("webhook-group");
const headersListDiv = document.getElementById("headers-list");
const headerKeyInput = document.getElementById("header-key");
const headerValueInput = document.getElementById("header-value");
const addHeaderBtn = document.getElementById("add-header-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const showAddWebhookBtn = document.getElementById("add-new-webhook-btn");
const customPayloadInput = document.getElementById("webhook-custom-payload");
const variablesAutocomplete = document.getElementById("variables-autocomplete");
const toggleCustomPayloadBtn = document.getElementById("toggle-custom-payload");
const customPayloadContent = document.getElementById("custom-payload-content");
const urlFilterInput = document.getElementById("webhook-url-filter");
const toggleUrlFilterBtn = document.getElementById("toggle-url-filter");
const urlFilterContent = document.getElementById("url-filter-content");
let headers = [];

showAddWebhookBtn.addEventListener('click', () => {
  form.classList.remove('hidden');
  showAddWebhookBtn.classList.add('hidden');
  labelInput.focus();
});

// Define available variables for autocompletion
const availableVariables = [
  "{{tab.title}}", "{{tab.url}}", "{{tab.id}}", "{{tab.windowId}}",
  "{{tab.index}}", "{{tab.pinned}}", "{{tab.audible}}", "{{tab.incognito}}",
  "{{tab.status}}", "{{browser}}", "{{platform}}", "{{triggeredAt}}", "{{identifier}}",
  "{{platform.arch}}", "{{platform.os}}", "{{platform.version}}",
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
  const group = groupInput.value.trim();
  const urlFilter = urlFilterInput.value.trim();
  const customPayload = customPayloadInput.value.trim();
  let { webhooks = [], groupOrder = [] } = await browser.storage.sync.get([
    "webhooks",
    "groupOrder",
  ]);

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
        customPayload: customPayload || null,
        urlFilter: urlFilter || "",
        group
      } : wh
    );
    if (group && !groupOrder.includes(group)) {
      groupOrder.push(group);
    }
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
      customPayload: customPayload || null,
      urlFilter: urlFilter || "",
      group
    };
    webhooks.push(newWebhook);
    if (group && !groupOrder.includes(group)) {
      groupOrder.push(group);
    }
  }

  await saveWebhooks(webhooks, groupOrder);
  labelInput.value = "";
  urlInput.value = "";
  methodSelect.value = "POST";
  identifierInput.value = "";
  groupInput.value = "";
  urlFilterInput.value = "";
  customPayloadInput.value = "";
  headerKeyInput.value = "";
  headerValueInput.value = "";
  headers = [];
  renderHeaders();
  // Always reset to save button after submit
  form.querySelector('button[type="submit"]').textContent = browser.i18n.getMessage("optionsSaveButton") || "Save Webhook";
  // Collapse custom payload section
  updateCustomPayloadVisibility();
  updateUrlFilterVisibility();
  form.classList.add('hidden');
  showAddWebhookBtn.classList.remove('hidden');
  loadWebhooks();
});

// Edit and delete event listeners
const groupsContainer = document.getElementById("webhook-groups-container");
let draggedItem = null;
let draggedGroup = null;

const persistWebhookOrder = async () => {
  const groupEls = Array.from(groupsContainer.querySelectorAll('.webhook-group'));
  let { webhooks = [] } = await browser.storage.sync.get('webhooks');
  const newOrder = [];
  const groupOrder = [];
  groupEls.forEach(gEl => {
    const group = gEl.dataset.group || '';
    groupOrder.push(group);
    const ids = Array.from(gEl.querySelectorAll('li')).map(li => li.dataset.id);
    ids.forEach(id => {
      const wh = webhooks.find(w => w.id === id);
      if (wh) {
        wh.group = group;
        newOrder.push(wh);
      }
    });
  });
  await saveWebhooks(newOrder, groupOrder);
};

groupsContainer.addEventListener("dragstart", (e) => {
  const li = e.target.closest("li");
  const group = e.target.closest(".webhook-group");
  if (li) {
    draggedItem = li;
    li.classList.add("dragging");
  } else if (group && e.target.classList.contains("group-drag-handle")) {
    draggedGroup = group;
    group.classList.add("dragging");
  }
  if (draggedItem || draggedGroup) {
    e.dataTransfer.effectAllowed = "move";
  }
});

groupsContainer.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (draggedItem) {
    const target = e.target.closest("li");
    const list = e.target.closest("ul.webhook-list");
    if (!list) return;
    if (target && target !== draggedItem) {
      const rect = target.getBoundingClientRect();
      const next = e.clientY - rect.top > rect.height / 2;
      list.insertBefore(draggedItem, next ? target.nextSibling : target);
    } else if (!target && list !== draggedItem.parentElement) {
      list.appendChild(draggedItem);
    }
  } else if (draggedGroup) {
    const targetGroup = e.target.closest(".webhook-group");
    if (!targetGroup || targetGroup === draggedGroup) return;
    const rect = targetGroup.getBoundingClientRect();
    const next = e.clientY - rect.top > rect.height / 2;
    groupsContainer.insertBefore(draggedGroup, next ? targetGroup.nextSibling : targetGroup);
  }
});

groupsContainer.addEventListener("drop", async (e) => {
  e.preventDefault();
  if (draggedItem || draggedGroup) {
    if (draggedItem) draggedItem.classList.remove("dragging");
    if (draggedGroup) draggedGroup.classList.remove("dragging");
    await persistWebhookOrder();
    draggedItem = null;
    draggedGroup = null;
  }
});

groupsContainer.addEventListener("dragend", async () => {
  if (draggedItem || draggedGroup) {
    if (draggedItem) draggedItem.classList.remove("dragging");
    if (draggedGroup) draggedGroup.classList.remove("dragging");
    await persistWebhookOrder();
    draggedItem = null;
    draggedGroup = null;
  }
});
groupsContainer.addEventListener("click", async (e) => {
  const listItem = e.target.closest("li");
  if (!listItem) return;
  const webhookId = listItem.dataset.id;
  let { webhooks = [], groupOrder = [] } = await browser.storage.sync.get([
    "webhooks",
    "groupOrder",
  ]);

  if (e.target.classList.contains("delete-btn")) {
    // Delete webhook
    webhooks = webhooks.filter((webhook) => webhook.id !== webhookId);
    const existingGroups = [...new Set(webhooks.map((w) => w.group || ""))];
    groupOrder = groupOrder.filter((g) => existingGroups.includes(g));
    await saveWebhooks(webhooks, groupOrder);
    loadWebhooks();
    // If deleting the one being edited, reset form
    if (editWebhookId === webhookId) {
      editWebhookId = null;
      labelInput.value = "";
      urlInput.value = "";
      methodSelect.value = "POST";
      identifierInput.value = "";
      groupInput.value = "";
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
      groupInput.value = webhook.group || "";
      urlFilterInput.value = webhook.urlFilter || "";
      customPayloadInput.value = webhook.customPayload || "";
      headers = Array.isArray(webhook.headers) ? [...webhook.headers] : [];
      renderHeaders();
      cancelEditBtn.classList.remove("hidden");
      form.classList.remove('hidden');
      showAddWebhookBtn.classList.add('hidden');
      // Always set to save button when entering edit mode
      form.querySelector('button[type="submit"]').textContent = browser.i18n.getMessage("optionsSaveButton") || "Save Webhook";

      // Update custom payload section visibility based on content
      updateCustomPayloadVisibility();
      updateUrlFilterVisibility();

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
  groupInput.value = "";
  urlFilterInput.value = "";
  customPayloadInput.value = "";
  headerKeyInput.value = "";
  headerValueInput.value = "";
  headers = [];
  renderHeaders();
  cancelEditBtn.classList.add("hidden");
  form.querySelector('button[type="submit"]').textContent = browser.i18n.getMessage("optionsSaveButton") || "Save Webhook";
  // Collapse custom payload section
  updateCustomPayloadVisibility();
  updateUrlFilterVisibility();
  form.classList.add('hidden');
  showAddWebhookBtn.classList.remove('hidden');
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
const customPayloadHeader = document.getElementById('custom-payload-header');
customPayloadHeader.addEventListener('click', (e) => {
  // Only toggle if the click is not on the toggle button itself
  if (!e.target.closest('#toggle-custom-payload')) {
    toggleCustomPayloadSection();
  }
});

// Toggle URL filter section
function toggleUrlFilterSection() {
  const isExpanded = toggleUrlFilterBtn.getAttribute('aria-expanded') === 'true';
  toggleUrlFilterBtn.setAttribute('aria-expanded', !isExpanded);

  if (isExpanded) {
    urlFilterContent.classList.add('collapsed');
  } else {
    urlFilterContent.classList.remove('collapsed');
  }
}

toggleUrlFilterBtn.addEventListener('click', toggleUrlFilterSection);

const urlFilterHeader = document.getElementById('url-filter-header');
urlFilterHeader.addEventListener('click', (e) => {
  if (!e.target.closest('#toggle-url-filter')) {
    toggleUrlFilterSection();
  }
});

// Keep URL filter section expanded when typing
urlFilterInput.addEventListener('input', () => {
  if (urlFilterInput.value.trim() !== '') {
    toggleUrlFilterBtn.setAttribute('aria-expanded', 'true');
    urlFilterContent.classList.remove('collapsed');
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

function updateUrlFilterVisibility() {
  const hasContent = urlFilterInput.value.trim() !== '';

  if (hasContent) {
    toggleUrlFilterBtn.setAttribute('aria-expanded', 'true');
    urlFilterContent.classList.remove('collapsed');
  } else {
    toggleUrlFilterBtn.setAttribute('aria-expanded', 'false');
    urlFilterContent.classList.add('collapsed');
  }
}

// Show webhooks on page load
document.addEventListener("DOMContentLoaded", () => {
  // Replace i18n placeholders
  replaceI18nPlaceholders();

  // Set localized placeholder for webhook-label input
  labelInput.placeholder = browser.i18n.getMessage("optionsLabelInputPlaceholder");
  groupInput.placeholder = browser.i18n.getMessage("optionsGroupInputPlaceholder");

  // Set localized label for cancel edit button
  cancelEditBtn.textContent = browser.i18n.getMessage("optionsCancelEditButton") || "Cancel";
  showAddWebhookBtn.textContent = browser.i18n.getMessage("optionsAddNewWebhookButton") || "Add new webhook";

  // Initialize custom payload section (collapsed by default)
  updateCustomPayloadVisibility();
  updateUrlFilterVisibility();

  // Load webhooks
  loadWebhooks();
});

// Export functions for testing in Node environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = { loadWebhooks, saveWebhooks, renderHeaders, persistWebhookOrder };
}
