const browser = window.getBrowserAPI();

// Function to load and display webhooks
const loadWebhooks = async () => {
  const { webhooks = [], groups = [] } = await browser.storage.sync.get(["webhooks", "groups"]);
  const list = document.getElementById("webhook-list");
  const message = document.getElementById("no-webhooks-message");
  list.innerHTML = "";

  // Clear the webhook list safely
  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }

  // Populate group dropdown safely
  const groupSelect = document.getElementById("webhook-group");
  // Remove all children
  while (groupSelect.firstChild) {
    groupSelect.removeChild(groupSelect.firstChild);
  }
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.selected = true;
  defaultOption.textContent = browser.i18n.getMessage("optionsNoGroup");
  groupSelect.appendChild(defaultOption);
  groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    groupSelect.appendChild(option);
  });

  if (webhooks.length === 0) {
    message.classList.remove("hidden");
    message.textContent = browser.i18n.getMessage("optionsNoWebhooksMessage");
  } else {
    message.classList.add("hidden");

    // Group webhooks by group ID
    const groupedWebhooks = {};
    webhooks.forEach(webhook => {
      const groupId = webhook.groupId || "ungrouped";
      if (!groupedWebhooks[groupId]) {
        groupedWebhooks[groupId] = [];
      }
      groupedWebhooks[groupId].push(webhook);
    });

    // Display webhooks grouped by group
    groups.forEach(group => {
      const groupWebhooks = groupedWebhooks[group.id] || [];
      if (groupWebhooks.length > 0) {
        // Create group header
        const groupHeader = document.createElement("li");
        groupHeader.classList.add("group-header");
        groupHeader.textContent = group.name;
        list.appendChild(groupHeader);

        // Add webhooks in this group
        groupWebhooks.forEach((webhook) => {
          const listItem = document.createElement("li");
          listItem.dataset.id = webhook.id;
          listItem.draggable = true;
          listItem.classList.add("webhook-item");

          const dragHandle = document.createElement("span");
          dragHandle.classList.add("drag-handle");
          dragHandle.textContent = "\u2630"; // common drag icon

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

          const duplicateButton = document.createElement("button");
          duplicateButton.textContent = browser.i18n.getMessage("optionsDuplicateButton") || "Duplicate";
          duplicateButton.classList.add("duplicate-btn");

          listItem.appendChild(dragHandle);
          listItem.appendChild(textContent);
          listItem.appendChild(editButton);
          listItem.appendChild(duplicateButton);
          listItem.appendChild(deleteButton);
          list.appendChild(listItem);
        });
      }
    });

    // Display ungrouped webhooks
    const ungroupedWebhooks = groupedWebhooks["ungrouped"] || [];
    if (ungroupedWebhooks.length > 0) {
      // Create ungrouped header
      const ungroupedHeader = document.createElement("li");
      ungroupedHeader.classList.add("group-header");
      ungroupedHeader.textContent = browser.i18n.getMessage("optionsNoGroup");
      list.appendChild(ungroupedHeader);

      // Add ungrouped webhooks
      ungroupedWebhooks.forEach((webhook) => {
        const listItem = document.createElement("li");
        listItem.dataset.id = webhook.id;
        listItem.draggable = true;
        listItem.classList.add("webhook-item");

        const dragHandle = document.createElement("span");
        dragHandle.classList.add("drag-handle");
        dragHandle.textContent = "\u2630"; // common drag icon

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

        const duplicateButton = document.createElement("button");
        duplicateButton.textContent = browser.i18n.getMessage("optionsDuplicateButton") || "Duplicate";
        duplicateButton.classList.add("duplicate-btn");

        listItem.appendChild(dragHandle);
        listItem.appendChild(textContent);
        listItem.appendChild(editButton);
        listItem.appendChild(duplicateButton);
        listItem.appendChild(deleteButton);
        list.appendChild(listItem);
      });
    }
  }
};

// Function to save webhooks
const saveWebhooks = (webhooks) => {
  return browser.storage.sync.set({ webhooks });
};

// Function to save groups
const saveGroups = (groups) => {
  return browser.storage.sync.set({ groups });
};

// Function to load groups
const loadGroups = async () => {
  const { groups = [] } = await browser.storage.sync.get("groups");
  return groups;
};

