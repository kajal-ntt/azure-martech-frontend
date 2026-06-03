"use client";

import { Layers, Trash2, Image, ImagePlus, Type, Square, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, Copy } from "lucide-react";
import type {
  Overlay,
  OverlayLayersPanelProps,
} from "@/components/video/VideoOverlayEditor";

// ─── Display name helpers ─────────────────────────────────────────────────────

/**
 * Computes a human-readable display name for each overlay.
 *
 * - LogoOverlay  → "Logo"
 * - TextOverlay  → "Text 1", "Text 2", … (numbered in order of appearance)
 * - ShapeOverlay → "Shape 1", "Shape 2", … (numbered in order of appearance)
 *
 * Returns a parallel array of names with the same indices as `overlays`.
 */
export function computeDisplayNames(overlays: Overlay[]): string[] {
  let textCounter = 0;
  let shapeCounter = 0;
  let imageCounter = 0;
  return overlays.map((overlay) => {
    if (overlay.type === "logo") return "Logo";
    if (overlay.type === "text") { textCounter += 1; return `Text ${textCounter}`; }
    if (overlay.type === "shape") { shapeCounter += 1; return `Shape ${shapeCounter}`; }
    if (overlay.type === "image") { imageCounter += 1; return `Image ${imageCounter}`; }
    return "Unknown";
  });
}

function getOverlayIcon(type: Overlay["type"]) {
  if (type === "logo") return Image;
  if (type === "image") return ImagePlus;
  if (type === "shape") return Square;
  return Type;
}

function getOverlayIconColor(type: Overlay["type"]) {
  if (type === "logo") return "text-purple-400";
  if (type === "image") return "text-orange-400";
  if (type === "shape") return "text-blue-400";
  return "text-green-400";
}

// ─── OverlayLayersPanel ───────────────────────────────────────────────────────

/**
 * OverlayLayersPanel — lists all overlays with select and delete controls.
 *
 * - Displays "Logo" for logo overlays and "Text N" (sequentially numbered)
 *   for text overlays.
 * - Highlights the row whose id matches `selectedId`.
 * - Clicking a row calls `onSelect(overlay.id)`.
 * - Clicking the trash icon calls `onDelete(overlay.id)` without also
 *   triggering `onSelect` (event propagation is stopped).
 */
export default function OverlayLayersPanel({
  overlays,
  selectedId,
  onSelect,
  onDelete,
  onReorder,
  onDuplicate,
}: Readonly<OverlayLayersPanelProps>) {
  const displayNames = computeDisplayNames(overlays);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
        <Layers size={14} className="text-zinc-400" />
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
          Layers
        </p>
        <span className="ml-auto text-[10px] text-zinc-400">
          {overlays.length}
        </span>
      </div>

      {/* ── Overlay list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {overlays.length === 0 && (
          <p className="text-xs text-zinc-400 text-center mt-6 px-2">
            No overlays yet. Add a logo or text overlay to get started.
          </p>
        )}

        {overlays.map((overlay, index) => {
          const isSelected = overlay.id === selectedId;
          const name = displayNames[index];
          const Icon = getOverlayIcon(overlay.type);
          const iconColor = getOverlayIconColor(overlay.type);

          return (
            <div
              key={overlay.id}
              className={`group flex items-center gap-2 px-2 py-2 rounded-lg border transition-all ${
                isSelected
                  ? "border-[#4CAF31] bg-[#F0F9F6] shadow-sm"
                  : "border-zinc-100 bg-zinc-50 hover:border-zinc-300"
              }`}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(overlay.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left focus:outline-none"
              >
                {/* ── Type icon ──────────────────────────────────────────────── */}
                <Icon
                  size={12}
                  className={`${iconColor} shrink-0`}
                />

                {/* ── Display name ───────────────────────────────────────────── */}
                <span className="flex-1 text-xs font-medium text-zinc-700 truncate">
                  {name}
                </span>
              </button>

              {/* ── Controls ───────────────────────────────────────────────── */}
              <div className={`flex items-center gap-0.5 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                {onDuplicate && (
                  <button title={`Duplicate ${name}`} onClick={(e) => { e.stopPropagation(); onDuplicate(overlay.id); }}
                    className="p-1 rounded text-zinc-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                    <Copy size={11} />
                  </button>
                )}
                {onReorder && (
                  <>
                    <button title="Bring to top" onClick={(e) => { e.stopPropagation(); onReorder(overlay.id, "top"); }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                      <ChevronsUp size={11} />
                    </button>
                    <button title="Move up" onClick={(e) => { e.stopPropagation(); onReorder(overlay.id, "up"); }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                      <ChevronUp size={11} />
                    </button>
                    <button title="Move down" onClick={(e) => { e.stopPropagation(); onReorder(overlay.id, "down"); }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                      <ChevronDown size={11} />
                    </button>
                    <button title="Send to bottom" onClick={(e) => { e.stopPropagation(); onReorder(overlay.id, "bottom"); }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
                      <ChevronsDown size={11} />
                    </button>
                  </>
                )}
                <button
                  aria-label={`Delete ${name}`}
                  title={`Delete ${name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(overlay.id);
                  }}
                  className="p-1 rounded transition-all text-zinc-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer hint ────────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-t border-zinc-100">
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          Click a layer to select it. Drag on canvas to reposition.
        </p>
      </div>
    </div>
  );
}
