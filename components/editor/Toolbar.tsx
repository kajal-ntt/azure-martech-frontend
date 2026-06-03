"use client";

import { useState, useRef, useEffect } from "react";
import {
  Type, Maximize2, Crop, X, Check, Trash2, Undo2,
  ZoomIn, ZoomOut, Square,
  ImagePlus, Sparkles, ChevronDown, Search,
} from "lucide-react";
import { SHAPE_LIBRARY, SHAPE_CATEGORIES } from "@/lib/shapes";

export interface ToolbarProps {
  readonly isCropMode: boolean;
  readonly hasSelection: boolean;
  readonly canUndo: boolean;
  readonly zoom?: number;
  readonly onAddText: () => void;
  readonly onResize: () => void;
  readonly onCrop: () => void;
  readonly onApplyCrop: () => void;
  readonly onCancelCrop: () => void;
  readonly onDeleteSelected: () => void;
  readonly onUndo: () => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onZoomReset: () => void;
  readonly onAddShape?: (shape: string) => void;
  readonly onAddElement?: (element: ElementType) => void;
  readonly onUploadImage?: (file: File) => void;
}

export type ElementType = "heart" | "check" | "cross" | "badge-new" | "badge-sale" | "badge-hot" | "speech-bubble" | "banner";

const ELEMENTS: { type: ElementType; label: string; emoji: string }[] = [
  { type: "heart",         label: "Heart",        emoji: "❤️" },
  { type: "check",         label: "Checkmark",    emoji: "✅" },
  { type: "cross",         label: "Cross",        emoji: "❌" },
  { type: "badge-new",     label: "NEW Badge",    emoji: "🆕" },
  { type: "badge-sale",    label: "SALE Badge",   emoji: "🏷️" },
  { type: "badge-hot",     label: "HOT Badge",    emoji: "🔥" },
  { type: "speech-bubble", label: "Speech",       emoji: "💬" },
  { type: "banner",        label: "Banner",       emoji: "🎀" },
];

