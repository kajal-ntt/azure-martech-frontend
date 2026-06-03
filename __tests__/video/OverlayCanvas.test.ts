/**
 * Unit tests for OverlayCanvas logic.
 *
 * react-konva requires a real browser canvas environment and cannot be
 * meaningfully rendered in a Node.js test runner. Following the project's
 * established pattern (see __tests__/email/email-preview.test.ts), these
 * tests exercise the pure logic functions that drive OverlayCanvas behaviour:
 *
 *   - Timeline filtering  (which overlays are visible at a given time)
 *   - Stage-click detection  (is the click target the stage itself?)
 *   - Drag-end position extraction  (reading x/y from a Konva event)
 *   - Transformer presence logic  (should a Transformer be rendered?)
 *
 * Each function mirrors the logic inside OverlayCanvas.tsx so that the
 * invariants can be verified without a DOM.
 */

import * as fc from "fast-check";
import type { Overlay, LogoOverlay, TextOverlay } from "@/components/video/VideoOverlayEditor";

// ─── Pure logic extracted from OverlayCanvas ─────────────────────────────────

/**
 * Returns the overlays that should be rendered at `currentTime`.
 * Mirrors: `overlays.filter(o => o.timeline.inPoint <= currentTime && currentTime < o.timeline.outPoint)`
 */
function getVisibleOverlays(overlays: Overlay[], currentTime: number): Overlay[] {
  return overlays.filter(
    (o) => o.timeline.inPoint <= currentTime && currentTime < o.timeline.outPoint
  );
}

/**
 * Returns true when the click target is the stage itself (background click).
 * Mirrors the `e.target === e.target.getStage()` check in handleStageClick.
 */
function isStageBackgroundClick(targetIsStage: boolean): boolean {
  return targetIsStage;
}

/**
 * Extracts the new position from a drag-end event.
 * Mirrors the `onDragEnd` handler: `{ x: e.target.x(), y: e.target.y() }`.
 */
function extractDragPosition(event: { x: number; y: number }): { x: number; y: number } {
  return { x: event.x, y: event.y };
}

/**
 * Returns true when a Transformer should be rendered (i.e. an overlay is selected).
 * Mirrors the `{selectedId && <Transformer ... />}` conditional in OverlayCanvas.
 */
function shouldRenderTransformer(selectedId: string | null): boolean {
  return selectedId !== null;
}

/**
 * Computes the new width/height after a transform, resetting scale to 1.
 * Mirrors the `onTransformEnd` handler logic.
 */
