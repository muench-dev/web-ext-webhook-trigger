const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const { JSDOM } = require('jsdom');
const { replaceI18nPlaceholders } = require('../utils/utils');

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