// Function to render groups in the group management modal
const renderGroups = async () => {
  const groups = await loadGroups();
  groupsList.innerHTML = "";

  groups.forEach(group => {
    const listItem = document.createElement("li");
    listItem.className = "group-item";
    listItem.dataset.id = group.id;

    // Create drag handle (same icon as used for webhooks)
    const dragHandle = document.createElement("span");
    dragHandle.className = "drag-handle";
    dragHandle.textContent = "\u2630"; // common drag icon
    dragHandle.draggable = true;

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "edit-group-name";
    nameInput.value = group.name;
    nameInput.disabled = true;

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "group-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-group-btn";
    editBtn.textContent = browser.i18n.getMessage("optionsEditGroupButton") || "Edit";

    const saveBtn = document.createElement("button");
    saveBtn.className = "save-group-name hidden";
    saveBtn.textContent = browser.i18n.getMessage("optionsSaveGroupButton") || "Save";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-group";
    deleteBtn.textContent = browser.i18n.getMessage("optionsDeleteGroupButton") || "Delete";

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(saveBtn);
    actionsDiv.appendChild(deleteBtn);

    listItem.appendChild(dragHandle);
    listItem.appendChild(nameInput);
    listItem.appendChild(actionsDiv);
    groupsList.appendChild(listItem);

    // Event listeners for group actions
    editBtn.addEventListener("click", () => {
      nameInput.disabled = false;
      nameInput.focus();
      editBtn.classList.add("hidden");
      saveBtn.classList.remove("hidden");
    });

    saveBtn.addEventListener("click", async () => {
      const newName = nameInput.value.trim();
      if (newName && newName !== group.name) {
        // Update group name
        const groups = await loadGroups();
        const updatedGroups = groups.map(g =>
          g.id === group.id ? { ...g, name: newName } : g
        );
        await saveGroups(updatedGroups);

        // Update group dropdown in the webhook form
        const option = groupSelect.querySelector(`option[value="${group.id}"]`);
        if (option) {
          option.textContent = newName;
        }

        // Update UI
        nameInput.disabled = true;
        editBtn.classList.remove("hidden");
        saveBtn.classList.add("hidden");
      } else {
        // Just disable the input if no change or empty name
        nameInput.disabled = true;
        editBtn.classList.remove("hidden");
        saveBtn.classList.add("hidden");
      }
    });

    deleteBtn.addEventListener("click", async () => {
      if (confirm(`Are you sure you want to delete the group "${group.name}"? All webhooks in this group will become ungrouped.`)) {
        // Remove group
        const groups = await loadGroups();
        const updatedGroups = groups.filter(g => g.id !== group.id);
        await saveGroups(updatedGroups);

        // Remove group from webhook form dropdown
        const option = groupSelect.querySelector(`option[value="${group.id}"]`);
        if (option) {
          option.remove();
        }

        // Update webhooks that belonged to this group
        const { webhooks = [] } = await browser.storage.sync.get("webhooks");
        const updatedWebhooks = webhooks.map(wh =>
          wh.groupId === group.id ? { ...wh, groupId: null } : wh
        );
        await saveWebhooks(updatedWebhooks);

        // Re-render groups
        renderGroups();

        // Reload webhooks to update the list
        loadWebhooks();
      }
    });

    // Drag and drop event listeners (only on the drag handle)
    dragHandle.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", group.id);
      listItem.classList.add("dragging");
    });

    dragHandle.addEventListener("dragend", () => {
      listItem.classList.remove("dragging");
      // Remove drag-over class from all items
      document.querySelectorAll(".group-item").forEach(item => {
        item.classList.remove("drag-over");
      });
    });

    listItem.addEventListener("dragover", (e) => {
      e.preventDefault();
      listItem.classList.add("drag-over");
    });

    listItem.addEventListener("dragleave", () => {
      listItem.classList.remove("drag-over");
    });

    listItem.addEventListener("drop", async (e) => {
      e.preventDefault();
      listItem.classList.remove("drag-over");

      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId !== group.id) {
        // Reorder groups
        const groups = await loadGroups();
        const draggedIndex = groups.findIndex(g => g.id === draggedId);
        const targetIndex = groups.findIndex(g => g.id === group.id);

        if (draggedIndex !== -1 && targetIndex !== -1) {
          // Remove dragged item and insert at target position
          const [draggedItem] = groups.splice(draggedIndex, 1);
          groups.splice(targetIndex, 0, draggedItem);

          // Save reordered groups
          await saveGroups(groups);

          // Re-render groups to reflect new order
          renderGroups();

          // Also reload webhooks to ensure correct group order in the list
          loadWebhooks();

          // Update group dropdown in webhook form to reflect new order
          const groupSelect = document.getElementById("webhook-group");
          const selectedValue = groupSelect.value;
          groupSelect.innerHTML = '<option value="" selected>' + browser.i18n.getMessage("optionsNoGroup") + '</option>';
          groups.forEach(group => {
            const option = document.createElement("option");
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
          });
          groupSelect.value = selectedValue;
        }
      }
    });
  });
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
const showAddWebhookBtn = document.getElementById("add-new-webhook-btn");
const manageGroupsBtn = document.getElementById("manage-groups-btn");
const customPayloadInput = document.getElementById("webhook-custom-payload");
const variablesAutocomplete = document.getElementById("variables-autocomplete");
const toggleCustomPayloadBtn = document.getElementById("toggle-custom-payload");
const customPayloadContent = document.getElementById("custom-payload-content");
const urlFilterInput = document.getElementById("webhook-url-filter");
const toggleUrlFilterBtn = document.getElementById("toggle-url-filter");
const urlFilterContent = document.getElementById("url-filter-content");
const exportWebhooksBtn = document.getElementById("export-webhooks-btn");
const importWebhooksBtn = document.getElementById("import-webhooks-btn");
const importWebhooksInput = document.getElementById("import-webhooks-input");
const groupSelect = document.getElementById("webhook-group");
const manageGroupsModal = document.getElementById("manage-groups-modal");
const newGroupNameInput = document.getElementById("new-group-name");
const addGroupBtn = document.getElementById("add-group-btn");
const groupsList = document.getElementById("groups-list");
const closeManageGroupsBtn = document.getElementById("close-manage-groups-btn");
const closeManageGroups = document.querySelector("#manage-groups-modal .close-manage-groups");
let headers = [];

