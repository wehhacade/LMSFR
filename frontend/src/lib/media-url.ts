/** API origin without `/api/v3` — media files are served from Django `/media/`. */
function apiOrigin(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v3";
  return base.replace(/\/api\/v\d+\/?$/, "");
}

/**
 * Normalize profile/media URLs from the API for use in `<img>` and CSS backgrounds.
 * Relative paths like `/media/avatars/x.png` must load from the API host, not Next.js.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const origin = apiOrigin();
  return trimmed.startsWith("/") ? `${origin}${trimmed}` : `${origin}/${trimmed}`;
}
