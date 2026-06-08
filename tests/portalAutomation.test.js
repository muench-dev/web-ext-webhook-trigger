const {
  detectPortalFromUrl,
  normalizeCandidate,
  buildCandidateWebhookPayload,
  parseCandidateMessageResponse,
  fetchCandidateMessage,
} = require("../utils/portal-automation");

describe("portal automation helpers", () => {
  test("detects Xing URLs", () => {
    expect(detectPortalFromUrl("https://www.xing.com/search/members")).toBe("xing");
    expect(detectPortalFromUrl("https://app.xing.com/profile/Example")).toBe("xing");
    expect(detectPortalFromUrl("https://www.linkedin.com/in/example")).toBe("linkedin");
  });

  test("normalizes candidate records", () => {
    expect(normalizeCandidate({ name: "  Ada Lovelace  ", url: "https://xing.com/profile/ada" }, 2)).toEqual({
      id: "candidate-3",
      name: "Ada Lovelace",
      url: "https://xing.com/profile/ada",
      source: "visible-list",
      profileText: "",
    });
  });

  test("builds candidate webhook payload", () => {
    const payload = buildCandidateWebhookPayload(
      {
        id: "profile-1",
        name: "Ada",
        url: "https://xing.com/profile/ada",
        profileText: "Senior engineer at Example GmbH",
      },
      {
        portal: "xing",
        jobKid: "KID-123",
        tab: { title: "Candidates", url: "https://xing.com/search" },
        triggeredAt: "2026-06-03T10:00:00.000Z",
      }
    );

    expect(payload).toEqual({
      portal: "xing",
      candidate: {
        id: "profile-1",
        name: "Ada",
        url: "https://xing.com/profile/ada",
        source: "visible-list",
        profileText: "Senior engineer at Example GmbH",
      },
      job_kid: "KID-123",
      tab: {
        title: "Candidates",
        url: "https://xing.com/search",
      },
      triggeredAt: "2026-06-03T10:00:00.000Z",
    });
  });

  test("parses JSON message response", async () => {
    const message = await parseCandidateMessageResponse({
      text: () => Promise.resolve(JSON.stringify({ message: "Hello candidate" })),
    });

    expect(message).toBe("Hello candidate");
  });

  test("rejects non-JSON message response", async () => {
    await expect(parseCandidateMessageResponse({
      text: () => Promise.resolve("Hello candidate"),
    })).resolves.toBe("Hello candidate");
  });

  test("uses plain text message response", async () => {
    const message = await parseCandidateMessageResponse({
      text: () => Promise.resolve("Hallo Leon, wir haben dein Profil gesehen."),
    });

    expect(message).toBe("Hallo Leon, wir haben dein Profil gesehen.");
  });

  test("fetches candidate message with POST payload", async () => {
    const fetchImpl = jest.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ message: "Draft" })),
    }));

    const message = await fetchCandidateMessage(
      {
        url: "https://hooks.example/message",
        method: "POST",
        headers: [{ key: "X-Test", value: "1" }],
      },
      { name: "Ada", url: "https://xing.com/profile/ada" },
      { portal: "xing", triggeredAt: "2026-06-03T10:00:00.000Z" },
      fetchImpl
    );

    expect(message).toBe("Draft");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://hooks.example/message",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Test": "1",
        }),
        body: expect.stringContaining('"portal":"xing"'),
      })
    );
    expect(fetchImpl.mock.calls[0][1].body).toContain('"profileText"');
  });

  test("fetches candidate message with GET payload query", async () => {
    const fetchImpl = jest.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ message: "Draft" })),
    }));

    await fetchCandidateMessage(
      { url: "https://hooks.example/message", method: "GET" },
      { name: "Ada", url: "https://xing.com/profile/ada" },
      {},
      fetchImpl
    );

    expect(fetchImpl.mock.calls[0][0]).toContain("https://hooks.example/message?payload=");
    expect(fetchImpl.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: "GET",
    }));
    expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty("body");
  });
});
