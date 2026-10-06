"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { resolveSuspectPhotoUrl } from "@/lib/suspect-photo";

interface SuspectPhotoProps {
  photo?: string | null;
  alt: string;
  fallback?: ReactNode;
  style?: CSSProperties;
  className?: string;
  loading?: "lazy" | "eager";
  /** Bust browser cache when photo changes (e.g. suspect updated_at). */
  cacheKey?: string | number;
}

/** Native img — works with /media/, S3 presigned URLs, and external hosts without Next.js domain limits. */
export function SuspectPhoto({
  photo,
  alt,
  fallback = null,
  style,
  className,
  loading = "lazy",
  cacheKey,
}: SuspectPhotoProps) {
  const [failed, setFailed] = useState(false);
  const baseSrc = resolveSuspectPhotoUrl(photo);
  const src = baseSrc && cacheKey != null && cacheKey !== ""
    ? `${baseSrc}${baseSrc.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(cacheKey))}`
    : baseSrc;

  useEffect(() => {
    setFailed(false);
  }, [photo, cacheKey]);

  if (!src || failed) return <>{fallback}</>;

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
}
