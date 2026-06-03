/**
 * @jest-environment jsdom
 *
 * Unit tests for useVideoOverlays hook.
 * React hooks are exercised through @testing-library/react's renderHook + act helpers.
 */

import { renderHook, act } from "@testing-library/react";
import { useVideoOverlays } from "../useVideoOverlays";
import { LogoOverlay, TextOverlay } from "@/components/video/VideoOverlayEditor";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a minimal HTMLImageElement stub with the given natural dimensions. */
function makeImage(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  const img = {
    naturalWidth,
    naturalHeight,
    src: "",
  } as unknown as HTMLImageElement;
  return img;
}

const VIDEO_DURATION = 30; // seconds

// ─── addLogoOverlay ───────────────────────────────────────────────────────────

describe("addLogoOverlay", () => {
  it("appends a LogoOverlay with the correct type", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addLogoOverlay("https://example.com/logo.png", makeImage(200, 100));
    });

    expect(result.current.overlays).toHaveLength(1);
    expect(result.current.overlays[0].type).toBe("logo");
  });

  it("places the logo at (x: 20, y: 20) with default width 120", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addLogoOverlay("https://example.com/logo.png", makeImage(200, 100));
    });

    const overlay = result.current.overlays[0] as LogoOverlay;
    expect(overlay.x).toBe(20);
    expect(overlay.y).toBe(20);
    expect(overlay.width).toBe(120);
  });

  it("derives height proportionally from the image's natural aspect ratio", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    // 200×100 → aspect ratio 0.5 → height = round(120 * 0.5) = 60
    act(() => {
      result.current.addLogoOverlay("https://example.com/logo.png", makeImage(200, 100));
    });

    const overlay = result.current.overlays[0] as LogoOverlay;
    expect(overlay.height).toBe(60);
  });

  it("falls back to height === width when image has zero dimensions", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addLogoOverlay("https://example.com/logo.png", makeImage(0, 0));
    });

    const overlay = result.current.overlays[0] as LogoOverlay;
    expect(overlay.height).toBe(120); // aspect ratio defaults to 1
  });

  it("initialises the timeline with inPoint: 0 and outPoint equal to videoDuration", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addLogoOverlay("https://example.com/logo.png", makeImage(200, 100));
    });

    const overlay = result.current.overlays[0] as LogoOverlay;
    expect(overlay.timeline.inPoint).toBe(0);
    expect(overlay.timeline.outPoint).toBe(VIDEO_DURATION);
  });

  it("stores the src and konvaImage on the overlay", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));
    const img = makeImage(200, 100);

    act(() => {
      result.current.addLogoOverlay("https://example.com/logo.png", img);
    });

    const overlay = result.current.overlays[0] as LogoOverlay;
    expect(overlay.src).toBe("https://example.com/logo.png");
    expect(overlay.konvaImage).toBe(img);
  });

  it("assigns a unique id to each overlay", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addLogoOverlay("https://example.com/logo.png", makeImage(200, 100));
      result.current.addLogoOverlay("https://example.com/logo2.png", makeImage(200, 100));
    });

    const [a, b] = result.current.overlays;
    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });
});

// ─── addTextOverlay ───────────────────────────────────────────────────────────

describe("addTextOverlay", () => {
  it("appends a TextOverlay with the correct type", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    expect(result.current.overlays).toHaveLength(1);
    expect(result.current.overlays[0].type).toBe("text");
  });

  it("centers the overlay on the stage", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    const overlay = result.current.overlays[0] as TextOverlay;
    expect(overlay.x).toBe(320); // 640 / 2
    expect(overlay.y).toBe(180); // 360 / 2
  });

  it("uses the correct default text, font, size, and color", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    const overlay = result.current.overlays[0] as TextOverlay;
    expect(overlay.text).toBe("Your text here");
    expect(overlay.fontFamily).toBe("Arial");
    expect(overlay.fontSize).toBe(32);
    expect(overlay.fill).toBe("#ffffff");
  });

  it("initialises the timeline with inPoint: 0 and outPoint equal to videoDuration", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    const overlay = result.current.overlays[0] as TextOverlay;
    expect(overlay.timeline.inPoint).toBe(0);
    expect(overlay.timeline.outPoint).toBe(VIDEO_DURATION);
  });
});

// ─── updateOverlay ────────────────────────────────────────────────────────────

describe("updateOverlay", () => {
  it("merges the patch into the target overlay", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    const id = result.current.overlays[0].id;

    act(() => {
      result.current.updateOverlay(id, { x: 100, y: 200 });
    });

    const overlay = result.current.overlays[0] as TextOverlay;
    expect(overlay.x).toBe(100);
    expect(overlay.y).toBe(200);
  });

  it("does not mutate other overlays", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
      result.current.addTextOverlay(640, 360);
    });

    const [first, second] = result.current.overlays;

    act(() => {
      result.current.updateOverlay(first.id, { x: 999 });
    });

    // Second overlay should be unchanged
    expect(result.current.overlays[1].id).toBe(second.id);
    expect(result.current.overlays[1].x).toBe(320);
  });

  it("preserves fields not included in the patch", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    const id = result.current.overlays[0].id;

    act(() => {
      result.current.updateOverlay(id, { x: 50 });
    });

    const overlay = result.current.overlays[0] as TextOverlay;
    // y, text, fontFamily, etc. should be unchanged
    expect(overlay.y).toBe(180);
    expect(overlay.text).toBe("Your text here");
    expect(overlay.fontFamily).toBe("Arial");
  });

  it("is a no-op when the id does not match any overlay", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    const before = result.current.overlays[0].x;

    act(() => {
      result.current.updateOverlay("non-existent-id", { x: 999 });
    });

    expect(result.current.overlays[0].x).toBe(before);
  });
});

// ─── deleteOverlay ────────────────────────────────────────────────────────────

describe("deleteOverlay", () => {
  it("removes the overlay from the list", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    const id = result.current.overlays[0].id;

    act(() => {
      result.current.deleteOverlay(id);
    });

    expect(result.current.overlays).toHaveLength(0);
  });

  it("clears selectedId when the deleted overlay was selected", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    const id = result.current.overlays[0].id;

    act(() => {
      result.current.selectOverlay(id);
    });

    expect(result.current.selectedId).toBe(id);

    act(() => {
      result.current.deleteOverlay(id);
    });

    expect(result.current.selectedId).toBeNull();
  });

  it("does not clear selectedId when a different overlay is deleted", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
      result.current.addTextOverlay(640, 360);
    });

    const [first, second] = result.current.overlays;

    act(() => {
      result.current.selectOverlay(first.id);
    });

    act(() => {
      result.current.deleteOverlay(second.id);
    });

    // first is still selected
    expect(result.current.selectedId).toBe(first.id);
    expect(result.current.overlays).toHaveLength(1);
  });
});

// ─── selectOverlay ────────────────────────────────────────────────────────────

describe("selectOverlay", () => {
  it("sets selectedId to the given id", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    const id = result.current.overlays[0].id;

    act(() => {
      result.current.selectOverlay(id);
    });

    expect(result.current.selectedId).toBe(id);
  });

  it("clears selection when called with null", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));

    act(() => {
      result.current.addTextOverlay(640, 360);
    });

    const id = result.current.overlays[0].id;

    act(() => {
      result.current.selectOverlay(id);
    });

    act(() => {
      result.current.selectOverlay(null);
    });

    expect(result.current.selectedId).toBeNull();
  });

  it("starts with no selection", () => {
    const { result } = renderHook(() => useVideoOverlays(VIDEO_DURATION));
    expect(result.current.selectedId).toBeNull();
  });
});
