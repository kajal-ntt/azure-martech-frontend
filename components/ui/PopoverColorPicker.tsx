"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChromePicker, ColorResult } from "react-color";

interface PopoverColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
}

export function PopoverColorPicker({ color, onChange, className }: PopoverColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleChange = (colorResult: ColorResult) => {
    const alphaHex = Math.round((colorResult.rgb.a ?? 1) * 255).toString(16).padStart(2, "0");
    // Ensure 8-digit hex if alpha < 1, else 6-digit hex
    const finalHex = colorResult.hex + (alphaHex === "ff" ? "" : alphaHex);
    onChange(finalHex);
  };

  // Convert transparent to a valid hex for the picker internally
  const pickerColor = color === "transparent" ? "rgba(0,0,0,0)" : color;

  return (
    <div className="relative inline-block">
      <div
        className={`w-8 h-8 cursor-pointer rounded border border-zinc-200 p-0.5 flex items-center justify-center bg-white ${className || ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div 
          className="w-full h-full rounded-sm ring-1 ring-black/10" 
          style={{ 
            backgroundColor: color,
            backgroundImage: color === "transparent" ? 'conic-gradient(#eee 25%, white 25%, white 50%, #eee 50%, #eee 75%, white 75%, white)' : 'none',
            backgroundSize: '8px 8px'
          }} 
        />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-2 top-full right-0 sm:left-0 sm:right-auto" ref={popoverRef}>
          <ChromePicker color={pickerColor} onChange={handleChange} />
        </div>
      )}
    </div>
  );
}
