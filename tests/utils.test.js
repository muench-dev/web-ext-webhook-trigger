const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');
const utils = require('../utils/utils');
const { replaceI18nPlaceholders } = utils;

describe('replaceI18nPlaceholders', () => {
  let dom;
  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><head><title data-i18n="title"></title></head><body><span data-i18n="hello"></span><p>__MSG_world__</p></body></html>`);
    global.document = dom.window.document;
    global.Node = dom.window.Node;
    global.NodeFilter = dom.window.NodeFilter;
    global.browser = {
      i18n: {
        getMessage: (key) => ({ title: 'Title', hello: 'Hello', world: 'World' }[key])
      }
    };
  });
  afterEach(() => {
    dom.window.close();
    delete global.document;
    delete global.Node;
    delete global.NodeFilter;
    delete global.browser;
  });
  test('replaces placeholders in elements and text nodes', () => {
    replaceI18nPlaceholders();
    expect(dom.window.document.querySelector('span').textContent).toBe('Hello');
    expect(dom.window.document.querySelector('p').textContent).toBe('World');
    expect(dom.window.document.title).toBe('Title');
  });
});

describe('sendWebhook', () => {
  let mockBrowser;
  const originalFetch = global.fetch;
  let originalBrowser;

  beforeEach(() => {
    mockBrowser = {
      tabs: {
        query: jest.fn().mockResolvedValue([{
          id: 1,
          title: 'Active Tab',
          url: 'https://example.com',
          windowId: 1,
          index: 0,
          pinned: false,
          audible: false,
          mutedInfo: null,
          incognito: false,
          status: 'complete'
        }]),
        sendMessage: jest.fn().mockResolvedValue({ selectorContent: ['John Doe'] })
      },
      runtime: {
        getBrowserInfo: jest.fn().mockResolvedValue({}),
        getPlatformInfo: jest.fn().mockResolvedValue({}),
      },
      i18n: {
        getMessage: jest.fn((key, value) => key)
      }
    };

    originalBrowser = global.browser;
    global.browser = mockBrowser;
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    if (typeof originalBrowser === 'undefined') {
      delete global.browser;
    } else {
      global.browser = originalBrowser;
    }
    if (typeof originalFetch === 'function') {
      global.fetch = originalFetch;
    } else {
      delete global.fetch;
    }
  });

  test('attaches selector content to payload when selectors exist', async () => {
    const webhook = { url: 'https://webhook.example', selectors: ['.name'] };
    await utils.sendWebhook(webhook, false);

    expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'GET_SELECTOR_CONTENT',
      selectors: ['.name']
    }));

    const fetchArgs = global.fetch.mock.calls[0];
    expect(fetchArgs[0]).toBe('https://webhook.example');
    const payload = JSON.parse(fetchArgs[1].body);
    expect(payload.selectorContent).toEqual(['John Doe']);
  });

  test('replaces selectorContent placeholder inside custom payload', async () => {
    const webhook = {
      url: 'https://webhook.example',
      selectors: ['.name'],
      customPayload: '{"message": {{selectorContent}} }'
    };

    await utils.sendWebhook(webhook, false);

    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload).toEqual({ message: ['John Doe'] });
  });
});

describe('toLocalIsoString', () => {
  const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;

  afterEach(() => {
    Date.prototype.getTimezoneOffset = originalGetTimezoneOffset;
  });

  test('correctly formats a date with single digit components', () => {
    const date = new Date(2023, 0, 5, 8, 4, 2, 3); // Jan 5, 2023, 08:04:02.003
    // Mock timezone to UTC
    Date.prototype.getTimezoneOffset = jest.fn(() => 0);

    // year: 2023
    // month: 0 + 1 = 1 -> "01"
    // day: 5 -> "05"
    // hour: 8 -> "08"
    // minute: 4 -> "04"
    // second: 2 -> "02"
    // millisecond: 3 -> "003"
    // offset: 0 -> "+00:00"

    expect(utils.toLocalIsoString(date)).toBe('2023-01-05T08:04:02.003+00:00');
  });

  test('handles positive timezone offset (e.g., UTC-5)', () => {
    const date = new Date(2023, 0, 5, 8, 4, 2, 3);
    Date.prototype.getTimezoneOffset = jest.fn(() => 300); // 300 minutes = 5 hours
    // sign = - (offsetMinutes = -300)
    expect(utils.toLocalIsoString(date)).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-05:00/);
  });

  test('handles negative timezone offset (e.g., UTC+2)', () => {
    const date = new Date(2023, 0, 5, 8, 4, 2, 3);
    Date.prototype.getTimezoneOffset = jest.fn(() => -120); // -120 minutes = -2 hours
    // sign = + (offsetMinutes = 120)
    expect(utils.toLocalIsoString(date)).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+02:00/);
  });

  test('handles leap year (Feb 29)', () => {
    const date = new Date(2024, 1, 29, 12, 0, 0);
    Date.prototype.getTimezoneOffset = jest.fn(() => 0);
    expect(utils.toLocalIsoString(date)).toBe('2024-02-29T12:00:00.000+00:00');
  });

  test('handles end of year boundary', () => {
    const date = new Date(2023, 11, 31, 23, 59, 59, 999);
    Date.prototype.getTimezoneOffset = jest.fn(() => 0);
    expect(utils.toLocalIsoString(date)).toBe('2023-12-31T23:59:59.999+00:00');
  });
});
