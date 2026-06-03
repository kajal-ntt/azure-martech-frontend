"use client";

import { useState, useEffect, useRef, useId } from "react";
import type { ReactNode } from "react";
import { AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, ChevronDown } from "lucide-react";
import type {
  Overlay,
  LogoOverlay,
  ImageOverlay,
  TextOverlay,
  ShapeOverlay,
  OverlayPropertiesPanelProps,
  EntranceAnimation,
  LoopAnimation,
  OverlayAnimation,
} from "@/components/video/VideoOverlayEditor";
import { FONTS_BY_CATEGORY, ALL_FONT_NAMES, loadGoogleFonts } from "@/lib/fonts";
import { PopoverColorPicker } from "../ui/PopoverColorPicker";

// ─── Font picker ──────────────────────────────────────────────────────────────

function getHighlightAlpha(color: string): string {
  const trimmed = color.trim();
  if (!trimmed.startsWith("rgba(") || !trimmed.endsWith(")")) return "0.5";

  const parts = trimmed.slice(5, -1).split(",");
  const alpha = parts[3]?.trim();
  return alpha && Number.isFinite(Number(alpha)) ? alpha : "0.5";
}

function getHighlightColorInputValue(color: string): string {
  const trimmed = color.trim();
  if (trimmed.startsWith("#") && trimmed.length === 7) return trimmed;
  return "#000000";
}

function hexToRgb(hex: string) {
  if (hex.length !== 7 || !hex.startsWith("#")) return null;

  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  if (![r, g, b].every(Number.isFinite)) return null;

  return { r, g, b };
}

