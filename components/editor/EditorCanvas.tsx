"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from "react";
import * as fabric from "fabric";
import { SHAPE_LIBRARY } from "@/lib/shapes";

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontWeight: string | number;
  fontStyle: string;
  textAlign: string;
  underline: boolean;
  linethrough: boolean;
  lineHeight: number;
  charSpacing: number;
  opacity: number;
  // effects
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeDashArray?: number[] | null; // border style: null=solid, [6,4]=dashed, [2,4]=dotted
  borderRadius?: number;             // rx/ry for rect shapes (0Ã¢â‚¬â€œ200)
  // Gradient fill (for shapes/objects)
  gradientEnabled?: boolean;
  gradientType?: "linear" | "radial";
  gradientColor1?: string;
  gradientColor2?: string;
  gradientAngle?: number; // degrees, for linear gradient
  gradientFocalRadius?: number; // 0Ã¢â‚¬â€œ1, for radial: 0=tight center, 1=full radius
  // Highlight Ã¢â‚¬â€ rendered as a full-textbox background rect (not per-line)
  highlightEnabled?: boolean;
  highlightColor?: string;     // hex, e.g. "#ffff00"
  highlightOpacity?: number;   // 0Ã¢â‚¬â€œ1
  highlightPadding?: number;   // px padding around the textbox
  flipX?: boolean;
  flipY?: boolean;
  isImage?: boolean;
  // Position & size (for the properties panel)
  posX?: number;
  posY?: number;
  objWidth?: number;
  objHeight?: number;
  // Curved text Ã¢â‚¬â€ when the selected object is a curved-text image
  isCurvedText?: boolean;
  curvedTextSource?: string;   // the original text string
  curvedTextEffect?: string;   // the effect id
}

export interface LayerDef {
  id: string;
  label: string;
  type: "background" | "graphic" | "logo" | "actors" | "text" | "shape" | "element" | "image";
  url?: string;
  text?: string;
  top?: number;
  locked?: boolean;
  visible?: boolean;
}

export interface LayerInfo {
  id: string;
  label: string;
  type: string;
  visible: boolean;
  locked: boolean;
}

export type HorizontalAlign = "left" | "center" | "right" | null;
export type VerticalAlign = "top" | "middle" | "bottom" | null;

export interface EditorCanvasRef {
  addText: () => void;
  addImageLayer: (url: string, label: string, id: string) => void;
  deleteSelected: () => void;
  getSelectedTextStyle: () => TextStyle | null;
  applyTextStyle: (style: Partial<TextStyle>) => void;
  enterCropMode: () => void;
  applyCrop: () => void;
  cancelCrop: () => void;
  resize: (width: number, height: number) => void;
  fitToContainer: (containerWidth: number, containerHeight: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  getZoom: () => number;
  undo: () => void;
  canUndo: () => boolean;
  exportBlob: () => Promise<Blob>;
  getLayers: () => LayerInfo[];
  setLayerVisible: (id: string, visible: boolean) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  selectLayer: (id: string) => void;
  bringLayerForward: (id: string) => void;
  sendLayerBackward: (id: string) => void;
  bringLayerToFront: (id: string) => void;
  sendLayerToBack: (id: string) => void;
  alignLayer: (id: string, hAlign: "left" | "center" | "right" | null, vAlign: "top" | "middle" | "bottom" | null) => void;
  addShape: (shape: string) => void;
  addElement: (element: import("./Toolbar").ElementType) => void;
  addUploadedImage: (file: File) => void;
  getActiveLayerId: () => string | null;
  alignActiveObject: (hAlign: HorizontalAlign, vAlign: VerticalAlign) => void;
  addCurvedText: (text: string, effect: CurvedTextEffect, options?: Partial<CurvedTextOptions>) => void;
  applyTextShape: (effect: CurvedTextEffect) => void;
  addBadge: (badgeType: BadgeType) => void;
  duplicateSelected: () => void;
  updateCurvedText: (text: string) => void;
  getSelectedPosition: () => { x: number; y: number; w: number; h: number } | null;
  setSelectedPosition: (x: number, y: number) => void;
  setSelectedSize: (w: number, h: number) => void;
}

export type CurvedTextEffect =
  | "arc-up"
  | "arc-down"
  | "circle"
  | "wave"
  | "squeeze"
  | "bulge"
  | "flag"
  | "arch";

export type BadgeType =
  | "badge-sale"
  | "badge-new"
  | "badge-hot"
  | "badge-50off"
  | "badge-limited"
  | "badge-free"
  | "badge-best"
  | "badge-trending";

export interface CurvedTextOptions {
  fontSize: number;
  fontFamily: string;
  fill: string;
  fontWeight: string;
  radius: number;       // for arc/circle effects
  amplitude: number;    // for wave/flag effects
}

export interface EditorCanvasProps {
  layers: LayerDef[];
  initialWidth?: number;
  initialHeight?: number;
  onDirty: () => void;
  onSelectionChange: (style: TextStyle | null) => void;
  onLayersChange: (layers: LayerInfo[]) => void;
  onImageLoaded?: () => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 800;

// Crop box state in % of canvas display size (0Ã¢â‚¬â€œ100)
interface CropBox { x: number; y: number; w: number; h: number; }

const DEFAULT_SHADOW = { color: "#000000", blur: 0, x: 0, y: 0 };
const TEXT_SELECTION_KEYS = [
  "fontFamily",
  "fontSize",
  "fill",
  "fontWeight",
  "fontStyle",
  "underline",
  "linethrough",
] as const;

function isTextObject(obj: fabric.FabricObject | null | undefined): obj is fabric.IText {
  return obj?.type === "i-text" || obj?.type === "textbox";
}

interface SelectionStyleWithShadow {
  shadow?: fabric.Shadow | null;
}

function getSelectionShadow(obj: fabric.IText): fabric.Shadow | null | undefined {
  const [selectionStyle] = obj.getSelectionStyles() as SelectionStyleWithShadow[];
  return selectionStyle?.shadow;
}

function getShadowValues(s: any) {
  if (!s) return DEFAULT_SHADOW;
  return {
    color: s.color || "#000000",
    blur: s.blur || 0,
    x: s.offsetX || 0,
    y: s.offsetY || 0,
  };
}

function buildBaseTextStyle(obj: fabric.IText): TextStyle {
  const shadow = getShadowValues(obj.shadow);

  return {
    fontFamily: obj.fontFamily || "Arial",
    fontSize: obj.fontSize || 24,
    fill: typeof obj.fill === "string" ? obj.fill : "#000000",
    fontWeight: obj.fontWeight || "normal",
    fontStyle: obj.fontStyle || "normal",
    textAlign: obj.textAlign || "left",
    underline: obj.underline || false,
    linethrough: obj.linethrough || false,
    lineHeight: obj.lineHeight || 1.16,
    charSpacing: obj.charSpacing || 0,
    opacity: obj.opacity ?? 1,
    shadowColor: shadow.color,
    shadowBlur: shadow.blur,
    shadowOffsetX: shadow.x,
    shadowOffsetY: shadow.y,
    stroke: typeof obj.stroke === "string" ? obj.stroke : "transparent",
    strokeWidth: obj.strokeWidth || 0,
    highlightEnabled: !!(obj as any).__highlightEnabled,
    highlightColor: (obj as any).__highlightColor || "#ffff00",
    highlightOpacity: (obj as any).__highlightOpacity ?? 0.5,
    highlightPadding: (obj as any).__highlightPadding ?? 8,
  };
}

function applySelectionTextOverrides(base: TextStyle, selectionStyle: any) {
  for (const key of TEXT_SELECTION_KEYS) {
    if (selectionStyle[key] !== undefined) {
      (base as any)[key] = selectionStyle[key];
    }
  }

  if (selectionStyle.shadow) {
    const shadow = getShadowValues(selectionStyle.shadow);
    base.shadowColor = shadow.color;
    base.shadowBlur = shadow.blur;
    base.shadowOffsetX = shadow.x;
    base.shadowOffsetY = shadow.y;
  }

  if (selectionStyle.stroke !== undefined) base.stroke = selectionStyle.stroke;
  if (selectionStyle.strokeWidth !== undefined) base.strokeWidth = selectionStyle.strokeWidth;
}

function getTextStyleFromObject(obj: fabric.IText): TextStyle {
  const base = buildBaseTextStyle(obj);
  if (!obj.isEditing) return base;

  const selectionStyle = obj.getSelectionStyles()?.[0] as any;
  if (!selectionStyle) return base;

  applySelectionTextOverrides(base, selectionStyle);
  return base;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Curved text renderer Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function renderArc(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, totalW: number, radius: number, isUp: boolean) {
  const r = radius;
  const totalAngle = totalW / r;
  const startAngle = -Math.PI / 2 - totalAngle / 2;
  const dir = isUp ? 1 : -1;
  const arcCy = isUp ? cy + r * 0.3 : cy - r * 0.3;

  let charX = 0;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    const angle = startAngle + dir * (charX + w / 2) / r;
    ctx.save();
    ctx.translate(cx + r * Math.cos(angle), arcCy + r * Math.sin(angle));
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(ch, -w / 2, 0);
    ctx.restore();
    charX += w;
  }
}

function renderCircle(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, totalW: number, radius: number) {
  const r = radius;
  const totalAngle = (totalW / (2 * Math.PI * r)) * 2 * Math.PI;
  const startAngle = -Math.PI / 2 - totalAngle / 2;

  let charX = 0;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    const angle = startAngle + (charX + w / 2) / r;
    ctx.save();
    ctx.translate(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(ch, -w / 2, 0);
    ctx.restore();
    charX += w;
  }
}

function renderWaveOrFlag(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, totalW: number, amplitude: number, isWave: boolean) {
  const startX = cx - totalW / 2;
  let charX = 0;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    const x = startX + charX + w / 2;
    const progress = charX / totalW;
    const y = cy + Math.sin(progress * Math.PI * 2) * amplitude;

    ctx.save();
    ctx.translate(x, y);
    if (isWave) {
      const angle = Math.atan2(
        Math.cos(progress * Math.PI * 2) * amplitude * (Math.PI * 2) / totalW,
        1
      );
      ctx.rotate(angle);
    }
    ctx.fillText(ch, -w / 2, 0);
    ctx.restore();
    charX += w;
  }
}

function renderSqueezeOrBulge(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, totalW: number, isSqueeze: boolean) {
  const startX = cx - totalW / 2;
  let charX = 0;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    const progress = (charX + w / 2) / totalW;
    const scale = isSqueeze
      ? 0.5 + Math.abs(progress - 0.5) * 1
      : 1 + (0.5 - Math.abs(progress - 0.5)) * 1;
    ctx.save();
    ctx.translate(startX + charX + w / 2, cy);
    ctx.scale(1, scale);
    ctx.fillText(ch, -w / 2, 0);
    ctx.restore();
    charX += w;
  }
}

