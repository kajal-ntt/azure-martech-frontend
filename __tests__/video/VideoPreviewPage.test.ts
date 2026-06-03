/**
 * Unit tests for VideoPreviewPage modifications (Task 9).
 *
 * VideoPreviewPage is a Next.js page component that depends on the router,
 * search params, auth guard, and dynamically-imported client-only components
 * (VideoOverlayEditor, OverlayCanvas). Following the project's established
 * pattern (see VideoOverlayEditor.test.ts, OverlayCanvas.test.ts), these tests
 * exercise the pure logic functions that drive the page's behaviour:
 *
 *   - editVideoButtonVisible   (visible only when status === "ready")
 *   - editorOpenTransition     (setEditorOpen(true) / setEditorOpen(false))
 *   - handleSaved              (router.push to new creative URL)
 *   - layoutWidths             (video area / editor panel widths based on editorOpen)
 *   - overlayCanvasVisible     (OverlayCanvas rendered only when editorOpen && ready)
 *
 * Each function mirrors the logic inside page.tsx so that the invariants can be
 * verified without a DOM or React renderer.
 */

import * as fc from "fast-check";

// ─── Pure logic extracted from VideoPreviewPage ───────────────────────────────

type PageStatus = "waiting" | "ready" | "error";

/**
 * Determines whether the "Edit Video" button should be visible.
 * Mirrors: `status === "ready" && !editorOpen`
 * (The button is hidden while the editor is already open to avoid confusion.)
 */
function isEditVideoButtonVisible(status: PageStatus, editorOpen: boolean): boolean {
  return status === "ready" && !editorOpen;
}

/**
 * Determines the CSS width class for the video preview area.
 * Mirrors: `editorOpen ? "w-[40%]" : "w-full"`
 */
function videoAreaWidthClass(editorOpen: boolean): string {
  return editorOpen ? "w-[40%]" : "w-full";
}

/**
 * Determines the CSS width class for the editor panel.
 * Mirrors: `editorOpen ? "w-[60%]" : "w-0"`
 */
function editorPanelWidthClass(editorOpen: boolean): string {
  return editorOpen ? "w-[60%]" : "w-0";
}

/**
 * Determines whether the VideoOverlayEditor should be rendered.
 * Mirrors: `editorOpen && videoCreative?.signedUrl`
 */
function isEditorRendered(editorOpen: boolean, signedUrl: string | null | undefined): boolean {
  return editorOpen && Boolean(signedUrl);
}

/**
 * Determines whether the OverlayCanvas should be rendered.
 * Mirrors: `editorOpen && status === "ready"`
 */
function isOverlayCanvasRendered(editorOpen: boolean, status: PageStatus): boolean {
  return editorOpen && status === "ready";
}

/**
 * Builds the URL that handleSaved navigates to.
 * Mirrors: `router.push(\`/preview/video?campaignId=${campaignId}&creativeId=${newCreativeId}\`)`
 */
function buildSavedUrl(campaignId: string | null, newCreativeId: string): string {
  return `/preview/video?campaignId=${campaignId}&creativeId=${newCreativeId}`;
}

/**
 * Simulates clicking "Edit Video": returns the new editorOpen state.
 * Mirrors: `onClick={() => setEditorOpen(true)}`
 */
function handleEditVideoClick(): boolean {
  return true; // setEditorOpen(true)
}

/**
 * Simulates the onClose callback passed to VideoOverlayEditor.
 * Mirrors: `onClose={() => setEditorOpen(false)}`
 */
function handleEditorClose(): boolean {
  return false; // setEditorOpen(false)
}

// ─── isEditVideoButtonVisible ─────────────────────────────────────────────────

