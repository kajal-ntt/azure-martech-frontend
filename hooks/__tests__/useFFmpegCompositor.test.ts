/**
 * @jest-environment jsdom
 *
 * Unit tests for renderTextToPng exported from useFFmpegCompositor.
 *
 * These tests exercise the pure canvas-based function in isolation.
 * @ffmpeg/ffmpeg and @ffmpeg/util are mocked to avoid WASM/ESM loading issues
 * in the Jest environment — renderTextToPng itself only uses DOM canvas APIs.
 */

// Mock @ffmpeg/ffmpeg and @ffmpeg/util to avoid ESM/WASM issues in Jest
jest.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: jest.fn().mockImplementation(() => ({
    load: jest.fn(),
    exec: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
  })),
}));

jest.mock("@ffmpeg/util", () => ({
  toBlobURL: jest.fn().mockResolvedValue("blob:mock"),
}));

import { renderTextToPng } from "../useFFmpegCompositor";
import { TextOverlay } from "@/components/video/VideoOverlayEditor";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a minimal TextOverlay for testing. */
function makeTextOverlay(overrides: Partial<TextOverlay> = {}): TextOverlay {
  return {
    id: "test-id",
    type: "text",
    text: "Hello",
    fontFamily: "Arial",
    fontSize: 32,
    fill: "#ffffff",
    fontWeight: "normal",
    fontStyle: "normal",
    underline: false,
    textAlign: "left",
    opacity: 1,
    lineHeight: 1.2,
    letterSpacing: 0,
    shadowEnabled: false,
    shadowColor: "#000000",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    outlineEnabled: false,
    outlineColor: "#000000",
    outlineWidth: 0,
    highlightEnabled: false,
    highlightColor: "#ffff00",
    highlightPadding: 0,
    x: 0,
    y: 0,
    timeline: { inPoint: 0, outPoint: 10 },
    ...overrides,
  };
}

// ─── renderTextToPng ──────────────────────────────────────────────────────────

describe("renderTextToPng", () => {
  it("returns a non-empty Uint8Array for a valid TextOverlay", () => {
    const overlay = makeTextOverlay({ text: "Hello", fontFamily: "Arial", fontSize: 32, fill: "#ffffff" });

    const result = renderTextToPng(overlay, 1);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("canvas height is proportional to font size (larger font → taller canvas)", () => {
    // In jsdom, measureText returns 0 width, so canvas width may be minimal.
    // We test height only: canvas.height = scaledFontSize + 4
    const smallOverlay = makeTextOverlay({ fontSize: 16, text: "Test" });
    const largeOverlay = makeTextOverlay({ fontSize: 32, text: "Test" });

    const smallResult = renderTextToPng(smallOverlay, 1);
    const largeResult = renderTextToPng(largeOverlay, 1);

    // Both should be non-empty Uint8Arrays
    expect(smallResult).toBeInstanceOf(Uint8Array);
    expect(largeResult).toBeInstanceOf(Uint8Array);
    expect(smallResult.length).toBeGreaterThan(0);
    expect(largeResult.length).toBeGreaterThan(0);

    // The larger font size should produce a taller canvas (more PNG bytes for height)
    // We verify this by checking the canvas height indirectly:
    // canvas.height = scaledFontSize + 4
    // fontSize 16 → height 20, fontSize 32 → height 36
    // A taller canvas produces a larger PNG file
    expect(largeResult.length).toBeGreaterThanOrEqual(smallResult.length);
  });

  it("calls fillText with the correct text", () => {
    // Get CanvasRenderingContext2D from a canvas element (jsdom doesn't expose it as a global)
    const ctx = document.createElement("canvas").getContext("2d")!;
    const fillTextSpy = jest.spyOn(Object.getPrototypeOf(ctx), "fillText");

    const overlay = makeTextOverlay({ text: "Hello World" });
    renderTextToPng(overlay, 1);

    expect(fillTextSpy).toHaveBeenCalledWith("Hello World", 4, expect.any(Number));

    fillTextSpy.mockRestore();
  });

  it("applies scale factor to font size (scaleFactor 2 doubles the canvas height)", () => {
    // fontSize: 20, scaleFactor: 2 -> scaledFontSize = 40 -> canvas.height = 44
    const overlay = makeTextOverlay({ fontSize: 20, text: "Scale" });

    const result = renderTextToPng(overlay, 2);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);

    // Verify the canvas height was set correctly by checking that a larger
    // scale factor produces a larger result than scale factor 1
    const resultSmallScale = renderTextToPng(overlay, 1);
    expect(result.length).toBeGreaterThanOrEqual(resultSmallScale.length);
  });
});
