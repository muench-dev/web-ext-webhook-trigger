const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');

describe('options page', () => {
  let dom;
  let loadWebhooks;
  let saveWebhooks;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <form id="add-webhook-form">
        <input id="webhook-label" />
        <input id="webhook-url" />
        <select id="webhook-method"></select>
        <input id="webhook-identifier" />
        <div id="headers-list"></div>
        <input id="header-key" />
        <input id="header-value" />
        <button type="button" id="add-header-btn"></button>
        <button type="button" id="cancel-edit-btn" class="hidden"></button>
        <button type="submit"></button>
      </form>
      <ul id="webhook-list"></ul>
      <p id="no-webhooks-message" class="hidden"></p>
    </body></html>`);
    global.document = dom.window.document;
    // Prevent auto-fired DOMContentLoaded handlers from executing
    dom.window.document.addEventListener = jest.fn();
    global.window = dom.window;
    global.Node = dom.window.Node;
    global.replaceI18nPlaceholders = jest.fn();
    global.browser = {
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn(),
        },
      },
      i18n: {
        getMessage: jest.fn().mockImplementation((key) => key),
      },
    };
    ({ loadWebhooks, saveWebhooks } = require('../options/options.js'));
  });

  afterEach(() => {
    jest.resetModules();
    dom.window.close();
    delete global.document;
    delete global.window;
    delete global.Node;
    delete global.browser;
    delete global.replaceI18nPlaceholders;
  });

  test('shows message when no webhooks are stored', async () => {
    global.browser.storage.sync.get.mockResolvedValue({ webhooks: [] });
    await loadWebhooks();
    const msg = document.getElementById('no-webhooks-message');
    expect(msg.classList.contains('hidden')).toBe(false);
    expect(msg.textContent).toBe('optionsNoWebhooksMessage');
  });

  test('renders list items when webhooks exist', async () => {
    const hooks = [{ id: '1', label: 'Test', url: 'http://example.com' }];
    global.browser.storage.sync.get.mockResolvedValue({ webhooks: hooks });
    await loadWebhooks();
    const items = document.querySelectorAll('#webhook-list li');
    expect(items.length).toBe(1);
    const item = items[0];
    expect(item.dataset.id).toBe('1');
    expect(item.querySelector('.label').textContent).toBe('Test');
    expect(item.querySelector('.url').textContent).toBe('http://example.com');
  });

  test('saveWebhooks writes to storage', async () => {
    const hooks = [{ id: 'a' }];
    await saveWebhooks(hooks);
    expect(global.browser.storage.sync.set).toHaveBeenCalledWith({ webhooks: hooks });
  });
});