function renderArch(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, totalW: number, amplitude: number) {
  const startX = cx - totalW / 2;
  let charX = 0;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    const progress = (charX + w / 2) / totalW;
    const yOffset = -Math.sin(progress * Math.PI) * amplitude;
    const angle = Math.cos(progress * Math.PI) * amplitude / totalW * Math.PI;
    ctx.save();
    ctx.translate(startX + charX + w / 2, cy + yOffset);
    ctx.rotate(-angle);
    ctx.fillText(ch, -w / 2, 0);
    ctx.restore();
    charX += w;
  }
}

/**
 * Renders text along a curved path onto an offscreen canvas and returns a
 * data URL. Each character is placed individually at the correct angle along
 * the path.
 */
function renderCurvedTextToDataURL(
  text: string,
  effect: CurvedTextEffect,
  opts: Required<CurvedTextOptions>
): string {
  const { fontSize, fontFamily, fill, fontWeight, radius, amplitude } = opts;
  const fontStr = `${fontWeight} ${fontSize}px ${fontFamily}`;

  // Measure total text width
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = fontStr;
  const totalW = measure.measureText(text).width;

  // Canvas size Ã¢â‚¬â€ generous padding
  const pad = fontSize * 2;
  const size = Math.max(totalW + pad * 2, radius * 2 + pad * 2, 400);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.font = fontStr;
  ctx.fillStyle = fill;
  ctx.textBaseline = "alphabetic";

  const cx = size / 2;
  const cy = size / 2;

  switch (effect) {
    case "arc-up":
    case "arc-down":
      renderArc(ctx, text, cx, cy, totalW, radius, effect === "arc-up");
      break;
    case "circle":
      renderCircle(ctx, text, cx, cy, totalW, radius);
      break;
    case "wave":
    case "flag":
      renderWaveOrFlag(ctx, text, cx, cy, totalW, amplitude, effect === "wave");
      break;
    case "squeeze":
    case "bulge":
      renderSqueezeOrBulge(ctx, text, cx, cy, totalW, effect === "squeeze");
      break;
    case "arch":
      renderArch(ctx, text, cx, cy, totalW, amplitude);
      break;
  }

  return canvas.toDataURL("image/png");
}

function buildLayerInfo(obj: fabric.FabricObject): LayerInfo | null {
  const id = (obj as any).__layerId;
  if (!id) return null;
  return {
    id,
    label: (obj as any).__layerLabel ?? id,
    type: (obj as any).__layerType ?? "image",
    visible: obj.visible !== false,
    locked: !(obj.selectable ?? true),
  };
}

function setLayerMetadata(obj: fabric.FabricObject, layer: Pick<LayerDef, "id" | "label" | "type">) {
  (obj as any).__layerId = layer.id;
  (obj as any).__layerLabel = layer.label;
  (obj as any).__layerType = layer.type;
}

function getBackgroundObject(canvas: fabric.Canvas) {
  return canvas.getObjects().find((o) => (o as any).__layerType === "background");
}

function placeAboveBackground(canvas: fabric.Canvas, obj: fabric.FabricObject) {
  canvas.sendObjectToBack(obj);
  const bgObj = getBackgroundObject(canvas);
  if (bgObj) {
    canvas.moveObjectTo(obj, canvas.getObjects().indexOf(bgObj) + 1);
  }
}

function parseBottomBandConfig(layer: LayerDef) {
  let bandColor = "#1E3A5F";
  let heightPct = 0.18;

  try {
    const cfg = JSON.parse(layer.text || "{}");
    if (cfg.color) bandColor = cfg.color;
    if (cfg.heightPct) heightPct = cfg.heightPct;
  } catch {
    // Use defaults.
  }

  return { bandColor, heightPct };
}

function createBottomBand(layer: LayerDef, naturalSize: { w: number; h: number }) {
  const { bandColor, heightPct } = parseBottomBandConfig(layer);
  const bandH = Math.round(naturalSize.h * heightPct);
  const band = new fabric.Rect({
    left: 0,
    top: naturalSize.h - bandH,
    width: naturalSize.w,
    height: bandH,
    fill: bandColor,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
  });
  setLayerMetadata(band, { id: layer.id, label: layer.label, type: "shape" });
  return band;
}

function createTextLayerObject(layer: LayerDef, naturalSize: { w: number; h: number }) {
  const isHeadline = layer.id === "headline";
  const topPos = layer.top ?? (isHeadline ? naturalSize.h * 0.25 : naturalSize.h - 120);
  const text = new fabric.Textbox(layer.text || "Edit this text", {
    left: naturalSize.w / 2,
    top: topPos,
    width: naturalSize.w * 0.85,
    originX: "center",
    originY: "center",
    fontFamily: "Arial",
    fontSize: isHeadline ? 48 : 28,
    fontWeight: "bold",
    fill: "#ffffff",
    textAlign: "center",
    splitByGrapheme: false,
    shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.7)", blur: 8, offsetX: 0, offsetY: 2 }),
  });
  setLayerMetadata(text, layer);
  return text;
}

function getImagePlacement(layer: LayerDef, img: fabric.FabricImage, naturalSize: { w: number; h: number }) {
  const imgW = img.width || naturalSize.w;
  const imgH = img.height || naturalSize.h;

  if (layer.type === "background") {
    const scale = Math.max(naturalSize.w / imgW, naturalSize.h / imgH);
    return {
      scaleX: scale,
      scaleY: scale,
      left: naturalSize.w / 2,
      top: naturalSize.h / 2,
      originX: "center" as const,
      originY: "center" as const,
      selectable: false,
      evented: false,
    };
  }

  const maxSize = layer.type === "logo" ? 160 : 320;
  const scale = Math.min(maxSize / imgW, maxSize / imgH, 1);
  const positions: Record<string, { left: number; top: number }> = {
    logo: { left: naturalSize.w - 80, top: 80 },
    graphic: { left: naturalSize.w / 2, top: naturalSize.h / 2 },
    actors: { left: naturalSize.w / 2, top: naturalSize.h * 0.6 },
  };
  const pos = positions[layer.type] ?? { left: naturalSize.w / 2, top: naturalSize.h / 2 };

  return {
    scaleX: scale,
    scaleY: scale,
    left: pos.left,
    top: pos.top,
    originX: "center" as const,
    originY: "center" as const,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
  };
}

async function loadCanvasLayer(
  canvas: fabric.Canvas,
  layer: LayerDef,
  loadedLayerIds: Set<string>,
  naturalSize: { w: number; h: number },
  onImageLoaded?: () => void
) {
  loadedLayerIds.add(layer.id);

  if (layer.type === "shape" && layer.id === "bottom-band") {
    const band = createBottomBand(layer, naturalSize);
    canvas.add(band);
    placeAboveBackground(canvas, band);
    canvas.renderAll();
    return;
  }

  if (layer.type === "text") {
    canvas.add(createTextLayerObject(layer, naturalSize));
    canvas.renderAll();
    return;
  }

  if (!layer.url) return;

  try {
    const img = await fabric.FabricImage.fromURL(layer.url, { crossOrigin: "anonymous" });
    img.set(getImagePlacement(layer, img, naturalSize));
    setLayerMetadata(img, layer);
    canvas.add(img);
    if (layer.type === "background") canvas.sendObjectToBack(img);
    canvas.renderAll();
    onImageLoaded?.();
  } catch {
    loadedLayerIds.delete(layer.id);
  }
}

function clampCropValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getNextCropBox(drag: { type: string; startBox: CropBox }, dx: number, dy: number) {
  const { startBox: b, type } = drag;
  let { x, y, w, h } = b;
  const minSize = 5;

  if (type === "move") {
    return {
      x: clampCropValue(b.x + dx, 0, 100 - w),
      y: clampCropValue(b.y + dy, 0, 100 - h),
      w,
      h,
    };
  }

  if (type.includes("e")) w = clampCropValue(b.w + dx, minSize, 100 - b.x);
  if (type.includes("w")) {
    const nextWidth = Math.max(minSize, b.w - dx);
    x = b.x + b.w - nextWidth;
    w = nextWidth;
  }
  if (type.includes("s")) h = clampCropValue(b.h + dy, minSize, 100 - b.y);
  if (type.includes("n")) {
    const nextHeight = Math.max(minSize, b.h - dy);
    y = b.y + b.h - nextHeight;
    h = nextHeight;
  }

  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > 100) w = 100 - x;
  if (y + h > 100) h = 100 - y;

  return { x, y, w, h };
}

function applyHighlightUpdates(
  canvas: fabric.Canvas,
  active: fabric.FabricObject,
  style: Partial<TextStyle>,
  updates: any,
  syncHighlightRect: (canvas: fabric.Canvas, textObj: fabric.FabricObject) => void
) {
  const hasHighlightUpdate =
    style.highlightEnabled !== undefined ||
    style.highlightColor !== undefined ||
    style.highlightOpacity !== undefined ||
    style.highlightPadding !== undefined;

  if (!isTextObject(active) || !hasHighlightUpdate) return;

  if (style.highlightEnabled !== undefined) (active as any).__highlightEnabled = style.highlightEnabled;
  if (style.highlightColor !== undefined) (active as any).__highlightColor = style.highlightColor;
  if (style.highlightOpacity !== undefined) (active as any).__highlightOpacity = style.highlightOpacity;
  if (style.highlightPadding !== undefined) (active as any).__highlightPadding = style.highlightPadding;

  syncHighlightRect(canvas, active);
  delete updates.highlightEnabled;
  delete updates.highlightColor;
  delete updates.highlightOpacity;
  delete updates.highlightPadding;
}

function applyShadowUpdates(active: fabric.FabricObject, style: Partial<TextStyle>, updates: any) {
  const hasShadowUpdate =
    style.shadowColor !== undefined ||
    style.shadowBlur !== undefined ||
    style.shadowOffsetX !== undefined ||
    style.shadowOffsetY !== undefined;

  if (!hasShadowUpdate) return;

  const current = isTextObject(active) && active.isEditing
    ? getSelectionShadow(active)
    : active.shadow;

  updates.shadow = new fabric.Shadow({
    color: style.shadowColor ?? current?.color ?? "#000000",
    blur: style.shadowBlur ?? current?.blur ?? 0,
    offsetX: style.shadowOffsetX ?? current?.offsetX ?? 0,
    offsetY: style.shadowOffsetY ?? current?.offsetY ?? 0,
  });

  delete updates.shadowColor;
  delete updates.shadowBlur;
  delete updates.shadowOffsetX;
  delete updates.shadowOffsetY;
}

function applyGradientUpdates(active: fabric.FabricObject, updates: any) {
  const hasGradientUpdate =
    updates.gradientEnabled !== undefined ||
    updates.gradientType !== undefined ||
    updates.gradientColor1 !== undefined ||
    updates.gradientColor2 !== undefined ||
    updates.gradientAngle !== undefined ||
    updates.gradientFocalRadius !== undefined;

  if (!hasGradientUpdate) return;

  if (updates.gradientEnabled !== undefined) (active as any).__gradientEnabled = updates.gradientEnabled;
  if (updates.gradientType !== undefined) (active as any).__gradientType = updates.gradientType;
  if (updates.gradientColor1 !== undefined) (active as any).__gradientColor1 = updates.gradientColor1;
  if (updates.gradientColor2 !== undefined) (active as any).__gradientColor2 = updates.gradientColor2;
  if (updates.gradientAngle !== undefined) (active as any).__gradientAngle = updates.gradientAngle;
  if (updates.gradientFocalRadius !== undefined) (active as any).__gradientFocalRadius = updates.gradientFocalRadius;

  const enabled = (active as any).__gradientEnabled;
  const gType = (active as any).__gradientType || "linear";
  const color1 = (active as any).__gradientColor1 || "#4CAF31";
  const color2 = (active as any).__gradientColor2 || "#ffffff";
  const angle = (active as any).__gradientAngle ?? 0;
  const focalR = (active as any).__gradientFocalRadius ?? 0.5;

  if (enabled) {
    const w = active.width ?? 100;
    const h = active.height ?? 100;
    const rad = (angle * Math.PI) / 180;

    updates.fill = gType === "radial"
      ? new fabric.Gradient({
        type: "radial",
        gradientUnits: "pixels",
        coords: { x1: w / 2, y1: h / 2, r1: (Math.max(w, h) / 2) * focalR, x2: w / 2, y2: h / 2, r2: Math.max(w, h) / 2 },
        colorStops: [{ offset: 0, color: color1 }, { offset: 1, color: color2 }],
      })
      : new fabric.Gradient({
        type: "linear",
        gradientUnits: "pixels",
        coords: {
          x1: w / 2 - Math.cos(rad) * w / 2,
          y1: h / 2 - Math.sin(rad) * h / 2,
          x2: w / 2 + Math.cos(rad) * w / 2,
          y2: h / 2 + Math.sin(rad) * h / 2,
        },
        colorStops: [{ offset: 0, color: color1 }, { offset: 1, color: color2 }],
      });
  } else {
    updates.fill = (active as any).__solidFill || "#4CAF31";
  }

  delete updates.gradientEnabled;
  delete updates.gradientType;
  delete updates.gradientColor1;
  delete updates.gradientColor2;
  delete updates.gradientAngle;
  delete updates.gradientFocalRadius;
}

function applyBorderRadiusUpdates(active: fabric.FabricObject, updates: any) {
  if (updates.borderRadius === undefined) return;
  if (!isTextObject(active)) {
    updates.rx = updates.borderRadius;
    updates.ry = updates.borderRadius;
  }
  delete updates.borderRadius;
}

function buildObjectSelectionStyle(active: fabric.FabricObject) {
  const isCurved = !!(active as any).__curvedTextSource;
  return {
    fontFamily: "",
    fontSize: 0,
    fill: active.fill || "",
    stroke: active.stroke || "transparent",
    strokeWidth: active.strokeWidth || 0,
    strokeDashArray: active.strokeDashArray || null,
    borderRadius: (active as any).rx ?? 0,
    opacity: active.opacity ?? 1,
    shadowColor: (active.shadow as any)?.color || "#000000",
    shadowBlur: (active.shadow as any)?.blur || 0,
    shadowOffsetX: (active.shadow as any)?.offsetX || 0,
    shadowOffsetY: (active.shadow as any)?.offsetY || 0,
    flipX: active.flipX || false,
    flipY: active.flipY || false,
    gradientEnabled: !!(active as any).__gradientEnabled,
    gradientType: (active as any).__gradientType || "linear",
    gradientColor1: (active as any).__gradientColor1 || "#4CAF31",
    gradientColor2: (active as any).__gradientColor2 || "#ffffff",
    gradientAngle: (active as any).__gradientAngle ?? 0,
    gradientFocalRadius: (active as any).__gradientFocalRadius ?? 0.5,
    isImage: active.type === "image" || (active as any).__layerType === "image" || (active as any).__layerType === "background" || (active as any).__layerType === "logo" || (active as any).__layerType === "graphic",
    isCurvedText: isCurved,
    curvedTextSource: (active as any).__curvedTextSource || "",
    curvedTextEffect: (active as any).__curvedTextEffect || "",
    posX: Math.round(active.left ?? 0),
    posY: Math.round(active.top ?? 0),
    objWidth: Math.round((active.width ?? 0) * (active.scaleX ?? 1)),
    objHeight: Math.round((active.height ?? 0) * (active.scaleY ?? 1)),
    __hasSelection: true,
  } as any;
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Shape creation helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function createPathShape(entry: any, cx: number, cy: number): fabric.FabricObject {
  const pathObj = new fabric.Path(entry.path, {
    left: cx,
    top: cy,
    originX: "center" as const,
    originY: "center" as const,
    scaleX: 2,
    scaleY: 2,
    selectable: true,
    evented: true,
  });

  if (entry.defaultStroke) {
    pathObj.set({
      fill: "transparent",
      stroke: "#4CAF31",
      strokeWidth: 4,
    });
  } else {
    pathObj.set({
      fill: entry.defaultFill ?? "#4CAF31",
      stroke: "#ffffff",
      strokeWidth: 1,
    });
  }
  return pathObj;
}

function createDiamond(props: any, cx: number, cy: number) {
  const pts = [{ x: 100, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 100 }];
  return new fabric.Polygon(pts, { ...props, left: cx - 100, top: cy - 100, originX: "left", originY: "top" });
}

function createStar(props: any, cx: number, cy: number) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 80 : 35;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push({ x: 80 + r * Math.cos(a), y: 80 + r * Math.sin(a) });
  }
  return new fabric.Polygon(pts, { ...props, left: cx - 80, top: cy - 80, originX: "left", originY: "top" });
}