async function exportWebhooks() {
  const { webhooks = [] } = await browser.storage.sync.get("webhooks");
  const blob = new Blob([JSON.stringify({ webhooks }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "webhooks.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function handleImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const hooks = Array.isArray(data) ? data : data.webhooks;
    if (Array.isArray(hooks)) {
      await saveWebhooks(hooks);
      loadWebhooks();
    }
  } catch (e) {
    console.error("Failed to import webhooks", e);
  } finally {
    event.target.value = "";
  }
}

// Export webhooks and groups
const exportData = async () => {
  const { webhooks = [], groups = [] } = await browser.storage.sync.get(["webhooks", "groups"]);
  const data = { webhooks, groups };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "webhooks-export.json";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
};

// Import webhooks and groups
const importData = async (file) => {
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      const webhooks = Array.isArray(data.webhooks) ? data.webhooks : [];
      const groups = Array.isArray(data.groups) ? data.groups : [];
      await browser.storage.sync.set({ webhooks, groups });
      await loadWebhooks();
      if (typeof renderGroups === 'function') await renderGroups();
      alert("Import successful!");
    } catch (e) {
      alert("Import failed: Invalid file format.");
    }
  };
  reader.readAsText(file);
};

if (exportWebhooksBtn) {
  exportWebhooksBtn.addEventListener("click", async () => {
    const { webhooks = [], groups = [] } = await browser.storage.sync.get(["webhooks", "groups"]);
    const data = { webhooks, groups };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "webhooks-export.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  });
}

if (importWebhooksBtn && importWebhooksInput) {
  importWebhooksBtn.addEventListener("click", () => importWebhooksInput.click());
  importWebhooksInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          const webhooks = Array.isArray(data.webhooks) ? data.webhooks : [];
          const groups = Array.isArray(data.groups) ? data.groups : [];
          await browser.storage.sync.set({ webhooks, groups });
          await loadWebhooks();
          if (typeof renderGroups === 'function') await renderGroups();
          alert("Import successful!");
        } catch (e) {
          alert("Import failed: Invalid file format.");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    }
  });
}

showAddWebhookBtn.addEventListener('click', () => {
  form.classList.remove('hidden');
  showAddWebhookBtn.classList.add('hidden');
  cancelEditBtn.classList.remove('hidden');
  labelInput.focus();
});

// Manage groups button
manageGroupsBtn.addEventListener('click', async () => {
  manageGroupsModal.classList.remove('hidden');
  // Set localized placeholder for new group name input
  newGroupNameInput.placeholder = browser.i18n.getMessage("optionsNewGroupNamePlaceholder");
  await renderGroups();
});

// Close modal functions
const closeManageGroupsModalFunc = () => {
  manageGroupsModal.classList.add('hidden');
};

// Close manage groups modal
closeManageGroupsBtn.addEventListener('click', closeManageGroupsModalFunc);
closeManageGroups.addEventListener('click', closeManageGroupsModalFunc);

// Close modals when clicking outside
manageGroupsModal.addEventListener('click', (e) => {
  if (e.target === manageGroupsModal) {
    closeManageGroupsModalFunc();
  }
});

// Add group
addGroupBtn.addEventListener('click', async () => {
  const groupName = newGroupNameInput.value.trim();
  if (groupName) {
    // Load existing groups
    const groups = await loadGroups();

    // Check if group with this name already exists
    const existingGroup = groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
    if (existingGroup) {
      alert(`A group with the name "${groupName}" already exists.`);
      return;
    }

    // Add new group
    const newGroup = {
      id: crypto.randomUUID(),
      name: groupName
    };
    groups.push(newGroup);

    // Save groups
    await saveGroups(groups);

    // Update group dropdown
    const option = document.createElement("option");
    option.value = newGroup.id;
    option.textContent = newGroup.name;
    groupSelect.appendChild(option);

    // Reset input
    newGroupNameInput.value = '';

    // Re-render groups list
    renderGroups();
  }
});

