const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('webhook utils', () => {
  afterEach(() => {
    jest.resetModules();
    delete global.browser;
    delete global.window;
  });

  test('filterWebhooksByUrl filters correctly', () => {
    const { filterWebhooksByUrl } = require('../utils/webhookUtils');
    const hooks = [
      { id: '1', urlFilter: 'example.com' },
      { id: '2' }
    ];
    expect(filterWebhooksByUrl(hooks, 'https://example.com/page').length).toBe(2);
    expect(filterWebhooksByUrl(hooks, 'https://other.com').length).toBe(1);
  });

  test('getVisibleWebhooks loads and filters', async () => {
    const hooks = [
      { id: '1', urlFilter: 'example.com' },
      { id: '2' }
    ];
    const browser = { storage: { sync: { get: jest.fn().mockResolvedValue({ webhooks: hooks }) } } };
    global.browser = browser;
    global.window = { getBrowserAPI: () => browser };
    const { getVisibleWebhooks } = require('../utils/webhookUtils');
    const res = await getVisibleWebhooks('https://example.com');
    expect(res.length).toBe(2);
    const res2 = await getVisibleWebhooks('https://other.com');
    expect(res2.length).toBe(1);
  });
});