function createArrow(cx: number, cy: number) {
  const line = new fabric.Path("M 0 0 L 120 0", { stroke: "#4CAF31", strokeWidth: 4 });
  const head = new fabric.Triangle({ width: 20, height: 20, fill: "#4CAF31", left: 110, top: -10, angle: 90 });
  return new fabric.Group([line, head], { left: cx - 60, top: cy, selectable: true, evented: true });
}

function createPrimitiveShape(shape: string, cx: number, cy: number): fabric.FabricObject {
  const commonProps = {
    left: cx, top: cy,
    originX: "center" as const, originY: "center" as const,
    fill: "#4CAF31", stroke: "#ffffff", strokeWidth: 2,
    selectable: true, evented: true,
  };

  switch (shape) {
    case "rect":
      return new fabric.Rect({ ...commonProps, width: 200, height: 120, rx: 0, ry: 0 });
    case "rounded-rect":
      return new fabric.Rect({ ...commonProps, width: 200, height: 120, rx: 20, ry: 20 });
    case "circle":
      return new fabric.Circle({ ...commonProps, radius: 80 });
    case "triangle":
      return new fabric.Triangle({ ...commonProps, width: 160, height: 140 });
    case "diamond":
      return createDiamond(commonProps, cx, cy);
    case "star":
      return createStar(commonProps, cx, cy);
    case "line":
      return new fabric.Path(`M ${cx - 80} ${cy} L ${cx + 80} ${cy}`, { stroke: "#4CAF31", strokeWidth: 4, selectable: true, evented: true });
    case "arrow":
      return createArrow(cx, cy);
    default:
      return new fabric.Rect({ ...commonProps, width: 200, height: 120 });
  }
}

type CanvasClipboardRef = {
  current: fabric.FabricObject | null;
};

function isCopyShortcut(e: KeyboardEvent, ctrl: boolean) {
  return ctrl && e.key === "c";
}

function isPasteShortcut(e: KeyboardEvent, ctrl: boolean) {
  return ctrl && e.key === "v";
}

function isDuplicateShortcut(e: KeyboardEvent, ctrl: boolean) {
  return ctrl && e.key === "d";
}

function isDeleteShortcut(e: KeyboardEvent) {
  return e.key === "Delete" || e.key === "Backspace";
}

function isBackgroundLayer(obj: fabric.FabricObject) {
  return (obj as any).__layerType === "background";
}

function isEditingTextObject(obj: fabric.FabricObject) {
  return (
    (obj.type === "i-text" || obj.type === "textbox") &&
    (obj as fabric.IText).isEditing
  );
}

function copyCurvedTextProps(source: fabric.FabricObject, target: fabric.FabricObject) {
  if (!(source as any).__curvedTextSource) return;

  (target as any).__curvedTextSource = (source as any).__curvedTextSource;
  (target as any).__curvedTextEffect = (source as any).__curvedTextEffect;
  (target as any).__curvedTextOpts = (source as any).__curvedTextOpts;
}

function prepareLayerClone(source: fabric.FabricObject, target: fabric.FabricObject) {
  const id = `${(source as any).__layerType ?? "layer"}-${Date.now()}`;

  target.set({ left: (source.left ?? 0) + 20, top: (source.top ?? 0) + 20 });
  (target as any).__layerId = id;
  (target as any).__layerLabel = `${(source as any).__layerLabel ?? "Layer"} copy`;
  (target as any).__layerType = (source as any).__layerType;
  copyCurvedTextProps(source, target);
}

function addPreparedClone(canvas: fabric.Canvas, clone: fabric.FabricObject, onDirty: () => void) {
  canvas.add(clone);
  canvas.setActiveObject(clone);
  canvas.renderAll();
  onDirty();
}

function copyActiveObject(canvas: fabric.Canvas, clipboardRef: CanvasClipboardRef) {
  const active = canvas.getActiveObject();
  if (!active || isBackgroundLayer(active)) return;

  active.clone().then((clone: fabric.FabricObject) => {
    clipboardRef.current = clone;
  });
}

function pasteClipboardObject(canvas: fabric.Canvas, clipboardRef: CanvasClipboardRef, onDirty: () => void) {
  const source = clipboardRef.current;
  if (!source) return;

  source.clone().then((clone: fabric.FabricObject) => {
    prepareLayerClone(source, clone);
    addPreparedClone(canvas, clone, onDirty);
  });
}

function duplicateActiveObject(canvas: fabric.Canvas, onDirty: () => void) {
  const active = canvas.getActiveObject();
  if (!active || isBackgroundLayer(active)) return;

  active.clone().then((clone: fabric.FabricObject) => {
    prepareLayerClone(active, clone);
    addPreparedClone(canvas, clone, onDirty);
  });
}

function deleteActiveObject(canvas: fabric.Canvas) {
  const active = canvas.getActiveObject();
  if (!active || isEditingTextObject(active) || isBackgroundLayer(active)) return;

  canvas.remove(active);
  canvas.discardActiveObject();
  canvas.renderAll();
}

