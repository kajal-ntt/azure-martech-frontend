"use client";

import { useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import {
  Overlay,
  TextOverlay,
  ShapeOverlay,
  UseFFmpegCompositorReturn,
  CompositeParams,
} from "@/components/video/VideoOverlayEditor";

// ─── Canvas renderers ─────────────────────────────────────────────────────────
// Each renderer draws one overlay onto an offscreen canvas at video-native
// resolution and returns the PNG bytes to write into FFmpeg's virtual FS.

/**
 * Renders a TextOverlay to a PNG at video-native scale.
 * Respects: font family/size/weight/style, fill, opacity, shadow, outline,
 * highlight/background, underline, letter-spacing, line-height, text-align.
 */
export function renderTextToPng(overlay: TextOverlay, scaleFactor: number): Uint8Array {
  const sf = scaleFactor;
  const fontSize = Math.round(overlay.fontSize * sf);
  const lineHeight = overlay.lineHeight ?? 1.2;
  const letterSpacing = (overlay.letterSpacing ?? 0) * sf;

  const fontStyle = [
    overlay.fontStyle === "italic" ? "italic" : "",
    overlay.fontWeight === "bold" ? "bold" : "",
  ].filter(Boolean).join(" ") || "normal";

  const fontStr = `${fontStyle} ${fontSize}px ${overlay.fontFamily}`;

  // ── Measure each line ──────────────────────────────────────────────────────
  const lines = overlay.text.split("\n");
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = fontStr;

  const lineWidths = lines.map((line) => {
    if (letterSpacing === 0) return measure.measureText(line).width;
    // Manual letter-spacing measurement
    return [...line].reduce((acc, ch) => acc + measure.measureText(ch).width + letterSpacing, 0);
  });

  const textW = Math.ceil(Math.max(...lineWidths, 1));
  const lineH = Math.round(fontSize * lineHeight);
  const textH = lineH * lines.length;

  const pad = Math.round(4 * sf);
  const highlightPad = overlay.highlightEnabled ? Math.round((overlay.highlightPadding ?? 8) * sf) : 0;

  const canvas = document.createElement("canvas");
  canvas.width  = textW + pad * 2 + highlightPad * 2;
  canvas.height = textH + pad * 2 + highlightPad * 2;

  const ctx = canvas.getContext("2d")!;
  ctx.globalAlpha = overlay.opacity ?? 1;

  // ── Highlight / background ─────────────────────────────────────────────────
  if (overlay.highlightEnabled) {
    ctx.fillStyle = overlay.highlightColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 4 * sf);
    ctx.fill();
  }

  ctx.font = fontStr;
  ctx.textBaseline = "top";

  const drawLine = (line: string, x: number, y: number) => {
    if (letterSpacing === 0) {
      return ctx.fillText(line, x, y);
    }
    let cx = x;
    for (const ch of line) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + letterSpacing;
    }
  };

  lines.forEach((line, i) => {
    const y = pad + highlightPad + i * lineH;
    let x = pad + highlightPad;

    // Align
    const lineW = lineWidths[i];
    if (overlay.textAlign === "center") x += (textW - lineW) / 2;
    else if (overlay.textAlign === "right") x += textW - lineW;

    // ── Outline ──────────────────────────────────────────────────────────────
    if (overlay.outlineEnabled) {
      ctx.strokeStyle = overlay.outlineColor;
      ctx.lineWidth = (overlay.outlineWidth ?? 2) * sf * 2;
      ctx.lineJoin = "round";
      if (letterSpacing === 0) {
        ctx.strokeText(line, x, y);
      } else {
        let cx = x;
        for (const ch of line) {
          ctx.strokeText(ch, cx, y);
          cx += ctx.measureText(ch).width + letterSpacing;
        }
      }
    }

    // ── Shadow ───────────────────────────────────────────────────────────────
    if (overlay.shadowEnabled) {
      ctx.shadowColor   = overlay.shadowColor;
      ctx.shadowBlur    = (overlay.shadowBlur ?? 6) * sf;
      ctx.shadowOffsetX = (overlay.shadowOffsetX ?? 2) * sf;
      ctx.shadowOffsetY = (overlay.shadowOffsetY ?? 2) * sf;
    }

    // ── Fill ─────────────────────────────────────────────────────────────────
    ctx.fillStyle = overlay.fill;
    drawLine(line, x, y);

    // Reset shadow so it doesn't bleed into next line
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // ── Underline ────────────────────────────────────────────────────────────
    if (overlay.underline) {
      ctx.strokeStyle = overlay.fill;
      ctx.lineWidth = Math.max(1, fontSize * 0.06);
      ctx.beginPath();
      ctx.moveTo(x, y + fontSize + 1);
      ctx.lineTo(x + lineW, y + fontSize + 1);
      ctx.stroke();
    }
  });

  return canvasToPng(canvas);
}

