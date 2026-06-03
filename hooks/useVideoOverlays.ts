"use client";

import { useState, useCallback } from "react";
import {
  Overlay,
  LogoOverlay,
  ImageOverlay,
  TextOverlay,
  ShapeOverlay,
  UseVideoOverlaysReturn,
} from "@/components/video/VideoOverlayEditor";

/**
 * Generates a unique overlay id.
 * Uses crypto.randomUUID when available, then crypto.getRandomValues.
 * The final fallback is monotonic and intentionally not random.
 */
let fallbackIdCounter = 0;

function generateId(): string {
  const webCrypto = globalThis.crypto;

  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  if (typeof webCrypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }

  fallbackIdCounter += 1;
  return `overlay-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

/**
 * useVideoOverlays — manages the list of overlays and the current selection.
 *
 * @param videoDuration  The duration of the source video in seconds.
 *                       Used to initialise each new overlay's outPoint.
 */
export function useVideoOverlays(videoDuration: number): UseVideoOverlaysReturn {
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ─── 3.2 addLogoOverlay ────────────────────────────────────────────────────

  /**
   * Adds a LogoOverlay pre-populated with the given image.
   * Placed at (20, 20) with a default width of 120 px; height is derived
   * from the image's natural aspect ratio.
   */
  const addLogoOverlay = useCallback(
    (src: string, image: HTMLImageElement) => {
      const aspectRatio =
        image.naturalHeight > 0 && image.naturalWidth > 0
          ? image.naturalHeight / image.naturalWidth
          : 1;

      const width = 120;
      const height = Math.round(width * aspectRatio);

      const overlay: LogoOverlay = {
        id: generateId(),
        type: "logo",
        src,
        x: 20,
        y: 20,
        width,
        height,
        opacity: 1,
        konvaImage: image,
        timeline: { inPoint: 0, outPoint: videoDuration },
      };

      setOverlays((prev) => [...prev, overlay]);
    },
    [videoDuration]
  );

  // ─── 3.3 addTextOverlay ────────────────────────────────────────────────────

  /**
   * Adds a TextOverlay centered on the stage with sensible defaults.
   */
  const addTextOverlay = useCallback(
    (stageWidth: number, stageHeight: number) => {
      const overlay: TextOverlay = {
        id: generateId(),
        type: "text",
        text: "Your text here",
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
        shadowColor: "rgba(0,0,0,0.6)",
        shadowBlur: 6,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        outlineEnabled: false,
        outlineColor: "#000000",
        outlineWidth: 2,
        highlightEnabled: false,
        highlightColor: "rgba(0,0,0,0.5)",
        highlightPadding: 8,
        x: stageWidth / 2,
        y: stageHeight / 2,
        timeline: { inPoint: 0, outPoint: videoDuration },
      };

      setOverlays((prev) => [...prev, overlay]);
    },
    [videoDuration]
  );

  // ─── 3.3.5 addShapeOverlay ────────────────────────────────────────────────

  /**
   * Adds a ShapeOverlay centered on the stage with sensible defaults.
   */
  const addShapeOverlay = useCallback(
    (stageWidth: number, stageHeight: number) => {
      const overlay: ShapeOverlay = {
        id: generateId(),
        type: "shape",
        shapeType: "rectangle",
        width: 200,
        height: 100,
        fill: "#4CAF31",
        fillType: "solid",
        opacity: 1,
        cornerRadius: 8,
        borderEnabled: true,
        borderColor: "#ffffff",
        borderWidth: 2,
        borderStyle: "solid",
        x: stageWidth / 2 - 100,
        y: stageHeight / 2 - 50,
        timeline: { inPoint: 0, outPoint: videoDuration },
      };

      setOverlays((prev) => [...prev, overlay]);
    },
    [videoDuration]
  );

  // ─── addShapeWithType ─────────────────────────────────────────────────────
  const addShapeWithType = useCallback(
    (stageWidth: number, stageHeight: number, shapeId: string, shapePath: string, shapeLabel: string) => {
      const overlay: ShapeOverlay = {
        id: generateId(),
        type: "shape",
        shapeType: "library",
        shapeLibraryId: shapeId,
        shapePath,
        width: 150,
        height: 150,
        fill: "#4CAF31",
        fillType: "solid",
        opacity: 1,
        cornerRadius: 0,
        borderEnabled: false,
        borderColor: "#ffffff",
        borderWidth: 2,
        borderStyle: "solid",
        x: stageWidth / 2 - 75,
        y: stageHeight / 2 - 75,
        timeline: { inPoint: 0, outPoint: videoDuration },
      };
      setOverlays((prev) => [...prev, overlay]);
    },
    [videoDuration]
  );

  // ─── addBadgeOverlay ──────────────────────────────────────────────────────
  const addBadgeOverlay = useCallback(
    (stageWidth: number, stageHeight: number, badgeText: string, badgeColor: string) => {
      const overlay: ShapeOverlay = {
        id: generateId(),
        type: "shape",
        shapeType: "badge",
        badgeText,
        width: 160,
        height: 50,
        fill: badgeColor,
        fillType: "solid",
        opacity: 1,
        cornerRadius: 25,
        borderEnabled: false,
        borderColor: "#ffffff",
        borderWidth: 2,
        borderStyle: "solid",
        x: stageWidth / 2 - 80,
        y: stageHeight / 2 - 25,
        timeline: { inPoint: 0, outPoint: videoDuration },
      };
      setOverlays((prev) => [...prev, overlay]);
    },
    [videoDuration]
  );

  // ─── 3.4 updateOverlay ────────────────────────────────────────────────────

  /**
   * Merges `patch` into the overlay identified by `id`.
   * All other overlays are left untouched.
   */
  const updateOverlay = useCallback(
    (id: string, patch: Partial<Overlay>) => {
      setOverlays((prev) =>
        prev.map((overlay) =>
          overlay.id === id ? ({ ...overlay, ...patch } as Overlay) : overlay
        )
      );
    },
    []
  );

  // ─── 3.5 deleteOverlay ────────────────────────────────────────────────────

  /**
   * Removes the overlay with the given id.
   * If it was selected, the selection is cleared.
   */
  const deleteOverlay = useCallback((id: string) => {
    setOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  // ─── reorderOverlay ──────────────────────────────────────────────────────

  const reorderOverlay = useCallback(
    (id: string, direction: "up" | "down" | "top" | "bottom") => {
      setOverlays((prev) => {
        const idx = prev.findIndex(o => o.id === id);
        if (idx === -1) return prev;
        const next = [...prev];
        const [item] = next.splice(idx, 1);
        if (direction === "top") next.unshift(item);
        else if (direction === "bottom") next.push(item);
        else if (direction === "up") next.splice(Math.max(0, idx - 1), 0, item);
        else next.splice(Math.min(next.length, idx + 1), 0, item);
        return next;
      });
    },
    []
  );

  // ─── duplicateOverlay ─────────────────────────────────────────────────────

  const duplicateOverlay = useCallback(
    (id: string) => {
      setOverlays((prev) => {
        const overlay = prev.find(o => o.id === id);
        if (!overlay) return prev;
        const newId = generateId();
        const dup = { ...overlay, id: newId, x: overlay.x + 20, y: overlay.y + 20 };
        return [...prev, dup as Overlay];
      });
    },
    []
  );

  /**
   * Sets the currently selected overlay id (or clears selection with null).
   */
  const selectOverlay = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  // ─── addImageOverlay ──────────────────────────────────────────────────────

  /**
   * Adds an ImageOverlay centered on the stage with full styling defaults.
   */
  const addImageOverlay = useCallback(
    (src: string, image: HTMLImageElement) => {
      const aspectRatio =
        image.naturalHeight > 0 && image.naturalWidth > 0
          ? image.naturalHeight / image.naturalWidth
          : 1;
      const width = 200;
      const height = Math.round(width * aspectRatio);

      const overlay: ImageOverlay = {
        id: generateId(),
        type: "image",
        src,
        x: 60,
        y: 60,
        width,
        height,
        opacity: 1,
        borderEnabled: false,
        borderColor: "#ffffff",
        borderWidth: 2,
        borderRadius: 0,
        flipX: false,
        flipY: false,
        konvaImage: image,
        timeline: { inPoint: 0, outPoint: videoDuration },
      };

      setOverlays((prev) => [...prev, overlay]);
    },
    [videoDuration]
  );

  return {
    overlays,
    selectedId,
    addLogoOverlay,
    addTextOverlay,
    addShapeOverlay,
    addShapeWithType,
    addBadgeOverlay,
    addImageOverlay,
    updateOverlay,
    deleteOverlay,
    selectOverlay,
    reorderOverlay,
    duplicateOverlay,
  };
}