// Also allow adding group with Enter key
newGroupNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addGroupBtn.click();
  }
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
    btn.textContent = browser.i18n.getMessage('optionsRemoveHeaderButton') || 'Remove';
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
  const urlFilter = urlFilterInput.value.trim();
  const customPayload = customPayloadInput.value.trim();
  const groupId = groupSelect.value || null;
  let { webhooks = [], groups = [] } = await browser.storage.sync.get(["webhooks", "groups"]);

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
        groupId
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
      customPayload: customPayload || null,
      urlFilter: urlFilter || "",
      groupId
    };
    webhooks.push(newWebhook);
  }

  await saveWebhooks(webhooks);
  labelInput.value = "";
  urlInput.value = "";
  methodSelect.value = "POST";
  identifierInput.value = "";
  urlFilterInput.value = "";
  customPayloadInput.value = "";
  headerKeyInput.value = "";
  headerValueInput.value = "";
  groupSelect.value = "";
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
const webhookList = document.getElementById("webhook-list");
let draggedItem = null;

const persistWebhookOrder = async () => {
  const ids = Array.from(webhookList.querySelectorAll("li")).map((li) => li.dataset.id);
  let { webhooks = [] } = await browser.storage.sync.get("webhooks");
  webhooks = ids.map((id) => webhooks.find((w) => w.id === id)).filter(Boolean);
  await saveWebhooks(webhooks);
};

webhookList.addEventListener("dragstart", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  draggedItem = li;
  li.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
});

webhookList.addEventListener("dragover", (e) => {
  e.preventDefault();
  const target = e.target.closest("li");
  if (!draggedItem || !target || target === draggedItem) return;
  const rect = target.getBoundingClientRect();
  const next = e.clientY - rect.top > rect.height / 2;
  webhookList.insertBefore(draggedItem, next ? target.nextSibling : target);
});

webhookList.addEventListener("drop", async (e) => {
  e.preventDefault();
  if (draggedItem) {
    draggedItem.classList.remove("dragging");
    await persistWebhookOrder();
    draggedItem = null;
  }
});

webhookList.addEventListener("dragend", async () => {
  if (draggedItem) {
    draggedItem.classList.remove("dragging");
    await persistWebhookOrder();
    draggedItem = null;
  }
});
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
      urlFilterInput.value = webhook.urlFilter || "";
      customPayloadInput.value = webhook.customPayload || "";
      groupSelect.value = webhook.groupId || "";
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
  } else if (e.target.classList.contains("duplicate-btn")) {
    const webhook = webhooks.find((wh) => wh.id === webhookId);
    if (webhook) {
      editWebhookId = null;
      labelInput.value = webhook.label;
      urlInput.value = webhook.url;
      methodSelect.value = webhook.method || "POST";
      identifierInput.value = webhook.identifier || "";
      urlFilterInput.value = webhook.urlFilter || "";
      customPayloadInput.value = webhook.customPayload || "";
      groupSelect.value = webhook.groupId || "";
      headers = Array.isArray(webhook.headers) ? [...webhook.headers] : [];
      renderHeaders();
      cancelEditBtn.classList.remove("hidden");
      form.classList.remove('hidden');
      showAddWebhookBtn.classList.add('hidden');
      form.querySelector('button[type="submit"]').textContent = browser.i18n.getMessage("optionsSaveButton") || "Save Webhook";
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
  urlFilterInput.value = "";
  customPayloadInput.value = "";
  headerKeyInput.value = "";
  headerValueInput.value = "";
  groupSelect.value = "";
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

  // Localize additional placeholders and buttons
  headerKeyInput.placeholder = browser.i18n.getMessage('optionsHeaderNamePlaceholder');
  headerValueInput.placeholder = browser.i18n.getMessage('optionsHeaderValuePlaceholder');
  addHeaderBtn.textContent = browser.i18n.getMessage('optionsAddHeaderButton') || 'Add';
  identifierInput.placeholder = browser.i18n.getMessage('optionsIdentifierPlaceholder');
  urlFilterInput.placeholder = browser.i18n.getMessage('optionsURLFilterPlaceholder');
  customPayloadInput.placeholder = browser.i18n.getMessage('optionsCustomPayloadPlaceholder');

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
  module.exports = {
    loadWebhooks,
    saveWebhooks,
    renderHeaders,
    persistWebhookOrder,
    exportWebhooks,
    handleImport,
  };
}
