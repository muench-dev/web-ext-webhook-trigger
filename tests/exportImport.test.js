const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');

describe('export and import logic', () => {
  let dom;
  let exportWebhooks;
  let handleImport;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <button type="button" id="add-new-webhook-btn"></button>
      <button type="button" id="manage-groups-btn">Manage Groups</button>
      <form id="add-webhook-form" class="hidden">
        <input id="webhook-label" />
        <select id="webhook-group">
          <option value="" selected>No Group</option>
        </select>
        <input id="webhook-url" />
        <select id="webhook-method"></select>
        <input id="webhook-identifier" />
        <div class="form-group">
          <div class="selectors-header">
            <label for="selector-input">Selectors</label>
            <span id="selectors-count">0/10</span>
          </div>
          <p class="form-hint"></p>
          <ul id="selectors-list" class="selectors-list"></ul>
          <div class="selector-input-row">
            <input type="text" id="selector-input" />
            <button type="button" id="add-selector-btn"></button>
          </div>
          <p id="selector-error" class="error-message hidden"></p>
        </div>
        <div id="headers-list"></div>
        <input id="header-key" />
        <input id="header-value" />
        <button type="button" id="add-header-btn"></button>
        <div class="collapsible-header" id="url-filter-header">
          <button type="button" id="toggle-url-filter" class="toggle-btn" aria-expanded="false">
            <span class="toggle-icon">+</span>
          </button>
        </div>
        <div id="url-filter-content" class="collapsible-content collapsed">
          <input id="webhook-url-filter" />
        </div>
        <div class="collapsible-header" id="custom-payload-header">
          <button type="button" id="toggle-custom-payload" class="toggle-btn" aria-expanded="false">
            <span class="toggle-icon">+</span>
          </button>
        </div>
        <div id="custom-payload-content" class="collapsible-content collapsed">
          <textarea id="webhook-custom-payload"></textarea>
          <div id="variables-autocomplete" class="autocomplete-container hidden"></div>
        </div>
        <button type="button" id="cancel-edit-btn" class="hidden"></button>
        <button type="submit"></button>
        <button type="button" id="test-webhook-btn" class="hidden">__MSG_optionsTestButton__</button>
        <p id="form-status-message" class="status-message"></p>
      </form>
      
      <!-- Group Management Modal -->
      <div id="manage-groups-modal" class="modal hidden">
        <div class="modal-content">
          <span class="close-manage-groups">&times;</span>
          <h2>Manage Groups</h2>
          <div class="form-group">
            <label for="new-group-name">New Group Name:</label>
            <input type="text" id="new-group-name" placeholder="Enter new group name" />
            <button type="button" id="add-group-btn">Add Group</button>
          </div>
          <div id="existing-groups-container">
            <h3>Existing Groups:</h3>
            <ul id="groups-list"></ul>
          </div>
          <div class="modal-actions">
            <button type="button" id="close-manage-groups-btn">Close</button>
          </div>
        </div>
      </div>
      
      <div id="import-export-actions">
        <button type="button" id="export-webhooks-btn"></button>
        <button type="button" id="import-webhooks-btn"></button>
        <input type="file" id="import-webhooks-input" />
      </div>
      <ul id="webhook-list"></ul>
      <p id="no-webhooks-message" class="hidden"></p>
    </body></html>`);

    global.document = dom.window.document;
    global.window = dom.window;
    global.Node = dom.window.Node;
    global.replaceI18nPlaceholders = jest.fn();

    global.browser = {
      storage: {
        sync: {
          get: jest.fn().mockResolvedValue({ webhooks: [] }),
          set: jest.fn(),
        },
      },
      i18n: { getMessage: jest.fn((k) => k) },
    };
    global.window.getBrowserAPI = jest.fn().mockReturnValue(global.browser);

    const originalAddEventListener = dom.window.document.addEventListener;
    let domContentLoadedHandler;
    dom.window.document.addEventListener = jest.fn((event, handler) => {
      if (event === 'DOMContentLoaded') {
        domContentLoadedHandler = handler;
      } else {
        originalAddEventListener.call(dom.window.document, event, handler);
      }
    });

    const module = require('../options/options.js');
    exportWebhooks = module.exportWebhooks;
    handleImport = module.handleImport;

    if (domContentLoadedHandler) {
      domContentLoadedHandler();
    }

    global.URL.createObjectURL = jest.fn().mockReturnValue('blob:url');
  });

  afterEach(() => {
    jest.resetModules();
    dom.window.close();
    delete global.document;
    delete global.window.getBrowserAPI;
    delete global.window;
    delete global.Node;
    delete global.browser;
    delete global.replaceI18nPlaceholders;
    delete global.URL.createObjectURL;
  });

  test('exportWebhooks creates downloadable file with stored hooks', async () => {
    const hooks = [{ id: '1', label: 'A', url: 'https://example.com' }];
    global.browser.storage.sync.get.mockResolvedValue({ webhooks: hooks });

    const clickSpy = jest.fn();
    const originalCreateElement = dom.window.document.createElement.bind(dom.window.document);
    jest.spyOn(dom.window.document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return { href: '', download: '', click: clickSpy };
      }
      return originalCreateElement(tag);
    });

    await exportWebhooks();

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    const blob = global.URL.createObjectURL.mock.calls[0][0];
    const text = await blob.text();
    const normalizedHooks = hooks.map(h => ({
      ...h,
      headers: [],
      emoji: '',
      selectors: []
    }));
    expect(JSON.parse(text)).toEqual({ webhooks: normalizedHooks });
    expect(clickSpy).toHaveBeenCalled();
  });

  test('handleImport saves hooks from uploaded file', async () => {
    const hooks = [{ id: '1', label: 'A', url: 'https://example.com' }];
    const file = new File([JSON.stringify({ webhooks: hooks })], 'webhooks.json', { type: 'application/json' });

    const event = { target: { files: [file], value: 'test' } };

    await handleImport(event);

    const normalizedHooks = hooks.map(h => ({
      ...h,
      headers: [],
      emoji: '',
      selectors: []
    }));
    expect(global.browser.storage.sync.set).toHaveBeenCalledWith({ webhooks: normalizedHooks });
    expect(event.target.value).toBe('');
  });
});
