/**
 * Jest global setup file.
 *
 * Provides a minimal HTMLCanvasElement mock for jsdom environments.
 * jsdom does not implement canvas rendering — this mock stubs the
 * methods used by renderTextToPng so canvas-dependent tests can run
 * without the optional `canvas` npm package.
 */

// ── Canvas mock ───────────────────────────────────────────────────────────────

const mockContext: Partial<CanvasRenderingContext2D> = {
  font: "",
  fillStyle: "",
  globalAlpha: 1,
  textBaseline: "alphabetic",
  textAlign: "start",
  shadowColor: "",
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  strokeStyle: "",
  lineWidth: 1,
  measureText: (_text: string) => ({ width: 50 } as TextMetrics),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  roundRect: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  drawImage: jest.fn(),
  createLinearGradient: jest.fn().mockReturnValue({
    addColorStop: jest.fn(),
  }),
  createRadialGradient: jest.fn().mockReturnValue({
    addColorStop: jest.fn(),
  }),
  getImageData: jest.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
  putImageData: jest.fn(),
  setTransform: jest.fn(),
  resetTransform: jest.fn(),
  clip: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  closePath: jest.fn(),
};

// Stub HTMLCanvasElement.prototype.getContext to return the mock context
// and toDataURL to return a minimal PNG data URL.
HTMLCanvasElement.prototype.getContext = jest.fn(
  (_contextId: string) => mockContext as CanvasRenderingContext2D
) as typeof HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.toDataURL = jest.fn(
  () =>
    // Minimal 1×1 transparent PNG as a data URL
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
);
