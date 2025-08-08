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
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toBe('https://hook.test');
  });

  test('uses custom payload with all datetime variables', async () => {
    const customPayload = JSON.stringify({
      "triggeredAt": "{{triggeredAt}}",
      "now.iso": "{{now.iso}}",
      "now.date": "{{now.date}}",
      "now.time": "{{now.time}}",
      "now.unix": "{{now.unix}}",
      "now.unix_ms": "{{now.unix_ms}}",
      "now.year": "{{now.year}}",
      "now.month": "{{now.month}}",
      "now.day": "{{now.day}}",
      "now.hour": "{{now.hour}}",
      "now.minute": "{{now.minute}}",
      "now.second": "{{now.second}}",
      "now.millisecond": "{{now.millisecond}}",
      "now.local.iso": "{{now.local.iso}}",
      "now.local.date": "{{now.local.date}}",
      "now.local.time": "{{now.local.time}}",
    });
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

    // Mock Date
    const mockDate = new Date('2025-08-07T10:20:30.123Z');
    const OriginalDate = global.Date;
    global.Date = jest.fn((...args) => {
      if (args.length) {
        return new OriginalDate(...args);
      }
      return mockDate;
    });
    global.Date.now = jest.fn(() => mockDate.getTime());
    global.Date.toISOString = jest.fn(() => mockDate.toISOString());

    require('../popup/popup.js');
    document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    await new Promise(setImmediate);

    const btn = document.querySelector('button.webhook-btn');
    expect(btn).not.toBeNull();
    btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await new Promise(setImmediate);

    expect(fetchMock).toHaveBeenCalled();

    const fetchOptions = fetchMock.mock.calls[0][1];
    const sentPayload = JSON.parse(fetchOptions.body);

    const expectedPayload = {
      "triggeredAt": "2025-08-07T10:20:30.123Z",
      "now.iso": "2025-08-07T10:20:30.123Z",
      "now.date": "2025-08-07",
      "now.time": "10:20:30",
      "now.unix": Math.floor(mockDate.getTime() / 1000),
      "now.unix_ms": mockDate.getTime(),
      "now.year": 2025,
      "now.month": 8,
      "now.day": 7,
      "now.hour": 10,
      "now.minute": 20,
      "now.second": 30,
      "now.millisecond": 123,
      "now.local.iso": "2025-08-07T10:20:30.123+00:00",
      "now.local.date": "2025-08-07",
      "now.local.time": "10:20:30"
    };

    expect(sentPayload).toEqual(expectedPayload);

    // Restore Date mock
    global.Date = OriginalDate;
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
