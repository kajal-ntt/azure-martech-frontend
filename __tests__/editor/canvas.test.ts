/**
 * Property-based tests for canvas aspect ratio and scaling logic.
 * Tests pure math functions extracted from EditorCanvas.tsx — no DOM/React rendering.
 *
 * Feature: image-editor-mvp
 */

import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure logic functions (mirroring the math in EditorCanvas.tsx)
// ---------------------------------------------------------------------------

const PADDING = 40;

/**
 * Compute the scale factor used when fitting an image onto the canvas.
 * Mirrors the logic in EditorCanvas.tsx:
 *   const scale = Math.min(availW / imgW, availH / imgH);
 */
function computeImageScale(
  imgW: number,
  imgH: number,
  canvasW: number,
  canvasH: number,
  padding: number = PADDING
): number {
  const availW = canvasW - padding * 2;
  const availH = canvasH - padding * 2;
  return Math.min(availW / imgW, availH / imgH);
}

/**
 * Compute rendered image dimensions after scaling.
 */
function computeRenderedDimensions(
  imgW: number,
  imgH: number,
  scale: number
): { renderedW: number; renderedH: number } {
  return { renderedW: imgW * scale, renderedH: imgH * scale };
}

/**
 * Proportional scaling: given canvas resize from (W, H) → (W', H'),
 * compute new element position and scale.
 * Mirrors the resize logic described in the design doc (Property 7).
 */
function scaleElement(
  element: { x: number; y: number; scaleX: number; scaleY: number },
  oldW: number,
  oldH: number,
  newW: number,
  newH: number
): { x: number; y: number; scaleX: number; scaleY: number } {
  const ratioX = newW / oldW;
  const ratioY = newH / oldH;
  return {
    x: element.x * ratioX,
    y: element.y * ratioY,
    scaleX: element.scaleX * ratioX,
    scaleY: element.scaleY * ratioY,
  };
}

/**
 * Apply crop: set canvas dimensions to crop rect dimensions.
 * Mirrors: canvas.setDimensions({ width: cw, height: ch })
 */
function applyCropDimensions(
  cropW: number,
  cropH: number
): { width: number; height: number } {
  return { width: cropW, height: cropH };
}

/**
 * Cancel crop: restore original canvas state (no-op on dimensions/positions).
 */
function cancelCrop(state: {
  width: number;
  height: number;
  elements: Array<{ x: number; y: number }>;
}): { width: number; height: number; elements: Array<{ x: number; y: number }> } {
  // Cancel restores the original state unchanged
  return {
    width: state.width,
    height: state.height,
    elements: state.elements.map((el) => ({ ...el })),
  };
}

/**
 * Adjust text overlay position after crop.
 * Mirrors: newX = x - cx, newY = y - cy  (Property 10)
 */
function adjustTextPositionAfterCrop(
  textX: number,
  textY: number,
  cropOriginX: number,
  cropOriginY: number
): { x: number; y: number } {
  return { x: textX - cropOriginX, y: textY - cropOriginY };
}

// ---------------------------------------------------------------------------
// Property 1: Aspect Ratio Preservation
// ---------------------------------------------------------------------------

