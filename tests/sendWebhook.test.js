const { sendWebhook } = require('../utils/utils');

describe('sendWebhook', () => {
  const mockBrowser = {
    tabs: {
      query: jest.fn(),
    },
    runtime: {
      getBrowserInfo: jest.fn(),
      getPlatformInfo: jest.fn(),
    },
    i18n: {
      getMessage: jest.fn((key, ...args) => `${key} ${args.join(' ')}`.trim()),
    },
  };

  const originalFetch = global.fetch;
  const originalBrowser = global.browser;
  const originalConsoleError = console.error;

  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    );
    global.browser = mockBrowser;
    console.error = jest.fn();

    // Default mock implementations
    mockBrowser.tabs.query.mockResolvedValue([{
      id: 1,
      windowId: 1,
      index: 0,
      url: 'https://example.com',
      title: 'Example Domain',
      pinned: false,
      audible: false,
      mutedInfo: {},
      incognito: false,
      status: 'complete'
    }]);
    mockBrowser.runtime.getBrowserInfo.mockResolvedValue({ name: 'Firefox', version: '90.0' });
    mockBrowser.runtime.getPlatformInfo.mockResolvedValue({ os: 'linux', arch: 'x86-64' });
    mockBrowser.i18n.getMessage.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.browser = originalBrowser;
    console.error = originalConsoleError;
    jest.clearAllMocks();
  });

  test('should send test webhook', async () => {
    const webhook = { url: 'https://test.com' };
    await sendWebhook(webhook, true);

    expect(global.fetch).toHaveBeenCalledWith(
      webhook.url,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"test":true'),
      })
    );
  });

  test('should send real webhook with tab info', async () => {
    const webhook = { url: 'https://real.com' };
    await sendWebhook(webhook, false);

    expect(mockBrowser.tabs.query).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      webhook.url,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"title":"Example Domain"'),
      })
    );
  });

  test('should include custom headers', async () => {
    const webhook = {
      url: 'https://headers.com',
      headers: [{ key: 'X-Custom', value: 'MyValue' }]
    };
    await sendWebhook(webhook, true);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom': 'MyValue',
          'Content-Type': 'application/json'
        })
      })
    );
  });

  test('should support GET method', async () => {
    const webhook = {
      url: 'https://get.com',
      method: 'GET'
    };
    await sendWebhook(webhook, true);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://get.com/?payload='),
      expect.objectContaining({
        method: 'GET',
        body: undefined
      })
    );
  });

  test('should replace placeholders in custom payload', async () => {
    const webhook = {
      url: 'https://custom.com',
      customPayload: '{"text": "Page: {{tab.title}}", "id": {{tab.id}}}'
    };
    await sendWebhook(webhook, false);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          text: "Page: Example Domain",
          id: 1
        })
      })
    );
  });

  test('should handle string replacements in JSON values correctly', async () => {
     const webhook = {
      url: 'https://custom.com',
      customPayload: '{"browser": {{browser}}}'
    };
    await sendWebhook(webhook, false);

    // The current implementation replaces {{browser}} with a stringified JSON string,
    // so the resulting payload has "browser": "{\"name\":...}"
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"browser":"{\\"name\\":\\"Firefox\\",\\"version\\":\\"90.0\\"}"')
      })
    );
  });

  test('should throw error if no active tab found', async () => {
    mockBrowser.tabs.query.mockResolvedValue([]);

    await expect(sendWebhook({ url: 'https://fail.com' }, false))
      .rejects.toThrow('popupErrorNoActiveTab');
  });

  test('should throw error on fetch failure', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500
    });

    await expect(sendWebhook({ url: 'https://fail.com' }, true))
      .rejects.toThrow('popupErrorHttp 500');
  });

  test('should throw error on invalid custom payload JSON', async () => {
    const webhook = {
      url: 'https://custom.com',
      customPayload: '{invalid_json}'
    };
    await expect(sendWebhook(webhook, false))
      .rejects.toThrow('popupErrorCustomPayloadJsonParseError');
  });
});
