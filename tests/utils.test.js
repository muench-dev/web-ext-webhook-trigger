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
