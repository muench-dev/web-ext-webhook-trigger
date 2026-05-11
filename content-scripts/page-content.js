(() => {
  if (globalThis.__webhookTriggerPageContentLoaded) {
    return;
  }
  globalThis.__webhookTriggerPageContentLoaded = true;

  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "GET_PAGE_CONTENT") {
      return undefined;
    }

    sendResponse({
      ok: true,
      text: document.body?.innerText || "",
      html: document.documentElement?.outerHTML || ""
    });
    return false; // synchronous response
  });
})();
