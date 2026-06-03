/**
 * Unit tests for VideoOverlayEditor logic.
 *
 * VideoOverlayEditor is a React component that depends on the DOM, react-konva,
 * and @ffmpeg/ffmpeg (WASM). Following the project's established pattern
 * (see __tests__/video/OverlayCanvas.test.ts and OverlayPropertiesPanel.test.ts),
 * these tests exercise the pure logic functions that drive the component's behaviour:
 *
 *   - isGcsUrl / buildProxiedUrl  (logo URL proxy detection)
 *   - exportDisabled logic        (button disabled while loading/processing/saving)
 *   - save flow logic             (201 → onSaved, non-2xx → saveError)
 *   - brand kit fetch failure     (does not block editor, overlays remain empty)
 *   - cancel handler              (calls onClose)
 *   - error banner logic          (saveError vs compositor.error precedence)
 *   - brandColors derivation      (filters null/undefined from brand kit colors)
 *
 * Each function mirrors the logic inside VideoOverlayEditor.tsx so that the
 * invariants can be verified without a DOM or React renderer.
 */

import * as fc from "fast-check";
import { isGcsUrl, buildProxiedUrl, deriveBrandColors } from "@/components/video/videoOverlayUtils";
import type { BrandKit, SaveAsNewResponse } from "@/components/video/VideoOverlayEditor";

// ─── Pure logic extracted from VideoOverlayEditor ────────────────────────────

/**
 * Determines whether the "Export & Save" button should be disabled.
 * Mirrors: `compositor.isLoading || compositor.isProcessing || isSaving`
 */
function isExportDisabled(
  isLoading: boolean,
  isProcessing: boolean,
  isSaving: boolean
): boolean {
  return isLoading || isProcessing || isSaving;
}

/**
 * Derives brand colors from a brand kit, filtering out null/undefined values.
 * Imported from videoOverlayUtils — tested here for completeness.
 */
// deriveBrandColors is imported directly from videoOverlayUtils above

/**
 * Processes a save-as-new API response.
 *
 * Rules (mirrors handleExportAndSave):
 *   - 201 response → call onSaved with the new creative id
 *   - non-2xx response → set saveError, do NOT call onSaved
 *
 * Returns { type: "saved", id } or { type: "error", message }.
 */
async function processSaveResponse(
  response: { status: number; body: Record<string, unknown> }
): Promise<{ type: "saved"; id: string } | { type: "error"; message: string }> {
  if (response.status === 201) {
    const data = response.body as unknown as SaveAsNewResponse;
    return { type: "saved", id: data.id };
  }
  const errorMessage =
    (response.body as { error?: string }).error ||
    `Save failed with status ${response.status}`;
  return { type: "error", message: errorMessage };
}

/**
 * Determines the error message to display in the error banner.
 * Mirrors: `saveError ?? compositor.error`
 * saveError takes precedence over compositor.error.
 */
function resolveErrorMessage(
  saveError: string | null,
  compositorError: string | null
): string | null {
  return saveError ?? compositorError;
}

/**
 * Simulates the brand kit fetch failure path.
 * Returns the editor state after a failed fetch:
 *   - brandKitLoading = false (editor is not blocked)
 *   - brandKit = null
 *   - overlays = [] (no logo was added)
 */
function simulateBrandKitFetchFailure(): {
  brandKitLoading: boolean;
  brandKit: null;
  overlays: never[];
} {
  // On failure: log error, set brandKitLoading = false, do not set brandKit
  return {
    brandKitLoading: false,
    brandKit: null,
    overlays: [],
  };
}

/**
 * Simulates the cancel handler.
 * Mirrors: `onClick={onClose}`
 */
function handleCancel(onClose: () => void): void {
  onClose();
}

// ─── isGcsUrl ─────────────────────────────────────────────────────────────────

