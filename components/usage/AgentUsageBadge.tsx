"use client";

interface AgentUsageBadgeProps {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  executionTimeMs: number;
  /** Extra Tailwind classes for positioning/spacing */
  className?: string;
}

/**
 * A small pill that shows token usage after an agent finishes.
 * Shows total tokens and wall-clock time — no cost.
 */
export default function AgentUsageBadge({
  totalTokens,
  inputTokens,
  outputTokens,
  executionTimeMs,
  className = "",
}: AgentUsageBadgeProps) {
  const totalK = (totalTokens / 1000).toFixed(1);
  const secStr = (executionTimeMs / 1000).toFixed(1);

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-[#c6eacc] bg-[#F0F9F6] px-3 py-1.5 text-xs font-semibold text-[#2d6b1d] ${className}`}
      title={`Input: ${inputTokens.toLocaleString()} · Output: ${outputTokens.toLocaleString()} · ${secStr}s`}
    >
      {/* Lightning bolt icon */}
      <svg
        className="h-3 w-3 shrink-0 text-[#4CAF31]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      <span>{totalK}k tokens</span>
      <span className="text-[#4CAF31]">·</span>
      <span className="text-[#4a7c59]">{secStr}s</span>
    </div>
  );
}