const EditorCanvas = forwardRef<EditorCanvasRef, EditorCanvasProps>(
  function EditorCanvas({ layers, initialWidth, initialHeight, onDirty, onSelectionChange, onLayersChange, onImageLoaded }, ref) {
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const naturalSizeRef = useRef({ w: initialWidth ?? CANVAS_WIDTH, h: initialHeight ?? CANVAS_HEIGHT });

    const historyRef = useRef<string[]>([]);
    const historyTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isUndoingRef = useRef(false);
    const loadedLayerIdsRef = useRef<Set<string>>(new Set());

    // Crop state Ã¢â‚¬â€ pure React, no fabric involvement
    const [cropMode, setCropMode] = useState(false);
    const [cropBox, setCropBox] = useState<CropBox>({ x: 10, y: 10, w: 80, h: 80 });
    const dragRef = useRef<{ type: string; startX: number; startY: number; startBox: CropBox } | null>(null);

    const onDirtyRef = useRef(onDirty);
    const onSelectionChangeRef = useRef(onSelectionChange);
    const onLayersChangeRef = useRef(onLayersChange);
    useEffect(() => { onDirtyRef.current = onDirty; }, [onDirty]);
    useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);
    useEffect(() => { onLayersChangeRef.current = onLayersChange; }, [onLayersChange]);

    const emitLayers = (canvas: fabric.Canvas) => {
      const infos: LayerInfo[] = canvas.getObjects()
        .map(buildLayerInfo)
        .filter(Boolean) as LayerInfo[];
      infos.reverse();
      onLayersChangeRef.current(infos);
    };

    // Ã¢â€â‚¬Ã¢â€â‚¬ Highlight rect management Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // Creates/updates/removes a Rect that covers the entire textbox as a highlight.
    // The rect is tagged __highlightFor = layerId so it's never shown in layers.
    const syncHighlightRect = (canvas: fabric.Canvas, textObj: fabric.FabricObject) => {
      const id = (textObj as any).__layerId;
      if (!id) return;

      // Find existing highlight rect for this text
      const existing = canvas.getObjects().find(
        (o) => (o as any).__highlightFor === id
      ) as fabric.Rect | undefined;

      const enabled = !!(textObj as any).__highlightEnabled;

      if (!enabled) {
        if (existing) { canvas.remove(existing); canvas.renderAll(); }
        return;
      }

      const color = (textObj as any).__highlightColor || "#ffff00";
      const opacity = (textObj as any).__highlightOpacity ?? 0.5;
      const padding = (textObj as any).__highlightPadding ?? 8;

      // Use the object's own canvas-space coordinates (not getBoundingRect which is viewport-space).
      // For objects with originX/originY = "center", left/top is the center point.
      const objW = (textObj.width ?? 0) * (textObj.scaleX ?? 1);
      const objH = (textObj.height ?? 0) * (textObj.scaleY ?? 1);

      let rectLeft: number;
      let rectTop: number;

      if (textObj.get("originX") === "center") {
        rectLeft = (textObj.left ?? 0) - objW / 2 - padding;
      } else {
        rectLeft = (textObj.left ?? 0) - padding;
      }

      if (textObj.get("originY") === "center") {
        rectTop = (textObj.top ?? 0) - objH / 2 - padding;
      } else {
        rectTop = (textObj.top ?? 0) - padding;
      }

      const rectW = objW + padding * 2;
      const rectH = objH + padding * 2;

      if (existing) {
        existing.set({ left: rectLeft, top: rectTop, width: rectW, height: rectH, fill: color, opacity });
        existing.setCoords();
      } else {
        const rect = new fabric.Rect({
          left: rectLeft, top: rectTop,
          width: rectW, height: rectH,
          fill: color,
          opacity,
          selectable: false,
          evented: false,
        });
        (rect as any).__highlightFor = id;
        canvas.add(rect);
        // Send behind the text object but above the background
        canvas.sendObjectToBack(rect);
        const bgObj = canvas.getObjects().find(o => (o as any).__layerType === "background");
        if (bgObj) canvas.bringObjectForward(rect);
      }
      canvas.renderAll();
    };

    // Ã¢â€â‚¬Ã¢â€â‚¬ Canvas init Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    useEffect(() => {
      if (!canvasElRef.current || fabricRef.current) return;

      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: "#f4f4f4",
        selection: true,
      });
      fabricRef.current = canvas;
      naturalSizeRef.current = { w: CANVAS_WIDTH, h: CANVAS_HEIGHT };

      // Pinch-to-zoom (touchpad) fires as wheel+ctrlKey
      // Two-finger scroll also zooms (no modifier needed on canvas)
      const handleWheel = (e: WheelEvent) => {
        // Always zoom when over the canvas Ã¢â‚¬â€ prevent page scroll
        e.preventDefault();
        const nW = naturalSizeRef.current.w;
        const nH = naturalSizeRef.current.h;
        // Pinch gesture gives larger deltas; plain scroll gives smaller ones
        const sensitivity = e.ctrlKey ? 0.01 : 0.003;
        const delta = -e.deltaY * sensitivity;
        const newZoom = Math.min(4, Math.max(0.1, canvas.getZoom() + delta));
        canvas.setZoom(newZoom);
        canvas.setDimensions({ width: nW * newZoom, height: nH * newZoom });
        canvas.renderAll();
      };
      canvasElRef.current.addEventListener("wheel", handleWheel, { passive: false });

      const setupTextEvents = (obj: fabric.IText) => {
        obj.on("selection:changed", () => {
          onSelectionChangeRef.current(getTextStyleFromObject(obj));
        });
        obj.on("editing:entered", () => {
          onSelectionChangeRef.current(getTextStyleFromObject(obj));
        });
        obj.on("editing:exited", () => {
          onSelectionChangeRef.current(getTextStyleFromObject(obj));
        });
      };

      const markDirty = () => {
        if (isUndoingRef.current) return;
        onDirtyRef.current();
        emitLayers(canvas);

        // Debounce history serialization to avoid layout race conditions during toJSON
        if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
        historyTimerRef.current = setTimeout(() => {
          if (isUndoingRef.current || !fabricRef.current) return;
          try {
            const json = fabricRef.current.toJSON();
            historyRef.current.push(JSON.stringify(json));
            if (historyRef.current.length > 30) historyRef.current.shift();
          } catch (err) {
            console.warn("Failed to serialize canvas for history:", err);
          }
        }, 200);
      };

      canvas.on("object:added", (e: any) => {
        const obj = e.target;
        if (obj && (obj.type === "i-text" || obj.type === "textbox")) {
          setupTextEvents(obj as fabric.IText);
        }
        markDirty();
      });
      canvas.on("object:modified", (e: any) => {
        const obj = e.target;
        if (obj && (obj.type === "i-text" || obj.type === "textbox")) {
          syncHighlightRect(canvas, obj);
        }
        markDirty();
      });
      canvas.on("object:moving", (e: any) => {
        const obj = e.target;
        if (obj && (obj.type === "i-text" || obj.type === "textbox")) {
          syncHighlightRect(canvas, obj);
        }
      });
      canvas.on("object:scaling", (e: any) => {
        const obj = e.target;
        if (obj && (obj.type === "i-text" || obj.type === "textbox")) {
          syncHighlightRect(canvas, obj);
        }
      });
      canvas.on("text:changed", (e: any) => {
        const obj = e.target;
        if (obj) syncHighlightRect(canvas, obj);
      });
      canvas.on("object:removed", (e: any) => {
        const obj = e.target;
        if (obj?.__layerId) {
          // Remove associated highlight rect if any
          const highlightRect = canvas.getObjects().find(
            (o: any) => o.__highlightFor === obj.__layerId
          );
          if (highlightRect) canvas.remove(highlightRect);
        }
        markDirty();
      });

      const clipboardRef = { current: null as fabric.FabricObject | null };

      const handleKeyDown = (e: KeyboardEvent) => {
        const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const ctrl = isMac ? e.metaKey : e.ctrlKey;

        if (isCopyShortcut(e, ctrl)) {
          copyActiveObject(canvas, clipboardRef);
          return;
        }

        if (isPasteShortcut(e, ctrl)) {
          pasteClipboardObject(canvas, clipboardRef, onDirtyRef.current);
          return;
        }

        if (isDuplicateShortcut(e, ctrl)) {
          e.preventDefault();
          duplicateActiveObject(canvas, onDirtyRef.current);
          return;
        }

        if (isDeleteShortcut(e)) {
          deleteActiveObject(canvas);
        }
      };
      globalThis.addEventListener("keydown", handleKeyDown);

      const handleSelection = () => {
        const active = canvas.getActiveObject();
        if (isTextObject(active)) {
          onSelectionChangeRef.current(getTextStyleFromObject(active));
        } else if (active) {
          // Support styling for images/graphics (borders, opacity, shadow)
          const isCurved = !!(active as any).__curvedTextSource;
          onSelectionChangeRef.current({
            fontFamily: "", // Marker for non-text
            fontSize: 0,
            fill: active.fill || "",
            stroke: active.stroke || "transparent",
            strokeWidth: active.strokeWidth || 0,
            strokeDashArray: active.strokeDashArray || null,
            borderRadius: (active as any).rx ?? 0,
            opacity: active.opacity ?? 1,
            shadowColor: (active.shadow as any)?.color || "#000000",
            shadowBlur: (active.shadow as any)?.blur || 0,
            shadowOffsetX: (active.shadow as any)?.offsetX || 0,
            shadowOffsetY: (active.shadow as any)?.offsetY || 0,
            flipX: active.flipX || false,
            flipY: active.flipY || false,
            gradientEnabled: !!(active as any).__gradientEnabled,
            gradientType: (active as any).__gradientType || "linear",
            gradientColor1: (active as any).__gradientColor1 || "#4CAF31",
            gradientColor2: (active as any).__gradientColor2 || "#ffffff",
            gradientAngle: (active as any).__gradientAngle ?? 0,
            gradientFocalRadius: (active as any).__gradientFocalRadius ?? 0.5,
            isImage: active.type === "image" || (active as any).__layerType === "image" || (active as any).__layerType === "background" || (active as any).__layerType === "logo" || (active as any).__layerType === "graphic",
            isCurvedText: isCurved,
            curvedTextSource: (active as any).__curvedTextSource || "",
            curvedTextEffect: (active as any).__curvedTextEffect || "",
            posX: Math.round(active.left ?? 0),
            posY: Math.round(active.top ?? 0),
            objWidth: Math.round((active.width ?? 0) * (active.scaleX ?? 1)),
            objHeight: Math.round((active.height ?? 0) * (active.scaleY ?? 1)),
            __hasSelection: true
          } as any);
        } else {
          onSelectionChangeRef.current(null);
        }
      };
      canvas.on("selection:created", handleSelection);
      canvas.on("selection:updated", handleSelection);
      canvas.on("selection:cleared", () => onSelectionChangeRef.current(null));

      return () => {
        globalThis.removeEventListener("keydown", handleKeyDown);
        if (canvasElRef.current) canvasElRef.current.removeEventListener("wheel", handleWheel);
        canvas.dispose();
        fabricRef.current = null;
        loadedLayerIdsRef.current.clear();
      };
    }, []);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Load layers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    useEffect(() => {
      let attempts = 0;
      const tryLoad = () => {
        const canvas = fabricRef.current;
        if (!canvas) {
          if (attempts++ < 10) setTimeout(tryLoad, 100);
          return;
        }
        if (!layers.length) return;
        const toLoad = layers.filter(l => !loadedLayerIdsRef.current.has(l.id));
        if (!toLoad.length) return;

        const loadLayer = async (layer: LayerDef) => {
          await loadCanvasLayer(canvas, layer, loadedLayerIdsRef.current, naturalSizeRef.current, onImageLoaded);
        };

        Promise.all(toLoad.map(loadLayer)).then(() => emitLayers(canvas));
      };
      tryLoad();
    }, [layers]);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Crop drag handlers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    const onCropMouseDown = useCallback((e: React.MouseEvent, type: string) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { type, startX: e.clientX, startY: e.clientY, startBox: { ...cropBox } };
    }, [cropBox]);

    useEffect(() => {
      if (!cropMode) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const onMouseMove = (e: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const rect = wrapper.getBoundingClientRect();
        const W = rect.width, H = rect.height;
        const dx = ((e.clientX - drag.startX) / W) * 100;
        const dy = ((e.clientY - drag.startY) / H) * 100;

        setCropBox(getNextCropBox(drag, dx, dy));
      };

      const onMouseUp = () => { dragRef.current = null; };

      globalThis.addEventListener("mousemove", onMouseMove);
      globalThis.addEventListener("mouseup", onMouseUp);
      return () => {
        globalThis.removeEventListener("mousemove", onMouseMove);
        globalThis.removeEventListener("mouseup", onMouseUp);
      };
    }, [cropMode]);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Imperative API Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    useImperativeHandle(ref, () => ({
      addText() {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const id = `text-${Date.now()}`;
        const nW = naturalSizeRef.current.w;
        const nH = naturalSizeRef.current.h;
        const text = new fabric.Textbox("Double-click to edit", {
          left: nW / 2, top: nH / 2,
          width: nW * 0.7, originX: "center", originY: "center",
          fontFamily: "Arial", fontSize: Math.round(nH * 0.035), fill: "#ffffff", textAlign: "center",
        });
        (text as any).__layerId = id;
        (text as any).__layerLabel = "Text";
        (text as any).__layerType = "text";
        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.renderAll();
      },

      addImageLayer(url: string, label: string, id: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then(img => {
          const nW = naturalSizeRef.current.w;
          const nH = naturalSizeRef.current.h;
          const scale = Math.min(200 / (img.width || 200), 200 / (img.height || 200), 1);
          img.set({ scaleX: scale, scaleY: scale, left: nW / 2, top: nH / 2, originX: "center", originY: "center" });
          (img as any).__layerId = id;
          (img as any).__layerLabel = label;
          (img as any).__layerType = "image";
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
        });
      },

      deleteSelected() {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active || (active as any).__layerType === "background") return;
        canvas.remove(active);
        canvas.discardActiveObject();
        canvas.renderAll();
      },

      getSelectedTextStyle() {
        const canvas = fabricRef.current;
        if (!canvas) return null;
        const active = canvas.getActiveObject();
        if (isTextObject(active)) return getTextStyleFromObject(active);
        return null;
      },

      applyTextStyle(style: Partial<TextStyle>) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;

        const updates: any = { ...style };
        applyHighlightUpdates(canvas, active, style, updates, syncHighlightRect);
        applyShadowUpdates(active, style, updates);

        if (!isTextObject(active) && updates.strokeWidth !== undefined) {
          updates.strokeUniform = true;
        }

        applyGradientUpdates(active, updates);

        if (updates.fill && typeof updates.fill === "string" && !(active as any).__gradientEnabled) {
          (active as any).__solidFill = updates.fill;
        }

        applyBorderRadiusUpdates(active, updates);
        if (style.flipX !== undefined) updates.flipX = style.flipX;
        if (style.flipY !== undefined) updates.flipY = style.flipY;

        if (isTextObject(active) && (active as any).isEditing) {
          (active as any).setSelectionStyles(updates);
        } else {
          active.set(updates);
        }
        canvas.renderAll();

        if (isTextObject(active)) {
          onSelectionChangeRef.current(getTextStyleFromObject(active));
        } else {
          onSelectionChangeRef.current(buildObjectSelectionStyle(active));
        }
      },

      getLayers() {
        const canvas = fabricRef.current;
        if (!canvas) return [];
        const infos = canvas.getObjects().map(buildLayerInfo).filter(Boolean) as LayerInfo[];
        infos.reverse();
        return infos;
      },

      setLayerVisible(id: string, visible: boolean) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getObjects().find(o => (o as any).__layerId === id);
        if (!obj) return;
        obj.set({ visible });
        canvas.renderAll();
        emitLayers(canvas);
      },

      setLayerLocked(id: string, locked: boolean) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getObjects().find(o => (o as any).__layerId === id);
        if (!obj) return;
        obj.set({ selectable: !locked, evented: !locked, lockMovementX: locked, lockMovementY: locked });
        if (locked) canvas.discardActiveObject();
        canvas.renderAll();
        emitLayers(canvas);
      },

      selectLayer(id: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getObjects().find(o => (o as any).__layerId === id);
        if (!obj?.selectable) return;
        canvas.setActiveObject(obj);
        canvas.renderAll();
      },

      bringLayerForward(id: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getObjects().find(o => (o as any).__layerId === id);
        if (!obj) return;
        canvas.bringObjectForward(obj);
        canvas.renderAll();
        emitLayers(canvas);
      },

      sendLayerBackward(id: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getObjects().find(o => (o as any).__layerId === id);
        if (!obj) return;
        canvas.sendObjectBackwards(obj);
        canvas.renderAll();
        emitLayers(canvas);
      },

      bringLayerToFront(id: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getObjects().find(o => (o as any).__layerId === id);
        if (!obj) return;
        canvas.bringObjectToFront(obj);
        canvas.renderAll();
        emitLayers(canvas);
      },

      sendLayerToBack(id: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getObjects().find(o => (o as any).__layerId === id);
        if (!obj) return;
        // Send to back but keep above the background layer
        canvas.sendObjectToBack(obj);
        const bgObj = canvas.getObjects().find(o => (o as any).__layerType === "background");
        if (bgObj) canvas.bringObjectForward(obj);
        canvas.renderAll();
        emitLayers(canvas);
      },

      alignLayer(id: string, hAlign: HorizontalAlign, vAlign: VerticalAlign) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getObjects().find(o => (o as any).__layerId === id);
        if (!obj) return;

        const zoom = canvas.getZoom();
        const canvasW = canvas.getWidth() / zoom;
        const canvasH = canvas.getHeight() / zoom;
        const objW = (obj.width ?? 0) * (obj.scaleX ?? 1);
        const objH = (obj.height ?? 0) * (obj.scaleY ?? 1);

        // Fabric uses centered origins for most objects we add.
        const isCenter = obj.get("originX") === "center" && obj.get("originY") === "center";
        const halfW = isCenter ? objW / 2 : 0;
        const halfH = isCenter ? objH / 2 : 0;

        if (hAlign === "left") obj.set({ left: halfW });
        if (hAlign === "center") obj.set({ left: canvasW / 2 });
        if (hAlign === "right") obj.set({ left: canvasW - halfW });

        if (vAlign === "top") obj.set({ top: halfH });
        if (vAlign === "middle") obj.set({ top: canvasH / 2 });
        if (vAlign === "bottom") obj.set({ top: canvasH - halfH });

        obj.setCoords();
        canvas.renderAll();
        onDirtyRef.current();
      },

      enterCropMode() {
        setCropBox({ x: 10, y: 10, w: 80, h: 80 });
        setCropMode(true);
      },

      applyCrop() {
        const canvas = fabricRef.current;
        if (!canvas) return;

        // Convert % crop box to fabric's natural coordinate space
        const zoom = canvas.getZoom();
        const nW = canvas.getWidth() / zoom;
        const nH = canvas.getHeight() / zoom;

        const cropLeft = (cropBox.x / 100) * nW;
        const cropTop = (cropBox.y / 100) * nH;
        const cropWidth = (cropBox.w / 100) * nW;
        const cropHeight = (cropBox.h / 100) * nH;

        // Shift all objects by crop origin
        canvas.getObjects().forEach(obj => {
          obj.set({ left: (obj.left ?? 0) - cropLeft, top: (obj.top ?? 0) - cropTop });
          obj.setCoords();
        });

        // Resize canvas to crop area
        canvas.setZoom(zoom);
        canvas.setDimensions({ width: cropWidth * zoom, height: cropHeight * zoom });
        canvas.renderAll();
        onDirtyRef.current();
        setCropMode(false);
      },

      cancelCrop() {
        setCropMode(false);
      },

      getZoom() {
        return fabricRef.current?.getZoom() ?? 1;
      },

      zoomIn() {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const nW = naturalSizeRef.current.w;
        const nH = naturalSizeRef.current.h;
        const newZoom = Math.min(4, canvas.getZoom() + 0.1);
        canvas.setZoom(newZoom);
        canvas.setDimensions({ width: nW * newZoom, height: nH * newZoom });
        canvas.renderAll();
      },

      zoomOut() {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const nW = naturalSizeRef.current.w;
        const nH = naturalSizeRef.current.h;
        const newZoom = Math.max(0.1, canvas.getZoom() - 0.1);
        canvas.setZoom(newZoom);
        canvas.setDimensions({ width: nW * newZoom, height: nH * newZoom });
        canvas.renderAll();
      },

      zoomReset() {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const nW = naturalSizeRef.current.w;
        const nH = naturalSizeRef.current.h;
        canvas.setZoom(1);
        canvas.setDimensions({ width: nW, height: nH });
        canvas.renderAll();
      },

      canUndo() { return historyRef.current.length > 1; },

      undo() {
        const canvas = fabricRef.current;
        if (!canvas || historyRef.current.length <= 1) return;
        historyRef.current.pop();
        const prev = historyRef.current.at(-1);
        if (!prev) return;
        isUndoingRef.current = true;
        canvas.loadFromJSON(JSON.parse(prev)).then(() => {
          canvas.renderAll();
          isUndoingRef.current = false;
          emitLayers(canvas);
        });
      },

      fitToContainer(containerWidth: number, containerHeight: number) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const nW = naturalSizeRef.current.w;
        const nH = naturalSizeRef.current.h;
        const zoom = Math.min(containerWidth / nW, containerHeight / nH, 1);
        canvas.setZoom(zoom);
        canvas.setDimensions({ width: nW * zoom, height: nH * zoom });
        canvas.renderAll();
      },

      resize(newW: number, newH: number) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const oldW = naturalSizeRef.current.w;
        const oldH = naturalSizeRef.current.h;
        const sX = newW / oldW, sY = newH / oldH;
        canvas.getObjects().forEach(obj => {
          obj.set({ left: (obj.left ?? 0) * sX, top: (obj.top ?? 0) * sY, scaleX: (obj.scaleX ?? 1) * sX, scaleY: (obj.scaleY ?? 1) * sY });
          obj.setCoords();
        });
        naturalSizeRef.current = { w: newW, h: newH };
        const zoom = canvas.getZoom();
        canvas.setDimensions({ width: newW * zoom, height: newH * zoom });
        canvas.renderAll();
        onDirtyRef.current();
      },

      async exportBlob(): Promise<Blob> {
        const canvas = fabricRef.current;
        if (!canvas) throw new Error("Canvas not initialized");

        const dataUrl = canvas.toDataURL({ format: "png", quality: 1, multiplier: 1 });
        const response = await fetch(dataUrl);
        return response.blob();
      },

      addShape(shape: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const id = `shape-${Date.now()}`;
        const cx = naturalSizeRef.current.w / 2;
        const cy = naturalSizeRef.current.h / 2;

        // Try to find the shape in the library first
        const entry = SHAPE_LIBRARY.find(s => s.id === shape);
        const obj = entry
          ? createPathShape(entry, cx, cy)
          : createPrimitiveShape(shape, cx, cy);

        (obj as any).__layerId = id;
        (obj as any).__layerLabel = entry?.label ?? (shape.charAt(0).toUpperCase() + shape.slice(1));
        (obj as any).__layerType = "shape";

        canvas.add(obj);
        canvas.setActiveObject(obj);
        canvas.renderAll();
      },

      addElement(element: import("./Toolbar").ElementType) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const id = `element-${Date.now()}`;
        const cx = naturalSizeRef.current.w / 2;
        const cy = naturalSizeRef.current.h / 2;

        const emojiMap: Record<string, string> = {
          heart: "\u2764\uFE0F", check: "\u2705", cross: "\u274C",
          "badge-new": "\u{1F195}", "badge-sale": "\u{1F3F7}\uFE0F", "badge-hot": "\u{1F525}",
          "speech-bubble": "\u{1F4AC}", banner: "\u{1F380}",
        };

        // Render emoji to a canvas then add as image
        const offscreen = document.createElement("canvas");
        offscreen.width = 120; offscreen.height = 120;
        const ctx = offscreen.getContext("2d")!;
        ctx.font = "80px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emojiMap[element] ?? "\u2B50", 60, 60);

        void (async () => {
          const img = await fabric.FabricImage.fromURL(offscreen.toDataURL());
          img.set({ left: cx, top: cy, originX: "center", originY: "center", selectable: true, evented: true });
          (img as any).__layerId = id;
          (img as any).__layerLabel = element.charAt(0).toUpperCase() + element.slice(1);
          (img as any).__layerType = "element";
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
        })();
      },

      addUploadedImage(file: File) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const id = `upload-${Date.now()}`;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const src = ev.target?.result as string;
          const img = await fabric.FabricImage.fromURL(src);
          const maxSize = 300;
          const scale = Math.min(maxSize / (img.width || maxSize), maxSize / (img.height || maxSize), 1);
          img.set({
            scaleX: scale, scaleY: scale,
            left: naturalSizeRef.current.w / 2,
            top: naturalSizeRef.current.h / 2,
            originX: "center", originY: "center",
            selectable: true, evented: true,
          });
          (img as any).__layerId = id;
          (img as any).__layerLabel = file.name.replace(/\.[^.]+$/, "").slice(0, 20);
          (img as any).__layerType = "image";
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
        };
        reader.readAsDataURL(file);
      },

      getActiveLayerId(): string | null {
        const canvas = fabricRef.current;
        if (!canvas) return null;
        const active = canvas.getActiveObject();
        return active ? ((active as any).__layerId ?? null) : null;
      },

      alignActiveObject(hAlign: HorizontalAlign, vAlign: VerticalAlign) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;

        const zoom = canvas.getZoom();
        const canvasW = canvas.getWidth() / zoom;
        const canvasH = canvas.getHeight() / zoom;
        const objW = (active.width ?? 0) * (active.scaleX ?? 1);
        const objH = (active.height ?? 0) * (active.scaleY ?? 1);
        const isCenter = active.get("originX") === "center" && active.get("originY") === "center";
        const halfW = isCenter ? objW / 2 : 0;
        const halfH = isCenter ? objH / 2 : 0;

        if (hAlign === "left") active.set({ left: halfW });
        if (hAlign === "center") active.set({ left: canvasW / 2 });
        if (hAlign === "right") active.set({ left: canvasW - halfW });
        if (vAlign === "top") active.set({ top: halfH });
        if (vAlign === "middle") active.set({ top: canvasH / 2 });
        if (vAlign === "bottom") active.set({ top: canvasH - halfH });

        active.setCoords();
        canvas.renderAll();
        onDirtyRef.current();
      },

      addCurvedText(text: string, effect: CurvedTextEffect, options?: Partial<CurvedTextOptions>) {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const opts: Required<CurvedTextOptions> = {
          fontSize: options?.fontSize ?? 48,
          fontFamily: options?.fontFamily ?? "Arial",
          fill: options?.fill ?? "#ffffff",
          fontWeight: options?.fontWeight ?? "bold",
          radius: options?.radius ?? 160,
          amplitude: options?.amplitude ?? 40,
        };

        const dataUrl = renderCurvedTextToDataURL(text, effect, opts);
        const id = `curved-text-${Date.now()}`;

        fabric.FabricImage.fromURL(dataUrl).then(img => {
          const maxSize = 400;
          const scale = Math.min(maxSize / (img.width || maxSize), maxSize / (img.height || maxSize), 1);
          img.set({
            scaleX: scale, scaleY: scale,
            left: naturalSizeRef.current.w / 2,
            top: naturalSizeRef.current.h / 2,
            originX: "center", originY: "center",
            selectable: true, evented: true,
          });
          (img as any).__layerId = id;
          (img as any).__layerLabel = `${effect} text`;
          (img as any).__layerType = "text";
          // Store source so user can re-edit
          (img as any).__curvedTextSource = text;
          (img as any).__curvedTextEffect = effect;
          (img as any).__curvedTextOpts = opts;
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
        });
      },

      addBadge(badgeType: BadgeType) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const id = `badge-${Date.now()}`;
        const cx = naturalSizeRef.current.w / 2;
        const cy = naturalSizeRef.current.h / 2;

        const BADGE_CONFIGS: Record<BadgeType, { text: string; bg: string; textColor: string; shape: "circle" | "pill" | "burst" }> = {
          "badge-sale": { text: "SALE", bg: "#E53935", textColor: "#ffffff", shape: "pill" },
          "badge-new": { text: "NEW", bg: "#4CAF31", textColor: "#ffffff", shape: "pill" },
          "badge-hot": { text: "\u{1F525} HOT", bg: "#FF6F00", textColor: "#ffffff", shape: "pill" },
          "badge-50off": { text: "50% OFF", bg: "#E53935", textColor: "#ffffff", shape: "burst" },
          "badge-limited": { text: "LIMITED", bg: "#7B1FA2", textColor: "#ffffff", shape: "pill" },
          "badge-free": { text: "FREE", bg: "#00897B", textColor: "#ffffff", shape: "circle" },
          "badge-best": { text: "BEST BUY", bg: "#1565C0", textColor: "#ffffff", shape: "pill" },
          "badge-trending": { text: "TRENDING", bg: "#F4511E", textColor: "#ffffff", shape: "pill" },
        };

        const cfg = BADGE_CONFIGS[badgeType];
        const fontSize = 22;
        const padX = 20, padY = 12;

        // Measure text width
        const offscreen = document.createElement("canvas");
        const mctx = offscreen.getContext("2d")!;
        mctx.font = `bold ${fontSize}px Arial`;
        const textW = mctx.measureText(cfg.text).width;

        const rectW = textW + padX * 2;
        const rectH = fontSize + padY * 2;

        let bgShape: fabric.FabricObject;

        if (cfg.shape === "circle") {
          const r = Math.max(rectW, rectH) / 2;
          bgShape = new fabric.Circle({
            radius: r,
            fill: cfg.bg,
            originX: "center",
            originY: "center",
            left: 0,
            top: 0,
          });
        } else if (cfg.shape === "burst") {
          // 8-point star burst
          const pts: { x: number; y: number }[] = [];
          const outerR = Math.max(rectW, rectH) / 2 + 10;
          const innerR = outerR * 0.6;
          for (let i = 0; i < 16; i++) {
            const r2 = i % 2 === 0 ? outerR : innerR;
            const a = (Math.PI / 8) * i - Math.PI / 2;
            pts.push({ x: r2 * Math.cos(a), y: r2 * Math.sin(a) });
          }
          bgShape = new fabric.Polygon(pts, {
            fill: cfg.bg,
            originX: "center",
            originY: "center",
            left: 0,
            top: 0,
          });
        } else {
          // pill
          bgShape = new fabric.Rect({
            width: rectW,
            height: rectH,
            rx: rectH / 2,
            ry: rectH / 2,
            fill: cfg.bg,
            originX: "center",
            originY: "center",
            left: 0,
            top: 0,
          });
        }

        const textObj = new fabric.IText(cfg.text, {
          fontSize,
          fontFamily: "Arial",
          fontWeight: "bold",
          fill: cfg.textColor,
          textAlign: "center",
          originX: "center",
          originY: "center",
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
        });

        const group = new fabric.Group([bgShape, textObj], {
          left: cx,
          top: cy,
          originX: "center",
          originY: "center",
          selectable: true,
          evented: true,
          subTargetCheck: false,
        });

        (group as any).__layerId = id;
        (group as any).__layerLabel = cfg.text;
        (group as any).__layerType = "element";
        canvas.add(group);
        canvas.setActiveObject(group);
        canvas.renderAll();
      },

      applyTextShape(effect: CurvedTextEffect) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;

        // Read text content and styling from the active object
        let text = "Your Text";
        let fontSize = 48;
        let fontFamily = "Arial";
        let fill = "#ffffff";
        let fontWeight = "normal";

        if (active.type === "i-text" || active.type === "textbox") {
          const t = active as fabric.IText;
          text = t.text || "Your Text";
          fontSize = t.fontSize || 48;
          fontFamily = t.fontFamily || "Arial";
          fill = typeof t.fill === "string" ? t.fill : "#ffffff";
          fontWeight = String(t.fontWeight || "normal");
        }

        const opts: Required<CurvedTextOptions> = {
          fontSize,
          fontFamily,
          fill,
          fontWeight,
          radius: Math.max(fontSize * 3, 120),
          amplitude: fontSize * 0.8,
        };

        const dataUrl = renderCurvedTextToDataURL(text, effect, opts);

        // Remember position of the original object
        const origLeft = active.left ?? naturalSizeRef.current.w / 2;
        const origTop = active.top ?? naturalSizeRef.current.h / 2;
        const origId = (active as any).__layerId ?? `curved-text-${Date.now()}`;
        const origLabel = (active as any).__layerLabel ?? "Text";

        // Remove the original text object
        canvas.remove(active);

        fabric.FabricImage.fromURL(dataUrl).then(img => {
          const maxSize = 500;
          const scale = Math.min(maxSize / (img.width || maxSize), maxSize / (img.height || maxSize), 1);
          img.set({
            scaleX: scale, scaleY: scale,
            left: origLeft,
            top: origTop,
            originX: "center", originY: "center",
            selectable: true, evented: true,
          });
          (img as any).__layerId = origId;
          (img as any).__layerLabel = origLabel;
          (img as any).__layerType = "text";
          // Store source for re-editing
          (img as any).__curvedTextSource = text;
          (img as any).__curvedTextEffect = effect;
          (img as any).__curvedTextOpts = opts;
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          onDirtyRef.current();
        });
      },
      duplicateSelected() {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active || (active as any).__layerType === "background") return;
        active.clone().then((cloned: fabric.FabricObject) => {
          const id = `${(active as any).__layerType ?? "layer"}-${Date.now()}`;
          cloned.set({
            left: (active.left ?? 0) + 20,
            top: (active.top ?? 0) + 20,
          });
          (cloned as any).__layerId = id;
          (cloned as any).__layerLabel = ((active as any).__layerLabel ?? "Layer") + " copy";
          (cloned as any).__layerType = (active as any).__layerType;
          // Copy curved text metadata
          if ((active as any).__curvedTextSource) {
            (cloned as any).__curvedTextSource = (active as any).__curvedTextSource;
            (cloned as any).__curvedTextEffect = (active as any).__curvedTextEffect;
            (cloned as any).__curvedTextOpts = (active as any).__curvedTextOpts;
          }
          canvas.add(cloned);
          canvas.setActiveObject(cloned);
          canvas.renderAll();
          onDirtyRef.current();
        });
      },

      updateCurvedText(newText: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active || !(active as any).__curvedTextSource) return;

        const opts: Required<CurvedTextOptions> = (active as any).__curvedTextOpts ?? {
          fontSize: 48, fontFamily: "Arial", fill: "#ffffff", fontWeight: "bold", radius: 160, amplitude: 40,
        };
        const effect = (active as any).__curvedTextEffect as CurvedTextEffect ?? "arc-up";

        const dataUrl = renderCurvedTextToDataURL(newText, effect, opts);
        const origLeft = active.left ?? naturalSizeRef.current.w / 2;
        const origTop = active.top ?? naturalSizeRef.current.h / 2;
        const origScaleX = active.scaleX ?? 1;
        const origScaleY = active.scaleY ?? 1;
        const origId = (active as any).__layerId;
        const origLabel = (active as any).__layerLabel;

        canvas.remove(active);

        fabric.FabricImage.fromURL(dataUrl).then(img => {
          img.set({
            scaleX: origScaleX, scaleY: origScaleY,
            left: origLeft, top: origTop,
            originX: "center", originY: "center",
            selectable: true, evented: true,
          });
          (img as any).__layerId = origId;
          (img as any).__layerLabel = origLabel;
          (img as any).__layerType = "text";
          (img as any).__curvedTextSource = newText;
          (img as any).__curvedTextEffect = effect;
          (img as any).__curvedTextOpts = opts;
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          onDirtyRef.current();
        });
      },

      getSelectedPosition() {
        const canvas = fabricRef.current;
        if (!canvas) return null;
        const active = canvas.getActiveObject();
        if (!active) return null;
        return {
          x: Math.round(active.left ?? 0),
          y: Math.round(active.top ?? 0),
          w: Math.round((active.width ?? 0) * (active.scaleX ?? 1)),
          h: Math.round((active.height ?? 0) * (active.scaleY ?? 1)),
        };
      },

      setSelectedPosition(x: number, y: number) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        active.set({ left: x, top: y });
        active.setCoords();
        canvas.renderAll();
        onDirtyRef.current();
      },

      setSelectedSize(w: number, h: number) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        const origW = active.width ?? 1;
        const origH = active.height ?? 1;
        active.set({ scaleX: w / origW, scaleY: h / origH });
        active.setCoords();
        canvas.renderAll();
        onDirtyRef.current();
      },
    }));

    // Resize handle positions
    const handles = [
      { type: "nw", style: { top: -5, left: -5, cursor: "nw-resize" } },
      { type: "n", style: { top: -5, left: "calc(50% - 5px)", cursor: "n-resize" } },
      { type: "ne", style: { top: -5, right: -5, cursor: "ne-resize" } },
      { type: "e", style: { top: "calc(50% - 5px)", right: -5, cursor: "e-resize" } },
      { type: "se", style: { bottom: -5, right: -5, cursor: "se-resize" } },
      { type: "s", style: { bottom: -5, left: "calc(50% - 5px)", cursor: "s-resize" } },
      { type: "sw", style: { bottom: -5, left: -5, cursor: "sw-resize" } },
      { type: "w", style: { top: "calc(50% - 5px)", left: -5, cursor: "w-resize" } },
    ] as const;

    return (
      <div ref={wrapperRef} className="relative flex items-center justify-center w-full h-full">
        <canvas ref={canvasElRef} className="block shadow-xl rounded" />

        {/* React crop overlay Ã¢â‚¬â€ sits exactly on top of the canvas element */}
        {cropMode && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Dark mask Ã¢â‚¬â€ 4 rectangles around the crop box */}
            <div className="absolute inset-0 bg-black/50"
              style={{ clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${cropBox.y}%, ${cropBox.x}% ${cropBox.y}%, ${cropBox.x}% ${cropBox.y + cropBox.h}%, ${cropBox.x + cropBox.w}% ${cropBox.y + cropBox.h}%, ${cropBox.x + cropBox.w}% ${cropBox.y}%, 0% ${cropBox.y}%)` }}
            />

            {/* Crop box */}
            <div
              className="absolute border-2 border-[#4CAF31] pointer-events-none"
              style={{
                left: `${cropBox.x}%`,
                top: `${cropBox.y}%`,
                width: `${cropBox.w}%`,
                height: `${cropBox.h}%`,
              }}
            >
              <button
                type="button"
                aria-label="Move crop area"
                className="absolute inset-0 pointer-events-auto cursor-move bg-transparent"
                onMouseDown={(e) => onCropMouseDown(e, "move")}
              />

              {/* Rule-of-thirds grid lines */}
              <div className="absolute inset-0 pointer-events-none">
                {[33.33, 66.66].map(p => (
                  <div key={`v${p}`} className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: `${p}%` }} />
                ))}
                {[33.33, 66.66].map(p => (
                  <div key={`h${p}`} className="absolute left-0 right-0 h-px bg-white/30" style={{ top: `${p}%` }} />
                ))}
              </div>

              {/* Resize handles */}
              {handles.map(({ type, style }) => (
                <button
                  type="button"
                  key={type}
                  className="absolute w-3 h-3 bg-white border-2 border-[#4CAF31] rounded-sm pointer-events-auto"
                  style={{ ...style, position: "absolute" }}
                  onMouseDown={(e) => onCropMouseDown(e, type)}
                  aria-label={`Resize crop ${type}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default EditorCanvas;