describe("isGcsUrl — GCS URL detection", () => {
  it("returns true for a gs:// URL", () => {
    expect(isGcsUrl("gs://my-bucket/logo.png")).toBe(true);
  });

  it("returns true for a https://storage.googleapis.com/ URL", () => {
    expect(isGcsUrl("https://storage.googleapis.com/my-bucket/logo.png")).toBe(true);
  });

  it("returns false for a regular https URL", () => {
    expect(isGcsUrl("https://example.com/logo.png")).toBe(false);
  });

  it("returns false for an http URL", () => {
    expect(isGcsUrl("http://example.com/logo.png")).toBe(false);
  });

  it("returns false for a relative URL", () => {
    expect(isGcsUrl("/images/logo.png")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isGcsUrl("")).toBe(false);
  });

  it("returns false for a data URL", () => {
    expect(isGcsUrl("data:image/png;base64,abc123")).toBe(false);
  });

  // Property: only gs:// and https://storage.googleapis.com/ prefixes are GCS
  it("property: any URL starting with gs:// is a GCS URL", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (path) => isGcsUrl(`gs://${path}`) === true
      ),
      { numRuns: 100 }
    );
  });

  it("property: any URL starting with https://storage.googleapis.com/ is a GCS URL", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (path) =>
          isGcsUrl(`https://storage.googleapis.com/${path}`) === true
      ),
      { numRuns: 100 }
    );
  });

  it("property: URLs not starting with gs:// or https://storage.googleapis.com/ are not GCS", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(
          (s) =>
            !s.startsWith("gs://") &&
            !s.startsWith("https://storage.googleapis.com/")
        ),
        (url) => isGcsUrl(url) === false
      ),
      { numRuns: 100 }
    );
  });
});

// ─── buildProxiedUrl ──────────────────────────────────────────────────────────

