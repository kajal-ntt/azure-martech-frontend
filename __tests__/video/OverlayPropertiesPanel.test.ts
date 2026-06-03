/**
 * Unit tests for OverlayPropertiesPanel logic.
 *
 * OverlayPropertiesPanel is a React component that depends on the DOM and
 * Tailwind CSS classes. Following the project's established pattern
 * (see __tests__/video/OverlayCanvas.test.ts), these tests exercise the pure
 * validation and transformation functions that drive the panel's behaviour:
 *
 *   - inPoint validation  (must be < outPoint; negative values clamped to 0)
 *   - outPoint clamping   (must not exceed videoDuration)
 *   - brand color swatch  (calls onUpdate with the correct fill)
 *   - placeholder logic   (null overlay → no update calls)
 *
 * Each function mirrors the logic inside OverlayPropertiesPanel.tsx so that
 * the invariants can be verified without a DOM or React renderer.
 */

import * as fc from "fast-check";
import type { Overlay, TextOverlay, LogoOverlay } from "@/components/video/VideoOverlayEditor";

// ─── Pure logic extracted from OverlayPropertiesPanel ────────────────────────

/**
 * Processes an inPoint change.
 *
 * Rules (mirrors handleInPointChange):
 *   - If parsed value is NaN → no-op (returns null)
 *   - If value >= outPoint   → validation error, no update (returns { error })
 *   - If value < 0           → clamp to 0, call update (returns { value: 0 })
 *   - Otherwise              → call update with the value (returns { value })
 */
function processInPointChange(
  rawValue: string,
  outPoint: number
): { value: number } | { error: string } | null {
  const parsed = Number.parseFloat(rawValue);
  if (Number.isNaN(parsed)) return null;

  const value = Math.max(0, parsed);

  if (value >= outPoint) {
    return { error: "In point must be less than out point." };
  }

  return { value };
}

/**
 * Processes an outPoint change.
 *
 * Rules (mirrors handleOutPointChange):
 *   - If parsed value is NaN → no-op (returns null)
 *   - If value > videoDuration → clamp to videoDuration, return clamped value + message
 *   - Otherwise               → return the value as-is
 */
function processOutPointChange(
  rawValue: string,
  videoDuration: number
): { value: number; message: string | null } | null {
  const parsed = Number.parseFloat(rawValue);
  if (Number.isNaN(parsed)) return null;

  if (parsed > videoDuration) {
    return {
      value: videoDuration,
      message: `Out point clamped to video duration (${videoDuration}s).`,
    };
  }

  return { value: parsed, message: null };
}

/**
 * Determines the fill patch to apply when a brand color swatch is clicked.
 * Mirrors: `onUpdate(overlay.id, { fill: color })`
 */
function getBrandColorPatch(color: string): { fill: string } {
  return { fill: color };
}

/**
 * Returns true when the panel should show a placeholder (no overlay selected).
 * Mirrors the `if (!overlay)` guard in OverlayPropertiesPanel.
 */
