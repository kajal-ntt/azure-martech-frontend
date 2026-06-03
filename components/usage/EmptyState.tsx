export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 mb-4">
        <svg
          className="h-7 w-7 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-zinc-900 mb-1">No usage data found</h3>
      <p className="text-sm text-zinc-500 max-w-xs">
        No agent traces match the selected filters. Try adjusting the date range, campaign, or creative filters.
      </p>
    </div>
  );
}