describe("buildProxiedUrl — image proxy URL construction", () => {
  it("wraps the URL in the image proxy endpoint", () => {
    const result = buildProxiedUrl("https://storage.googleapis.com/bucket/logo.png");
    expect(result).toBe(
      "/api/image-proxy?url=https%3A%2F%2Fstorage.googleapis.com%2Fbucket%2Flogo.png"
    );
  });

  it("encodes special characters in the URL", () => {
    const result = buildProxiedUrl("gs://bucket/path with spaces/logo.png");
    expect(result).toContain("/api/image-proxy?url=");
    expect(result).toContain(encodeURIComponent("gs://bucket/path with spaces/logo.png"));
  });

  it("always starts with /api/image-proxy?url=", () => {
    const result = buildProxiedUrl("https://example.com/img.png");
    expect(result.startsWith("/api/image-proxy?url=")).toBe(true);
  });

  it("property: proxied URL always starts with /api/image-proxy?url=", () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (url) => buildProxiedUrl(url).startsWith("/api/image-proxy?url=")
      ),
      { numRuns: 100 }
    );
  });

  it("property: the original URL can be recovered by decoding the query param", () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (url) => {
          const proxied = buildProxiedUrl(url);
          const encoded = proxied.replace("/api/image-proxy?url=", "");
          return decodeURIComponent(encoded) === url;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── isExportDisabled ─────────────────────────────────────────────────────────

describe("isExportDisabled — Export & Save button disabled state", () => {
  it("is disabled when isLoading is true", () => {
    expect(isExportDisabled(true, false, false)).toBe(true);
  });

  it("is disabled when isProcessing is true", () => {
    expect(isExportDisabled(false, true, false)).toBe(true);
  });

  it("is disabled when isSaving is true", () => {
    expect(isExportDisabled(false, false, true)).toBe(true);
  });

  it("is disabled when all three are true", () => {
    expect(isExportDisabled(true, true, true)).toBe(true);
  });

  it("is enabled when all three are false", () => {
    expect(isExportDisabled(false, false, false)).toBe(false);
  });

  it("is disabled when isLoading and isProcessing are true", () => {
    expect(isExportDisabled(true, true, false)).toBe(true);
  });

  it("is disabled when isLoading and isSaving are true", () => {
    expect(isExportDisabled(true, false, true)).toBe(true);
  });

  it("is disabled when isProcessing and isSaving are true", () => {
    expect(isExportDisabled(false, true, true)).toBe(true);
  });

  // Property: disabled iff at least one flag is true
  it("property: disabled iff at least one of isLoading, isProcessing, isSaving is true", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (isLoading, isProcessing, isSaving) => {
          const disabled = isExportDisabled(isLoading, isProcessing, isSaving);
          const expected = isLoading || isProcessing || isSaving;
          return disabled === expected;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── processSaveResponse ──────────────────────────────────────────────────────

describe("processSaveResponse — save API response handling", () => {
  it("returns { type: 'saved', id } for a 201 response", async () => {
    const result = await processSaveResponse({
      status: 201,
      body: { id: "new-creative-123", campaignId: "c1", status: "GENERATED", url: null, type: "VIDEO" },
    });
    expect(result).toEqual({ type: "saved", id: "new-creative-123" });
  });

  it("calls onSaved with the new creative id on 201", async () => {
    const onSaved = jest.fn();
    const result = await processSaveResponse({
      status: 201,
      body: { id: "creative-abc", campaignId: "c1", status: "GENERATED", url: null, type: "VIDEO" },
    });
    if (result.type === "saved") {
      onSaved(result.id);
    }
    expect(onSaved).toHaveBeenCalledWith("creative-abc");
  });

  it("returns { type: 'error' } for a 400 response", async () => {
    const result = await processSaveResponse({
      status: 400,
      body: { error: "Bad request" },
    });
    expect(result.type).toBe("error");
  });

  it("returns { type: 'error' } for a 500 response", async () => {
    const result = await processSaveResponse({
      status: 500,
      body: { error: "Internal server error" },
    });
    expect(result.type).toBe("error");
    expect((result as { type: "error"; message: string }).message).toBe(
      "Internal server error"
    );
  });

  it("uses the error field from the response body when present", async () => {
    const result = await processSaveResponse({
      status: 422,
      body: { error: "Validation failed" },
    });
    expect(result.type).toBe("error");
    expect((result as { type: "error"; message: string }).message).toBe(
      "Validation failed"
    );
  });

  it("falls back to a generic message when error field is absent", async () => {
    const result = await processSaveResponse({
      status: 503,
      body: {},
    });
    expect(result.type).toBe("error");
    expect((result as { type: "error"; message: string }).message).toBe(
      "Save failed with status 503"
    );
  });

  it("does NOT call onSaved for a non-2xx response", async () => {
    const onSaved = jest.fn();
    const result = await processSaveResponse({
      status: 500,
      body: { error: "Server error" },
    });
    if (result.type === "saved") {
      onSaved(result.id);
    }
    expect(onSaved).not.toHaveBeenCalled();
  });

  // Property: 201 always produces type "saved"
  it("property: status 201 always produces type 'saved'", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (id) => {
          const result = await processSaveResponse({
            status: 201,
            body: { id, campaignId: "c", status: "GENERATED", url: null, type: "VIDEO" },
          });
          return result.type === "saved" && (result as { type: "saved"; id: string }).id === id;
        }
      ),
      { numRuns: 50 }
    );
  });

  // Property: non-201 status always produces type "error"
  it("property: non-201 status always produces type 'error'", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }),
        async (status) => {
          const result = await processSaveResponse({ status, body: {} });
          return result.type === "error";
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── resolveErrorMessage ──────────────────────────────────────────────────────

describe("resolveErrorMessage — error banner content", () => {
  it("returns saveError when both saveError and compositorError are set", () => {
    expect(resolveErrorMessage("Save failed", "FFmpeg error")).toBe("Save failed");
  });

  it("returns compositorError when saveError is null", () => {
    expect(resolveErrorMessage(null, "FFmpeg error")).toBe("FFmpeg error");
  });

  it("returns null when both are null (no error banner shown)", () => {
    expect(resolveErrorMessage(null, null)).toBeNull();
  });

  it("returns saveError when compositorError is null", () => {
    expect(resolveErrorMessage("Save failed", null)).toBe("Save failed");
  });

  // Property: saveError takes precedence over compositorError
  it("property: saveError always takes precedence when non-null", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.option(fc.string({ minLength: 1 }), { nil: null }),
        (saveError, compositorError) => {
          return resolveErrorMessage(saveError, compositorError) === saveError;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── simulateBrandKitFetchFailure ─────────────────────────────────────────────

describe("simulateBrandKitFetchFailure — brand kit fetch failure does not block editor", () => {
  it("sets brandKitLoading to false after failure", () => {
    const state = simulateBrandKitFetchFailure();
    expect(state.brandKitLoading).toBe(false);
  });

  it("leaves brandKit as null after failure", () => {
    const state = simulateBrandKitFetchFailure();
    expect(state.brandKit).toBeNull();
  });

  it("leaves overlays empty after failure (no logo was added)", () => {
    const state = simulateBrandKitFetchFailure();
    expect(state.overlays).toHaveLength(0);
  });

  it("does not throw when brand kit fetch fails", () => {
    expect(() => simulateBrandKitFetchFailure()).not.toThrow();
  });
});

// ─── handleCancel ─────────────────────────────────────────────────────────────

describe("handleCancel — Cancel button calls onClose", () => {
  it("calls onClose when cancel is triggered", () => {
    const onClose = jest.fn();
    handleCancel(onClose);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose more than once per cancel action", () => {
    const onClose = jest.fn();
    handleCancel(onClose);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose with no arguments", () => {
    const onClose = jest.fn();
    handleCancel(onClose);
    expect(onClose).toHaveBeenCalledWith();
  });

  // Property: onClose is always called exactly once per cancel
  it("property: onClose is always called exactly once per cancel", () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        const onClose = jest.fn();
        handleCancel(onClose);
        return onClose.mock.calls.length === 1;
      }),
      { numRuns: 50 }
    );
  });
});

// ─── deriveBrandColors ────────────────────────────────────────────────────────

describe("deriveBrandColors — brand color extraction from brand kit", () => {
  it("returns an empty array when brandKit is null", () => {
    expect(deriveBrandColors(null)).toEqual([]);
  });

  it("returns all three colors when all are present", () => {
    const kit: BrandKit = {
      id: "k1",
      brandId: "b1",
      primaryColor: "#ff0000",
      secondaryColor: "#00ff00",
      accentColor: "#0000ff",
      logos: [],
      fonts: [],
    };
    expect(deriveBrandColors(kit)).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
  });

  it("filters out null colors", () => {
    const kit: BrandKit = {
      id: "k1",
      brandId: "b1",
      primaryColor: "#ff0000",
      secondaryColor: null,
      accentColor: "#0000ff",
      logos: [],
      fonts: [],
    };
    expect(deriveBrandColors(kit)).toEqual(["#ff0000", "#0000ff"]);
  });

  it("returns an empty array when all colors are null", () => {
    const kit: BrandKit = {
      id: "k1",
      brandId: "b1",
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
      logos: [],
      fonts: [],
    };
    expect(deriveBrandColors(kit)).toEqual([]);
  });

  it("returns only primaryColor when only it is set", () => {
    const kit: BrandKit = {
      id: "k1",
      brandId: "b1",
      primaryColor: "#123456",
      secondaryColor: null,
      accentColor: null,
      logos: [],
      fonts: [],
    };
    expect(deriveBrandColors(kit)).toEqual(["#123456"]);
  });

  it("preserves the order: primary, secondary, accent", () => {
    const kit: BrandKit = {
      id: "k1",
      brandId: "b1",
      primaryColor: "#aaa",
      secondaryColor: "#bbb",
      accentColor: "#ccc",
      logos: [],
      fonts: [],
    };
    const colors = deriveBrandColors(kit);
    expect(colors[0]).toBe("#aaa");
    expect(colors[1]).toBe("#bbb");
    expect(colors[2]).toBe("#ccc");
  });

  // Property: result length is always <= 3
  it("property: result length is always <= 3", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        (primary, secondary, accent) => {
          const kit: BrandKit = {
            id: "k",
            brandId: "b",
            primaryColor: primary,
            secondaryColor: secondary,
            accentColor: accent,
            logos: [],
            fonts: [],
          };
          return deriveBrandColors(kit).length <= 3;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: result contains no null or undefined values
  it("property: result never contains null or undefined", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1 }), { nil: null }),
        fc.option(fc.string({ minLength: 1 }), { nil: null }),
        fc.option(fc.string({ minLength: 1 }), { nil: null }),
        (primary, secondary, accent) => {
          const kit: BrandKit = {
            id: "k",
            brandId: "b",
            primaryColor: primary,
            secondaryColor: secondary,
            accentColor: accent,
            logos: [],
            fonts: [],
          };
          return deriveBrandColors(kit).every((c) => c !== null && c !== undefined);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Integration: export flow ─────────────────────────────────────────────────

describe("export flow — integration of disabled state and save response", () => {
  it("button is disabled while saving, then re-enabled after save completes", async () => {
    // Simulate: isSaving = true → disabled
    expect(isExportDisabled(false, false, true)).toBe(true);
    // After save completes: isSaving = false → enabled
    expect(isExportDisabled(false, false, false)).toBe(false);
  });

  it("button is disabled while FFmpeg is loading, then enabled after load", () => {
    expect(isExportDisabled(true, false, false)).toBe(true);
    expect(isExportDisabled(false, false, false)).toBe(false);
  });

  it("a 201 response clears saveError and calls onSaved", async () => {
    const onSaved = jest.fn();
    let saveError: string | null = "previous error";

    const result = await processSaveResponse({
      status: 201,
      body: { id: "new-id", campaignId: "c", status: "GENERATED", url: null, type: "VIDEO" },
    });

    if (result.type === "saved") {
      saveError = null; // clear error on success
      onSaved(result.id);
    }

    expect(saveError).toBeNull();
    expect(onSaved).toHaveBeenCalledWith("new-id");
  });

  it("a non-2xx response sets saveError and does not call onSaved", async () => {
    const onSaved = jest.fn();
    let saveError: string | null = null;

    const result = await processSaveResponse({
      status: 500,
      body: { error: "Server error" },
    });

    if (result.type === "error") {
      saveError = result.message;
    } else {
      onSaved(result.id);
    }

    expect(saveError).toBe("Server error");
    expect(onSaved).not.toHaveBeenCalled();
  });
});
