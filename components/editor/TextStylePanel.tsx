"use client";

import React, { useState, useEffect } from "react";
import { PopoverColorPicker } from "../ui/PopoverColorPicker";
import { TextStyle } from "./EditorCanvas";
import { BrandKit } from "./EditorLayout";
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  ChevronDown,
} from "lucide-react";
import { FONTS_BY_CATEGORY, ALL_FONT_NAMES, loadGoogleFonts } from "@/lib/fonts";
export { ALL_FONT_NAMES as DEFAULT_FONTS } from "@/lib/fonts";

export interface TextStylePanelProps {
  readonly visible: boolean;
  readonly style: TextStyle;
  readonly brandKit: BrandKit | null;
  readonly onChange: (style: Partial<TextStyle>) => void;
  readonly onAlignLayer?: (hAlign: "left" | "center" | "right" | null, vAlign: "top" | "middle" | "bottom" | null) => void;
  readonly onApplyTextShape?: (effect: string) => void;
  readonly onUpdateCurvedText?: (text: string) => void;
  readonly onSetPosition?: (x: number, y: number) => void;
  readonly onSetSize?: (w: number, h: number) => void;
}

const GREEN = "#4CAF31";

function SelectOrInput({
  label,
  value,
  options,
  suffix = "",
  min,
  max,
  step = 1,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly options: number[];
  readonly suffix?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly onChange: (v: number) => void;
}) {
  const [isCustom, setIsCustom] = React.useState(!options.includes(value));
  const [customValue, setCustomValue] = React.useState(value.toString());
  const controlId = React.useId();

  React.useEffect(() => {
    if (!options.includes(value)) {
      setIsCustom(true);
      setCustomValue(value.toString());
    }
  }, [value, options]);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={controlId} className="text-xs text-zinc-500">{label}</label>
      {isCustom ? (
        <div className="flex items-center gap-1">
          <div className="flex-1 relative">
            <input
              id={controlId}
              type="number"
              value={customValue}
              min={min}
              max={max}
              step={step}
              onChange={(e) => {
                setCustomValue(e.target.value);
                const num = Number.parseFloat(e.target.value);
                if (!Number.isNaN(num)) {
                  onChange(num);
                }
              }}
              className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5 pr-8 focus:outline-none text-zinc-900 font-medium bg-white"
              style={{ outlineColor: GREEN }}
            />
            {suffix && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none text-xs">
                {suffix}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setIsCustom(false);
              onChange(options[0]);
            }}
            className="w-7 h-7 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-xs flex items-center justify-center"
            title="Switch to preset"
          >
            ⌄
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <select
            id={controlId}
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "custom") {
                setIsCustom(true);
                setCustomValue(value.toString());
              } else {
                onChange(Number(val));
              }
            }}
            className="flex-1 text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white text-zinc-700 focus:outline-none"
            style={{ outlineColor: GREEN }}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}{suffix}
              </option>
            ))}
            <option value="custom">Custom...</option>
          </select>
        </div>
      )}
    </div>
  );
}

function ToggleBtn({
  active, onClick, title, children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={active ? { backgroundColor: GREEN, borderColor: GREEN, color: "#fff" } : {}}
      className="p-1.5 rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  displayValue,
  min,
  max,
  step,
  value,
  onChange,
}: {
  readonly label: string;
  readonly displayValue: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const inputId = React.useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-xs text-zinc-500">{label}</label>
        <span className="text-xs font-mono text-zinc-400">{displayValue}</span>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          WebkitAppearance: "none",
          appearance: "none",
          width: "100%",
          height: "6px",
          borderRadius: "9999px",
          outline: "none",
          cursor: "pointer",
          background: `linear-gradient(to right, ${GREEN} ${pct}%, #e4e4e7 ${pct}%)`,
        }}
      />
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${GREEN};
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          cursor: pointer;
        }
        input[type=range]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${GREEN};
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

// ─── FontPicker ───────────────────────────────────────────────────────────────

