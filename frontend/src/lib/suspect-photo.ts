const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v3").replace(
  /\/api\/v\d+\/?$/,
  "",
);

/** Turn API photo paths into loadable URLs (handles /media/, relative paths, S3, data URLs). */
export function resolveSuspectPhotoUrl(photo?: string | null): string | null {
  const raw = photo?.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
    return raw;
  }
  if (raw.startsWith("/")) return `${API_ORIGIN}${raw}`;
  return `${API_ORIGIN}/media/${raw.replace(/^media\//, "")}`;
}
