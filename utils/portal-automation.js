const PORTAL_AUTOMATION_STORAGE_KEY = "portal_automation_run";

function detectPortalFromUrl(url) {
  try {
    const parsed = new URL(url || "");
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "xing.com" || host.endsWith(".xing.com")) {
      return "xing";
    }
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
      return "linkedin";
    }
  } catch (_) {
    return null;
  }
  return null;
}

function normalizeCandidate(candidate, index = 0) {
  return {
    id: candidate?.id || `candidate-${index + 1}`,
    name: String(candidate?.name || "").trim() || `Candidate ${index + 1}`,
    url: String(candidate?.url || "").trim(),
    source: candidate?.source || "visible-list",
    profileText: String(candidate?.profileText || "").trim(),
  };
}

function buildCandidateWebhookPayload(candidate, context = {}) {
  return {
    portal: context.portal || "xing",
    candidate: normalizeCandidate(candidate),
    job_kid: context.jobKid || null,
    tab: {
      title: context.tab?.title || "",
      url: context.tab?.url || "",
    },
    triggeredAt: context.triggeredAt || new Date().toISOString(),
  };
}

async function parseCandidateMessageResponse(response) {
  const text = await response.text();
  if (!text || !text.trim()) {
    throw new Error("Message webhook returned an empty response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
    if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
  } catch (error) {
    return text.trim();
  }

  return text.trim();
}

async function fetchCandidateMessage(webhook, candidate, context = {}, fetchImpl = fetch) {
  if (!webhook || !webhook.url) {
    throw new Error("A message webhook must be selected.");
  }

  let url;
  try {
    url = new URL(webhook.url);
  } catch (_) {
    throw new Error("Invalid message webhook URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid message webhook scheme. Only http and https are allowed.");
  }

  const headers = { "Content-Type": "application/json" };
  if (Array.isArray(webhook.headers)) {
    webhook.headers.forEach((header) => {
      if (header?.key && header?.value) {
        headers[header.key] = header.value;
      }
    });
  }

  const payload = buildCandidateWebhookPayload(candidate, context);
  const method = webhook.method || "POST";
  const fetchOptions = {
    method,
    headers,
  };

  let fetchUrl = url.toString();
  if (method === "GET") {
    url.searchParams.set("payload", encodeURIComponent(JSON.stringify(payload)));
    fetchUrl = url.toString();
  } else {
    fetchOptions.body = JSON.stringify(payload);
  }

  const response = await fetchImpl(fetchUrl, fetchOptions);
  if (!response.ok) {
    throw new Error(`Message webhook returned HTTP ${response.status}.`);
  }

  return parseCandidateMessageResponse(response);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PORTAL_AUTOMATION_STORAGE_KEY,
    detectPortalFromUrl,
    normalizeCandidate,
    buildCandidateWebhookPayload,
    parseCandidateMessageResponse,
    fetchCandidateMessage,
  };
} else {
  globalThis.PORTAL_AUTOMATION_STORAGE_KEY = PORTAL_AUTOMATION_STORAGE_KEY;
  globalThis.detectPortalFromUrl = detectPortalFromUrl;
  globalThis.normalizeCandidate = normalizeCandidate;
  globalThis.buildCandidateWebhookPayload = buildCandidateWebhookPayload;
  globalThis.parseCandidateMessageResponse = parseCandidateMessageResponse;
  globalThis.fetchCandidateMessage = fetchCandidateMessage;
}