function FontPicker({
  value,
  brandFonts,
  onChange,
}: {
  readonly value: string;
  readonly brandFonts: { name: string }[];
  readonly onChange: (font: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const labelId = React.useId();
  const triggerId = React.useId();

  useEffect(() => { loadGoogleFonts(); }, []);

  const categories = Object.keys(FONTS_BY_CATEGORY) as (keyof typeof FONTS_BY_CATEGORY)[];
  const brandFontNames = Array.from(
    new Set(brandFonts.map(font => font.name.trim()).filter(Boolean)),
  );
  const searchableFonts = Array.from(new Set([...brandFontNames, ...ALL_FONT_NAMES]));
  const filtered = search.trim()
    ? searchableFonts.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : null;

  const commit = (font: string) => {
    onChange(font);
    setHovered(null);
    setOpen(false);
    setSearch("");
  };

  const handleClose = () => {
    if (hovered) onChange(value); // revert preview
    setHovered(null);
    setOpen(false);
    setSearch("");
  };

  const previewFont = hovered ?? value;
  let fontOptions: React.ReactNode;
  if (filtered) {
    fontOptions = filtered.length === 0 ? (
      <p className="text-xs text-zinc-400 text-center py-4">No fonts found</p>
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
    fontOptions = (
      <>
        {brandFontNames.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 sticky top-0">Brand Kit</div>
            {brandFontNames.map((font) => (
              <FontOption key={`brand-${font}`} font={font} selected={value === font} hovered={hovered === font}
                onSelect={commit}
                onHover={(f) => { setHovered(f); onChange(f); }}
                onHoverEnd={() => { setHovered(null); onChange(value); }}
              />
            ))}
          </div>
        )}
        {categories.map((cat) => (
          <div key={cat}>
            <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 sticky top-0">{cat}</div>
            {FONTS_BY_CATEGORY[cat].map((entry) => (
              <FontOption key={entry.name} font={entry.name} selected={value === entry.name} hovered={hovered === entry.name}
                onSelect={commit}
                onHover={(f) => { setHovered(f); onChange(f); }}
                onHoverEnd={() => { setHovered(null); onChange(value); }}
              />
            ))}
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1 relative">
      <span id={labelId} className="text-xs text-zinc-500">Font Family</span>
      <button
        id={triggerId}
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-2 py-1.5 border border-zinc-200 rounded-lg bg-white text-zinc-700 hover:border-zinc-300 transition-colors focus:outline-none"
        style={{ fontFamily: previewFont }}
      >
        <span className="text-sm truncate">{previewFont}</span>
        <ChevronDown size={13} className={`text-zinc-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close font picker"
            onClick={handleClose}
            className="fixed inset-0 z-40"
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 flex flex-col max-h-72 overflow-hidden">
            <div className="p-2 border-b border-zinc-100 shrink-0">
              <input
                autoFocus
                type="text"
                placeholder="Search fonts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4CAF31]"
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

function FontOption({ font, selected, hovered, onSelect, onHover, onHoverEnd }: {
  readonly font: string; readonly selected: boolean; readonly hovered: boolean;
  readonly onSelect: (f: string) => void;
  readonly onHover: (f: string) => void;
  readonly onHoverEnd: () => void;
}) {
  let optionClassName = "text-zinc-700 hover:bg-zinc-50";
  if (hovered) {
    optionClassName = "bg-zinc-100 text-zinc-900";
  } else if (selected) {
    optionClassName = "bg-[#F0F9F6] text-[#4CAF31]";
  }

  return (
    <button
      role="option"
      aria-selected={selected}
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

export default function TextStylePanel({ visible, style, brandKit, onChange, onAlignLayer, onApplyTextShape, onUpdateCurvedText, onSetPosition, onSetSize }: Readonly<TextStylePanelProps>) {
  const [curvedTextEdit, setCurvedTextEdit] = React.useState(style.curvedTextSource ?? "");

  // Sync when selection changes
  React.useEffect(() => {
    setCurvedTextEdit(style.curvedTextSource ?? "");
  }, [style.curvedTextSource]);

  if (!visible) return null;

  const brandColors = brandKit ? [
    { label: "Primary", value: brandKit.primaryColor },
    { label: "Secondary", value: brandKit.secondaryColor },
    { label: "Accent", value: brandKit.accentColor },
  ].filter(c => !!c.value) as { label: string; value: string }[] : [];

  const isBold = style.fontWeight === "bold" || Number(style.fontWeight) >= 700;
  const isItalic = style.fontStyle === "italic";

  const isText = style.fontFamily !== "";

  return (
    <div className="flex flex-col gap-4 p-4 bg-white w-full">
      <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
        {isText ? "Text Style" : "Object Style"}
      </p>

      {/* Curved text editing — shown when a curved text image is selected */}
      {style.isCurvedText && onUpdateCurvedText && (
        <div className="flex flex-col gap-2 pb-3 border-b border-zinc-100">
          <p className="text-[10px] font-bold text-[#4CAF31] uppercase tracking-widest">✏ Edit Curved Text</p>
          <textarea
            value={curvedTextEdit}
            onChange={(e) => setCurvedTextEdit(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4CAF31] resize-none text-zinc-700"
            placeholder="Type your text..."
          />
          <button
            onClick={() => onUpdateCurvedText(curvedTextEdit)}
            className="w-full py-1.5 rounded-lg bg-[#4CAF31] text-white text-xs font-bold hover:bg-[#3d8e27] transition-colors"
          >
            Apply
          </button>
          <p className="text-[9px] text-zinc-400">Effect: <span className="font-medium text-zinc-600">{style.curvedTextEffect}</span></p>
        </div>
      )}

      {/* Position & Size — shown for all selected objects */}
      {(style.posX !== undefined || style.objWidth !== undefined) && (onSetPosition || onSetSize) && (
        <div className="flex flex-col gap-2 pb-3 border-b border-zinc-100">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Position & Size</p>
          <div className="grid grid-cols-2 gap-2">
            {onSetPosition && (
              <>
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="position-x-input" className="text-[10px] text-zinc-400">X</label>
                  <input
                    id="position-x-input"
                    type="number"
                    defaultValue={style.posX ?? 0}
                    key={`x-${style.posX}`}
                    onBlur={(e) => onSetPosition(Number(e.target.value), style.posY ?? 0)}
                    onKeyDown={(e) => { if (e.key === "Enter") onSetPosition(Number((e.target as HTMLInputElement).value), style.posY ?? 0); }}
                    className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4CAF31] text-zinc-700"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="position-y-input" className="text-[10px] text-zinc-400">Y</label>
                  <input
                    id="position-y-input"
                    type="number"
                    defaultValue={style.posY ?? 0}
                    key={`y-${style.posY}`}
                    onBlur={(e) => onSetPosition(style.posX ?? 0, Number(e.target.value))}
                    onKeyDown={(e) => { if (e.key === "Enter") onSetPosition(style.posX ?? 0, Number((e.target as HTMLInputElement).value)); }}
                    className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4CAF31] text-zinc-700"
                  />
                </div>
              </>
            )}
            {onSetSize && (
              <>
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="size-width-input" className="text-[10px] text-zinc-400">W</label>
                  <input
                    id="size-width-input"
                    type="number"
                    min={1}
                    defaultValue={style.objWidth ?? 0}
                    key={`w-${style.objWidth}`}
                    onBlur={(e) => onSetSize(Math.max(1, Number(e.target.value)), style.objHeight ?? 1)}
                    onKeyDown={(e) => { if (e.key === "Enter") onSetSize(Math.max(1, Number((e.target as HTMLInputElement).value)), style.objHeight ?? 1); }}
                    className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4CAF31] text-zinc-700"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label htmlFor="size-height-input" className="text-[10px] text-zinc-400">H</label>
                  <input
                    id="size-height-input"
                    type="number"
                    min={1}
                    defaultValue={style.objHeight ?? 0}
                    key={`h-${style.objHeight}`}
                    onBlur={(e) => onSetSize(style.objWidth ?? 1, Math.max(1, Number(e.target.value)))}
                    onKeyDown={(e) => { if (e.key === "Enter") onSetSize(style.objWidth ?? 1, Math.max(1, Number((e.target as HTMLInputElement).value))); }}
                    className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:border-[#4CAF31] text-zinc-700"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isText && (
        <FontSettingsSection
          style={style}
          brandFonts={Array.isArray(brandKit?.fonts) ? brandKit.fonts : []}
          isBold={isBold}
          isItalic={isItalic}
          onChange={onChange}
        />
      )}

      {/* Opacity */}
      <Slider
        label="Opacity"
        displayValue={`${Math.round((style.opacity ?? 1) * 100)}%`}
        min={0}
        max={1}
        step={0.01}
        value={style.opacity ?? 1}
        onChange={(v) => onChange({ opacity: v })}
      />

      {/* Outline / Border */}
      <div className="flex flex-col gap-3 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            {isText ? "Outline" : "Border"}
          </p>
          <button
            onClick={() => onChange({ stroke: "transparent", strokeWidth: 0 })}
            className="text-[10px] text-zinc-400 hover:text-red-600 underline font-medium"
          >
            Remove
          </button>
        </div>
        <div className="flex items-center gap-2">
          <PopoverColorPicker
            color={style.stroke === "transparent" ? "#000000" : (style.stroke || "#000000")}
            onChange={(color) => onChange({ stroke: color })}
            className="flex-shrink-0"
          />
          <SelectOrInput
            label="Width"
            value={style.strokeWidth || 0}
            options={[0, 1, 2, 3, 4, 5, 8, 10, 15, 20]}
            suffix="px"
            min={0}
            max={50}
            step={0.5}
            onChange={(v) => onChange({ strokeWidth: v })}
          />
        </div>
        {/* Border style (dashed/dotted) — for shapes */}
        {!isText && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-zinc-500">Style</p>
            <div className="flex gap-1.5">
              {([
                { label: "Solid", value: null, preview: "─────" },
                { label: "Dashed", value: [8, 5], preview: "─ ─ ─" },
                { label: "Dotted", value: [2, 5], preview: "· · · ·" },
              ] as const).map(opt => {
                const isActive = JSON.stringify(style.strokeDashArray ?? null) === JSON.stringify(opt.value);
                return (
                  <button
                    key={opt.label}
                    onClick={() => onChange({ strokeDashArray: opt.value as any })}
                    title={opt.label}
                    className={`flex-1 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${isActive ? "border-[#4CAF31] bg-[#F0F9F6] text-[#4CAF31]" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                      }`}
                  >
                    {opt.preview}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Border radius — for shapes */}
        {!isText && (
          <Slider
            label="Corner Radius"
            displayValue={`${style.borderRadius ?? 0}px`}
            min={0}
            max={200}
            step={1}
            value={style.borderRadius ?? 0}
            onChange={(v) => onChange({ borderRadius: v })}
          />
        )}
      </div>

      {isText && (
        <HighlightSection
          style={style}
          brandColors={brandColors}
          onChange={onChange}
        />
      )}

      {/* Shadow — shown for all selected objects */}
      <ShadowSection style={style} onChange={onChange} />

      {/* Gradient fill — shown for text and shapes (non-image) objects */}
      {!style.isImage && (
        <GradientSection style={style} brandColors={brandColors} onChange={onChange} />
      )}

      {style.isImage && (
        <TransformSection style={style} onChange={onChange} />
      )}

      {onAlignLayer && (
        <CanvasAlignmentSection onAlignLayer={onAlignLayer} />
      )}

      {isText && onApplyTextShape && (
        <TextShapeSection onApplyTextShape={onApplyTextShape} />
      )}

    </div>
  );
}

function FontSettingsSection({ style, brandFonts, isBold, isItalic, onChange }: {
  readonly style: TextStyle;
  readonly brandFonts: { name: string }[];
  readonly isBold: boolean;
  readonly isItalic: boolean;
  readonly onChange: (style: Partial<TextStyle>) => void;
}) {
  return (
    <>
      <FontPicker
        value={style.fontFamily}
        brandFonts={brandFonts}
        onChange={(font) => onChange({ fontFamily: font })}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="font-size-input" className="text-xs text-zinc-500">
          Font Size
        </label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ fontSize: Math.max(8, (style.fontSize || 24) - 1) })}
            className="w-8 h-8 rounded border border-zinc-200 hover:bg-zinc-50 text-zinc-600"
          >−</button>
          <input
            id="font-size-input"
            type="number"
            min={8}
            max={300}
            value={style.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            className="flex-1 text-xs border border-zinc-200 rounded-lg px-2 py-1.5 focus:outline-none text-center font-medium bg-white text-zinc-900"
          />
          <button
            onClick={() => onChange({ fontSize: Math.min(300, (style.fontSize || 24) + 1) })}
            className="w-8 h-8 rounded border border-zinc-200 hover:bg-zinc-50 text-zinc-600"
          >+</button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <p className="text-xs text-zinc-500">Style</p>
          <div className="flex gap-1.5">
            <ToggleBtn active={isBold} onClick={() => onChange({ fontWeight: isBold ? "normal" : "bold" })} title="Bold">
              <Bold size={13} />
            </ToggleBtn>
            <ToggleBtn active={isItalic} onClick={() => onChange({ fontStyle: isItalic ? "normal" : "italic" })} title="Italic">
              <Italic size={13} />
            </ToggleBtn>
            <ToggleBtn active={!!style.underline} onClick={() => onChange({ underline: !style.underline })} title="Underline">
              <Underline size={13} />
            </ToggleBtn>
            <ToggleBtn active={!!style.linethrough} onClick={() => onChange({ linethrough: !style.linethrough })} title="Strikethrough">
              <Strikethrough size={13} />
            </ToggleBtn>
          </div>
        </div>

        <fieldset className="flex flex-col gap-1 flex-1 min-w-0">
          <legend className="text-xs text-zinc-500">Alignment</legend>
          <div className="flex gap-1.5">
            {(["left", "center", "right", "justify"] as const).map((align) => {
              const icons = {
                left: <AlignLeft size={13} />,
                center: <AlignCenter size={13} />,
                right: <AlignRight size={13} />,
                justify: <AlignJustify size={13} />,
              };
              return (
                <ToggleBtn
                  key={align}
                  active={style.textAlign === align}
                  onClick={() => onChange({ textAlign: align })}
                  title={align.charAt(0).toUpperCase() + align.slice(1)}
                >
                  {icons[align]}
                </ToggleBtn>
              );
            })}
          </div>
        </fieldset>
      </div>

      <SelectOrInput
        label="Line Height"
        value={style.lineHeight ?? 1.16}
        options={[0.8, 1, 1.16, 1.2, 1.5, 1.8, 2, 2.5, 3]}
        min={0.5}
        max={5}
        step={0.05}
        onChange={(v) => onChange({ lineHeight: v })}
      />

      <SelectOrInput
        label="Letter Spacing"
        value={style.charSpacing ?? 0}
        options={[-200, -100, -50, 0, 50, 100, 200, 400, 800]}
        min={-500}
        max={1000}
        step={10}
        onChange={(v) => onChange({ charSpacing: v })}
      />
    </>
  );
}

function OutlineSection({ isText, style, onChange }: {
  readonly isText: boolean;
  readonly style: TextStyle;
  readonly onChange: (style: Partial<TextStyle>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-zinc-100">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
          {isText ? "Outline" : "Border"}
        </p>
        <button
          onClick={() => onChange({ stroke: "transparent", strokeWidth: 0 })}
          className="text-[10px] text-zinc-400 hover:text-red-600 underline font-medium"
        >
          Remove
        </button>
      </div>
      <div className="flex items-center gap-2">
        <PopoverColorPicker
          color={style.stroke === "transparent" ? "#000000" : (style.stroke || "#000000")}
          onChange={(color) => onChange({ stroke: color })}
          className="flex-shrink-0"
        />
        <SelectOrInput
          label="Width"
          value={style.strokeWidth || 0}
          options={[0, 1, 2, 3, 4, 5, 8, 10, 15, 20]}
          suffix="px"
          min={0}
          max={50}
          step={0.5}
          onChange={(v) => onChange({ strokeWidth: v })}
        />
      </div>
    </div>
  );
}

function ShadowSection({ style, onChange }: {
  readonly style: TextStyle;
  readonly onChange: (style: Partial<TextStyle>) => void;
}) {
  const hasShadow = (style.shadowBlur ?? 0) > 0 ||
    (style.shadowOffsetX ?? 0) !== 0 ||
    (style.shadowOffsetY ?? 0) !== 0;

  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-zinc-100">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Shadow</p>
        {hasShadow && (
          <button
            onClick={() => onChange({
              shadowColor: "transparent",
              shadowBlur: 0,
              shadowOffsetX: 0,
              shadowOffsetY: 0,
            })}
            className="text-[10px] text-zinc-400 hover:text-red-600 underline font-medium"
          >
            Remove
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <PopoverColorPicker
          color={(style.shadowColor && style.shadowColor !== "transparent")
            ? style.shadowColor
            : "#000000"}
          onChange={(color) => onChange({ shadowColor: color })}
          className="flex-shrink-0"
        />
        <span className="text-[10px] text-zinc-400">Color</span>
      </div>

      <Slider
        label="Blur"
        displayValue={`${style.shadowBlur ?? 0}px`}
        min={0}
        max={30}
        step={1}
        value={style.shadowBlur ?? 0}
        onChange={(v) => onChange({ shadowBlur: v })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Slider
          label="Offset X"
          displayValue={`${style.shadowOffsetX ?? 0}px`}
          min={-20}
          max={20}
          step={1}
          value={style.shadowOffsetX ?? 0}
          onChange={(v) => onChange({ shadowOffsetX: v })}
        />
        <Slider
          label="Offset Y"
          displayValue={`${style.shadowOffsetY ?? 0}px`}
          min={-20}
          max={20}
          step={1}
          value={style.shadowOffsetY ?? 0}
          onChange={(v) => onChange({ shadowOffsetY: v })}
        />
      </div>
    </div>
  );
}

function GradientSection({ style, brandColors, onChange }: {
  readonly style: TextStyle;
  readonly brandColors: { label: string; value: string }[];
  readonly onChange: (style: Partial<TextStyle>) => void;
}) {
  // Determine the current fill type: solid, linear, or radial
  const fillType: "solid" | "linear" | "radial" = style.gradientEnabled
    ? (style.gradientType === "radial" ? "radial" : "linear")
    : "solid";

  const setFillType = (t: "solid" | "linear" | "radial") => {
    if (t === "solid") {
      onChange({ gradientEnabled: false });
    } else {
      onChange({ gradientEnabled: true, gradientType: t });
    }
  };

  const color1 = style.gradientColor1 || "#4CAF31";
  const color2 = style.gradientColor2 || "#ffffff";
  const angle = style.gradientAngle ?? 0;
  const focal = style.gradientFocalRadius ?? 0.5;

  const previewStyle = fillType === "solid"
    ? { background: typeof style.fill === "string" && style.fill.startsWith("#") ? style.fill : color1 }
    : fillType === "radial"
      ? { background: `radial-gradient(circle, ${color1}, ${color2})` }
      : { background: `linear-gradient(${angle}deg, ${color1}, ${color2})` };

  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-zinc-100">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fill</p>

      {/* Fill type toggle: Solid / Linear / Radial */}
      <div className="flex gap-1.5">
        {(["solid", "linear", "radial"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFillType(t)}
            className={`flex-1 py-1.5 rounded-lg border text-[10px] font-medium capitalize transition-all ${fillType === t
                ? "border-[#4CAF31] bg-[#F0F9F6] text-[#4CAF31]"
                : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      {fillType === "solid" ? (
        /* Solid color picker */
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <PopoverColorPicker
              color={typeof style.fill === "string" ? style.fill : color1}
              onChange={(color) => onChange({ fill: color })}
              className="flex-shrink-0"
            />
            <span className="text-xs text-zinc-500 font-mono">
              {typeof style.fill === "string" ? style.fill : color1}
            </span>
          </div>
        </div>
      ) : (
        /* Gradient controls */
        <div className="flex flex-col gap-2">
          {/* Live preview strip + start/end colour pickers */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <PopoverColorPicker
                color={color1}
                onChange={(color) => onChange({ gradientColor1: color })}
                className="flex-shrink-0"
              />
              <span className="text-[9px] text-zinc-400">Start</span>
            </div>

            {/* Preview strip */}
            <div
              className="flex-1 h-7 rounded-lg border border-zinc-200"
              style={previewStyle}
            />

            <div className="flex flex-col items-center gap-0.5">
              <PopoverColorPicker
                color={color2}
                onChange={(color) => onChange({ gradientColor2: color })}
                className="flex-shrink-0"
              />
              <span className="text-[9px] text-zinc-400">End</span>
            </div>
          </div>

          {/* Angle — linear only */}
          {fillType === "linear" && (
            <Slider
              label="Angle"
              displayValue={`${angle}°`}
              min={0}
              max={360}
              step={1}
              value={angle}
              onChange={(v) => onChange({ gradientAngle: v })}
            />
          )}

          {/* Focal radius — radial only */}
          {fillType === "radial" && (
            <Slider
              label="Center Size"
              displayValue={`${Math.round(focal * 100)}%`}
              min={0}
              max={1}
              step={0.01}
              value={focal}
              onChange={(v) => onChange({ gradientFocalRadius: v } as any)}
            />
          )}
        </div>
      )}

      {/* Brand color swatches — apply to the primary fill colour */}
      {brandColors.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {brandColors.map(({ label, value }) => (
            <button
              key={`gradient-brand-${value}`}
              title={label}
              onClick={() =>
                fillType === "solid"
                  ? onChange({ fill: value })
                  : onChange({ gradientColor1: value })
              }
              style={{ backgroundColor: value }}
              className="w-6 h-6 rounded-full border-2 border-white shadow ring-1 ring-zinc-200 hover:ring-[#4CAF31] transition-shadow"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightSection({ style, brandColors, onChange }: {
  readonly style: TextStyle;
  readonly brandColors: { label: string; value: string }[];
  readonly onChange: (style: Partial<TextStyle>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-zinc-100">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Highlight</p>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={!!style.highlightEnabled}
            onChange={(e) =>
              onChange({
                highlightEnabled: e.target.checked,
                highlightColor: style.highlightColor || "#ffff00",
                highlightOpacity: style.highlightOpacity ?? 0.5,
                highlightPadding: style.highlightPadding ?? 8,
              })
            }
            className="w-3.5 h-3.5 accent-[#4CAF31]"
          />
          <span className="text-[10px] text-zinc-500">Enable</span>
        </label>
      </div>

      {!!style.highlightEnabled && (
        <div className="flex flex-col gap-2 pl-1">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.highlightColor?.slice(0, 7) || "#ffff00"}
              onChange={(e) => onChange({ highlightColor: e.target.value })}
              className="w-8 h-8 cursor-pointer rounded border border-zinc-200 p-0.5"
            />
            <span className="text-[10px] text-zinc-400">Color</span>
          </div>

          <Slider
            label="Opacity"
            displayValue={`${Math.round((style.highlightOpacity ?? 0.5) * 100)}%`}
            min={0}
            max={1}
            step={0.05}
            value={style.highlightOpacity ?? 0.5}
            onChange={(v) => onChange({ highlightOpacity: v })}
          />

          <Slider
            label="Padding"
            displayValue={`${style.highlightPadding ?? 8}px`}
            min={0}
            max={40}
            step={1}
            value={style.highlightPadding ?? 8}
            onChange={(v) => onChange({ highlightPadding: v })}
          />

          {brandColors.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {brandColors.map(({ label: l, value }: any) => (
                <button
                  key={value}
                  title={l}
                  onClick={() => onChange({ highlightColor: value })}
                  style={{ backgroundColor: value }}
                  className="w-6 h-6 rounded-full border-2 border-white shadow ring-1 ring-zinc-200 hover:ring-[#4CAF31] transition-shadow"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TransformSection({ style, onChange }: {
  readonly style: TextStyle;
  readonly onChange: (style: Partial<TextStyle>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-zinc-100">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Transform</p>
      <div className="flex gap-2">
        <button
          onClick={() => onChange({ flipX: !style.flipX })}
          className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${style.flipX ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
        >
          <span className="text-[10px] font-bold uppercase">Flip H</span>
        </button>
        <button
          onClick={() => onChange({ flipY: !style.flipY })}
          className={`flex-1 py-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${style.flipY ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
        >
          <span className="text-[10px] font-bold uppercase">Flip V</span>
        </button>
      </div>
    </div>
  );
}

function CanvasAlignmentSection({ onAlignLayer }: {
  readonly onAlignLayer: (hAlign: "left" | "center" | "right" | null, vAlign: "top" | "middle" | "bottom" | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-zinc-100">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Alignment</p>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wide">Horizontal</span>
        <div className="flex gap-1">
          <button onClick={() => onAlignLayer("left", null)} title="Align left" className="flex-1 py-2 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 hover:border-zinc-400 transition-colors text-zinc-600">
            <AlignLeft size={14} />
          </button>
          <button onClick={() => onAlignLayer("center", null)} title="Align center" className="flex-1 py-2 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 hover:border-zinc-400 transition-colors text-zinc-600">
            <AlignCenter size={14} />
          </button>
          <button onClick={() => onAlignLayer("right", null)} title="Align right" className="flex-1 py-2 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 hover:border-zinc-400 transition-colors text-zinc-600">
            <AlignRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wide">Vertical</span>
        <div className="flex gap-1">
          <button onClick={() => onAlignLayer(null, "top")} title="Align top" className="flex-1 py-2 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 hover:border-zinc-400 transition-colors text-zinc-600">
            <AlignStartVertical size={14} />
          </button>
          <button onClick={() => onAlignLayer(null, "middle")} title="Align middle" className="flex-1 py-2 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 hover:border-zinc-400 transition-colors text-zinc-600">
            <AlignCenterVertical size={14} />
          </button>
          <button onClick={() => onAlignLayer(null, "bottom")} title="Align bottom" className="flex-1 py-2 rounded-lg border border-zinc-200 flex items-center justify-center hover:bg-zinc-50 hover:border-zinc-400 transition-colors text-zinc-600">
            <AlignEndVertical size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TextShapeSection({ onApplyTextShape }: {
  readonly onApplyTextShape: (effect: string) => void;
}) {
  const shapes = [
    { effect: "arc-up", label: "Arc ↑", preview: "⌢" },
    { effect: "arc-down", label: "Arc ↓", preview: "⌣" },
    { effect: "circle", label: "Circle", preview: "○" },
    { effect: "wave", label: "Wave", preview: "∿" },
    { effect: "arch", label: "Arch", preview: "∩" },
    { effect: "bulge", label: "Bulge", preview: "◉" },
    { effect: "squeeze", label: "Squeeze", preview: "◈" },
    { effect: "flag", label: "Flag", preview: "⌇" },
  ] as const;

  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-zinc-100">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Text Shape</p>
      <div className="grid grid-cols-4 gap-1">
        {shapes.map(({ effect, label, preview }) => (
          <button
            key={effect}
            onClick={() => onApplyTextShape(effect)}
            title={label}
            className="flex flex-col items-center gap-0.5 py-2 rounded-lg border border-zinc-200 hover:border-[#4CAF31] hover:bg-[#F0F9F6] text-zinc-600 hover:text-[#4CAF31] transition-all"
          >
            <span className="text-lg leading-none">{preview}</span>
            <span className="text-[8px] font-medium leading-none">{label}</span>
          </button>
        ))}
      </div>
      <p className="text-[9px] text-zinc-400 leading-relaxed">
        Applies the shape to the selected text layer.
      </p>
    </div>
  );
}

function BrandColorsSection({ brandColors, style, onChange }: {
  readonly brandColors: { label: string; value: string }[];
  readonly style: TextStyle;
  readonly onChange: (style: Partial<TextStyle>) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-zinc-500">Brand Colors</p>
      <div className="flex gap-2 flex-wrap">
        {brandColors.map(({ label, value }: any) => {
          const isActive = typeof style.fill === "string" && style.fill.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={`${label}-${value}`}
              title={label}
              aria-label={`${label} brand color`}
              data-color={value}
              onClick={() => onChange({ fill: value })}
              style={{
                backgroundColor: value,
                borderColor: isActive ? GREEN : "#e4e4e7",
                borderWidth: isActive ? 3 : 2,
                boxShadow: isActive ? `0 0 0 2px ${GREEN}40` : undefined,
              }}
              className="w-7 h-7 rounded-full border-2 transition-all"
            />
          );
        })}
      </div>
    </div>
  );
}

function ColorPickerSection({ style, onChange }: {
  readonly style: TextStyle;
  readonly onChange: (style: Partial<TextStyle>) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label htmlFor="fill-color-input" className="text-xs text-zinc-500">Color</label>
        <button
          onClick={() => onChange({ fill: "#000000" })}
          className="text-[10px] text-zinc-400 hover:text-red-600 underline font-medium"
        >
          Reset
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="fill-color-input"
          type="color"
          value={typeof style.fill === "string" && style.fill.startsWith("#") ? style.fill : "#ffffff"}
          onChange={(e) => onChange({ fill: e.target.value })}
          className="w-8 h-8 cursor-pointer rounded border border-zinc-200 p-0.5"
        />
        <span className="text-xs text-zinc-500 font-mono">
          {typeof style.fill === "string" ? style.fill : "Gradient"}
        </span>
      </div>
    </div>
  );
}