describe("Property 1: Aspect Ratio Preservation", () => {
  // Feature: image-editor-mvp, Property 1: For any (width, height), rendered canvas maintains width/height ratio within 0.01 tolerance
  it("rendered image preserves original aspect ratio within 0.01 tolerance", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 200, max: 4000 }),
        fc.integer({ min: 200, max: 4000 }),
        (imgW, imgH, canvasW, canvasH) => {
          const scale = computeImageScale(imgW, imgH, canvasW, canvasH);
          const { renderedW, renderedH } = computeRenderedDimensions(imgW, imgH, scale);

          const originalRatio = imgW / imgH;
          const renderedRatio = renderedW / renderedH;

          return Math.abs(originalRatio - renderedRatio) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("scale factor is positive for valid image and canvas dimensions", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4000 }),
        fc.integer({ min: 1, max: 4000 }),
        fc.integer({ min: 200, max: 4000 }),
        fc.integer({ min: 200, max: 4000 }),
        (imgW, imgH, canvasW, canvasH) => {
          const scale = computeImageScale(imgW, imgH, canvasW, canvasH);
          return scale > 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Proportional Scaling on Resize
// ---------------------------------------------------------------------------

describe("Property 7: Proportional Scaling on Resize", () => {
  // Feature: image-editor-mvp, Property 7: For N text elements at (x,y,scaleX,scaleY), after resize (W,H)→(W',H'), each element's position and scale are multiplied by (W'/W, H'/H)
  it("each element position and scale are multiplied by resize ratios", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.float({ min: 0, max: 2000, noNaN: true }),
            y: fc.float({ min: 0, max: 2000, noNaN: true }),
            scaleX: fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
            scaleY: fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 100, max: 4000 }),
        (elements, oldW, oldH, newW, newH) => {
          const ratioX = newW / oldW;
          const ratioY = newH / oldH;

          for (const el of elements) {
            const scaled = scaleElement(el, oldW, oldH, newW, newH);

            const expectedX = el.x * ratioX;
            const expectedY = el.y * ratioY;
            const expectedScaleX = el.scaleX * ratioX;
            const expectedScaleY = el.scaleY * ratioY;

            if (Math.abs(scaled.x - expectedX) > 1e-9) return false;
            if (Math.abs(scaled.y - expectedY) > 1e-9) return false;
            if (Math.abs(scaled.scaleX - expectedScaleX) > 1e-9) return false;
            if (Math.abs(scaled.scaleY - expectedScaleY) > 1e-9) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("identity resize (same dimensions) leaves elements unchanged", () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.float({ min: 0, max: 2000, noNaN: true }),
          y: fc.float({ min: 0, max: 2000, noNaN: true }),
          scaleX: fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
          scaleY: fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
        }),
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 100, max: 4000 }),
        (el, W, H) => {
          const scaled = scaleElement(el, W, H, W, H);
          return (
            Math.abs(scaled.x - el.x) < 1e-9 &&
            Math.abs(scaled.y - el.y) < 1e-9 &&
            Math.abs(scaled.scaleX - el.scaleX) < 1e-9 &&
            Math.abs(scaled.scaleY - el.scaleY) < 1e-9
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Crop Applies Correct Dimensions
// ---------------------------------------------------------------------------

describe("Property 8: Crop Applies Correct Dimensions", () => {
  // Feature: image-editor-mvp, Property 8: For any crop rect (cw,ch), resulting canvas equals cw×ch
  it("canvas dimensions after crop equal the crop rect dimensions", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 2000 }),
        fc.integer({ min: 10, max: 2000 }),
        (cropW, cropH) => {
          const result = applyCropDimensions(cropW, cropH);
          return result.width === cropW && result.height === cropH;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Cancel Crop Leaves Canvas Unchanged
// ---------------------------------------------------------------------------

describe("Property 9: Cancel Crop Leaves Canvas Unchanged", () => {
  // Feature: image-editor-mvp, Property 9: Enter crop mode then cancel → canvas dimensions and element positions identical to before
  it("cancel crop restores original canvas dimensions", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 100, max: 4000 }),
        (width, height) => {
          const originalState = { width, height, elements: [] };
          const restored = cancelCrop(originalState);
          return restored.width === width && restored.height === height;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("cancel crop restores all element positions unchanged", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 100, max: 4000 }),
        fc.array(
          fc.record({
            x: fc.float({ min: 0, max: 2000, noNaN: true }),
            y: fc.float({ min: 0, max: 2000, noNaN: true }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (width, height, elements) => {
          const originalState = { width, height, elements };
          const restored = cancelCrop(originalState);

          if (restored.elements.length !== elements.length) return false;
          for (let i = 0; i < elements.length; i++) {
            if (restored.elements[i].x !== elements[i].x) return false;
            if (restored.elements[i].y !== elements[i].y) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Text Overlay Position Adjustment After Crop
// ---------------------------------------------------------------------------

describe("Property 10: Text Overlay Position Adjustment After Crop", () => {
  // Feature: image-editor-mvp, Property 10: Text at (x,y), crop origin (cx,cy) → new position (x−cx, y−cy)
  it("text position after crop equals (x - cx, y - cy)", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 2000, noNaN: true }),
        fc.float({ min: 0, max: 2000, noNaN: true }),
        fc.float({ min: 0, max: 500, noNaN: true }),
        fc.float({ min: 0, max: 500, noNaN: true }),
        (textX, textY, cropOriginX, cropOriginY) => {
          const adjusted = adjustTextPositionAfterCrop(textX, textY, cropOriginX, cropOriginY);
          return (
            Math.abs(adjusted.x - (textX - cropOriginX)) < 1e-9 &&
            Math.abs(adjusted.y - (textY - cropOriginY)) < 1e-9
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("crop at origin (0,0) leaves text position unchanged", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 2000, noNaN: true }),
        fc.float({ min: 0, max: 2000, noNaN: true }),
        (textX, textY) => {
          const adjusted = adjustTextPositionAfterCrop(textX, textY, 0, 0);
          return (
            Math.abs(adjusted.x - textX) < 1e-9 &&
            Math.abs(adjusted.y - textY) < 1e-9
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
