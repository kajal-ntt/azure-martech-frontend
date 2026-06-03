"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Home,
  LayoutGrid,
  Plus,
  Send,
  ShoppingBag,
  X,
} from "lucide-react";

function stringifyCreativeBrief(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return `${value}`;
  if (typeof value === "object") return JSON.stringify(value);
  return "";
}

function formatBulletSection(title: string, items: string[]) {
  const bullets = items.map((item) => "- " + item).join("\n");
  return title + ":\n" + bullets;
}

export function formatCreativeBrief(creativeBrief: unknown) {
  try {
    const parsed = typeof creativeBrief === "string" ? JSON.parse(creativeBrief) : creativeBrief;
    if (typeof parsed !== "object" || parsed === null) return stringifyCreativeBrief(creativeBrief);

    const parts: string[] = [];
    const brief = parsed as { strategy?: string; hooks?: string[]; themes?: string[] };
    if (brief.strategy) parts.push(brief.strategy);
    if (Array.isArray(brief.hooks)) parts.push(formatBulletSection("Key Hooks", brief.hooks));
    if (Array.isArray(brief.themes)) parts.push(formatBulletSection("Themes", brief.themes));

    return parts.join("\n\n").trim() || stringifyCreativeBrief(creativeBrief);
  } catch {
    return stringifyCreativeBrief(creativeBrief);
  }
}

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}: Readonly<{ icon: ReactNode; label: string; active?: boolean; onClick?: () => void }>) {
  const className = `flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
    active ? "bg-[#F0F9F6] text-[#4CAF31]" : "text-zinc-500 hover:bg-zinc-50"
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`w-full text-left ${className}`}>
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </button>
    );
  }

  return (
    <div className={className}>
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function CreativeSubNavItem({
  active,
  href,
  label,
}: Readonly<{ active: boolean; href: string; label: string }>) {
  if (active) {
    return <div className="text-xs font-semibold text-[#4CAF31] bg-[#F0F9F6] px-2 py-1.5 rounded-md">{label}</div>;
  }

  return (
    <Link href={href} className="block text-xs text-zinc-500 hover:text-zinc-800 px-2 py-1.5 rounded-md hover:bg-zinc-50">
      {label}
    </Link>
  );
}

export function CreativeSidebar({
  activeType,
  campaignId,
  onNavigate,
}: Readonly<{
  activeType: "image" | "video";
  campaignId: string | null;
  onNavigate: (href: string) => void;
}>) {
  return (
    <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col shrink-0">
      <Link href="/dashboard" className="p-6 text-left">
        <div className="flex items-center gap-2 text-[#4CAF31] font-bold text-xl uppercase tracking-tighter">
          MAR<span className="text-zinc-800">TECH</span>
        </div>
        <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-1 leading-none">
          Marketing . Technology . Solution.
        </p>
      </Link>
      <nav className="flex-1 px-4 space-y-1">
        <SidebarItem icon={<Home size={18} />} label="Home" onClick={() => onNavigate("/dashboard")} />
        <SidebarItem icon={<ShoppingBag size={18} />} label="Subscribed Product" />
        <SidebarItem icon={<LayoutGrid size={18} />} label="Marketplace" />
        <SidebarItem
          icon={<Send size={18} />}
          label="Campaign Manager"
          active
          onClick={() => onNavigate(campaignId ? `/campaigns/${campaignId}` : "/campaigns")}
        />
        <div className="ml-9 pt-1 border-l border-zinc-100 pl-4 space-y-1">
          <CreativeSubNavItem
            active={activeType === "image"}
            href={`/creatives?campaignId=${campaignId}`}
            label="Image Creative"
          />
          <CreativeSubNavItem
            active={activeType === "video"}
            href={`/creatives/video?campaignId=${campaignId}`}
            label="Video Creative"
          />
        </div>
      </nav>
    </aside>
  );
}

export function AccordionSection({
  title,
  children,
  isOpen,
  onToggle,
}: Readonly<{ title: string; children: ReactNode; isOpen: boolean; onToggle: () => void }>) {
  return (
    <div className="border border-zinc-200 rounded-lg bg-white overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3.5 hover:bg-zinc-50 transition-colors">
        <span className="text-sm font-semibold text-zinc-700">{title}</span>
        {isOpen ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
      </button>
      {isOpen && <div className="p-4 pt-0 border-t border-zinc-100">{children}</div>}
    </div>
  );
}

export function InputField({
  label,
  value,
  placeholder,
  onChange,
}: Readonly<{ label: string; value: string; placeholder?: string; onChange: (value: string) => void }>) {
  const inputId = useId();

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="text-xs text-zinc-500">{label}</label>
      <input
        id={inputId}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-zinc-200 rounded p-2.5 text-sm focus:border-[#4CAF31] outline-none placeholder:text-zinc-300"
      />
    </div>
  );
}

export function DropdownField({
  label,
  value,
  options,
  onSelect,
  onAdd,
}: Readonly<{
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  onAdd: (value: string) => void;
}>) {
  const [open, setOpen] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();

  const updateRect = () => {
    if (buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
  };

  const addValue = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    onSelect(trimmed);
    setNewValue("");
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (event: Event) => {
      if (event.type === "scroll") {
        updateRect();
        return;
      }

      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handler);
    globalThis.addEventListener("scroll", handler, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      globalThis.removeEventListener("scroll", handler, true);
    };
  }, [open]);

  return (
    <div className="space-y-1">
      <label htmlFor={buttonId} className="text-xs text-zinc-500">{label}</label>
      <button
        id={buttonId}
        ref={buttonRef}
        type="button"
        onClick={() => {
          updateRect();
          setOpen((current) => !current);
        }}
        className="w-full border border-zinc-200 rounded p-2.5 text-sm text-left flex items-center justify-between bg-white hover:border-[#4CAF31] outline-none transition-colors"
      >
        <span className={value ? "text-zinc-900" : "text-zinc-300"}>{value || `Select ${label}`}</span>
        <ChevronDown size={14} className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && rect && (
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-white border border-zinc-200 rounded-lg shadow-xl overflow-hidden"
          style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
        >
          <div className="max-h-44 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onSelect(value === option ? "" : option);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F0F9F6] transition-colors flex items-center justify-between ${
                  value === option ? "text-[#4CAF31] font-semibold bg-[#F0F9F6]" : "text-zinc-700"
                }`}
              >
                {option}
                {value === option && <X size={12} className="text-[#4CAF31]" />}
              </button>
            ))}
          </div>
          <div className="border-t border-zinc-100 p-2 flex gap-2">
            <input
              type="text"
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addValue();
              }}
              placeholder="Add new..."
              className="flex-1 text-xs border border-zinc-200 rounded px-2 py-1.5 outline-none focus:border-[#4CAF31]"
            />
            <button type="button" onClick={addValue} className="px-2 py-1.5 bg-[#4CAF31] text-white rounded text-xs font-bold hover:bg-[#3d8e27]">
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
