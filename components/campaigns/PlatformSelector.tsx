"use client";

import { PLATFORMS, toTargetPlatform } from "@/lib/platforms";
import type { PlatformDefinition, TargetPlatform } from "@/lib/platforms";

// ── PlatformBadge ──────────────────────────────────────────────────────────

interface PlatformBadgeProps {
  readonly platform: TargetPlatform;
  readonly onRemove?: () => void;
}

/**
 * Renders a badge showing "<platformName> · <orientation>" with an optional
 * remove (×) button. Used both in the PlatformSelector grid and in the
 * CreativeBriefsSection header.
 *
 * Requirements: 1.3, 2.2, 5.2, 5.4
 */
export function PlatformBadge({ platform, onRemove }: PlatformBadgeProps) {
  const label = `${platform.platformName} · ${capitalise(platform.orientation)}`;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F0F9F6] text-[#2d6b1d] border border-[#c6eacc] select-none"
      aria-label={label}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${platform.platformName}`}
          className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full hover:bg-[#c6eacc] transition-colors text-[#2d6b1d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF31]"
        >
          ×
        </button>
      )}
    </span>
  );
}

// ── PlatformCard ───────────────────────────────────────────────────────────

interface PlatformCardProps {
  readonly platform: PlatformDefinition;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly onToggle: () => void;
}

/**
 * A single selectable card in the platform grid. Highlighted when selected.
 * Uses role="checkbox" and aria-checked for screen-reader support.
 *
 * Requirements: 1.2, 1.4, 1.6
 */
function PlatformCard({ platform, selected, disabled, onToggle }: PlatformCardProps) {
  const orientationLabel = capitalise(platform.orientation);
  const ariaLabel = `${platform.name} — ${orientationLabel}${selected ? ", selected" : ""}`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!disabled) onToggle();
    }
  };

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onToggle}
      onKeyDown={handleKeyDown}
      className={[
        "relative flex flex-col gap-1 px-3 py-2.5 rounded-lg border cursor-pointer transition-all select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF31] focus-visible:ring-offset-1",
        selected
          ? "bg-[#F0F9F6] border-[#4CAF31] shadow-sm"
          : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Selection indicator */}
      {selected && (
        <span
          aria-hidden="true"
          className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#4CAF31] flex items-center justify-center"
        >
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}

      <span
        className={`text-xs font-semibold leading-tight pr-5 ${selected ? "text-[#2d6b1d]" : "text-zinc-800"}`}
      >
        {platform.name}
      </span>
      <span
        className={`text-[10px] font-medium uppercase tracking-wide ${selected ? "text-[#4CAF31]" : "text-zinc-400"}`}
      >
        {orientationLabel} · {platform.aspectRatio}
      </span>
    </div>
  );
}

// ── PlatformSelector ───────────────────────────────────────────────────────

interface PlatformSelectorProps {
  readonly selected: TargetPlatform[];
  readonly onChange: (platforms: TargetPlatform[]) => void;
  readonly disabled?: boolean;
}

/**
 * Multi-select grid of platform cards. Clicking a card toggles its selection.
 * Selected platforms are shown as PlatformBadge components below the grid.
 * When nothing is selected, a prompt is shown.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2, 5.4
 */
export function PlatformSelector({ selected, onChange, disabled }: PlatformSelectorProps) {
  const isSelected = (platform: PlatformDefinition) =>
    selected.some((p) => p.platformName === platform.name);

  const handleToggle = (platform: PlatformDefinition) => {
    if (disabled) return;
    const target = toTargetPlatform(platform);
    if (isSelected(platform)) {
      onChange(selected.filter((p) => p.platformName !== platform.name));
    } else {
      onChange([...selected, target]);
    }
  };

  const handleRemove = (platformName: string) => {
    if (disabled) return;
    onChange(selected.filter((p) => p.platformName !== platformName));
  };

  return (
    <div className="space-y-3">
      {/* Platform grid */}
      <div
        role="group"
        aria-label="Target platforms"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"
      >
        {PLATFORMS.map((platform) => (
          <PlatformCard
            key={platform.id}
            platform={platform}
            selected={isSelected(platform)}
            disabled={disabled}
            onToggle={() => handleToggle(platform)}
          />
        ))}
      </div>

      {/* Selected badges or empty-state prompt */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1" aria-label="Selected platforms">
          {selected.map((platform) => (
            <PlatformBadge
              key={platform.platformName}
              platform={platform}
              onRemove={disabled ? undefined : () => handleRemove(platform.platformName)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-400 italic pt-1">
          Select at least one platform to enable platform-aware brief generation.
        </p>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function capitalise(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
