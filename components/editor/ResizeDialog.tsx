"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

export interface ResizeDialogProps {
  readonly isOpen: boolean;
  readonly currentWidth: number;
  readonly currentHeight: number;
  readonly onConfirm: (width: number, height: number) => void;
  readonly onClose: () => void;
}

export const RESIZE_PRESETS = [
  { label: "1:1", ratio: 1 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "9:16", ratio: 9 / 16 },
  { label: "4:3", ratio: 4 / 3 },
];

export function computeLockedHeight(newWidth: number, origWidth: number, origHeight: number): number {
  return Math.round(newWidth * (origHeight / origWidth));
}

export function computeLockedWidth(newHeight: number, origWidth: number, origHeight: number): number {
  return Math.round(newHeight * (origWidth / origHeight));
}

export default function ResizeDialog({
  isOpen,
  currentWidth,
  currentHeight,
  onConfirm,
  onClose,
}: ResizeDialogProps) {
  const [width, setWidth] = useState(currentWidth);
  const [height, setHeight] = useState(currentHeight);
  const [lockAspect, setLockAspect] = useState(false);

  // Sync local state when dialog opens or dimensions change
  useEffect(() => {
    if (isOpen) {
      setWidth(currentWidth);
      setHeight(currentHeight);
    }
  }, [isOpen, currentWidth, currentHeight]);

  if (!isOpen) return null;

  function handleWidthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newWidth = Number(e.target.value);
    setWidth(newWidth);
    if (lockAspect && currentWidth > 0) {
      setHeight(computeLockedHeight(newWidth, currentWidth, currentHeight));
    }
  }

  function handleHeightChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newHeight = Number(e.target.value);
    setHeight(newHeight);
    if (lockAspect && currentHeight > 0) {
      setWidth(computeLockedWidth(newHeight, currentWidth, currentHeight));
    }
  }

  function handlePreset(ratio: number) {
    const newWidth = currentWidth;
    const newHeight = Math.round(newWidth / ratio);
    setWidth(newWidth);
    setHeight(newHeight);
  }

  function handleConfirm() {
    onConfirm(width, height);
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex h-full max-h-none w-full max-w-none items-center justify-center bg-black/50 p-0 border-0"
      aria-modal="true"
      aria-label="Resize canvas"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">Resize Canvas</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current dimensions info */}
        <p className="text-sm text-zinc-500">
          Current size: {currentWidth} × {currentHeight} px
        </p>

        {/* Preset buttons */}
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wide">Presets</p>
          <div className="flex gap-2 flex-wrap">
            {RESIZE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset.ratio)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Width / Height inputs */}
        <div className="flex gap-4">
          <label className="flex-1 flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Width (px)</span>
            <input
              type="number"
              min={50}
              max={8000}
              value={width}
              onChange={handleWidthChange}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#4CAF31]/40 focus:border-[#4CAF31]"
              aria-label="Width"
            />
          </label>
          <label className="flex-1 flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">Height (px)</span>
            <input
              type="number"
              min={50}
              max={8000}
              value={height}
              onChange={handleHeightChange}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#4CAF31]/40 focus:border-[#4CAF31]"
              aria-label="Height"
            />
          </label>
        </div>

        {/* Lock aspect ratio toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={lockAspect}
            onChange={(e) => setLockAspect(e.target.checked)}
            className="w-4 h-4 accent-[#4CAF31]"
            aria-label="Lock aspect ratio"
          />
          <span className="text-sm text-zinc-700">Lock Aspect Ratio</span>
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg bg-[#4CAF31] text-white text-sm font-semibold hover:bg-[#3d8e27] transition-colors shadow-sm shadow-[#4CAF31]/30"
          >
            Apply
          </button>
        </div>
      </div>
    </dialog>
  );
}
