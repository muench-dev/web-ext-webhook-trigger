const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;


describe('background context menu', () => {
  let browser;
  let fetchMock;
  let createContextMenus;
  let sendWebhook;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    browser = {
      storage: {
        sync: { get: jest.fn().mockResolvedValue({ webhooks: [{ id: '1', label: 'Test', url: 'https://hook.test' }] }) }
      },
      contextMenus: {
        create: jest.fn(),
        removeAll: jest.fn(),
        onClicked: { addListener: jest.fn() },
      },
      i18n: { getMessage: jest.fn((_k, s) => s) },
      runtime: { getBrowserInfo: jest.fn().mockResolvedValue({}), getPlatformInfo: jest.fn().mockResolvedValue({}) },
    };
    global.browser = browser;
    global.window = { getBrowserAPI: () => browser };
    ({ createContextMenus, sendWebhook } = require('../background.js'));
  });

  afterEach(() => {
    delete global.browser;
    delete global.window;
    delete global.fetch;
    jest.resetModules();
  });

  test('creates context menu entries', async () => {
    await createContextMenus();
    expect(browser.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  test('sendWebhook performs fetch', async () => {
    const hook = { id: '1', label: 'Test', url: 'https://hook.test' };
    await sendWebhook(hook, { title: 't', url: 'u', id: 1, windowId: 1, index:0, pinned:false, audible:false, mutedInfo:null, incognito:false, status:'complete' }, { selectionText: '' });
    expect(fetchMock).toHaveBeenCalled();
  });
});
