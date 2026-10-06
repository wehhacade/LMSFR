"use client";

import type { CSSProperties, ReactNode } from "react";
import { hexA } from "@/lib/lmsbr/data";

/** System-wide table page size defaults (all list tables). */
export const DEFAULT_TABLE_PAGE_SIZE = 10;
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];

/** Minimal theme tokens required by the shared pagination control. */
export type PaginationThemeColors = {
  tableSep: string;
  inputBg: string;
  inputBdr: string;
  txtPrimary: string;
  txtSecondary: string;
  txtMuted: string;
};

export type PaginationLabels = {
  prev: string;
  next: string;
  page: string;
  of: string;
};

/** @deprecated Prefer `PaginationLabels`. */
export type TablePaginationLabels = PaginationLabels;

function navBtnStyle(C: PaginationThemeColors, disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 9,
    border: `1px solid ${C.inputBdr}`,
    background: C.inputBg,
    color: disabled ? C.txtMuted : C.txtSecondary,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "var(--font-outfit)",
    fontSize: 13,
    opacity: disabled ? 0.5 : 1,
  };
}

export function buildPageItems(page: number, totalPages: number): (number | "...")[] {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );
  const items: (number | "...")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) items.push("...");
    items.push(p);
  });
  return items;
}

export function usePaginatedRows<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    total,
    totalPages,
    pageRows: rows.slice(start, start + pageSize),
    startIndex: start,
  };
}

/** Rows-per-page select — place above tables by default. */
export function TableRowsSelect({
  pageSize,
  onPageSizeChange,
  C,
  label = "Rows",
  options = TABLE_PAGE_SIZE_OPTIONS as unknown as number[],
  disabled = false,
  style,
}: {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  C: PaginationThemeColors;
  label?: string;
  options?: number[];
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className="lmsbr-table-rows-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 10,
        ...style,
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: C.txtMuted,
          fontFamily: "var(--font-outfit)",
        }}
      >
        <span>{label}</span>
        <select
          value={String(pageSize)}
          disabled={disabled}
          onChange={(e) => onPageSizeChange(Number(e.target.value) || DEFAULT_TABLE_PAGE_SIZE)}
          style={{
            padding: "8px 12px",
            borderRadius: 9,
            border: `1px solid ${C.inputBdr}`,
            background: C.inputBg,
            color: C.txtPrimary,
            fontFamily: "var(--font-outfit)",
            fontSize: 13,
            cursor: disabled ? "not-allowed" : "pointer",
            minWidth: 72,
          }}
        >
          {options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export type PaginationProps = {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  C: PaginationThemeColors;
  accent: string;
  labels: PaginationLabels;
  isDark?: boolean;
  total?: number;
  totalLabel?: ReactNode;
  isFetching?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  pageSizeLabel?: string;
  /** Show rows selector in the bottom bar (default false — use TableRowsSelect on top). */
  showPageSize?: boolean;
  extra?: ReactNode;
  /** Draw a top border and padding (table footer style). Default true. */
  bordered?: boolean;
  /** Hide entirely when there is only one page and no page-size control. */
  hideWhenSinglePage?: boolean;
  /** Layout of summary vs controls. Default `"between"`. */
  align?: "between" | "center" | "end";
  style?: CSSProperties;
};

export function Pagination({
  page,
  totalPages,
  onPage,
  C,
  accent,
  isDark = false,
  labels,
  total,
  totalLabel,
  isFetching = false,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  pageSizeLabel,
  showPageSize: showPageSizeProp = false,
  extra,
  bordered = true,
  hideWhenSinglePage = false,
  align = "between",
  style,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const items = buildPageItems(page, safeTotalPages);
  const resolvedOptions =
    pageSizeOptions?.length
      ? pageSizeOptions
      : (TABLE_PAGE_SIZE_OPTIONS as unknown as number[]);
  const showPageSize =
    showPageSizeProp &&
    Boolean(onPageSizeChange && pageSize != null && resolvedOptions.length);
  // Always show Previous / page numbers / Next when the bar is visible (buttons disable at ends).
  const showPager = safeTotalPages > 1 || showPageSize || Boolean(totalLabel ?? total !== undefined);
  const summary = totalLabel ?? (total !== undefined ? String(total) : null);
  const hasSummary = summary !== null || extra != null;

  if (hideWhenSinglePage && safeTotalPages <= 1 && !showPageSize) return null;

  const justifyContent =
    align === "center" ? "center" : align === "end" ? "flex-end" : "space-between";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent,
      gap: 16,
      flexWrap: "wrap",
      ...(bordered ? { padding: "16px 20px", borderTop: `1px solid ${C.tableSep}` } : {}),
      ...style,
    }}>
      {hasSummary && align !== "center" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {summary !== null && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 14px",
              borderRadius: 10,
              background: hexA(accent, 0.14),
              color: accent,
              fontFamily: "var(--font-outfit)",
              fontWeight: 700,
              fontSize: 14,
            }}>
              {summary}
              {isFetching ? " · …" : ""}
            </span>
          )}
          {extra}
        </div>
      )}

      {(showPager || showPageSize) && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}>
          {showPageSize && (
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: C.txtMuted,
              fontFamily: "var(--font-outfit)",
            }}>
              {pageSizeLabel ? <span>{pageSizeLabel}</span> : null}
              <select
                value={String(pageSize)}
                onChange={(e) => onPageSizeChange?.(Number(e.target.value) || pageSize!)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 9,
                  border: `1px solid ${C.inputBdr}`,
                  background: C.inputBg,
                  color: C.txtPrimary,
                  fontFamily: "var(--font-outfit)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {resolvedOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          )}

          {showPager && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                disabled={page <= 1 || isFetching}
                onClick={() => onPage(page - 1)}
                style={navBtnStyle(C, page <= 1 || isFetching)}
              >
                {labels.prev}
              </button>

              {items.map((item, i) =>
                item === "..." ? (
                  <span key={`ellipsis-${i}`} style={{ padding: "0 4px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    disabled={isFetching}
                    onClick={() => onPage(item)}
                    style={{
                      minWidth: 36,
                      height: 36,
                      borderRadius: 9,
                      border: `1px solid ${item === page ? hexA(accent, 0.5) : C.inputBdr}`,
                      background: item === page ? hexA(accent, isDark ? 0.2 : 0.12) : C.inputBg,
                      color: item === page ? accent : C.txtSecondary,
                      cursor: isFetching ? "wait" : "pointer",
                      fontFamily: "var(--font-outfit)",
                      fontSize: 13,
                      fontWeight: item === page ? 600 : 400,
                    }}
                  >
                    {item}
                  </button>
                ),
              )}

              <button
                type="button"
                disabled={page >= safeTotalPages || isFetching}
                onClick={() => onPage(page + 1)}
                style={navBtnStyle(C, page >= safeTotalPages || isFetching)}
              >
                {labels.next}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** @deprecated Prefer `Pagination`. */
export const TablePagination = Pagination;