function ToolButton({
  onClick, icon, label, disabled, active,
}: {
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly disabled?: boolean;
  readonly active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#4CAF31]/40 disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-[#4CAF31] text-white"
          : "text-zinc-600 hover:bg-zinc-100 border border-transparent hover:border-zinc-200"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-zinc-200 mx-0.5 shrink-0" />;
}

/** Dropdown that uses a fixed-position panel anchored to the trigger button,
 *  so it escapes any overflow:hidden parent. */
interface FixedDropdownProps {
  trigger: React.ReactNode;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

function FixedDropdown({
  trigger,
  open,
  onClose,
  children,
  wide,
}: Readonly<FixedDropdownProps>) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open]);

  return (
    <div ref={triggerRef} className="relative">
      {trigger}
      {open && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 cursor-default"
            style={{ zIndex: 9998 }}
            onClick={onClose}
          />
          {/* Panel — fixed so it escapes overflow:hidden parents */}
          <div
            className={`fixed bg-white border border-zinc-200 rounded-xl shadow-xl p-2 ${wide ? "w-72" : "w-48 grid grid-cols-4 gap-1"}`}
            style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

/** Categorized shape picker panel */
interface ShapePanelProps {
  onSelect: (id: string) => void;
}

function ShapePanel({
  onSelect,
}: Readonly<ShapePanelProps>) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filtered = SHAPE_LIBRARY.filter(s => {
    const matchesSearch = search === "" || s.label.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search shapes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-6 pr-2 py-1 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4CAF31]/40"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1">
        {["All", ...SHAPE_CATEGORIES].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
              activeCategory === cat
                ? "bg-[#4CAF31] text-white"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Shape grid — 5 per row */}
      <div className="grid grid-cols-5 gap-1 max-h-52 overflow-y-auto pr-0.5">
        {filtered.map(shape => (
          <button
            key={shape.id}
            onClick={() => onSelect(shape.id)}
            title={shape.label}
            className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg hover:bg-zinc-50 transition-colors group"
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 100 100"
              className="text-zinc-600 group-hover:text-[#4CAF31] transition-colors"
            >
              <path
                d={shape.path}
                fill={shape.defaultStroke ? "none" : "currentColor"}
                stroke={shape.defaultStroke ? "currentColor" : "none"}
                strokeWidth={shape.defaultStroke ? 6 : 0}
              />
            </svg>
            <span className="text-[8px] text-zinc-400 leading-none text-center truncate w-full">
              {shape.label}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-5 py-4 text-center text-xs text-zinc-400">No shapes found</div>
        )}
      </div>
    </div>
  );
}

export default function Toolbar({
  isCropMode,
  hasSelection,
  canUndo,
  zoom = 1,
  onAddText,
  onResize,
  onCrop,
  onApplyCrop,
  onCancelCrop,
  onDeleteSelected,
  onUndo,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onAddShape,
  onAddElement,
  onUploadImage,
}: ToolbarProps) {
  const [shapesOpen, setShapesOpen] = useState(false);
  const [elementsOpen, setElementsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="h-12 border-b border-zinc-200 bg-white flex items-center px-4 gap-1 shrink-0">

      {/* ── Add elements group ── */}
      <ToolButton onClick={onAddText} icon={<Type size={15} />} label="Text" />

      {/* Shapes dropdown */}
      <FixedDropdown
        open={shapesOpen}
        onClose={() => setShapesOpen(false)}
        wide
        trigger={
          <button
            onClick={() => { setShapesOpen(v => !v); setElementsOpen(false); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 transition-colors"
            title="Add Shape"
          >
            <Square size={15} />
            <span className="hidden sm:inline">Shape</span>
            <ChevronDown size={11} className={`transition-transform ${shapesOpen ? "rotate-180" : ""}`} />
          </button>
        }
      >
        <ShapePanel onSelect={(id) => { onAddShape?.(id); setShapesOpen(false); }} />
      </FixedDropdown>

      {/* Elements dropdown */}
      <FixedDropdown
        open={elementsOpen}
        onClose={() => setElementsOpen(false)}
        trigger={
          <button
            onClick={() => { setElementsOpen(v => !v); setShapesOpen(false); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 transition-colors"
            title="Add Element"
          >
            <Sparkles size={15} />
            <span className="hidden sm:inline">Elements</span>
            <ChevronDown size={11} className={`transition-transform ${elementsOpen ? "rotate-180" : ""}`} />
          </button>
        }
      >
        {ELEMENTS.map(el => (
          <button
            key={el.type}
            onClick={() => { onAddElement?.(el.type); setElementsOpen(false); }}
            title={el.label}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <span className="text-lg leading-none">{el.emoji}</span>
            <span className="text-[9px] text-zinc-400 leading-none">{el.label.split(" ")[0]}</span>
          </button>
        ))}
      </FixedDropdown>

      {/* Upload image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { onUploadImage?.(file); e.target.value = ""; }
        }}
      />
      <ToolButton
        onClick={() => fileInputRef.current?.click()}
        icon={<ImagePlus size={15} />}
        label="Image"
      />

      <Divider />

      {/* ── Edit tools ── */}
      {isCropMode ? (
        <>
          <button
            onClick={onApplyCrop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4CAF31] text-white text-xs font-semibold hover:bg-[#3d8e27] transition-colors"
          >
            <Check size={14} /> Apply Crop
          </button>
          <button
            onClick={onCancelCrop}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-semibold hover:bg-zinc-50 transition-colors"
          >
            <X size={14} /> Cancel
          </button>
        </>
      ) : (
        <>
          <ToolButton onClick={onCrop} icon={<Crop size={15} />} label="Crop" />
          <ToolButton onClick={onResize} icon={<Maximize2 size={15} />} label="Resize" />
        </>
      )}

      {hasSelection && !isCropMode && (
        <ToolButton
          onClick={onDeleteSelected}
          icon={<Trash2 size={15} />}
          label="Delete"
        />
      )}

      <Divider />

      {/* ── History ── */}
      <ToolButton onClick={onUndo} icon={<Undo2 size={14} />} label="Undo" disabled={!canUndo} />

      <Divider />

      {/* ── Zoom ── */}
      <button
        onClick={onZoomOut}
        title="Zoom out"
        className="p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 transition-colors"
      >
        <ZoomOut size={14} />
      </button>
      <button
        onClick={onZoomReset}
        title="Reset zoom"
        className="px-2 py-1 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-mono hover:bg-zinc-50 transition-colors min-w-[46px] text-center"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={onZoomIn}
        title="Zoom in"
        className="p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 transition-colors"
      >
        <ZoomIn size={14} />
      </button>
    </div>
  );
}
