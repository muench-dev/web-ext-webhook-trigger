const { sendWebhook } = require('../utils/utils');

// Mock browser API
const mockBrowser = {
  tabs: {
    query: jest.fn()
  },
  runtime: {
    getBrowserInfo: jest.fn(),
    getPlatformInfo: jest.fn()
  },
  i18n: {
    getMessage: jest.fn((key) => key)
  }
};

global.browser = mockBrowser;
global.fetch = jest.fn();
global.console.error = jest.fn();

describe('sendWebhook Vulnerability and bugs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowser.tabs.query.mockResolvedValue([{
      title: 'Test Page',
      url: 'http://example.com',
      id: 1,
      windowId: 1,
      index: 0,
      pinned: false,
      audible: false,
      incognito: false,
      status: 'complete'
    }]);
    mockBrowser.runtime.getBrowserInfo.mockResolvedValue({ name: 'Firefox' });
    mockBrowser.runtime.getPlatformInfo.mockResolvedValue({ os: 'linux' });
    global.fetch.mockResolvedValue({ ok: true });
  });

  test('should correctly handle backslash in payload (fix JSON syntax error)', async () => {
    const webhook = {
      url: 'http://localhost/hook',
      customPayload: '{ "title": "{{tab.title}}" }',
      method: 'POST'
    };

    mockBrowser.tabs.query.mockResolvedValue([{
      title: '\\',
      url: 'http://example.com'
    }]);

    await sendWebhook(webhook, false);

    const callArgs = global.fetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.title).toBe('\\');
  });

  test('should correctly handle escaped quote in payload', async () => {
    const webhook = {
      url: 'http://localhost/hook',
      customPayload: '{ "title": "{{tab.title}}" }',
      method: 'POST'
    };

    mockBrowser.tabs.query.mockResolvedValue([{
      title: '\\"',
      url: 'http://example.com'
    }]);

    await sendWebhook(webhook, false);

    const callArgs = global.fetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.title).toBe('\\"');
  });

  test('should correctly handle dollar signs in payload', async () => {
    const webhook = {
      url: 'http://localhost/hook',
      customPayload: '{ "title": "{{tab.title}}" }',
      method: 'POST'
    };

    // '$&' is a special replacement pattern (inserts matched string)
    mockBrowser.tabs.query.mockResolvedValue([{
      title: '$&',
      url: 'http://example.com'
    }]);

    await sendWebhook(webhook, false);

    const callArgs = global.fetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.title).toBe('$&');
  });
});
