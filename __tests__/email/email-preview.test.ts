/**
 * Tests for email preview page and campaign page pure logic.
 * All tests are pure logic — no DOM, no fetch, no React.
 *
 * Covers tasks 8.3, 8.4, 8.5, 8.6 of the email-template-generation spec.
 */

import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure logic functions (mirroring the logic in app/preview/email/page.tsx
// and app/campaigns/[id]/page.tsx)
// ---------------------------------------------------------------------------

// ── Polling constants ────────────────────────────────────────────────────────
const BASE_INTERVAL = 3000;
const MAX_INTERVAL = 10000;

// ── Types ────────────────────────────────────────────────────────────────────
type CreativeStatus = "PENDING" | "GENERATING" | "GENERATED" | "FAILED";

// ── Helper functions ─────────────────────────────────────────────────────────

function toProxiedUrl(url: string): string {
  const publicUrl = url.startsWith("gs://")
    ? url.replace("gs://", "https://storage.googleapis.com/")
    : url;
  return `/api/image-proxy?url=${encodeURIComponent(publicUrl)}`;
}

function getSubjectLine(creative: {
  subjectLine?: string | null;
  metadata?: { subject_line?: string };
}): string {
  return creative.subjectLine ?? creative.metadata?.subject_line ?? "";
}

function getPreheader(creative: {
  preheader?: string | null;
  metadata?: { preheader?: string };
}): string {
  return creative.preheader ?? creative.metadata?.preheader ?? "";
}

function getIframeWidth(previewMode: "desktop" | "mobile"): number {
  return previewMode === "desktop" ? 600 : 375;
}

function isPolling(status: CreativeStatus | null): boolean {
  return status === null || status === "PENDING" || status === "GENERATING";
}

function isFailed(status: CreativeStatus | null): boolean {
  return status === "FAILED";
}

function isReady(
  status: CreativeStatus | null,
  htmlContent: string | null
): boolean {
  return status === "GENERATED" && htmlContent !== null;
}

function getDownloadFilename(creativeId: string): string {
  return `email-${creativeId.slice(0, 8)}.html`;
}

function getPollingDelay(pollCount: number): number {
  return pollCount < 10
    ? BASE_INTERVAL
    : Math.min(BASE_INTERVAL * (pollCount - 10 + 1), MAX_INTERVAL);
}

function extractCreativeId(createResponse: {
  creative?: { id?: string };
  id?: string;
}): string | null {
  return createResponse.creative?.id ?? createResponse.id ?? null;
}

// ---------------------------------------------------------------------------
// 8.3 — iframe rendering and desktop/mobile toggle
// ---------------------------------------------------------------------------

describe("getIframeWidth — desktop/mobile toggle", () => {
  it("desktop mode returns 600", () => {
    expect(getIframeWidth("desktop")).toBe(600);
  });

  it("mobile mode returns 375", () => {
    expect(getIframeWidth("mobile")).toBe(375);
  });

  it("only two valid modes exist and they produce different widths", () => {
    const desktopWidth = getIframeWidth("desktop");
    const mobileWidth = getIframeWidth("mobile");
    expect(desktopWidth).not.toBe(mobileWidth);
  });
});

describe("isReady — iframe shown only when GENERATED + HTML loaded", () => {
  it("GENERATED + non-null HTML → true", () => {
    expect(isReady("GENERATED", "<html></html>")).toBe(true);
  });

  it("GENERATED + null HTML → false", () => {
    expect(isReady("GENERATED", null)).toBe(false);
  });

  it("PENDING + non-null HTML → false", () => {
    expect(isReady("PENDING", "<html></html>")).toBe(false);
  });

  it("GENERATING + non-null HTML → false", () => {
    expect(isReady("GENERATING", "<html></html>")).toBe(false);
  });

  it("null status + non-null HTML → false", () => {
    expect(isReady(null, "<html></html>")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8.4 — download button
// ---------------------------------------------------------------------------

describe("getDownloadFilename", () => {
  it("uses first 8 chars of creativeId", () => {
    const id = "abcdef1234567890";
    expect(getDownloadFilename(id)).toBe("email-abcdef12.html");
  });

  it("always ends with .html", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }),
        (id) => {
          return getDownloadFilename(id).endsWith(".html");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("different creativeIds produce different filenames when first 8 chars differ", () => {
    const id1 = "aaaaaaaa-rest";
    const id2 = "bbbbbbbb-rest";
    expect(getDownloadFilename(id1)).not.toBe(getDownloadFilename(id2));
  });

  it("creativeId shorter than 8 chars uses full id", () => {
    const shortId = "abc";
    expect(getDownloadFilename(shortId)).toBe("email-abc.html");
  });

  it("filename always starts with 'email-'", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 64 }),
        (id) => {
          return getDownloadFilename(id).startsWith("email-");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// 8.5 — Generate Email button flow
// ---------------------------------------------------------------------------

describe("extractCreativeId", () => {
  it("extracts from creative.id when present", () => {
    expect(extractCreativeId({ creative: { id: "creative-123" } })).toBe(
      "creative-123"
    );
  });

  it("falls back to top-level id", () => {
    expect(extractCreativeId({ id: "top-level-456" })).toBe("top-level-456");
  });

  it("returns null when neither present", () => {
    expect(extractCreativeId({})).toBeNull();
  });

  it("prefers creative.id over top-level id", () => {
    expect(
      extractCreativeId({ creative: { id: "creative-789" }, id: "top-level-000" })
    ).toBe("creative-789");
  });
});

describe("toProxiedUrl", () => {
  it("converts gs:// to https://storage.googleapis.com/", () => {
    const result = toProxiedUrl("gs://my-bucket/path/to/file.html");
    // The converted URL is percent-encoded inside the proxy wrapper
    expect(result).toBe(
      `/api/image-proxy?url=${encodeURIComponent(
        "https://storage.googleapis.com/my-bucket/path/to/file.html"
      )}`
    );
  });

  it("wraps in /api/image-proxy?url= with encoding", () => {
    const result = toProxiedUrl("https://example.com/email.html");
    expect(result).toBe(
      `/api/image-proxy?url=${encodeURIComponent("https://example.com/email.html")}`
    );
  });

  it("https:// URLs are not double-converted", () => {
    const url = "https://storage.googleapis.com/bucket/file.html";
    const result = toProxiedUrl(url);
    // Should not contain double "https://storage.googleapis.com/https://storage.googleapis.com/"
    expect(result).not.toContain("storage.googleapis.com/https://");
    expect(result).toBe(`/api/image-proxy?url=${encodeURIComponent(url)}`);
  });

  it("special characters in URL are encoded", () => {
    const url = "https://example.com/path?foo=bar&baz=qux";
    const result = toProxiedUrl(url);
    // The query string characters should be percent-encoded
    expect(result).toContain("%3F"); // '?' encoded
    expect(result).toContain("%26"); // '&' encoded
    expect(result).toContain("%3D"); // '=' encoded
  });

  it("gs:// URL is proxied via storage.googleapis.com", () => {
    const result = toProxiedUrl("gs://bucket/folder/email.html");
    expect(result).toBe(
      `/api/image-proxy?url=${encodeURIComponent(
        "https://storage.googleapis.com/bucket/folder/email.html"
      )}`
    );
  });
});

// ---------------------------------------------------------------------------
// 8.6 — Error handling
// ---------------------------------------------------------------------------

describe("isPolling — error handling states", () => {
  it("null creative (not yet loaded) → isPolling = true", () => {
    expect(isPolling(null)).toBe(true);
  });

  it("FAILED status → isPolling = false", () => {
    expect(isPolling("FAILED")).toBe(false);
  });

  it("GENERATED status → isPolling = false", () => {
    expect(isPolling("GENERATED")).toBe(false);
  });

  it("PENDING status → isPolling = true", () => {
    expect(isPolling("PENDING")).toBe(true);
  });

  it("GENERATING status → isPolling = true", () => {
    expect(isPolling("GENERATING")).toBe(true);
  });
});

describe("isFailed", () => {
  it("FAILED → true", () => {
    expect(isFailed("FAILED")).toBe(true);
  });

  it("PENDING → false", () => {
    expect(isFailed("PENDING")).toBe(false);
  });

  it("GENERATING → false", () => {
    expect(isFailed("GENERATING")).toBe(false);
  });

  it("GENERATED → false", () => {
    expect(isFailed("GENERATED")).toBe(false);
  });

  it("null → false", () => {
    expect(isFailed(null)).toBe(false);
  });
});

describe("getSubjectLine — fallback chain", () => {
  it("returns subjectLine when present", () => {
    expect(
      getSubjectLine({ subjectLine: "Hello World", metadata: { subject_line: "Other" } })
    ).toBe("Hello World");
  });

  it("falls back to metadata.subject_line when subjectLine is null", () => {
    expect(
      getSubjectLine({ subjectLine: null, metadata: { subject_line: "From Metadata" } })
    ).toBe("From Metadata");
  });

  it("returns empty string when both are absent", () => {
    expect(getSubjectLine({})).toBe("");
  });

  it("subjectLine takes priority over metadata", () => {
    const result = getSubjectLine({
      subjectLine: "Direct Subject",
      metadata: { subject_line: "Metadata Subject" },
    });
    expect(result).toBe("Direct Subject");
  });

  it("returns empty string when subjectLine is null and metadata has no subject_line", () => {
    expect(getSubjectLine({ subjectLine: null, metadata: {} })).toBe("");
  });
});

describe("getPreheader — fallback chain", () => {
  it("returns preheader when present", () => {
    expect(
      getPreheader({ preheader: "Check this out", metadata: { preheader: "Other" } })
    ).toBe("Check this out");
  });

  it("falls back to metadata.preheader when preheader is null", () => {
    expect(
      getPreheader({ preheader: null, metadata: { preheader: "Meta Preheader" } })
    ).toBe("Meta Preheader");
  });

  it("returns empty string when both are absent", () => {
    expect(getPreheader({})).toBe("");
  });

  it("preheader takes priority over metadata.preheader", () => {
    const result = getPreheader({
      preheader: "Direct Preheader",
      metadata: { preheader: "Metadata Preheader" },
    });
    expect(result).toBe("Direct Preheader");
  });
});

describe("getPollingDelay — backoff", () => {
  it("first 10 polls use BASE_INTERVAL (3000ms)", () => {
    for (let i = 0; i < 10; i++) {
      expect(getPollingDelay(i)).toBe(3000);
    }
  });

  it("poll 10 uses BASE_INTERVAL (3000ms * 1 = 3000ms)", () => {
    // pollCount=10: 10 < 10 is false, so Math.min(3000 * (10 - 10 + 1), 10000) = Math.min(3000, 10000) = 3000
    expect(getPollingDelay(10)).toBe(3000);
  });

  it("poll 11 uses 6000ms (3000 * 2)", () => {
    // pollCount=11: Math.min(3000 * (11 - 10 + 1), 10000) = Math.min(6000, 10000) = 6000
    expect(getPollingDelay(11)).toBe(6000);
  });

  it("poll 20 is capped at MAX_INTERVAL (10000ms)", () => {
    // pollCount=20: Math.min(3000 * (20 - 10 + 1), 10000) = Math.min(33000, 10000) = 10000
    expect(getPollingDelay(20)).toBe(10000);
  });

  it("delay never exceeds MAX_INTERVAL", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (pollCount) => {
          return getPollingDelay(pollCount) <= MAX_INTERVAL;
        }
      ),
      { numRuns: 200 }
    );
  });

  it("delay is always positive", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (pollCount) => {
          return getPollingDelay(pollCount) > 0;
        }
      ),
      { numRuns: 200 }
    );
  });

  it("delay is non-decreasing as pollCount increases", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        (a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          return getPollingDelay(lo) <= getPollingDelay(hi);
        }
      ),
      { numRuns: 200 }
    );
  });
});