function FontOption({ font, selected, hovered, onSelect, onHover, onHoverEnd }: {
  readonly font: string; readonly selected: boolean; readonly hovered: boolean;
  readonly onSelect: (f: string) => void;
  readonly onHover: (f: string) => void;
  readonly onHoverEnd: () => void;
}) {
  let optionClassName = "text-gray-700 hover:bg-gray-50";
  if (hovered) {
    optionClassName = "bg-gray-100 text-gray-900";
  } else if (selected) {
    optionClassName = "bg-[#F0F9F6] text-[#4CAF31]";
  }

  return (
    <button
      onClick={() => onSelect(font)}
      onMouseEnter={() => onHover(font)}
      onMouseLeave={onHoverEnd}
      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${optionClassName}`}
      style={{ fontFamily: font }}
    >
      <span>{font}</span>
      {selected && !hovered && <span className="text-[10px] text-[#4CAF31]">✓</span>}
    </button>
  );
}

function FontPicker({ value, onChange }: { readonly value: string; readonly onChange: (font: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const labelId = useId();
  const triggerId = useId();

  useEffect(() => { loadGoogleFonts(); }, []);

  const categories = Object.keys(FONTS_BY_CATEGORY) as (keyof typeof FONTS_BY_CATEGORY)[];
  const filtered = search.trim()
    ? ALL_FONT_NAMES.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : null;

  const commit = (font: string) => {
    onChange(font);
    setHovered(null);
    setOpen(false);
    setSearch("");
  };

  const handleClose = () => {
    if (hovered) onChange(value);
    setHovered(null);
    setOpen(false);
    setSearch("");
  };

  const previewFont = hovered ?? value;
  let fontOptions: ReactNode;
  if (filtered) {
    fontOptions = filtered.length === 0 ? (
      <p className="text-xs text-gray-400 text-center py-4">No fonts found</p>
    ) : (
      filtered.map((font) => (
        <FontOption key={font} font={font} selected={value === font} hovered={hovered === font}
          onSelect={commit}
          onHover={(f) => { setHovered(f); onChange(f); }}
          onHoverEnd={() => { setHovered(null); onChange(value); }}
        />
      ))
    );
  } else {
    fontOptions = categories.map((cat) => (
      <div key={cat}>
        <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 sticky top-0">{cat}</div>
        {FONTS_BY_CATEGORY[cat].map((entry) => (
          <FontOption key={entry.name} font={entry.name} selected={value === entry.name} hovered={hovered === entry.name}
            onSelect={commit}
            onHover={(f) => { setHovered(f); onChange(f); }}
            onHoverEnd={() => { setHovered(null); onChange(value); }}
          />
        ))}
      </div>
    ));
  }

  return (
    <div className="flex flex-col gap-1 relative">
      <span id={labelId} className="text-xs font-medium text-gray-600">Font Family</span>
      <button
        id={triggerId}
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-2 py-1.5 border border-gray-300 rounded bg-white text-gray-700 hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{ fontFamily: previewFont }}
      >
        <span className="text-sm truncate">{previewFont}</span>
        <ChevronDown size={13} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close font picker"
            onClick={handleClose}
            className="fixed inset-0 z-40"
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 flex flex-col max-h-64 overflow-hidden">
            <div className="p-2 border-b border-gray-100 shrink-0">
              <input
                autoFocus
                type="text"
                placeholder="Search fonts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {fontOptions}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── OverlayPropertiesPanel ───────────────────────────────────────────────────

/**
 * OverlayPropertiesPanel — displays editable properties for the selected overlay.
 *
 * - When `overlay` is null: shows a placeholder message.
 * - When `overlay` is a LogoOverlay: shows a read-only size display.
 * - When `overlay` is a TextOverlay: shows font family, font size, and color controls.
 * - For all overlay types: shows inPoint / outPoint timeline controls with validation.
 * - Brand color swatches are rendered below the color picker for TextOverlays.
 */
export default function OverlayPropertiesPanel({
  overlay,
  videoDuration,
  brandColors,
  stageWidth,
  stageHeight,
  onUpdate,
  onAddLogoOverlay,
}: Readonly<OverlayPropertiesPanelProps>) {
  // ── 6.4 Timeline validation state ─────────────────────────────────────────
  const [inPointError, setInPointError] = useState<string | null>(null);
  const [outPointMessage, setOutPointMessage] = useState<string | null>(null);

  // Clear validation messages when the selected overlay changes
  useEffect(() => {
    setInPointError(null);
    setOutPointMessage(null);
  }, [overlay?.id]);

  // ── 6.1 No overlay selected ───────────────────────────────────────────────
  if (!overlay) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-gray-400 text-sm text-center">
        Select an overlay to edit its properties
      </div>
    );
  }

  // ── 6.4 Timeline handlers (shared by all overlay types) ───────────────────

  const handleInPointChange = (rawValue: string) => {
    const parsed = Number.parseFloat(rawValue);
    if (Number.isNaN(parsed)) return;

    // Clamp to 0 if negative
    const value = Math.max(0, parsed);

    if (value >= overlay.timeline.outPoint) {
      setInPointError("In point must be less than out point.");
      // Do NOT call onUpdate — revert by not updating state
      return;
    }

    setInPointError(null);
    if (parsed < 0) {
      setInPointError(null);
      // Show a brief clamp message then clear it
    }

    onUpdate(overlay.id, {
      timeline: { ...overlay.timeline, inPoint: value },
    });
  };

  const handleOutPointChange = (rawValue: string) => {
    const parsed = Number.parseFloat(rawValue);
    if (Number.isNaN(parsed)) return;

    let value = parsed;
    let message: string | null = null;

    if (parsed > videoDuration) {
      value = videoDuration;
      message = `Out point clamped to video duration (${videoDuration}s).`;
    }

    setOutPointMessage(message);
    onUpdate(overlay.id, {
      timeline: { ...overlay.timeline, outPoint: value },
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 text-sm text-gray-800">
      <h3 className="font-semibold text-gray-900 text-base">Properties</h3>

      {/* ── Canvas Alignment (all overlay types) ─────────────────────────── */}
      <CanvasAlignment
        overlay={overlay}
        stageWidth={stageWidth}
        stageHeight={stageHeight}
        onUpdate={onUpdate}
      />

      {/* ── 6.1 Logo: read-only size display ─────────────────────────────── */}
      {overlay.type === "logo" && (
        <LogoProperties
          overlay={overlay}
          onUpdate={onUpdate}
          onAddLogoOverlay={onAddLogoOverlay}
        />
      )}

      {/* ── 6.2 Text: font / color controls ──────────────────────────────── */}
      {overlay.type === "text" && (
        <TextProperties
          overlay={overlay}
          brandColors={brandColors}
          onUpdate={onUpdate}
        />
      )}

      {/* ── Image overlay controls ───────────────────────────────────────── */}
      {overlay.type === "image" && (
        <ImageProperties overlay={overlay} onUpdate={onUpdate} />
      )}

      {/* ── Shape: shape controls ────────────────────────────────────────── */}
      {overlay.type === "shape" && (
        <ShapeProperties
          overlay={overlay}
          brandColors={brandColors}
          onUpdate={onUpdate}
        />
      )}

      {/* ── Animation controls (all overlay types) ───────────────────────── */}
      <AnimationControls overlay={overlay} onUpdate={onUpdate} />

      {/* ── 6.4 Timeline controls (all overlay types) ────────────────────── */}
      <TimelineControls
        overlay={overlay}
        videoDuration={videoDuration}
        inPointError={inPointError}
        outPointMessage={outPointMessage}
        onInPointChange={handleInPointChange}
        onOutPointChange={handleOutPointChange}
      />
    </div>
  );
}

// ─── CanvasAlignment ──────────────────────────────────────────────────────────

interface CanvasAlignmentProps {
  readonly overlay: Overlay;
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
}

function CanvasAlignment({ overlay, stageWidth, stageHeight, onUpdate }: CanvasAlignmentProps) {
  // Get the real rendered dimensions for each overlay type.
  // logo/shape/image all have explicit width/height.
  // text has width/height written back by TextNode after Konva measures it.
  const getOverlayDimensions = (): { width: number; height: number } => {
    if (
      overlay.type === "logo" ||
      overlay.type === "shape" ||
      overlay.type === "image"
    ) {
      return { width: overlay.width, height: overlay.height };
    }
    if (overlay.type === "text") {
      // Use measured dimensions if available, fall back to a rough estimate
      return {
        width: overlay.width ?? overlay.text.length * overlay.fontSize * 0.55,
        height: overlay.height ?? overlay.fontSize * overlay.lineHeight,
      };
    }
    return { width: 0, height: 0 };
  };

  const { width: ow, height: oh } = getOverlayDimensions();

  // Horizontal
  const alignLeft   = () => onUpdate(overlay.id, { x: 0 });
  const alignCenter = () => onUpdate(overlay.id, { x: Math.round((stageWidth - ow) / 2) });
  const alignRight  = () => onUpdate(overlay.id, { x: Math.round(stageWidth - ow) });

  // Vertical
  const alignTop    = () => onUpdate(overlay.id, { y: 0 });
  const alignMiddle = () => onUpdate(overlay.id, { y: Math.round((stageHeight - oh) / 2) });
  const alignBottom = () => onUpdate(overlay.id, { y: Math.round(stageHeight - oh) });

  const btnBase = "flex-1 p-2 border border-gray-200 rounded-md hover:bg-[#F0F9F6] hover:border-[#4CAF31] transition-colors focus:outline-none focus:ring-2 focus:ring-[#4CAF31]";

  return (
    <div className="flex flex-col gap-2 pb-3 border-b border-gray-200">
      <p className="font-medium text-gray-700 text-xs">Canvas Alignment</p>

      {/* Horizontal */}
      <fieldset className="flex flex-col gap-1 min-w-0">
        <legend className="text-[10px] text-gray-400 uppercase tracking-wide">Horizontal</legend>
        <div className="flex gap-1">
          <button onClick={alignLeft}   title="Align left"   className={btnBase}><AlignLeft   size={14} className="mx-auto text-gray-600" /></button>
          <button onClick={alignCenter} title="Align center" className={btnBase}><AlignCenter  size={14} className="mx-auto text-gray-600" /></button>
          <button onClick={alignRight}  title="Align right"  className={btnBase}><AlignRight   size={14} className="mx-auto text-gray-600" /></button>
        </div>
      </fieldset>

      {/* Vertical */}
      <fieldset className="flex flex-col gap-1 min-w-0">
        <legend className="text-[10px] text-gray-400 uppercase tracking-wide">Vertical</legend>
        <div className="flex gap-1">
          <button onClick={alignTop}    title="Align top"    className={btnBase}><AlignStartVertical  size={14} className="mx-auto text-gray-600" /></button>
          <button onClick={alignMiddle} title="Align middle" className={btnBase}><AlignCenterVertical size={14} className="mx-auto text-gray-600" /></button>
          <button onClick={alignBottom} title="Align bottom" className={btnBase}><AlignEndVertical    size={14} className="mx-auto text-gray-600" /></button>
        </div>
      </fieldset>
    </div>
  );
}

// ─── LogoProperties ───────────────────────────────────────────────────────────

function LogoProperties({
  overlay,
  onUpdate,
  onAddLogoOverlay,
}: {
  readonly overlay: LogoOverlay;
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
  readonly onAddLogoOverlay: (src: string, image: HTMLImageElement) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        onAddLogoOverlay(src, img);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      img.onerror = () => { setUploadError("Failed to load image."); setUploading(false); };
      img.src = src;
    };
    reader.onerror = () => { setUploadError("Failed to read file."); setUploading(false); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Size */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500">Width</span>
          <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 text-xs">
            {Math.round(overlay.width)} px
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500">Height</span>
          <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 text-xs">
            {Math.round(overlay.height)} px
          </span>
        </div>
      </div>

      {/* Opacity */}
      <div className="flex flex-col gap-1">
        <label htmlFor="logo-opacity" className="text-xs font-medium text-gray-600">
          Opacity: {Math.round((overlay.opacity ?? 1) * 100)}%
        </label>
        <input
          id="logo-opacity"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={overlay.opacity ?? 1}
          onChange={(e) => onUpdate(overlay.id, { opacity: Number.parseFloat(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Add another image as a new overlay */}
      <div className="flex flex-col gap-1 border-t border-gray-200 pt-3">
        <p className="text-xs font-medium text-gray-600">Add Another Image</p>
        <p className="text-[10px] text-gray-400">Adds a new image overlay layer.</p>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 hover:border-zinc-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Loading…</>
          ) : (
            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload Image</>
          )}
        </button>
        {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      </div>
    </div>
  );
}

// ─── TextProperties ───────────────────────────────────────────────────────────

interface TextPropertiesProps {
  readonly overlay: TextOverlay;
  readonly brandColors: string[];
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
}

function TextProperties({ overlay, brandColors, onUpdate }: TextPropertiesProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* ── Edit hint ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Double-click text on canvas to edit
      </div>

      {/* ── 6.2 Font family ─────────────────────────────────────────────── */}
      <FontPicker
        value={overlay.fontFamily}
        onChange={(font) => onUpdate(overlay.id, { fontFamily: font })}
      />

      {/* ── 6.2 Font size ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <label htmlFor="font-size" className="text-xs font-medium text-gray-600">
          Font Size (px)
        </label>
        <input
          id="font-size"
          type="number"
          min={6}
          max={200}
          value={overlay.fontSize}
          onChange={(e) => {
            const val = Number.parseInt(e.target.value, 10);
            if (!Number.isNaN(val) && val > 0) {
              onUpdate(overlay.id, { fontSize: val });
            }
          }}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* ── Text style toggles (Bold, Italic, Underline) ─────────────────── */}
      <fieldset className="flex flex-col gap-1 min-w-0">
        <legend className="text-xs font-medium text-gray-600">Style</legend>
        <div className="flex gap-2">
          <button
            onClick={() => onUpdate(overlay.id, { fontWeight: overlay.fontWeight === "bold" ? "normal" : "bold" })}
            className={`px-3 py-1.5 text-sm font-bold border rounded transition-colors ${
              overlay.fontWeight === "bold"
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            B
          </button>
          <button
            onClick={() => onUpdate(overlay.id, { fontStyle: overlay.fontStyle === "italic" ? "normal" : "italic" })}
            className={`px-3 py-1.5 text-sm italic border rounded transition-colors ${
              overlay.fontStyle === "italic"
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            I
          </button>
          <button
            onClick={() => onUpdate(overlay.id, { underline: !overlay.underline })}
            className={`px-3 py-1.5 text-sm underline border rounded transition-colors ${
              overlay.underline
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            U
          </button>
        </div>
      </fieldset>

      {/* ── Text alignment ──────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-1 min-w-0">
        <legend className="text-xs font-medium text-gray-600">Alignment</legend>
        <div className="flex gap-2">
          {(["left", "center", "right"] as const).map((align) => (
            <button
              key={align}
              onClick={() => onUpdate(overlay.id, { textAlign: align })}
              className={`flex-1 px-2 py-1.5 text-xs border rounded capitalize transition-colors ${
                overlay.textAlign === align
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {align}
            </button>
          ))}
        </div>
      </fieldset>

      {/* ── 6.2 Color picker ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <label htmlFor="text-color" className="text-xs font-medium text-gray-600">
          Color
        </label>
        <PopoverColorPicker
          color={overlay.fill}
          onChange={(color) => onUpdate(overlay.id, { fill: color })}
          className="h-9 w-16 flex-shrink-0"
        />

        {/* ── 6.3 Brand color swatches ──────────────────────────────────── */}
        {brandColors.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Brand colors</span>
            <div className="flex flex-wrap gap-2">
              {brandColors.map((color) => (
                <button
                  key={color}
                  aria-label={`Set color to ${color}`}
                  title={color}
                  onClick={() => onUpdate(overlay.id, { fill: color })}
                  style={{ backgroundColor: color }}
                  className="w-7 h-7 rounded-full border-2 border-white shadow ring-1 ring-gray-300 hover:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Opacity ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <label htmlFor="opacity" className="text-xs font-medium text-gray-600">
          Opacity: {Math.round(overlay.opacity * 100)}%
        </label>
        <input
          id="opacity"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={overlay.opacity}
          onChange={(e) => onUpdate(overlay.id, { opacity: Number.parseFloat(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>

      {/* ── Line height ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <label htmlFor="line-height" className="text-xs font-medium text-gray-600">
          Line Height: {overlay.lineHeight.toFixed(1)}
        </label>
        <input
          id="line-height"
          type="range"
          min={0.8}
          max={2.5}
          step={0.1}
          value={overlay.lineHeight}
          onChange={(e) => onUpdate(overlay.id, { lineHeight: Number.parseFloat(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>

      {/* ── Letter spacing ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <label htmlFor="letter-spacing" className="text-xs font-medium text-gray-600">
          Letter Spacing: {overlay.letterSpacing}px
        </label>
        <input
          id="letter-spacing"
          type="range"
          min={-5}
          max={20}
          step={1}
          value={overlay.letterSpacing}
          onChange={(e) => onUpdate(overlay.id, { letterSpacing: Number.parseInt(e.target.value, 10) })}
          className="w-full accent-blue-500"
        />
      </div>

      {/* ── Shadow toggle ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={overlay.shadowEnabled}
            onChange={(e) => onUpdate(overlay.id, { shadowEnabled: e.target.checked })}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-xs font-medium text-gray-600">Enable Shadow</span>
        </label>

        {overlay.shadowEnabled && (
          <div className="flex flex-col gap-2 pl-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="shadow-blur" className="text-xs text-gray-500">
                Blur: {overlay.shadowBlur}px
              </label>
              <input
                id="shadow-blur"
                type="range"
                min={0}
                max={20}
                step={1}
                value={overlay.shadowBlur}
                onChange={(e) => onUpdate(overlay.id, { shadowBlur: Number.parseInt(e.target.value, 10) })}
                className="w-full accent-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label htmlFor="shadow-x" className="text-xs text-gray-500">
                  X: {overlay.shadowOffsetX}
                </label>
                <input
                  id="shadow-x"
                  type="range"
                  min={-10}
                  max={10}
                  step={1}
                  value={overlay.shadowOffsetX}
                  onChange={(e) => onUpdate(overlay.id, { shadowOffsetX: Number.parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label htmlFor="shadow-y" className="text-xs text-gray-500">
                  Y: {overlay.shadowOffsetY}
                </label>
                <input
                  id="shadow-y"
                  type="range"
                  min={-10}
                  max={10}
                  step={1}
                  value={overlay.shadowOffsetY}
                  onChange={(e) => onUpdate(overlay.id, { shadowOffsetY: Number.parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Outline toggle ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={overlay.outlineEnabled}
            onChange={(e) => onUpdate(overlay.id, { outlineEnabled: e.target.checked })}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-xs font-medium text-gray-600">Enable Outline</span>
        </label>

        {overlay.outlineEnabled && (
          <div className="flex flex-col gap-2 pl-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="outline-color" className="text-xs text-gray-500">
                Color
              </label>
              <PopoverColorPicker
                color={overlay.outlineColor || "#000000"}
                onChange={(color) => onUpdate(overlay.id, { outlineColor: color })}
                className="h-8 w-16 flex-shrink-0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="outline-width" className="text-xs text-gray-500">
                Width: {overlay.outlineWidth}px
              </label>
              <input
                id="outline-width"
                type="range"
                min={1}
                max={10}
                step={1}
                value={overlay.outlineWidth}
                onChange={(e) => onUpdate(overlay.id, { outlineWidth: Number.parseInt(e.target.value, 10) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Highlight/Background toggle ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={overlay.highlightEnabled}
            onChange={(e) => onUpdate(overlay.id, { highlightEnabled: e.target.checked })}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-xs font-medium text-gray-600">Enable Highlight</span>
        </label>

        {overlay.highlightEnabled && (
          <div className="flex flex-col gap-2 pl-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="highlight-color" className="text-xs text-gray-500">
                Color
              </label>
              <PopoverColorPicker
                color={getHighlightColorInputValue(overlay.highlightColor)}
                onChange={(color) => {
                  const alpha = getHighlightAlpha(overlay.highlightColor);
                  const rgb = hexToRgb(color);
                  if (rgb) {
                    onUpdate(overlay.id, { highlightColor: `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})` });
                  }
                }}
                className="h-8 w-16 flex-shrink-0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="highlight-padding" className="text-xs text-gray-500">
                Padding: {overlay.highlightPadding}px
              </label>
              <input
                id="highlight-padding"
                type="range"
                min={0}
                max={20}
                step={1}
                value={overlay.highlightPadding}
                onChange={(e) => onUpdate(overlay.id, { highlightPadding: Number.parseInt(e.target.value, 10) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ImageProperties ──────────────────────────────────────────────────────────

interface ImagePropertiesProps {
  readonly overlay: ImageOverlay;
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
}

function ImageProperties({ overlay, onUpdate }: ImagePropertiesProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Size */}
      <div className="flex gap-3">
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="img-width" className="text-xs font-medium text-gray-600">Width</label>
          <input
            id="img-width"
            type="number"
            min={10}
            max={2000}
            value={Math.round(overlay.width)}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(val) && val > 0) onUpdate(overlay.id, { width: val });
            }}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label htmlFor="img-height" className="text-xs font-medium text-gray-600">Height</label>
          <input
            id="img-height"
            type="number"
            min={10}
            max={2000}
            value={Math.round(overlay.height)}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(val) && val > 0) onUpdate(overlay.id, { height: val });
            }}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Opacity */}
      <div className="flex flex-col gap-1">
        <label htmlFor="img-opacity" className="text-xs font-medium text-gray-600">
          Opacity: {Math.round(overlay.opacity * 100)}%
        </label>
        <input
          id="img-opacity"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={overlay.opacity}
          onChange={(e) => onUpdate(overlay.id, { opacity: Number.parseFloat(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Corner radius */}
      <div className="flex flex-col gap-1">
        <label htmlFor="img-radius" className="text-xs font-medium text-gray-600">
          Corner Radius: {overlay.borderRadius}px
        </label>
        <input
          id="img-radius"
          type="range"
          min={0}
          max={100}
          step={1}
          value={overlay.borderRadius}
          onChange={(e) => onUpdate(overlay.id, { borderRadius: Number.parseInt(e.target.value, 10) })}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Flip */}
      <fieldset className="flex flex-col gap-1 min-w-0">
        <legend className="text-xs font-medium text-gray-600">Flip</legend>
        <div className="flex gap-2">
          <button
            onClick={() => onUpdate(overlay.id, { flipX: !overlay.flipX })}
            className={`flex-1 px-2 py-1.5 text-xs border rounded transition-colors ${
              overlay.flipX ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            ↔ Horizontal
          </button>
          <button
            onClick={() => onUpdate(overlay.id, { flipY: !overlay.flipY })}
            className={`flex-1 px-2 py-1.5 text-xs border rounded transition-colors ${
              overlay.flipY ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            ↕ Vertical
          </button>
        </div>
      </fieldset>

      {/* Border */}
      <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={overlay.borderEnabled}
            onChange={(e) => onUpdate(overlay.id, { borderEnabled: e.target.checked })}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-xs font-medium text-gray-600">Enable Border</span>
        </label>
        {overlay.borderEnabled && (
          <div className="flex flex-col gap-2 pl-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="img-border-color" className="text-xs text-gray-500">Color</label>
              <PopoverColorPicker
                color={overlay.borderColor || "#000000"}
                onChange={(color) => onUpdate(overlay.id, { borderColor: color })}
                className="h-8 w-16 flex-shrink-0"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="img-border-width" className="text-xs text-gray-500">
                Width: {overlay.borderWidth}px
              </label>
              <input
                id="img-border-width"
                type="range"
                min={1}
                max={20}
                step={1}
                value={overlay.borderWidth}
                onChange={(e) => onUpdate(overlay.id, { borderWidth: Number.parseInt(e.target.value, 10) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ShapeProperties ──────────────────────────────────────────────────────────

interface ShapePropertiesProps {
  readonly overlay: ShapeOverlay;
  readonly brandColors: string[];
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
}

function ShapeProperties({ overlay, brandColors, onUpdate }: ShapePropertiesProps) {
  const getFillTypeLabel = (fillType: "solid" | "linear" | "radial") => {
    const labels = {
      solid: "Solid",
      linear: "Linear",
      radial: "Radial",
    };

    return labels[fillType];
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Badge text — only for badge type */}
      {overlay.shapeType === "badge" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="badge-text" className="text-xs font-medium text-zinc-600">Badge Text</label>
          <input
            id="badge-text"
            type="text"
            value={overlay.badgeText || ""}
            onChange={(e) => onUpdate(overlay.id, { badgeText: e.target.value })}
            className="border border-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#4CAF31]"
          />
        </div>
      )}

      {/* Size */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Size</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <label htmlFor="shape-width" className="text-[10px] text-zinc-400">W</label>
            <input id="shape-width" type="number" min={10} max={2000} value={Math.round(overlay.width)}
              onChange={(e) => { const v = Number.parseInt(e.target.value, 10); if (!Number.isNaN(v) && v > 0) onUpdate(overlay.id, { width: v }); }}
              className="border border-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#4CAF31]" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label htmlFor="shape-height" className="text-[10px] text-zinc-400">H</label>
            <input id="shape-height" type="number" min={10} max={2000} value={Math.round(overlay.height)}
              onChange={(e) => { const v = Number.parseInt(e.target.value, 10); if (!Number.isNaN(v) && v > 0) onUpdate(overlay.id, { height: v }); }}
              className="border border-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#4CAF31]" />
          </div>
        </div>
      </div>

      {/* Opacity */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="shape-opacity" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Opacity</label>
          <span className="text-[10px] font-mono text-zinc-400">{Math.round(overlay.opacity * 100)}%</span>
        </div>
        <input id="shape-opacity" type="range" min={0} max={1} step={0.01} value={overlay.opacity}
          onChange={(e) => onUpdate(overlay.id, { opacity: Number.parseFloat(e.target.value) })}
          className="w-full accent-[#4CAF31]" />
      </div>

      {/* Fill — matches image editor style */}
      <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fill</p>

        {/* Fill type toggle */}
        <div className="flex gap-1.5">
          {(["solid", "linear", "radial"] as const).map(t => (
            <button key={t} onClick={() => onUpdate(overlay.id, { fillType: t })}
              className={`flex-1 py-1.5 rounded-lg border text-[10px] font-medium capitalize transition-all ${
                overlay.fillType === t ? "border-[#4CAF31] bg-[#F0F9F6] text-[#4CAF31]" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              }`}>
              {getFillTypeLabel(t)}
            </button>
          ))}
        </div>

        {overlay.fillType === "solid" ? (
          <div className="flex items-center gap-2">
            <PopoverColorPicker color={overlay.fill}
              onChange={(color) => onUpdate(overlay.id, { fill: color })}
              className="flex-shrink-0" />
            <span className="text-xs text-zinc-500 font-mono">{overlay.fill}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Color stops with preview */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <PopoverColorPicker color={overlay.fill}
                  onChange={(color) => onUpdate(overlay.id, { fill: color })}
                  className="flex-shrink-0" />
                <span className="text-[9px] text-zinc-400">Start</span>
              </div>
              <div className="flex-1 h-6 rounded-lg border border-zinc-200" style={{
                background: overlay.fillType === "radial"
                  ? `radial-gradient(circle, ${overlay.fill}, ${overlay.gradientEnd ?? "#ffffff"})`
                  : `linear-gradient(${overlay.gradientAngle ?? 0}deg, ${overlay.fill}, ${overlay.gradientEnd ?? "#ffffff"})`,
              }} />
              <div className="flex flex-col items-center gap-0.5">
                <PopoverColorPicker color={overlay.gradientEnd ?? "#ffffff"}
                  onChange={(color) => onUpdate(overlay.id, { gradientEnd: color })}
                  className="flex-shrink-0" />
                <span className="text-[9px] text-zinc-400">End</span>
              </div>
            </div>

            {/* Angle — linear only */}
            {overlay.fillType === "linear" && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="shape-gradient-angle" className="text-[10px] text-zinc-400">Angle</label>
                  <span className="text-[10px] font-mono text-zinc-400">{overlay.gradientAngle ?? 0}°</span>
                </div>
                <input id="shape-gradient-angle" type="range" min={0} max={360} step={1} value={overlay.gradientAngle ?? 0}
                  onChange={(e) => onUpdate(overlay.id, { gradientAngle: Number.parseInt(e.target.value, 10) } as any)}
                  className="w-full accent-[#4CAF31]" />
              </div>
            )}

            {/* Focal radius — radial only */}
            {overlay.fillType === "radial" && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="shape-gradient-focal-radius" className="text-[10px] text-zinc-400">Center Size</label>
                  <span className="text-[10px] font-mono text-zinc-400">{Math.round((overlay.gradientFocalRadius ?? 0.5) * 100)}%</span>
                </div>
                <input id="shape-gradient-focal-radius" type="range" min={0} max={1} step={0.01} value={overlay.gradientFocalRadius ?? 0.5}
                  onChange={(e) => onUpdate(overlay.id, { gradientFocalRadius: Number.parseFloat(e.target.value) } as any)}
                  className="w-full accent-[#4CAF31]" />
              </div>
            )}
          </div>
        )}

        {/* Brand color swatches */}
        {brandColors.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {brandColors.map((color) => (
              <button key={color} title={color} onClick={() => onUpdate(overlay.id, { fill: color })}
                style={{ backgroundColor: color }}
                className="w-6 h-6 rounded-full border-2 border-white shadow ring-1 ring-zinc-200 hover:ring-[#4CAF31] transition-shadow" />
            ))}
          </div>
        )}
      </div>

      {/* Corner radius — rectangle only */}
      {(overlay.shapeType === "rectangle" || overlay.shapeType === "library") && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label htmlFor="shape-corner-radius" className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Corner Radius</label>
            <span className="text-[10px] font-mono text-zinc-400">{overlay.cornerRadius}px</span>
          </div>
          <input id="shape-corner-radius" type="range" min={0} max={100} step={1} value={overlay.cornerRadius}
            onChange={(e) => onUpdate(overlay.id, { cornerRadius: Number.parseInt(e.target.value, 10) })}
            className="w-full accent-[#4CAF31]" />
        </div>
      )}

      {/* Border */}
      <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={overlay.borderEnabled}
            onChange={(e) => onUpdate(overlay.id, { borderEnabled: e.target.checked })}
            className="w-3.5 h-3.5 accent-[#4CAF31]" />
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Border</span>
        </label>
        {overlay.borderEnabled && (
          <div className="flex flex-col gap-2 pl-1">
            <div className="flex items-center gap-2">
              <PopoverColorPicker color={overlay.borderColor}
                onChange={(color) => onUpdate(overlay.id, { borderColor: color })}
                className="flex-shrink-0" />
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="shape-border-width" className="text-[10px] text-zinc-400">Width</label>
                  <span className="text-[10px] font-mono text-zinc-400">{overlay.borderWidth}px</span>
                </div>
                <input id="shape-border-width" type="range" min={1} max={20} step={1} value={overlay.borderWidth}
                  onChange={(e) => onUpdate(overlay.id, { borderWidth: Number.parseInt(e.target.value, 10) })}
                  className="w-full accent-[#4CAF31]" />
              </div>
            </div>
            <div className="flex gap-1.5">
              {(["solid", "dashed"] as const).map(s => (
                <button key={s} onClick={() => onUpdate(overlay.id, { borderStyle: s })}
                  className={`flex-1 py-1.5 rounded-lg border text-[10px] font-medium capitalize transition-all ${
                    overlay.borderStyle === s ? "border-[#4CAF31] bg-[#F0F9F6] text-[#4CAF31]" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                  }`}>
                  {s === "solid" ? "─────" : "─ ─ ─"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AnimationControls ────────────────────────────────────────────────────────

const ENTRANCE_OPTIONS: { value: EntranceAnimation; label: string; icon: string }[] = [
  { value: "none",        label: "None",       icon: "✕" },
  { value: "fade-in",     label: "Fade In",    icon: "◎" },
  { value: "zoom-in",     label: "Zoom In",    icon: "⊕" },
  { value: "zoom-out",    label: "Zoom Out",   icon: "⊖" },
  { value: "slide-up",    label: "Slide ↑",    icon: "↑" },
  { value: "slide-down",  label: "Slide ↓",    icon: "↓" },
  { value: "slide-left",  label: "Slide →",    icon: "→" },
  { value: "slide-right", label: "Slide ←",    icon: "←" },
  { value: "bounce-in",   label: "Bounce",     icon: "⤵" },
  { value: "flip-in",     label: "Flip",       icon: "↻" },
];

const LOOP_OPTIONS: { value: LoopAnimation; label: string; icon: string }[] = [
  { value: "none",   label: "None",   icon: "✕" },
  { value: "spin",   label: "Spin",   icon: "↺" },
  { value: "pulse",  label: "Pulse",  icon: "◉" },
  { value: "float",  label: "Float",  icon: "↕" },
  { value: "bounce", label: "Bounce", icon: "⇅" },
  { value: "shake",  label: "Shake",  icon: "↔" },
  { value: "swing",  label: "Swing",  icon: "⟳" },
  { value: "blink",  label: "Blink",  icon: "◈" },
];

function AnimationControls({
  overlay,
  onUpdate,
}: {
  readonly overlay: Overlay;
  readonly onUpdate: (id: string, patch: Partial<Overlay>) => void;
}) {
  const [open, setOpen] = useState(false);
  const anim: OverlayAnimation = overlay.animation ?? {
    entrance: "none",
    entranceDuration: 0.5,
    loop: "none",
    loopSpeed: 1,
  };

  const update = (patch: Partial<OverlayAnimation>) => {
    onUpdate(overlay.id, { animation: { ...anim, ...patch } } as any);
  };

  const hasAnim = anim.entrance !== "none" || anim.loop !== "none";

  return (
    <div className="border-t border-zinc-100 pt-3">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left group">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Animations</span>
          {hasAnim && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#4CAF31] text-white">ON</span>
          )}
        </div>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-4 mt-3">
          {/* Entrance */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Entrance</p>
            <div className="grid grid-cols-5 gap-1">
              {ENTRANCE_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => update({ entrance: opt.value })} title={opt.label}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border text-xs transition-all ${
                    anim.entrance === opt.value
                      ? "bg-[#4CAF31] text-white border-[#4CAF31] shadow-sm"
                      : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:border-zinc-300"
                  }`}>
                  <span className="text-sm leading-none font-mono">{opt.icon}</span>
                  <span className="text-[8px] leading-none">{opt.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
            {anim.entrance !== "none" && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="entrance-duration" className="text-[10px] text-zinc-400">Duration</label>
                  <span className="text-[10px] font-mono text-zinc-400">{anim.entranceDuration.toFixed(1)}s</span>
                </div>
                <input id="entrance-duration" type="range" min={0.1} max={3} step={0.1} value={anim.entranceDuration}
                  onChange={(e) => update({ entranceDuration: Number.parseFloat(e.target.value) })}
                  className="w-full accent-[#4CAF31]" />
              </div>
            )}
          </div>

          {/* Loop */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Loop</p>
            <div className="grid grid-cols-4 gap-1">
              {LOOP_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => update({ loop: opt.value })} title={opt.label}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border text-xs transition-all ${
                    anim.loop === opt.value
                      ? "bg-[#4CAF31] text-white border-[#4CAF31] shadow-sm"
                      : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:border-zinc-300"
                  }`}>
                  <span className="text-sm leading-none font-mono">{opt.icon}</span>
                  <span className="text-[8px] leading-none">{opt.label}</span>
                </button>
              ))}
            </div>
            {anim.loop !== "none" && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="loop-speed" className="text-[10px] text-zinc-400">Speed</label>
                  <span className="text-[10px] font-mono text-zinc-400">{anim.loopSpeed.toFixed(1)}×</span>
                </div>
                <input id="loop-speed" type="range" min={0.2} max={4} step={0.1} value={anim.loopSpeed}
                  onChange={(e) => update({ loopSpeed: Number.parseFloat(e.target.value) })}
                  className="w-full accent-[#4CAF31]" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TimelineControls ─────────────────────────────────────────────────────────

interface TimelineControlsProps {
  readonly overlay: Overlay;
  readonly videoDuration: number;
  readonly inPointError: string | null;
  readonly outPointMessage: string | null;
  readonly onInPointChange: (value: string) => void;
  readonly onOutPointChange: (value: string) => void;
}

function TimelineControls({
  overlay,
  videoDuration,
  inPointError,
  outPointMessage,
  onInPointChange,
  onOutPointChange,
}: TimelineControlsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-gray-200 pt-3">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left group"
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Timeline
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-3 mt-3">
          <p className="text-[10px] text-gray-400">
            Control when this overlay is visible during playback.
          </p>

          {/* In point */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label htmlFor="in-point" className="text-xs font-medium text-gray-600">
                In (s)
              </label>
              <input
                id="in-point"
                type="number"
                min={0}
                max={videoDuration}
                step={0.1}
                value={overlay.timeline.inPoint}
                onChange={(e) => onInPointChange(e.target.value)}
                className={`border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  inPointError ? "border-red-400" : "border-gray-300"
                }`}
              />
              {inPointError && (
                <p role="alert" className="text-xs text-red-600">{inPointError}</p>
              )}
            </div>

            {/* Out point */}
            <div className="flex flex-col gap-1 flex-1">
              <label htmlFor="out-point" className="text-xs font-medium text-gray-600">
                Out (s)
              </label>
              <input
                id="out-point"
                type="number"
                min={0}
                max={videoDuration}
                step={0.1}
                value={overlay.timeline.outPoint}
                onChange={(e) => onOutPointChange(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {outPointMessage && (
                <output className="text-xs text-amber-600">{outPointMessage}</output>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
