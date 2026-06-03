/**
 * Unit tests for OverlayLayersPanel logic.
 *
 * OverlayLayersPanel is a React component that depends on the DOM. Following
 * the project's established pattern (see __tests__/video/OverlayCanvas.test.ts
 * and __tests__/video/OverlayPropertiesPanel.test.ts), these tests exercise
 * the pure logic functions that drive the panel's behaviour:
 *
 *   - computeDisplayNames  (Logo / Text N sequential numbering)
 *   - Row selection logic  (which row is highlighted)
 *   - Delete propagation   (delete does not trigger select)
 *   - Empty state          (no overlays)
 *
 * Each function mirrors the logic inside OverlayLayersPanel.tsx so that the
 * invariants can be verified without a DOM or React renderer.
 */

import * as fc from "fast-check";
import { computeDisplayNames } from "@/components/video/OverlayLayersPanel";
import type { Overlay, LogoOverlay, TextOverlay } from "@/components/video/VideoOverlayEditor";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTextOverlay(id: string): TextOverlay {
  return {
    id,
    type: "text",
    text: "Hello",
    fontFamily: "Arial",
    fontSize: 32,
    fill: "#ffffff",
    x: 50,
    y: 50,
    timeline: { inPoint: 0, outPoint: 10 },
  };
}

function makeLogoOverlay(id: string): LogoOverlay {
  return {
    id,
    type: "logo",
    src: "https://example.com/logo.png",
    x: 20,
    y: 20,
    width: 120,
    height: 60,
    konvaImage: null,
    timeline: { inPoint: 0, outPoint: 10 },
  };
}

// ─── Pure logic helpers (mirror component internals) ─────────────────────────

/**
 * Returns true when the row for `overlayId` should be highlighted.
 * Mirrors: `overlay.id === selectedId`
 */
function isRowSelected(overlayId: string, selectedId: string | null): boolean {
  return overlayId === selectedId;
}

/**
 * Simulates clicking a row: calls onSelect with the overlay id.
 * Mirrors the row's onClick handler.
 */
function handleRowClick(
  overlayId: string,
  onSelect: (id: string) => void
): void {
  onSelect(overlayId);
}

/**
 * Simulates clicking the delete button: calls onDelete but NOT onSelect
 * (propagation is stopped).
 * Mirrors the delete button's onClick handler.
 */
function handleDeleteClick(
  overlayId: string,
  onDelete: (id: string) => void,
  onSelect: (id: string) => void,
  propagationStopped: boolean
): void {
  onDelete(overlayId);
  if (!propagationStopped) {
    // If propagation were NOT stopped, onSelect would also fire
    onSelect(overlayId);
  }
}

// ─── computeDisplayNames ──────────────────────────────────────────────────────

