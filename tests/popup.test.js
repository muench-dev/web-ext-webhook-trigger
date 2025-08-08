const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');

describe('popup script', () => {
  let dom;
  let fetchMock;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="buttons-container"></div>
      <div id="status-message"></div>
      <a id="open-options"></a>
    </body></html>`, { url: 'https://example.com' });
    global.document = dom.window.document;
    global.window = dom.window;
    global.Node = dom.window.Node;
    global.replaceI18nPlaceholders = jest.fn();
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    global.browser = {
      storage: { sync: { get: jest.fn() } },
      i18n: { getMessage: jest.fn((key) => key) },
      tabs: { query: jest.fn().mockResolvedValue([{ title: 't', url: 'https://example.com', id: 1, windowId: 1, index: 0, pinned: false, audible: false, mutedInfo: null, incognito: false, status: 'complete' }]) },
      runtime: {
        openOptionsPage: jest.fn(),
        getBrowserInfo: jest.fn().mockResolvedValue({}),
        getPlatformInfo: jest.fn().mockResolvedValue({}),
      },
    };
    global.window.getBrowserAPI = jest.fn().mockReturnValue(global.browser);
    global.window.sendWebhook = jest.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.resetModules();
    dom.window.close();
    delete global.document;
    delete global.window.getBrowserAPI;
    delete global.window;
    delete global.Node;
    delete global.fetch;
    delete global.browser;
    delete global.replaceI18nPlaceholders;
  });

  test('shows message when no webhooks configured', async () => {
    browser.storage.sync.get.mockResolvedValue({ webhooks: [] });
    require('../popup/popup.js');
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    await new Promise(setImmediate);
    const msg = document.querySelector('.no-hooks-msg');
    expect(msg).not.toBeNull();
    expect(msg.textContent).toBe('popupNoWebhooksConfigured');
  });

  test('clicking webhook button triggers fetch', async () => {
    const hook = { id: '1', label: 'Send', url: 'https://hook.test' };
    browser.storage.sync.get.mockResolvedValue({ webhooks: [hook] });
    browser.tabs.query.mockResolvedValue([{ title: 't', url: 'https://example.com', id: 1, windowId: 1, index: 0, pinned: false, audible: false, mutedInfo: null, incognito: false, status: 'complete' }]);
    require('../popup/popup.js');
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    await new Promise(setImmediate);
    const btn = document.querySelector('button.webhook-btn');
    expect(btn).not.toBeNull();
    btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await new Promise(setImmediate);
    expect(window.sendWebhook).toHaveBeenCalled();
    expect(window.sendWebhook.mock.calls[0][0]).toEqual(hook);
  });

  test('uses custom payload when available', async () => {
    const customPayload = '{"message": "Custom message with {{tab.title}}"}';
    const hook = {
      id: '1',
      label: 'Send',
      url: 'https://hook.test',
      customPayload
    };
    browser.storage.sync.get.mockResolvedValue({ webhooks: [hook] });
    browser.tabs.query.mockResolvedValue([{
      title: 'Test Page',
      url: 'https://example.com',
      id: 1,
      windowId: 1,
      index: 0,
      pinned: false,
      audible: false,
      mutedInfo: null,
      incognito: false,
      status: 'complete'
    }]);

    require('../popup/popup.js');
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    await new Promise(setImmediate);

    const btn = document.querySelector('button.webhook-btn');
    expect(btn).not.toBeNull();
    btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await new Promise(setImmediate);

    expect(window.sendWebhook).toHaveBeenCalled();
    expect(window.sendWebhook.mock.calls[0][0]).toEqual(hook);
  });

  test('filters webhooks based on urlFilter', async () => {
    const hooks = [
      { id: '1', label: 'A', url: 'https://hook1.test', urlFilter: 'example.com' },
      { id: '2', label: 'B', url: 'https://hook2.test', urlFilter: 'other.com' }
    ];
    browser.storage.sync.get.mockResolvedValue({ webhooks: hooks });
    browser.tabs.query.mockResolvedValue([{ title: 't', url: 'https://example.com', id: 1, windowId: 1, index: 0, pinned: false, audible: false, mutedInfo: null, incognito: false, status: 'complete' }]);

    require('../popup/popup.js');
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    await new Promise(setImmediate);

    const btns = document.querySelectorAll('button.webhook-btn');
    expect(btns.length).toBe(1);
    expect(btns[0].textContent).toBe('A');
  });
});