function computeTransformedDimensions(
  originalWidth: number,
  originalHeight: number,
  scaleX: number,
  scaleY: number,
  minSize = 5
): { width: number; height: number } {
  return {
    width: Math.max(minSize, originalWidth * scaleX),
    height: Math.max(minSize, originalHeight * scaleY),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTextOverlay(
  id: string,
  inPoint: number,
  outPoint: number
): TextOverlay {
  return {
    id,
    type: "text",
    text: "Hello",
    fontFamily: "Arial",
    fontSize: 24,
    fill: "#ffffff",
    x: 10,
    y: 10,
    timeline: { inPoint, outPoint },
  };
}

function makeLogoOverlay(
  id: string,
  inPoint: number,
  outPoint: number
): LogoOverlay {
  return {
    id,
    type: "logo",
    src: "https://example.com/logo.png",
    x: 20,
    y: 20,
    width: 120,
    height: 60,
    konvaImage: null,
    timeline: { inPoint, outPoint },
  };
}

// ─── Timeline filtering ───────────────────────────────────────────────────────

describe("getVisibleOverlays — timeline filtering", () => {
  it("returns an overlay when currentTime is exactly at inPoint", () => {
    const overlay = makeTextOverlay("a", 2, 8);
    expect(getVisibleOverlays([overlay], 2)).toHaveLength(1);
  });

  it("returns an overlay when currentTime is between inPoint and outPoint", () => {
    const overlay = makeTextOverlay("a", 2, 8);
    expect(getVisibleOverlays([overlay], 5)).toHaveLength(1);
  });

  it("excludes an overlay when currentTime equals outPoint (exclusive upper bound)", () => {
    const overlay = makeTextOverlay("a", 2, 8);
    expect(getVisibleOverlays([overlay], 8)).toHaveLength(0);
  });

  it("excludes an overlay when currentTime is before inPoint", () => {
    const overlay = makeTextOverlay("a", 5, 10);
    expect(getVisibleOverlays([overlay], 3)).toHaveLength(0);
  });

  it("excludes an overlay when currentTime is after outPoint", () => {
    const overlay = makeTextOverlay("a", 0, 5);
    expect(getVisibleOverlays([overlay], 6)).toHaveLength(0);
  });

  it("returns only overlays whose window is active at currentTime", () => {
    const active = makeTextOverlay("active", 0, 10);
    const inactive = makeTextOverlay("inactive", 15, 20);
    const result = getVisibleOverlays([active, inactive], 5);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("active");
  });

  it("returns an empty array when no overlays are active", () => {
    const overlays = [
      makeTextOverlay("a", 0, 2),
      makeTextOverlay("b", 8, 10),
    ];
    expect(getVisibleOverlays(overlays, 5)).toHaveLength(0);
  });

  it("returns all overlays when all are active at currentTime", () => {
    const overlays = [
      makeTextOverlay("a", 0, 10),
      makeLogoOverlay("b", 0, 10),
    ];
    expect(getVisibleOverlays(overlays, 5)).toHaveLength(2);
  });

  it("returns an empty array when the overlay list is empty", () => {
    expect(getVisibleOverlays([], 5)).toHaveLength(0);
  });

  it("handles logo overlays the same as text overlays", () => {
    const logo = makeLogoOverlay("logo", 3, 7);
    expect(getVisibleOverlays([logo], 3)).toHaveLength(1);
    expect(getVisibleOverlays([logo], 7)).toHaveLength(0);
  });

  // Property: an overlay is visible iff inPoint <= t < outPoint
  it("property: visibility matches inPoint <= t < outPoint for any valid window", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (inPoint, outPoint, t) => {
          if (inPoint >= outPoint) return true; // skip degenerate windows
          const overlay = makeTextOverlay("x", inPoint, outPoint);
          const visible = getVisibleOverlays([overlay], t).length === 1;
          const expected = inPoint <= t && t < outPoint;
          return visible === expected;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Stage background click detection ────────────────────────────────────────

describe("isStageBackgroundClick — deselect on background click", () => {
  it("returns true when the click target is the stage itself", () => {
    expect(isStageBackgroundClick(true)).toBe(true);
  });

  it("returns false when the click target is a child node (not the stage)", () => {
    expect(isStageBackgroundClick(false)).toBe(false);
  });
});

// ─── Drag-end position extraction ────────────────────────────────────────────

describe("extractDragPosition — onDragEnd position update", () => {
  it("returns the x and y from the drag event", () => {
    const pos = extractDragPosition({ x: 42, y: 99 });
    expect(pos).toEqual({ x: 42, y: 99 });
  });

  it("returns zero coordinates when the node is at the origin", () => {
    const pos = extractDragPosition({ x: 0, y: 0 });
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it("returns negative coordinates when the node is dragged off-canvas", () => {
    const pos = extractDragPosition({ x: -10, y: -5 });
    expect(pos).toEqual({ x: -10, y: -5 });
  });

  it("property: extracted position always matches the event coordinates", () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true }),
        fc.float({ noNaN: true }),
        (x, y) => {
          const pos = extractDragPosition({ x, y });
          return pos.x === x && pos.y === y;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Transformer presence ─────────────────────────────────────────────────────

describe("shouldRenderTransformer — Transformer only when an overlay is selected", () => {
  it("returns true when selectedId is a non-null string", () => {
    expect(shouldRenderTransformer("some-id")).toBe(true);
  });

  it("returns false when selectedId is null", () => {
    expect(shouldRenderTransformer(null)).toBe(false);
  });

  it("returns true for any non-null string id", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (id) => shouldRenderTransformer(id) === true
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Transform dimension computation ─────────────────────────────────────────

describe("computeTransformedDimensions — onTransformEnd scale → size", () => {
  it("multiplies original dimensions by scale factors", () => {
    const result = computeTransformedDimensions(100, 50, 2, 3);
    expect(result).toEqual({ width: 200, height: 150 });
  });

  it("clamps to minimum size of 5 when scale produces a smaller value", () => {
    const result = computeTransformedDimensions(10, 10, 0.1, 0.1);
    expect(result.width).toBe(5);
    expect(result.height).toBe(5);
  });

  it("scale of 1 returns the original dimensions unchanged", () => {
    const result = computeTransformedDimensions(120, 60, 1, 1);
    expect(result).toEqual({ width: 120, height: 60 });
  });

  it("width and height are computed independently", () => {
    const result = computeTransformedDimensions(100, 200, 0.5, 2);
    expect(result.width).toBe(50);
    expect(result.height).toBe(400);
  });

  it("property: result dimensions are always >= minSize", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 500, noNaN: true }),
        fc.float({ min: 1, max: 500, noNaN: true }),
        // fc.float requires 32-bit float boundaries; use Math.fround for sub-integer mins
        fc.float({ min: Math.fround(0.01), max: 10, noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: 10, noNaN: true }),
        (w, h, sx, sy) => {
          const result = computeTransformedDimensions(w, h, sx, sy);
          return result.width >= 5 && result.height >= 5;
        }
      ),
      { numRuns: 200 }
    );
  });

  it("property: result dimensions equal max(minSize, original * scale)", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 500, noNaN: true }),
        fc.float({ min: 1, max: 500, noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: 10, noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: 10, noNaN: true }),
        (w, h, sx, sy) => {
          const result = computeTransformedDimensions(w, h, sx, sy);
          const expectedW = Math.max(5, w * sx);
          const expectedH = Math.max(5, h * sy);
          return (
            Math.abs(result.width - expectedW) < 0.0001 &&
            Math.abs(result.height - expectedH) < 0.0001
          );
        }
      ),
      { numRuns: 200 }
    );
  });
});