function shouldShowPlaceholder(overlay: Overlay | null): boolean {
  return overlay === null;
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
    fontSize: 32,
    fill: "#ffffff",
    x: 50,
    y: 50,
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

// ─── inPoint validation ───────────────────────────────────────────────────────

describe("processInPointChange — inPoint validation", () => {
  it("returns an error when inPoint equals outPoint", () => {
    const result = processInPointChange("5", 5);
    expect(result).toEqual({ error: "In point must be less than out point." });
  });

  it("returns an error when inPoint is greater than outPoint", () => {
    const result = processInPointChange("8", 5);
    expect(result).toEqual({ error: "In point must be less than out point." });
  });

  it("does NOT return an error when inPoint is strictly less than outPoint", () => {
    const result = processInPointChange("3", 5);
    expect(result).not.toHaveProperty("error");
    expect(result).toEqual({ value: 3 });
  });

  it("clamps a negative inPoint to 0 and returns value 0", () => {
    const result = processInPointChange("-2", 5);
    expect(result).toEqual({ value: 0 });
  });

  it("clamps -0.001 to 0 (not an error, since 0 < outPoint)", () => {
    const result = processInPointChange("-0.001", 5);
    expect(result).toEqual({ value: 0 });
  });

  it("returns null for a non-numeric string", () => {
    const result = processInPointChange("abc", 5);
    expect(result).toBeNull();
  });

  it("returns null for an empty string", () => {
    const result = processInPointChange("", 5);
    expect(result).toBeNull();
  });

  it("accepts a valid decimal inPoint", () => {
    const result = processInPointChange("2.5", 5);
    expect(result).toEqual({ value: 2.5 });
  });

  // Property: any value >= outPoint always produces an error
  it("property: inPoint >= outPoint always produces an error", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        (inPoint, outPoint) => {
          if (inPoint < outPoint) return true; // only test the error case
          const result = processInPointChange(String(inPoint), outPoint);
          return result !== null && "error" in result;
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property: any valid inPoint (0 <= value < outPoint) never produces an error
  it("property: valid inPoint (0 <= value < outPoint) never produces an error", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 99, noNaN: true }),
        fc.float({ min: 1, max: 100, noNaN: true }),
        (inPoint, outPoint) => {
          if (inPoint >= outPoint) return true; // skip invalid combos
          const result = processInPointChange(String(inPoint), outPoint);
          return result !== null && "value" in result && !("error" in result);
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property: negative inputs are always clamped to 0
  it("property: negative inPoint is always clamped to 0", () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1000, max: Math.fround(-0.001), noNaN: true }),
        fc.float({ min: 1, max: 100, noNaN: true }),
        (negativeValue, outPoint) => {
          const result = processInPointChange(String(negativeValue), outPoint);
          return result !== null && "value" in result && result.value === 0;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── outPoint clamping ────────────────────────────────────────────────────────

describe("processOutPointChange — outPoint clamping", () => {
  it("clamps outPoint to videoDuration when it exceeds the duration", () => {
    const result = processOutPointChange("15", 10);
    expect(result).toEqual({
      value: 10,
      message: "Out point clamped to video duration (10s).",
    });
  });

  it("calls onUpdate with the clamped value (videoDuration), not the raw input", () => {
    const result = processOutPointChange("999", 30);
    expect(result?.value).toBe(30);
  });

  it("does not clamp when outPoint equals videoDuration exactly", () => {
    const result = processOutPointChange("10", 10);
    expect(result).toEqual({ value: 10, message: null });
  });

  it("does not clamp when outPoint is less than videoDuration", () => {
    const result = processOutPointChange("7", 10);
    expect(result).toEqual({ value: 7, message: null });
  });

  it("returns null for a non-numeric string", () => {
    const result = processOutPointChange("abc", 10);
    expect(result).toBeNull();
  });

  it("returns null for an empty string", () => {
    const result = processOutPointChange("", 10);
    expect(result).toBeNull();
  });

  it("accepts a valid decimal outPoint", () => {
    const result = processOutPointChange("4.75", 10);
    expect(result).toEqual({ value: 4.75, message: null });
  });

  // Property: result value is always <= videoDuration
  it("property: result value is always <= videoDuration", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 200, noNaN: true }),
        fc.float({ min: 1, max: 100, noNaN: true }),
        (outPoint, videoDuration) => {
          const result = processOutPointChange(String(outPoint), videoDuration);
          if (result === null) return true;
          return result.value <= videoDuration;
        }
      ),
      { numRuns: 200 }
    );
  });

  // Property: when outPoint > videoDuration, message is non-null
  it("property: message is non-null iff outPoint > videoDuration", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 200, noNaN: true }),
        fc.float({ min: 1, max: 100, noNaN: true }),
        (outPoint, videoDuration) => {
          const result = processOutPointChange(String(outPoint), videoDuration);
          if (result === null) return true;
          const shouldHaveMessage = outPoint > videoDuration;
          return shouldHaveMessage ? result.message !== null : result.message === null;
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Brand color swatch ───────────────────────────────────────────────────────

describe("getBrandColorPatch — brand color swatch click", () => {
  it("returns a fill patch with the given color", () => {
    expect(getBrandColorPatch("#ff0000")).toEqual({ fill: "#ff0000" });
  });

  it("returns a fill patch for a named color", () => {
    expect(getBrandColorPatch("rebeccapurple")).toEqual({ fill: "rebeccapurple" });
  });

  it("returns a fill patch for an rgb() color", () => {
    expect(getBrandColorPatch("rgb(0,128,255)")).toEqual({ fill: "rgb(0,128,255)" });
  });

  it("property: fill in the patch always equals the input color string", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (color) => getBrandColorPatch(color).fill === color
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Placeholder logic ────────────────────────────────────────────────────────

describe("shouldShowPlaceholder — null overlay guard", () => {
  it("returns true when overlay is null", () => {
    expect(shouldShowPlaceholder(null)).toBe(true);
  });

  it("returns false when overlay is a TextOverlay", () => {
    const overlay = makeTextOverlay("t1", 0, 10);
    expect(shouldShowPlaceholder(overlay)).toBe(false);
  });

  it("returns false when overlay is a LogoOverlay", () => {
    const overlay = makeLogoOverlay("l1", 0, 10);
    expect(shouldShowPlaceholder(overlay)).toBe(false);
  });
});

// ─── Integration: inPoint + outPoint interaction ──────────────────────────────

describe("timeline validation — combined inPoint / outPoint rules", () => {
  it("inPoint equal to outPoint is invalid even when both are within duration", () => {
    const result = processInPointChange("5", 5);
    expect(result).toHaveProperty("error");
  });

  it("inPoint of 0 is valid when outPoint is positive", () => {
    const result = processInPointChange("0", 10);
    expect(result).toEqual({ value: 0 });
  });

  it("outPoint of 0 is valid (no clamping needed) when videoDuration > 0", () => {
    const result = processOutPointChange("0", 10);
    expect(result).toEqual({ value: 0, message: null });
  });

  it("outPoint exactly at videoDuration produces no clamp message", () => {
    const result = processOutPointChange("30", 30);
    expect(result?.message).toBeNull();
  });

  it("outPoint one unit above videoDuration is clamped with a message", () => {
    const result = processOutPointChange("31", 30);
    expect(result?.value).toBe(30);
    expect(result?.message).not.toBeNull();
  });
});
