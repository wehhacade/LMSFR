/** Exact share from counts (preferred over rounded API pct for display). */
export function shareFromCount(count: number, total: number): number {
  if (total <= 0 || count <= 0) return 0;
  return (count / total) * 100;
}

/** Format a completion share for display. */
export function formatCompletionPct(pct: number, count = 0): string {
  if (count === 0 && pct === 0) return "0%";
  if (pct >= 10) return `${Math.round(pct)}%`;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct >= 0.01 || count > 0) return `${pct.toFixed(2)}%`;
  return "<0.01%";
}

export function formatCompletionShare(count: number, total: number): string {
  return formatCompletionPct(shareFromCount(count, total), count);
}
