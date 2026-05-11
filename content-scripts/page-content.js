(() => {
  if (globalThis.__webhookTriggerPageContentLoaded) {
    return;
  }
  globalThis.__webhookTriggerPageContentLoaded = true;

  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  const INLINE_EVENT_ATTRS = [
    "onabort", "onblur", "oncancel", "oncanplay", "oncanplaythrough",
    "onchange", "onclick", "onclose", "oncontextmenu", "oncuechange",
    "ondblclick", "ondrag", "ondragend", "ondragenter", "ondragleave",
    "ondragover", "ondragstart", "ondrop", "ondurationchange", "onemptied",
    "onended", "onerror", "onfocus", "onformdata", "oninput", "oninvalid",
    "onkeydown", "onkeypress", "onkeyup", "onload", "onloadeddata",
    "onloadedmetadata", "onloadstart", "onmousedown", "onmouseenter",
    "onmouseleave", "onmousemove", "onmouseout", "onmouseover", "onmouseup",
    "onpause", "onplay", "onplaying", "onprogress", "onratechange", "onreset",
    "onresize", "onscroll", "onsecuritypolicyviolation", "onseeked",
    "onseeking", "onselect", "onslotchange", "onstalled", "onsubmit",
    "onsuspend", "ontimeupdate", "ontoggle", "onvolumechange", "onwaiting",
    "onwheel", "oncopy", "oncut", "onpaste",
  ];

  function getCleanedHtml() {
    const root = document.documentElement;
    if (!root) return "";

    const clone = root.cloneNode(true);

    // Remove undesirable tags
    const tagsToRemove = ["script", "style", "noscript", "iframe", "frame", "object", "embed"];
    tagsToRemove.forEach((tag) => {
      clone.querySelectorAll(tag).forEach((el) => el.remove());
    });

    // Remove link[rel="stylesheet"]
    clone.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());

    // Remove inline event handlers and style attributes from all elements
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
    let el = walker.currentNode;
    while (el) {
      INLINE_EVENT_ATTRS.forEach((attr) => {
        if (el.hasAttribute(attr)) {
          el.removeAttribute(attr);
        }
      });
      if (el.hasAttribute("style")) {
        el.removeAttribute("style");
      }
      el = walker.nextNode();
    }

    // Remove HTML comments
    const commentWalker = document.createTreeWalker(clone, NodeFilter.SHOW_COMMENT);
    const comments = [];
    let comment = commentWalker.nextNode();
    while (comment) {
      comments.push(comment);
      comment = commentWalker.nextNode();
    }
    comments.forEach((c) => c.remove());

    return clone.outerHTML || "";
  }

  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "GET_PAGE_CONTENT") {
      return undefined;
    }

    sendResponse({
      ok: true,
      text: document.body?.innerText || "",
      html: document.documentElement?.outerHTML || "",
      cleanedHtml: getCleanedHtml()
    });
    return false; // synchronous response
  });
})();