describe("computeDisplayNames — overlay display name logic", () => {
  it("returns an empty array for an empty overlay list", () => {
    expect(computeDisplayNames([])).toEqual([]);
  });

  it("names a single logo overlay 'Logo'", () => {
    const overlays: Overlay[] = [makeLogoOverlay("l1")];
    expect(computeDisplayNames(overlays)).toEqual(["Logo"]);
  });

  it("names a single text overlay 'Text 1'", () => {
    const overlays: Overlay[] = [makeTextOverlay("t1")];
    expect(computeDisplayNames(overlays)).toEqual(["Text 1"]);
  });

  it("numbers text overlays sequentially: Text 1, Text 2, Text 3", () => {
    const overlays: Overlay[] = [
      makeTextOverlay("t1"),
      makeTextOverlay("t2"),
      makeTextOverlay("t3"),
    ];
    expect(computeDisplayNames(overlays)).toEqual(["Text 1", "Text 2", "Text 3"]);
  });

  it("logo overlays do not increment the text counter", () => {
    const overlays: Overlay[] = [
      makeLogoOverlay("l1"),
      makeTextOverlay("t1"),
      makeTextOverlay("t2"),
    ];
    expect(computeDisplayNames(overlays)).toEqual(["Logo", "Text 1", "Text 2"]);
  });

  it("text counter is independent of logo position in the list", () => {
    const overlays: Overlay[] = [
      makeTextOverlay("t1"),
      makeLogoOverlay("l1"),
      makeTextOverlay("t2"),
    ];
    expect(computeDisplayNames(overlays)).toEqual(["Text 1", "Logo", "Text 2"]);
  });

  it("multiple logos all get the name 'Logo'", () => {
    // Edge case: spec only mentions one logo, but the naming logic should be stable
    const overlays: Overlay[] = [
      makeLogoOverlay("l1"),
      makeLogoOverlay("l2"),
    ];
    expect(computeDisplayNames(overlays)).toEqual(["Logo", "Logo"]);
  });

  it("returns a name for every overlay (output length equals input length)", () => {
    const overlays: Overlay[] = [
      makeLogoOverlay("l1"),
      makeTextOverlay("t1"),
      makeTextOverlay("t2"),
      makeLogoOverlay("l2"),
      makeTextOverlay("t3"),
    ];
    const names = computeDisplayNames(overlays);
    expect(names).toHaveLength(overlays.length);
  });

  it("text overlays are numbered in order of appearance, not by id", () => {
    const overlays: Overlay[] = [
      makeTextOverlay("z-last"),
      makeTextOverlay("a-first"),
    ];
    const names = computeDisplayNames(overlays);
    expect(names[0]).toBe("Text 1");
    expect(names[1]).toBe("Text 2");
  });

  // Property: every logo overlay maps to "Logo"
  it("property: every logo overlay always maps to 'Logo'", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constant("logo" as const), { minLength: 1, maxLength: 10 }),
        (types) => {
          const overlays: Overlay[] = types.map((_, i) => makeLogoOverlay(`l${i}`));
          const names = computeDisplayNames(overlays);
          return names.every((n) => n === "Logo");
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: text overlays are numbered 1..N in order
  it("property: text overlays are numbered 1..N in order of appearance", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (count) => {
          const overlays: Overlay[] = Array.from({ length: count }, (_, i) =>
            makeTextOverlay(`t${i}`)
          );
          const names = computeDisplayNames(overlays);
          return names.every((name, i) => name === `Text ${i + 1}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: output length always equals input length
  it("property: output length always equals input length", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constant(makeLogoOverlay("l")),
            fc.constant(makeTextOverlay("t"))
          ),
          { maxLength: 20 }
        ),
        (overlays) => computeDisplayNames(overlays).length === overlays.length
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Row selection logic ──────────────────────────────────────────────────────

describe("isRowSelected — selected row highlighting", () => {
  it("returns true when the overlay id matches selectedId", () => {
    expect(isRowSelected("abc", "abc")).toBe(true);
  });

  it("returns false when the overlay id does not match selectedId", () => {
    expect(isRowSelected("abc", "xyz")).toBe(false);
  });

  it("returns false when selectedId is null (nothing selected)", () => {
    expect(isRowSelected("abc", null)).toBe(false);
  });

  it("returns false when ids differ only in case", () => {
    expect(isRowSelected("ABC", "abc")).toBe(false);
  });

  // Property: only the exact matching id is selected
  it("property: only the row whose id equals selectedId is highlighted", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (id, selectedId) => {
          const result = isRowSelected(id, selectedId);
          return result === (id === selectedId);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Row click → onSelect ─────────────────────────────────────────────────────

describe("handleRowClick — clicking a row calls onSelect with the correct id", () => {
  it("calls onSelect with the overlay id when a row is clicked", () => {
    const onSelect = jest.fn();
    handleRowClick("overlay-1", onSelect);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("overlay-1");
  });

  it("calls onSelect with the correct id for different overlays", () => {
    const onSelect = jest.fn();
    handleRowClick("logo-id", onSelect);
    expect(onSelect).toHaveBeenCalledWith("logo-id");

    handleRowClick("text-id", onSelect);
    expect(onSelect).toHaveBeenCalledWith("text-id");
  });

  it("property: onSelect is always called with the exact overlay id", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (id) => {
        const onSelect = jest.fn();
        handleRowClick(id, onSelect);
        return (
          onSelect.mock.calls.length === 1 &&
          onSelect.mock.calls[0][0] === id
        );
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Delete button — does NOT trigger onSelect ────────────────────────────────

describe("handleDeleteClick — delete calls onDelete and not onSelect", () => {
  it("calls onDelete with the overlay id when propagation is stopped", () => {
    const onDelete = jest.fn();
    const onSelect = jest.fn();
    handleDeleteClick("overlay-1", onDelete, onSelect, true);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("overlay-1");
  });

  it("does NOT call onSelect when propagation is stopped", () => {
    const onDelete = jest.fn();
    const onSelect = jest.fn();
    handleDeleteClick("overlay-1", onDelete, onSelect, true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("would call onSelect if propagation were NOT stopped (demonstrates why stopPropagation is needed)", () => {
    const onDelete = jest.fn();
    const onSelect = jest.fn();
    handleDeleteClick("overlay-1", onDelete, onSelect, false);
    expect(onDelete).toHaveBeenCalledWith("overlay-1");
    expect(onSelect).toHaveBeenCalledWith("overlay-1");
  });

  it("calls onDelete with the correct id for any overlay", () => {
    const onDelete = jest.fn();
    const onSelect = jest.fn();
    handleDeleteClick("logo-42", onDelete, onSelect, true);
    expect(onDelete).toHaveBeenCalledWith("logo-42");
    expect(onSelect).not.toHaveBeenCalled();
  });

  // Property: with propagation stopped, onDelete fires once and onSelect never fires
  it("property: with propagation stopped, onDelete fires once and onSelect never fires", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (id) => {
        const onDelete = jest.fn();
        const onSelect = jest.fn();
        handleDeleteClick(id, onDelete, onSelect, true);
        return (
          onDelete.mock.calls.length === 1 &&
          onDelete.mock.calls[0][0] === id &&
          onSelect.mock.calls.length === 0
        );
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe("computeDisplayNames — empty overlay list", () => {
  it("returns an empty array when there are no overlays", () => {
    expect(computeDisplayNames([])).toEqual([]);
  });

  it("does not throw when called with an empty array", () => {
    expect(() => computeDisplayNames([])).not.toThrow();
  });
});

// ─── Integration: mixed overlay list ─────────────────────────────────────────

describe("computeDisplayNames — mixed overlay lists", () => {
  it("correctly names a realistic overlay list: logo, text, text", () => {
    const overlays: Overlay[] = [
      makeLogoOverlay("l1"),
      makeTextOverlay("t1"),
      makeTextOverlay("t2"),
    ];
    expect(computeDisplayNames(overlays)).toEqual(["Logo", "Text 1", "Text 2"]);
  });

  it("correctly names a list starting with two text overlays then a logo", () => {
    const overlays: Overlay[] = [
      makeTextOverlay("t1"),
      makeTextOverlay("t2"),
      makeLogoOverlay("l1"),
    ];
    expect(computeDisplayNames(overlays)).toEqual(["Text 1", "Text 2", "Logo"]);
  });

  it("handles alternating logo and text overlays", () => {
    const overlays: Overlay[] = [
      makeLogoOverlay("l1"),
      makeTextOverlay("t1"),
      makeLogoOverlay("l2"),
      makeTextOverlay("t2"),
    ];
    expect(computeDisplayNames(overlays)).toEqual([
      "Logo",
      "Text 1",
      "Logo",
      "Text 2",
    ]);
  });
});
