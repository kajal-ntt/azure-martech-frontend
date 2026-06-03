"use client";

import { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react";
import EditorCanvas, { EditorCanvasRef, TextStyle, LayerDef, LayerInfo } from "./EditorCanvas";
import TextStylePanel from "./TextStylePanel";
import LayersPanel from "./LayersPanel";
import ResizeDialog from "./ResizeDialog";
import DiscardDialog from "./DiscardDialog";
import {
  Type, Square, Sparkles, ImagePlus, Palette,
  Crop, Maximize2, Undo2, ZoomIn, ZoomOut, Trash2, Check, X,
  Search, Copy,
} from "lucide-react";
import { SHAPE_LIBRARY, SHAPE_CATEGORIES } from "@/lib/shapes";

export interface Creative {
  id: string;
  type: string;
  url: string | null;
  version: number;
  campaignId: string;
  status: string;
  adCopy: string | null;
  headlines: string[];
  callToAction: string | null;
  creativeBrief: string | null;
  reviewNote: string | null;
  versionHistory: unknown[];
  aspectRatio?: string | null;
  // guided layer fields
  guidedBackgroundUrl?: string | null;
  guidedLogoUrl?: string | null;
  guidedGraphicUrl?: string | null;
  guidedActorsUrl?: string | null;
  guidedTextPrompt?: string | null;
}

export interface BrandKit {
  brandId?: string;
  fonts: { name: string; weight?: number }[];
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logos?: string[];
}

export interface EditorLayoutProps {
  creative: Creative;
  layers: LayerDef[];
  brandKit: BrandKit | null;
  isDirty: boolean;
  onDirty: () => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
}

export interface EditorLayoutRef {
  exportBlob: () => Promise<Blob>;
}

const EditorLayout = forwardRef<EditorLayoutRef, EditorLayoutProps>(
  function EditorLayout({ creative, layers, brandKit, isDirty, onDirty, onSave, onCancel }, ref) {
    const canvasRef = useRef<EditorCanvasRef>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [isCropMode, setIsCropMode] = useState(false);
    const [showResizeDialog, setShowResizeDialog] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const [selectedTextStyle, setSelectedTextStyle] = useState<TextStyle | null>(null);
    const [hasSelection, setHasSelection] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canvasSize, setCanvasSize] = useState(() => {
      let w = 800;
      let h = 800;
      const ratio = (creative as any).aspectRatio;
      if (ratio && typeof ratio === "string") {
        const [rwStr, rhStr] = ratio.split(":");
        const rw = parseFloat(rwStr);
        const rh = parseFloat(rhStr);
        if (rw && rh && !isNaN(rw) && !isNaN(rh)) {
          if (rw > rh) {
            w = 1024;
            h = Math.round(1024 * (rh / rw));
          } else {
            h = 1024;
            w = Math.round(1024 * (rw / rh));
          }
        }
      }
      return { w, h };
    });
    const [zoom, setZoom] = useState(1);
    const [layerList, setLayerList] = useState<LayerInfo[]>([]);
    const [selectedLayerId, setSelectedLayerId] = useState<string | undefined>();
    // right panel tab: "layers" | "style" | "brand"
    const [rightTab, setRightTab] = useState<"layers" | "style" | "brand">("layers");

    // Left sidebar state
    const [leftPanel, setLeftPanel] = useState<"text" | "shapes" | "elements" | "upload" | "brand" | null>(null);
    const [shapeSearch, setShapeSearch] = useState("");
    const [shapeCategory, setShapeCategory] = useState("All");
    const [curvedTextInput, setCurvedTextInput] = useState("Your Text");

    // Resolved signed logo URLs for the brand panel
    const [resolvedLogoUrls, setResolvedLogoUrls] = useState<string[]>([]);
    useEffect(() => {
      if (!brandKit?.brandId) { setResolvedLogoUrls([]); return; }
      fetch(`/api/brands/${brandKit.brandId}/logo-url`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.url) {
            const raw = d.url as string;
            const proxied = `/api/image-proxy?url=${encodeURIComponent(
              raw.startsWith("gs://")
                ? raw.replace("gs://", "https://storage.googleapis.com/")
                : raw.replace("https://storage.cloud.google.com/", "https://storage.googleapis.com/")
            )}`;
            setResolvedLogoUrls([proxied]);
          }
        })
        .catch(() => { });
    }, [brandKit?.brandId]);

    // Auto-fit canvas when container resizes
    useEffect(() => {
      const el = canvasContainerRef.current;
      if (!el) return;
      const observer = new ResizeObserver(() => {
        const { width, height } = el.getBoundingClientRect();
        canvasRef.current?.fitToContainer(width - 48, height - 48);
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    useImperativeHandle(ref, () => ({
      exportBlob: () => canvasRef.current
        ? canvasRef.current.exportBlob()
        : Promise.reject(new Error("Canvas not ready")),
    }));

    const handleSave = useCallback(async () => {
      setIsSaving(true);
      try { await onSave(); } finally { setIsSaving(false); }
    }, [onSave]);

    const handleCancel = useCallback(() => {
      if (isDirty) setShowDiscardDialog(true);
      else onCancel();
    }, [isDirty, onCancel]);

    const handleSelectionChange = useCallback((style: TextStyle | null) => {
      setSelectedTextStyle(style);
      setHasSelection(style !== null);
      if (style) {
        setRightTab("style");
        // Sync selectedLayerId so alignment buttons work for canvas-selected objects
        const id = canvasRef.current?.getActiveLayerId?.();
        if (id) setSelectedLayerId(id);
      } else {
        setSelectedLayerId(undefined);
      }
    }, []);

    const handleLayersChange = useCallback((updated: LayerInfo[]) => {
      setLayerList(updated);
    }, []);

    const handleSelectLayer = useCallback((id: string) => {
      setSelectedLayerId(id);
      canvasRef.current?.selectLayer(id);
    }, []);

    return (
      <div className="flex flex-col h-screen bg-zinc-100 overflow-hidden font-sans">

        {/* Top bar */}
        <div className="h-[52px] bg-white border-b border-zinc-200 flex items-center justify-between px-5 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#4CAF31] tracking-tight">MAR<span className="text-zinc-800">TECH</span></span>
            <div className="w-px h-4 bg-zinc-200" />
            <span className="text-xs text-zinc-500 font-medium">Image Editor</span>
            <div className="w-px h-4 bg-zinc-200" />
            <span className="text-xs text-zinc-400 font-mono">#{creative.id.slice(0, 8)}</span>
            {isDirty && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full">
                ● Unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {isCropMode ? (
              <>
                <button onClick={() => { canvasRef.current?.applyCrop(); setIsCropMode(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4CAF31] text-white text-xs font-semibold hover:bg-[#3d8e27] transition-colors">
                  <Check size={13} /> Apply
                </button>
                <button onClick={() => { canvasRef.current?.cancelCrop(); setIsCropMode(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-semibold hover:bg-zinc-50 transition-colors ml-1">
                  <X size={13} /> Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { canvasRef.current?.enterCropMode(); setIsCropMode(true); }} title="Crop"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
                  <Crop size={14} /><span className="hidden md:inline ml-1">Crop</span>
                </button>
                <button onClick={() => setShowResizeDialog(true)} title="Resize"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
                  <Maximize2 size={14} /><span className="hidden md:inline ml-1">Resize</span>
                </button>
                {hasSelection && (
                  <>
                    <button onClick={() => canvasRef.current?.duplicateSelected()} title="Duplicate (Ctrl+D)"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
                      <Copy size={14} /><span className="hidden md:inline ml-1">Duplicate</span>
                    </button>
                    <button onClick={() => canvasRef.current?.deleteSelected()} title="Delete"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500/70 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 size={14} /><span className="hidden md:inline ml-1">Delete</span>
                    </button>
                  </>
                )}                <div className="w-px h-4 bg-zinc-200 mx-1" />
                <button onClick={() => { canvasRef.current?.undo(); setCanUndo(canvasRef.current?.canUndo() ?? false); }}
                  disabled={!canUndo} title="Undo"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <Undo2 size={14} /><span className="hidden md:inline ml-1">Undo</span>
                </button>
                <div className="w-px h-4 bg-zinc-200 mx-1" />
                <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg px-1 py-0.5">
                  <button onClick={() => { canvasRef.current?.zoomOut(); setZoom(canvasRef.current?.getZoom() ?? 1); }}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 transition-colors"><ZoomOut size={13} /></button>
                  <button onClick={() => { canvasRef.current?.zoomReset(); setZoom(1); }}
                    className="px-2 py-0.5 text-zinc-600 text-xs font-mono hover:text-zinc-900 transition-colors min-w-[40px] text-center">
                    {Math.round(zoom * 100)}%
                  </button>
                  <button onClick={() => { canvasRef.current?.zoomIn(); setZoom(canvasRef.current?.getZoom() ?? 1); }}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 transition-colors"><ZoomIn size={13} /></button>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCancel}
              className="px-4 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={isSaving}
              className="px-5 py-1.5 rounded-lg bg-[#4CAF31] text-white text-sm font-semibold hover:bg-[#3d8e27] transition-colors disabled:opacity-60 shadow-lg shadow-[#4CAF31]/20">
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left icon rail */}
          <div className="w-[60px] shrink-0 bg-white border-r border-zinc-200 flex flex-col items-center py-3 gap-1">
            {(["text", "shapes", "elements", "upload", "brand"] as const).map((tool) => {
              const icons: Record<string, React.ReactNode> = {
                text: <Type size={19} />,
                shapes: <Square size={19} />,
                elements: <Sparkles size={19} />,
                upload: <ImagePlus size={19} />,
                brand: <Palette size={19} />,
              };
              const labels: Record<string, string> = { text: "Text", shapes: "Shapes", elements: "Elements", upload: "Upload", brand: "Brand" };
              const active = leftPanel === tool;
              return (
                <button key={tool} onClick={() => setLeftPanel(active ? null : tool)} title={labels[tool]}
                  className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                    active ? "bg-[#F0F9F6] text-[#4CAF31] ring-1 ring-[#4CAF31]/30" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                  }`}>
                  {icons[tool]}
                  <span className="text-[7px] font-medium leading-none tracking-wide uppercase">{labels[tool]}</span>
                </button>
              );
            })}
          </div>

          {/* Left content panel */}
          {leftPanel && (
            <div className="w-64 shrink-0 bg-white border-r border-zinc-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 shrink-0">
                <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
                  {({ text: "Text", shapes: "Shapes", elements: "Elements", upload: "Upload", brand: "Brand" } as Record<string,string>)[leftPanel]}
                </span>
                <button onClick={() => setLeftPanel(null)}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors">
                  <X size={13} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">

                {leftPanel === "text" && (
                  <div className="p-4 space-y-3">
                    <button onClick={() => canvasRef.current?.addText()}
                      className="w-full py-4 rounded-xl border-2 border-dashed border-zinc-200 hover:border-[#4CAF31] hover:bg-[#F0F9F6] text-sm font-semibold text-zinc-500 hover:text-[#4CAF31] transition-all flex items-center justify-center gap-2 group">
                      <Type size={16} className="group-hover:scale-110 transition-transform" /> Add a text box
                    </button>
                    <p className="text-[10px] text-zinc-400 text-center leading-relaxed">Click to add · Double-click on canvas to edit</p>

                    {/* Curved / shaped text */}
                    <div className="pt-2 border-t border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Shaped Text</p>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Your text here..."
                          value={curvedTextInput}
                          onChange={e => setCurvedTextInput(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4CAF31] bg-white text-zinc-700 placeholder-zinc-400"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          {([
                            { effect: "arc-up",   label: "Arc Up",   preview: "⌢" },
                            { effect: "arc-down", label: "Arc Down", preview: "⌣" },
                            { effect: "circle",   label: "Circle",   preview: "○" },
                            { effect: "wave",     label: "Wave",     preview: "∿" },
                            { effect: "arch",     label: "Arch",     preview: "∩" },
                            { effect: "bulge",    label: "Bulge",    preview: "◉" },
                            { effect: "squeeze",  label: "Squeeze",  preview: "◈" },
                            { effect: "flag",     label: "Flag",     preview: "⌇" },
                          ] as const).map(({ effect, label, preview }) => (
                            <button
                              key={effect}
                              onClick={() => {
                                const t = curvedTextInput.trim() || "Your Text";
                                canvasRef.current?.addCurvedText(t, effect as any);
                              }}
                              className="flex items-center gap-1.5 px-2 py-2 rounded-lg border border-zinc-200 hover:border-[#4CAF31] hover:bg-[#F0F9F6] text-xs text-zinc-600 hover:text-[#4CAF31] transition-all"
                            >
                              <span className="text-base leading-none w-5 text-center">{preview}</span>
                              <span className="font-medium">{label}</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-400 leading-relaxed">
                          Type your text above, then click a shape to apply it.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {leftPanel === "shapes" && (
                  <div className="p-3 space-y-3">
                    <div className="relative">
                      <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input type="text" placeholder="Search shapes..." value={shapeSearch} onChange={e => setShapeSearch(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-[#4CAF31] transition-colors" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {["All", ...SHAPE_CATEGORIES].map(cat => (
                        <button key={cat} onClick={() => setShapeCategory(cat)}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors ${shapeCategory === cat ? "bg-[#4CAF31] text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"}`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {SHAPE_LIBRARY.filter(s => {
                        const ms = shapeSearch === "" || s.label.toLowerCase().includes(shapeSearch.toLowerCase());
                        const mc = shapeCategory === "All" || s.category === shapeCategory;
                        return ms && mc;
                      }).map(shape => (
                        <button key={shape.id} onClick={() => canvasRef.current?.addShape(shape.id)} title={shape.label}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg bg-zinc-50 hover:bg-[#F0F9F6] border border-zinc-100 hover:border-[#4CAF31]/40 transition-all group">
                          <svg width="32" height="32" viewBox="0 0 100 100" className="text-zinc-500 group-hover:text-[#4CAF31] transition-colors">
                            <path d={shape.path} fill={shape.defaultStroke ? "none" : "currentColor"} stroke={shape.defaultStroke ? "currentColor" : "none"} strokeWidth={shape.defaultStroke ? 7 : 0} />
                          </svg>
                          <span className="text-[7px] text-zinc-400 group-hover:text-zinc-700 leading-none text-center truncate w-full transition-colors">{shape.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {leftPanel === "elements" && (
                  <div className="p-3 space-y-3">
                    {/* Badge shapes */}
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Badges</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([
                          { id: "badge-sale",     label: "SALE",     bg: "#E53935" },
                          { id: "badge-new",      label: "NEW",      bg: "#4CAF31" },
                          { id: "badge-hot",      label: "🔥 HOT",   bg: "#FF6F00" },
                          { id: "badge-50off",    label: "50% OFF",  bg: "#E53935" },
                          { id: "badge-limited",  label: "LIMITED",  bg: "#7B1FA2" },
                          { id: "badge-free",     label: "FREE",     bg: "#00897B" },
                          { id: "badge-best",     label: "BEST BUY", bg: "#1565C0" },
                          { id: "badge-trending", label: "TRENDING", bg: "#F4511E" },
                        ] as const).map(badge => (
                          <button
                            key={badge.id}
                            onClick={() => canvasRef.current?.addBadge(badge.id as any)}
                            className="flex items-center justify-center px-2 py-2 rounded-lg border border-zinc-100 hover:border-[#4CAF31]/40 hover:bg-[#F0F9F6] transition-all group"
                          >
                            <span
                              className="text-[10px] font-bold text-white px-2 py-1 rounded-full"
                              style={{ backgroundColor: badge.bg }}
                            >
                              {badge.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Emoji elements */}
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Elements</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "heart", emoji: "❤️", label: "Heart" },
                          { id: "check", emoji: "✅", label: "Check" },
                          { id: "cross", emoji: "❌", label: "Cross" },
                          { id: "badge-new", emoji: "🆕", label: "NEW" },
                          { id: "badge-sale", emoji: "🏷️", label: "SALE" },
                          { id: "badge-hot", emoji: "🔥", label: "HOT" },
                          { id: "speech-bubble", emoji: "💬", label: "Speech" },
                          { id: "banner", emoji: "🎀", label: "Banner" },
                          { id: "star", emoji: "⭐", label: "Star" },
                          { id: "lightning", emoji: "⚡", label: "Lightning" },
                          { id: "crown", emoji: "👑", label: "Crown" },
                          { id: "diamond-gem", emoji: "💎", label: "Diamond" },
                        ].map(el => (
                          <button key={el.id} onClick={() => canvasRef.current?.addElement(el.id as any)}
                            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-zinc-50 hover:bg-[#F0F9F6] border border-zinc-100 hover:border-[#4CAF31]/40 transition-all group">
                            <span className="text-2xl leading-none group-hover:scale-110 transition-transform">{el.emoji}</span>
                            <span className="text-[9px] text-zinc-400 group-hover:text-zinc-700 transition-colors">{el.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {leftPanel === "upload" && (
                  <div className="p-4">
                    <label className="flex flex-col items-center justify-center gap-3 w-full py-10 rounded-xl border-2 border-dashed border-zinc-200 hover:border-[#4CAF31] hover:bg-[#F0F9F6] cursor-pointer transition-all group">
                      <div className="w-12 h-12 rounded-full bg-zinc-100 group-hover:bg-[#F0F9F6] flex items-center justify-center transition-colors">
                        <ImagePlus size={22} className="text-zinc-400 group-hover:text-[#4CAF31] transition-colors" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-zinc-500 group-hover:text-zinc-800 transition-colors">Upload image</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">JPG, PNG, SVG, WebP</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { canvasRef.current?.addUploadedImage(f); e.target.value = ""; } }} />
                    </label>
                  </div>
                )}

                {leftPanel === "brand" && (
                  <div className="p-4 space-y-4">
                    {brandKit ? (
                      <>
                        {/* Colors */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Colors</p>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { label: "Primary", value: brandKit.primaryColor },
                              { label: "Secondary", value: brandKit.secondaryColor },
                              { label: "Accent", value: brandKit.accentColor },
                            ].filter(c => c.value).map(c => (
                              <div key={c.label} className="flex flex-col items-center gap-1">
                                <div
                                  className="w-8 h-8 rounded-full border border-zinc-200 shadow-sm cursor-pointer hover:scale-110 transition-transform"
                                  style={{ backgroundColor: c.value! }}
                                  title={c.value!}
                                />
                                <span className="text-[9px] text-zinc-400">{c.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Fonts */}
                        {brandKit.fonts.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Fonts</p>
                            <div className="space-y-1">
                              {brandKit.fonts.slice(0, 5).map((f) => (
                                <div key={`${f.name}-${f.weight || 'normal'}`}
                                  className="text-xs text-zinc-600 bg-zinc-50 px-2 py-1.5 rounded border border-zinc-100 flex items-center justify-between">
                                  <span style={{ fontFamily: f.name }}>{f.name}</span>
                                  {f.weight && <span className="text-zinc-400 text-[10px]">w{f.weight}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Logos */}
                        {resolvedLogoUrls.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Logos</p>
                            <div className="grid grid-cols-2 gap-2">
                              {resolvedLogoUrls.slice(0, 4).map((url, i) => (
                                <button
                                  key={url}
                                  onClick={() => canvasRef.current?.addImageLayer(url, "Logo", `brand-logo-${i}-${Date.now()}`)}
                                  className="aspect-square rounded border border-zinc-200 overflow-hidden hover:border-[#4CAF31] transition-colors bg-zinc-50 flex items-center justify-center"
                                  title="Click to add to canvas"
                                >
                                  <img src={url} alt="Logo" className="w-full h-full object-contain p-1" />
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-zinc-400">Click a logo to add it to the canvas</p>
                          </div>
                        )}

                        {/* Upload Image */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Upload Image</p>
                          <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border-2 border-dashed border-zinc-200 hover:border-[#4CAF31] text-xs text-zinc-500 hover:text-[#4CAF31] cursor-pointer transition-colors bg-zinc-50">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Upload image
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const objectUrl = URL.createObjectURL(file);
                                canvasRef.current?.addImageLayer(objectUrl, file.name.replace(/\.[^.]+$/, ""), `upload-${Date.now()}`);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <p className="text-[10px] text-zinc-400">JPG, PNG, SVG, WebP</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-zinc-400 text-center mt-6">No brand kit available</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Canvas */}
          <div ref={canvasContainerRef}
            className="flex-1 flex items-center justify-center overflow-hidden p-8 bg-zinc-100">
            <div className="shadow-xl rounded overflow-hidden">
              <EditorCanvas
                ref={canvasRef}
                layers={layers}
                initialWidth={canvasSize.w}
                initialHeight={canvasSize.h}
                onDirty={() => { onDirty(); setCanUndo(canvasRef.current?.canUndo() ?? false); }}
                onImageLoaded={() => {
                  const el = canvasContainerRef.current;
                  if (el) {
                    const { width, height } = el.getBoundingClientRect();
                    canvasRef.current?.fitToContainer(width - 64, height - 64);
                  }
                }}
                onSelectionChange={handleSelectionChange}
                onLayersChange={handleLayersChange}
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="w-80 shrink-0 bg-white border-l border-zinc-200 flex flex-col overflow-hidden">
            <div className="flex border-b border-zinc-100 shrink-0 bg-zinc-50/50">
              {(["layers", "style"] as const).map(tab => (
                <button key={tab} onClick={() => setRightTab(tab)}
                  className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-all ${
                    rightTab === tab ? "text-[#4CAF31] border-b-2 border-[#4CAF31] bg-white" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                  }`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {rightTab === "layers" && (
                <LayersPanel
                  layers={layerList}
                  selectedLayerId={selectedLayerId}
                  onSelect={handleSelectLayer}
                  onToggleVisible={(id, v) => canvasRef.current?.setLayerVisible(id, v)}
                  onToggleLocked={(id, l) => canvasRef.current?.setLayerLocked(id, l)}
                  onBringForward={(id) => canvasRef.current?.bringLayerForward(id)}
                  onSendBackward={(id) => canvasRef.current?.sendLayerBackward(id)}
                  onBringToFront={(id) => canvasRef.current?.bringLayerToFront(id)}
                  onSendToBack={(id) => canvasRef.current?.sendLayerToBack(id)}
                />
              )}
              {rightTab === "style" && (
                selectedTextStyle ? (
                  <TextStylePanel
                    visible={true}
                    style={selectedTextStyle}
                    brandKit={brandKit}
                    onChange={(style) => canvasRef.current?.applyTextStyle(style)}
                    onAlignLayer={(hAlign, vAlign) => {
                      // Use selectedLayerId if available, otherwise align the currently active canvas object
                      const id = selectedLayerId ?? canvasRef.current?.getActiveLayerId?.() ?? null;
                      if (id) {
                        canvasRef.current?.alignLayer(id, hAlign, vAlign);
                      } else {
                        // Fallback: align whatever is currently selected on canvas
                        canvasRef.current?.alignActiveObject?.(hAlign, vAlign);
                      }
                    }}
                    onApplyTextShape={(effect) => canvasRef.current?.applyTextShape(effect as any)}
                    onUpdateCurvedText={(text) => canvasRef.current?.updateCurvedText(text)}
                    onSetPosition={(x, y) => canvasRef.current?.setSelectedPosition(x, y)}
                    onSetSize={(w, h) => canvasRef.current?.setSelectedSize(w, h)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
                      <Square size={20} className="text-zinc-300" />
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">Select an element on the canvas to edit its style</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        <ResizeDialog
          isOpen={showResizeDialog}
          currentWidth={canvasSize.w}
          currentHeight={canvasSize.h}
          onConfirm={(w, h) => { canvasRef.current?.resize(w, h); setCanvasSize({ w, h }); setShowResizeDialog(false); }}
          onClose={() => setShowResizeDialog(false)}
        />
        <DiscardDialog
          isOpen={showDiscardDialog}
          onDiscard={() => { setShowDiscardDialog(false); onCancel(); }}
          onKeepEditing={() => setShowDiscardDialog(false)}
        />
      </div>
    );
  }
);

export default EditorLayout;
