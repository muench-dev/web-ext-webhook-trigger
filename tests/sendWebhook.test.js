const { sendWebhook } = require('../utils/utils');

describe('sendWebhook', () => {
  const mockBrowser = {
    tabs: {
      query: jest.fn(),
      captureVisibleTab: jest.fn(),
      sendMessage: jest.fn(),
      executeScript: jest.fn(),
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
  const originalChrome = global.chrome;
  const originalWindow = global.window;
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
    mockBrowser.tabs.captureVisibleTab.mockReset();
    mockBrowser.tabs.sendMessage.mockReset();
    mockBrowser.tabs.executeScript.mockResolvedValue([]);
    mockBrowser.i18n.getMessage.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.browser = originalBrowser;
    if (typeof originalChrome === 'undefined') {
      delete global.chrome;
    } else {
      global.chrome = originalChrome;
    }
    if (typeof originalWindow === 'undefined') {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
    console.error = originalConsoleError;
    jest.useRealTimers();
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

  test('should replace all new now datetime placeholders', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-08-07T10:20:30.123Z'));

    const webhook = {
      url: 'https://custom.com',
      customPayload: '{"iso":"{{now.iso}}","date":"{{now.date}}","time":"{{now.time}}","unix":{{now.unix}},"unixMs":{{now.unix_ms}},"year":{{now.year}},"month":{{now.month}},"day":{{now.day}},"hour":{{now.hour}},"minute":{{now.minute}},"second":{{now.second}},"millisecond":{{now.millisecond}},"localIso":"{{now.local.iso}}","localDate":"{{now.local.date}}","localTime":"{{now.local.time}}"}'
    };

    await sendWebhook(webhook, false);

    const fetchBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(fetchBody.iso).toBe('2025-08-07T10:20:30.123Z');
    expect(fetchBody.date).toBe('2025-08-07');
    expect(fetchBody.time).toBe('10:20:30');
    expect(fetchBody.unix).toBe(1754562030);
    expect(fetchBody.unixMs).toBe(1754562030123);
    expect(fetchBody.year).toBe(2025);
    expect(fetchBody.month).toBe(8);
    expect(fetchBody.day).toBe(7);
    expect(fetchBody.hour).toBe(10);
    expect(fetchBody.minute).toBe(20);
    expect(fetchBody.second).toBe(30);
    expect(fetchBody.millisecond).toBe(123);
    expect(fetchBody.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fetchBody.localTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(fetchBody.localIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);

  });

  test('should keep triggeredAt as alias for now.iso', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-08-07T10:20:30.123Z'));

    const webhook = {
      url: 'https://custom.com',
      customPayload: '{"now":"{{now.iso}}","legacy":"{{triggeredAt}}"}'
    };

    await sendWebhook(webhook, false);

    const fetchBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(fetchBody.now).toBe('2025-08-07T10:20:30.123Z');
    expect(fetchBody.legacy).toBe('2025-08-07T10:20:30.123Z');

  });

  describe('page text and html extraction', () => {
    test('extracts page text and html when configured', async () => {
      mockBrowser.tabs.sendMessage.mockResolvedValue({
        ok: true,
        text: 'Mock Page Text',
        html: '<html>Mock Page Html</html>'
      });

      const webhook = {
        url: 'https://content.test',
        includePageText: true,
        includePageHtml: true
      };

      await sendWebhook(webhook, false);

      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ type: 'GET_PAGE_CONTENT' })
      );

      const fetchBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(fetchBody.pageText).toBe('Mock Page Text');
      expect(fetchBody.pageHtml).toBe('<html>Mock Page Html</html>');
    });

    test('substitutes {{page.text}} and {{page.html}} in custom payload', async () => {
      mockBrowser.tabs.sendMessage.mockResolvedValue({
        ok: true,
        text: 'Custom Text',
        html: '<custom>Html</custom>'
      });

      const webhook = {
        url: 'https://content.test',
        customPayload: '{"text":"{{page.text}}","html":"{{page.html}}"}'
      };

      await sendWebhook(webhook, false);

      const fetchBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(fetchBody.text).toBe('Custom Text');
      expect(fetchBody.html).toBe('<custom>Html</custom>');
    });
  });
});