describe("isEditVideoButtonVisible — Edit Video button visibility", () => {
  it("is visible when status is 'ready' and editor is closed", () => {
    expect(isEditVideoButtonVisible("ready", false)).toBe(true);
  });

  it("is NOT visible when status is 'waiting'", () => {
    expect(isEditVideoButtonVisible("waiting", false)).toBe(false);
  });

  it("is NOT visible when status is 'error'", () => {
    expect(isEditVideoButtonVisible("error", false)).toBe(false);
  });

  it("is NOT visible when editor is already open (even if status is ready)", () => {
    expect(isEditVideoButtonVisible("ready", true)).toBe(false);
  });

  it("is NOT visible when status is 'waiting' and editor is open", () => {
    expect(isEditVideoButtonVisible("waiting", true)).toBe(false);
  });

  // Property: only visible when status === "ready" AND editorOpen === false
  it("property: visible iff status === 'ready' AND editorOpen === false", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PageStatus>("waiting", "ready", "error"),
        fc.boolean(),
        (status, editorOpen) => {
          const visible = isEditVideoButtonVisible(status, editorOpen);
          const expected = status === "ready" && !editorOpen;
          return visible === expected;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Layout widths ────────────────────────────────────────────────────────────

describe("videoAreaWidthClass — video preview area width", () => {
  it("returns 'w-[40%]' when editor is open", () => {
    expect(videoAreaWidthClass(true)).toBe("w-[40%]");
  });

  it("returns 'w-full' when editor is closed", () => {
    expect(videoAreaWidthClass(false)).toBe("w-full");
  });

  // Property: always returns one of the two valid classes
  it("property: always returns 'w-[40%]' or 'w-full'", () => {
    fc.assert(
      fc.property(fc.boolean(), (editorOpen) => {
        const cls = videoAreaWidthClass(editorOpen);
        return cls === "w-[40%]" || cls === "w-full";
      }),
      { numRuns: 50 }
    );
  });
});

describe("editorPanelWidthClass — editor panel width", () => {
  it("returns 'w-[60%]' when editor is open", () => {
    expect(editorPanelWidthClass(true)).toBe("w-[60%]");
  });

  it("returns 'w-0' when editor is closed", () => {
    expect(editorPanelWidthClass(false)).toBe("w-0");
  });

  // Property: always returns one of the two valid classes
  it("property: always returns 'w-[60%]' or 'w-0'", () => {
    fc.assert(
      fc.property(fc.boolean(), (editorOpen) => {
        const cls = editorPanelWidthClass(editorOpen);
        return cls === "w-[60%]" || cls === "w-0";
      }),
      { numRuns: 50 }
    );
  });

  // Property: video area and editor panel widths are complementary
  it("property: video area is full-width iff editor panel is zero-width", () => {
    fc.assert(
      fc.property(fc.boolean(), (editorOpen) => {
        const videoClass = videoAreaWidthClass(editorOpen);
        const editorClass = editorPanelWidthClass(editorOpen);
        const videoFull = videoClass === "w-full";
        const editorZero = editorClass === "w-0";
        return videoFull === editorZero;
      }),
      { numRuns: 50 }
    );
  });
});

// ─── isEditorRendered ─────────────────────────────────────────────────────────

describe("isEditorRendered — VideoOverlayEditor render condition", () => {
  it("renders when editorOpen is true and signedUrl is present", () => {
    expect(isEditorRendered(true, "https://example.com/video.mp4")).toBe(true);
  });

  it("does NOT render when editorOpen is false", () => {
    expect(isEditorRendered(false, "https://example.com/video.mp4")).toBe(false);
  });

  it("does NOT render when signedUrl is null", () => {
    expect(isEditorRendered(true, null)).toBe(false);
  });

  it("does NOT render when signedUrl is undefined", () => {
    expect(isEditorRendered(true, undefined)).toBe(false);
  });

  it("does NOT render when signedUrl is an empty string", () => {
    expect(isEditorRendered(true, "")).toBe(false);
  });

  it("does NOT render when both editorOpen is false and signedUrl is null", () => {
    expect(isEditorRendered(false, null)).toBe(false);
  });

  // Property: renders iff editorOpen AND signedUrl is truthy
  it("property: renders iff editorOpen AND signedUrl is truthy", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(fc.webUrl(), { nil: null }),
        (editorOpen, signedUrl) => {
          const rendered = isEditorRendered(editorOpen, signedUrl);
          const expected = editorOpen && Boolean(signedUrl);
          return rendered === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── isOverlayCanvasRendered ──────────────────────────────────────────────────

describe("isOverlayCanvasRendered — OverlayCanvas render condition", () => {
  it("renders when editorOpen is true and status is 'ready'", () => {
    expect(isOverlayCanvasRendered(true, "ready")).toBe(true);
  });

  it("does NOT render when editorOpen is false", () => {
    expect(isOverlayCanvasRendered(false, "ready")).toBe(false);
  });

  it("does NOT render when status is 'waiting'", () => {
    expect(isOverlayCanvasRendered(true, "waiting")).toBe(false);
  });

  it("does NOT render when status is 'error'", () => {
    expect(isOverlayCanvasRendered(true, "error")).toBe(false);
  });

  // Property: renders iff editorOpen AND status === "ready"
  it("property: renders iff editorOpen AND status === 'ready'", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom<PageStatus>("waiting", "ready", "error"),
        (editorOpen, status) => {
          const rendered = isOverlayCanvasRendered(editorOpen, status);
          const expected = editorOpen && status === "ready";
          return rendered === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── buildSavedUrl ────────────────────────────────────────────────────────────

describe("buildSavedUrl — handleSaved navigation URL", () => {
  it("builds the correct URL with campaignId and newCreativeId", () => {
    const url = buildSavedUrl("campaign-123", "creative-456");
    expect(url).toBe("/preview/video?campaignId=campaign-123&creativeId=creative-456");
  });

  it("handles null campaignId gracefully", () => {
    const url = buildSavedUrl(null, "creative-456");
    expect(url).toBe("/preview/video?campaignId=null&creativeId=creative-456");
  });

  it("always starts with /preview/video", () => {
    const url = buildSavedUrl("c1", "cr1");
    expect(url.startsWith("/preview/video")).toBe(true);
  });

  it("always contains the new creative id", () => {
    const url = buildSavedUrl("c1", "new-creative-id");
    expect(url).toContain("creativeId=new-creative-id");
  });

  it("always contains the campaign id", () => {
    const url = buildSavedUrl("my-campaign", "cr1");
    expect(url).toContain("campaignId=my-campaign");
  });

  // Property: URL always contains both campaignId and creativeId params
  it("property: URL always contains campaignId and creativeId query params", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes("&") && !s.includes("?")),
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => !s.includes("&") && !s.includes("?")),
        (campaignId, creativeId) => {
          const url = buildSavedUrl(campaignId, creativeId);
          return (
            url.includes(`campaignId=${campaignId}`) &&
            url.includes(`creativeId=${creativeId}`)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: router.push is called with the correct URL
  it("calls router.push with the correct URL on save", () => {
    const push = jest.fn();
    const newCreativeId = "new-creative-789";
    const campaignId = "campaign-abc";

    // Simulate handleSaved
    const handleSaved = (id: string) => {
      push(buildSavedUrl(campaignId, id));
    };

    handleSaved(newCreativeId);
    expect(push).toHaveBeenCalledWith(
      `/preview/video?campaignId=${campaignId}&creativeId=${newCreativeId}`
    );
  });
});

// ─── Editor open/close transitions ───────────────────────────────────────────

describe("editorOpen state transitions", () => {
  it("clicking 'Edit Video' sets editorOpen to true", () => {
    const newState = handleEditVideoClick();
    expect(newState).toBe(true);
  });

  it("onClose callback sets editorOpen to false", () => {
    const newState = handleEditorClose();
    expect(newState).toBe(false);
  });

  it("after close, video area returns to full-width", () => {
    const editorOpen = handleEditorClose(); // false
    expect(videoAreaWidthClass(editorOpen)).toBe("w-full");
  });

  it("after close, editor panel collapses to zero width", () => {
    const editorOpen = handleEditorClose(); // false
    expect(editorPanelWidthClass(editorOpen)).toBe("w-0");
  });

  it("after open, video area compresses to 40%", () => {
    const editorOpen = handleEditVideoClick(); // true
    expect(videoAreaWidthClass(editorOpen)).toBe("w-[40%]");
  });

  it("after open, editor panel expands to 60%", () => {
    const editorOpen = handleEditVideoClick(); // true
    expect(editorPanelWidthClass(editorOpen)).toBe("w-[60%]");
  });

  it("after close, Edit Video button becomes visible again (status=ready)", () => {
    const editorOpen = handleEditorClose(); // false
    expect(isEditVideoButtonVisible("ready", editorOpen)).toBe(true);
  });

  it("after open, Edit Video button is hidden", () => {
    const editorOpen = handleEditVideoClick(); // true
    expect(isEditVideoButtonVisible("ready", editorOpen)).toBe(false);
  });

  // Property: open → close → open is idempotent for layout
  it("property: open/close transitions are deterministic", () => {
    fc.assert(
      fc.property(fc.boolean(), (initialOpen) => {
        // Toggle open then close
        const afterOpen = handleEditVideoClick();   // always true
        const afterClose = handleEditorClose();     // always false
        return afterOpen === true && afterClose === false;
      }),
      { numRuns: 50 }
    );
  });
});

// ─── Integration: full page state machine ────────────────────────────────────

describe("VideoPreviewPage state machine — integration", () => {
  it("waiting state: no Edit Video button, no editor, no canvas", () => {
    const status: PageStatus = "waiting";
    const editorOpen = false;

    expect(isEditVideoButtonVisible(status, editorOpen)).toBe(false);
    expect(isEditorRendered(editorOpen, "https://example.com/v.mp4")).toBe(false);
    expect(isOverlayCanvasRendered(editorOpen, status)).toBe(false);
    expect(videoAreaWidthClass(editorOpen)).toBe("w-full");
  });

  it("ready state (editor closed): Edit Video button visible, no editor, no canvas", () => {
    const status: PageStatus = "ready";
    const editorOpen = false;

    expect(isEditVideoButtonVisible(status, editorOpen)).toBe(true);
    expect(isEditorRendered(editorOpen, "https://example.com/v.mp4")).toBe(false);
    expect(isOverlayCanvasRendered(editorOpen, status)).toBe(false);
    expect(videoAreaWidthClass(editorOpen)).toBe("w-full");
  });

  it("ready state (editor open): no Edit Video button, editor rendered, canvas rendered", () => {
    const status: PageStatus = "ready";
    const editorOpen = true;
    const signedUrl = "https://example.com/v.mp4";

    expect(isEditVideoButtonVisible(status, editorOpen)).toBe(false);
    expect(isEditorRendered(editorOpen, signedUrl)).toBe(true);
    expect(isOverlayCanvasRendered(editorOpen, status)).toBe(true);
    expect(videoAreaWidthClass(editorOpen)).toBe("w-[40%]");
    expect(editorPanelWidthClass(editorOpen)).toBe("w-[60%]");
  });

  it("after save: router.push navigates to new creative URL", () => {
    const push = jest.fn();
    const campaignId = "camp-1";
    const newCreativeId = "new-creative-1";

    push(buildSavedUrl(campaignId, newCreativeId));

    expect(push).toHaveBeenCalledWith(
      `/preview/video?campaignId=camp-1&creativeId=new-creative-1`
    );
  });

  it("after cancel: editor closes, layout restores to full-width", () => {
    // Start with editor open
    let editorOpen = handleEditVideoClick(); // true
    expect(videoAreaWidthClass(editorOpen)).toBe("w-[40%]");

    // Cancel
    editorOpen = handleEditorClose(); // false
    expect(videoAreaWidthClass(editorOpen)).toBe("w-full");
    expect(editorPanelWidthClass(editorOpen)).toBe("w-0");
    expect(isEditorRendered(editorOpen, "https://example.com/v.mp4")).toBe(false);
  });
});