function strokeShapeBorder(
  ctx: CanvasRenderingContext2D,
  overlay: ShapeOverlay,
  borderWidth: number,
  scaleFactor: number,
  drawPath: () => void
) {
  if (!overlay.borderEnabled) return;

  ctx.strokeStyle = overlay.borderColor;
  ctx.lineWidth = borderWidth;
  if (overlay.borderStyle === "dashed") ctx.setLineDash([10 * scaleFactor, 5 * scaleFactor]);
  drawPath();
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBadgeText(
  ctx: CanvasRenderingContext2D,
  overlay: ShapeOverlay,
  x: number,
  y: number,
  width: number,
  height: number
) {
  if (overlay.shapeType !== "badge" || !overlay.badgeText) return;

  const badgeFontSize = Math.round(height * 0.4);
  ctx.font = `bold ${badgeFontSize}px Arial`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(overlay.badgeText, x + width / 2, y + height / 2);
}

function drawCircleShape(
  ctx: CanvasRenderingContext2D,
  overlay: ShapeOverlay,
  dimensions: { x: number; y: number; width: number; height: number; borderWidth: number; scaleFactor: number }
) {
  const rx = dimensions.width / 2;
  const ry = dimensions.height / 2;
  const drawPath = () => {
    ctx.beginPath();
    ctx.ellipse(dimensions.x + rx, dimensions.y + ry, rx, ry, 0, 0, Math.PI * 2);
  };

  drawPath();
  ctx.fillStyle = overlay.fill;
  ctx.fill();
  strokeShapeBorder(ctx, overlay, dimensions.borderWidth, dimensions.scaleFactor, drawPath);
}

function drawRoundedShape(
  ctx: CanvasRenderingContext2D,
  overlay: ShapeOverlay,
  dimensions: { x: number; y: number; width: number; height: number; borderWidth: number; scaleFactor: number }
) {
  const radius = overlay.shapeType === "badge"
    ? dimensions.height / 2
    : Math.round((overlay.cornerRadius ?? 0) * dimensions.scaleFactor);
  const drawPath = () => {
    ctx.beginPath();
    ctx.roundRect(dimensions.x, dimensions.y, dimensions.width, dimensions.height, radius);
  };

  drawPath();
  ctx.fillStyle = overlay.fill;
  ctx.fill();
  strokeShapeBorder(ctx, overlay, dimensions.borderWidth, dimensions.scaleFactor, drawPath);
  drawBadgeText(ctx, overlay, dimensions.x, dimensions.y, dimensions.width, dimensions.height);
}

/**
 * Renders a ShapeOverlay to a PNG at video-native scale.
 * Respects: shapeType (rectangle/circle/badge), fill, opacity, cornerRadius,
 * border (color/width/style), badge text.
 */
export function renderShapeToPng(overlay: ShapeOverlay, scaleFactor: number): Uint8Array {
  const sf = scaleFactor;
  const w = Math.round(overlay.width  * sf);
  const h = Math.round(overlay.height * sf);
  const bw = overlay.borderEnabled ? Math.round((overlay.borderWidth ?? 2) * sf) : 0;

  const canvas = document.createElement("canvas");
  canvas.width  = w + bw * 2;
  canvas.height = h + bw * 2;

  const ctx = canvas.getContext("2d")!;
  ctx.globalAlpha = overlay.opacity ?? 1;

  const ox = bw; // offset so border isn't clipped
  const oy = bw;
  const dimensions = { x: ox, y: oy, width: w, height: h, borderWidth: bw, scaleFactor: sf };

  if (overlay.shapeType === "circle") {
    drawCircleShape(ctx, overlay, dimensions);
  } else {
    drawRoundedShape(ctx, overlay, dimensions);
  }

  return canvasToPng(canvas);
}

/**
 * Fetches an image URL and returns its PNG bytes at the given target dimensions.
 * Handles data: URLs (base64) and http/https URLs.
 */
export async function renderImageToPng(
  src: string,
  targetW: number,
  targetH: number,
  opacity: number,
  flipX: boolean,
  flipY: boolean,
  borderRadius: number,
): Promise<Uint8Array> {
  const img = await loadImage(src);

  const canvas = document.createElement("canvas");
  canvas.width  = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  ctx.globalAlpha = opacity;

  // Clip to rounded rect if needed
  if (borderRadius > 0) {
    ctx.beginPath();
    ctx.roundRect(0, 0, targetW, targetH, borderRadius);
    ctx.clip();
  }

  // Apply flip transforms
  ctx.save();
  ctx.translate(flipX ? targetW : 0, flipY ? targetH : 0);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(img, 0, 0, targetW, targetH);
  ctx.restore();

  return canvasToPng(canvas);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function canvasToPng(canvas: HTMLCanvasElement): Uint8Array {
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.codePointAt(i) ?? 0;
  return bytes;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 80)}`));
    img.src = src;
  });
}

interface LoadedRef {
  current: boolean;
}

async function ensureFfmpegLoaded(ffmpeg: FFmpeg, loadedRef: LoadedRef) {
  if (loadedRef.current) return;

  const coreURL = await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript");
  const wasmURL = await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm");
  await ffmpeg.load({ coreURL, wasmURL });
  loadedRef.current = true;
}

async function writeSourceVideo(ffmpeg: FFmpeg, videoSrc: string) {
  const videoRes = await fetch(videoSrc);
  await ffmpeg.writeFile("input.mp4", new Uint8Array(await videoRes.arrayBuffer()));
}

async function renderOverlayToPng(overlay: Overlay, scaleFactor: number): Promise<Uint8Array | null> {
  if (overlay.type === "logo") {
    const w = Math.round(overlay.width * scaleFactor);
    const h = Math.round(overlay.height * scaleFactor);
    return renderImageToPng(overlay.src, w, h, overlay.opacity ?? 1, false, false, 0);
  }

  if (overlay.type === "image") {
    const w = Math.round(overlay.width * scaleFactor);
    const h = Math.round(overlay.height * scaleFactor);
    return renderImageToPng(
      overlay.src,
      w,
      h,
      overlay.opacity ?? 1,
      overlay.flipX,
      overlay.flipY,
      Math.round((overlay.borderRadius ?? 0) * scaleFactor),
    );
  }

  if (overlay.type === "text") return renderTextToPng(overlay, scaleFactor);
  if (overlay.type === "shape") return renderShapeToPng(overlay, scaleFactor);
  return null;
}

async function writeOverlayPngs(ffmpeg: FFmpeg, overlays: Overlay[], scaleFactor: number) {
  for (let i = 0; i < overlays.length; i++) {
    const pngBytes = await renderOverlayToPng(overlays[i], scaleFactor);
    if (pngBytes) {
      await ffmpeg.writeFile(`overlay_${i}.png`, pngBytes);
    }
  }
}

function buildOverlayFilterArgs(params: CompositeParams, overlays: Overlay[], scaleFactor: number) {
  const inputArgs: string[] = ["-i", "input.mp4"];
  const filterParts: string[] = [];
  let streamLabel = "0:v";
  let inputIdx = 1;

  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];
    const scaledX = Math.round(overlay.x * scaleFactor);
    const scaledY = Math.round(overlay.y * scaleFactor);
    const cx = Math.max(0, Math.min(scaledX, params.videoIntrinsicWidth - 1));
    const cy = Math.max(0, Math.min(scaledY, params.videoIntrinsicHeight - 1));
    const outPoint = overlay.timeline.outPoint > 0 ? overlay.timeline.outPoint : 999999;
    const outLabel = `v${inputIdx}`;

    inputArgs.push("-i", `overlay_${i}.png`);
    filterParts.push(
      `[${streamLabel}][${inputIdx}:v]overlay=x=${cx}:y=${cy}:enable='between(t,${overlay.timeline.inPoint},${outPoint})'[${outLabel}]`
    );
    streamLabel = outLabel;
    inputIdx++;
  }

  return { inputArgs, filterComplex: filterParts.join("; "), streamLabel };
}

async function runFfmpegComposite(ffmpeg: FFmpeg, params: CompositeParams, overlays: Overlay[], scaleFactor: number) {
  if (overlays.length === 0) {
    await ffmpeg.exec(["-i", "input.mp4", "-c", "copy", "output.mp4"]);
    return;
  }

  const { inputArgs, filterComplex, streamLabel } = buildOverlayFilterArgs(params, overlays, scaleFactor);
  await ffmpeg.exec([
    ...inputArgs,
    "-filter_complex", filterComplex,
    "-map", `[${streamLabel}]`,
    "-map", "0:a?",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-c:a", "copy",
    "-movflags", "+faststart",
    "output.mp4",
  ]);
}

async function readOutputBlob(ffmpeg: FFmpeg) {
  const data = await ffmpeg.readFile("output.mp4");
  const bytes = typeof data === "string"
    ? new TextEncoder().encode(data)
    : Uint8Array.from(data as Uint8Array);
  return new Blob([bytes], { type: "video/mp4" });
}

// ─── useFFmpegCompositor ──────────────────────────────────────────────────────

export function useFFmpegCompositor(): UseFFmpegCompositorReturn {
  const [isLoading,    setIsLoading]    = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const ffmpegRef  = useRef<FFmpeg>(new FFmpeg());
  const loadedRef  = useRef<boolean>(false);

  const composite = useCallback(
    async (params: CompositeParams): Promise<Blob | null> => {
      const ffmpeg = ffmpegRef.current;

      try {
        // ── Load FFmpeg WASM (once) ────────────────────────────────────────────
        setIsLoading(true);
        await ensureFfmpegLoaded(ffmpeg, loadedRef);
        setIsLoading(false);

        // ── Fetch and write source video ──────────────────────────────────────
        await writeSourceVideo(ffmpeg, params.videoSrc);

        const sf = params.videoIntrinsicWidth / params.stageWidth; // scale factor

        // ── Prepare every overlay as a PNG file in FFmpeg's FS ────────────────
        // We process overlays in render order (array order = bottom → top).
        // Each overlay gets a unique filename: overlay_0.png, overlay_1.png, …
        const activeOverlays = params.overlays; // all types, in order
        await writeOverlayPngs(ffmpeg, activeOverlays, sf);

        // ── Build FFmpeg filter graph ──────────────────────────────────────────
        setIsProcessing(true);
        await runFfmpegComposite(ffmpeg, params, activeOverlays, sf);
        setIsProcessing(false);

        // ── Read output ───────────────────────────────────────────────────────
        return readOutputBlob(ffmpeg);

      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsLoading(false);
        setIsProcessing(false);
        return null;
      }
    },
    []
  );

  return { isLoading, isProcessing, error, composite };
}
