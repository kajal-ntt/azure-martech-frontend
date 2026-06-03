"use client";

import React from "react";
import {
  Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown,
  ChevronsUp, ChevronsDown,
  Image, Type, Layers, Square, Sparkles,
} from "lucide-react";
import { LayerInfo } from "./EditorCanvas";

interface LayersPanelProps {
  readonly layers: LayerInfo[];
  readonly selectedLayerId?: string;
  readonly onSelect: (id: string) => void;
  readonly onToggleVisible: (id: string, visible: boolean) => void;
  readonly onToggleLocked: (id: string, locked: boolean) => void;
  readonly onBringForward: (id: string) => void;
  readonly onSendBackward: (id: string) => void;
  readonly onBringToFront?: (id: string) => void;
  readonly onSendToBack?: (id: string) => void;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  background: <Image size={12} className="text-blue-400" />,
  logo:       <Image size={12} className="text-purple-400" />,
  graphic:    <Image size={12} className="text-orange-400" />,
  actors:     <Image size={12} className="text-pink-400" />,
  text:       <Type size={12} className="text-green-400" />,
  image:      <Image size={12} className="text-zinc-400" />,
  shape:      <Square size={12} className="text-blue-500" />,
  element:    <Sparkles size={12} className="text-amber-400" />,
};

const TYPE_COLOR: Record<string, string> = {
  background: "bg-blue-50 border-blue-100",
  logo:       "bg-purple-50 border-purple-100",
  graphic:    "bg-orange-50 border-orange-100",
  actors:     "bg-pink-50 border-pink-100",
  text:       "bg-green-50 border-green-100",
  image:      "bg-zinc-50 border-zinc-100",
  shape:      "bg-blue-50 border-blue-100",
  element:    "bg-amber-50 border-amber-100",
};

export default function LayersPanel({
  layers,
  selectedLayerId,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
}: LayersPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
        <Layers size={14} className="text-zinc-400" />
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Layers</p>
        <span className="ml-auto text-[10px] text-zinc-400">{layers.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.length === 0 && (
          <p className="text-xs text-zinc-400 text-center mt-6 px-2">No layers yet. Generate a creative to see layers here.</p>
        )}
        {layers.map((layer) => {
          const isSelected = layer.id === selectedLayerId;
          const colorClass = TYPE_COLOR[layer.type] ?? TYPE_COLOR.image;
          return (
            <div
              key={layer.id}
              className={`group relative flex items-center gap-2 px-2 py-2 rounded-lg border transition-all ${
                isSelected
                  ? "border-[#4CAF31] bg-[#F0F9F6] shadow-sm"
                  : `${colorClass} hover:border-zinc-300`
              } ${layer.visible ? "" : "opacity-40"}`}
            >
              <button
                type="button"
                onClick={() => onSelect(layer.id)}
                aria-label={`Select ${layer.label}`}
                className="absolute inset-0 z-10"
              />
              {/* Type icon */}
              <span className="shrink-0">{TYPE_ICON[layer.type] ?? TYPE_ICON.image}</span>

              {/* Label */}
              <span className="flex-1 min-w-0 text-xs font-medium text-zinc-700 truncate">{layer.label}</span>

              {/* Controls — show on hover or when selected */}
              <div className={`relative z-20 flex items-center gap-0.5 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                <button
                  title={layer.visible ? "Hide layer" : "Show layer"}
                  onClick={(e) => { e.stopPropagation(); onToggleVisible(layer.id, !layer.visible); }}
                  className="p-1 rounded hover:bg-white/80 text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button
                  title={layer.locked ? "Unlock layer" : "Lock layer"}
                  onClick={(e) => { e.stopPropagation(); onToggleLocked(layer.id, !layer.locked); }}
                  className="p-1 rounded hover:bg-white/80 text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                {layer.type !== "background" && (
                  <>
                    <button
                      title="Bring to front"
                      onClick={(e) => { e.stopPropagation(); onBringToFront?.(layer.id); }}
                      className="p-1 rounded hover:bg-white/80 text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      <ChevronsUp size={12} />
                    </button>
                    <button
                      title="Bring forward"
                      onClick={(e) => { e.stopPropagation(); onBringForward(layer.id); }}
                      className="p-1 rounded hover:bg-white/80 text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      title="Send backward"
                      onClick={(e) => { e.stopPropagation(); onSendBackward(layer.id); }}
                      className="p-1 rounded hover:bg-white/80 text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      title="Send to back"
                      onClick={(e) => { e.stopPropagation(); onSendToBack?.(layer.id); }}
                      className="p-1 rounded hover:bg-white/80 text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      <ChevronsDown size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-zinc-100">
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          Click a layer to select it. Drag on canvas to reposition.
        </p>
      </div>
    </div>
  );
}
