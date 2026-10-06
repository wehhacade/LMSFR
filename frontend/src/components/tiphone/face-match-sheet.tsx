"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, ScanLine, X } from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { rgba } from "@/lib/tiphone/theme";
import type { SuspectListRow } from "@/lib/tiphone/types";
import { resolveTipMediaUrl } from "@/lib/tiphone/utils";
import { GoldButton } from "./gold-button";
import { useSwipeBackHandler } from "./ios-swipe-back";
import { useTipTheme } from "./theme-provider";

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function FaceMatchSheet({
  open,
  onClose,
  onOpenProfile,
}: {
  open: boolean;
  onClose: () => void;
  onOpenProfile: (row: SuspectListRow) => void;
}) {
  const { colors } = useTipTheme();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [matches, setMatches] = useState<SuspectListRow[]>([]);

  useSwipeBackHandler(open ? onClose : null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreview(null);
    setMessage("");
    setMatches([]);
  }, [open]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  if (!open) return null;

  function pick(next?: File) {
    if (!next) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setMatches([]);
    setMessage("");
  }

  async function runMatch() {
    if (!file) return;
    setLoading(true);
    setMessage("");
    try {
      const imageBase64 = await fileToBase64(file);
      const result = await TipApi.faceMatch({ imageBase64 });
      setMatches(result.matches);
      setMessage(result.message || (result.found ? "Waji ayaa la helay." : "Waji lama helin."));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Raadinta wajiga way fashilantay.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[125] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <section
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border p-4 sm:rounded-[28px]"
        style={{ background: colors.bg1, borderColor: rgba(colors.goldRgb, 0.28) }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.gold }}>
              Face Match
            </p>
            <h3 className="text-xl font-bold">Raadi waji</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border p-2"
            style={{ borderColor: rgba(colors.lineRgb, 0.12) }}
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="mb-2 flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-2xl border"
          style={{ borderColor: rgba(colors.goldRgb, 0.3), background: rgba(colors.lineRgb, 0.04) }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-sm" style={{ color: colors.inkMut }}>
              <Camera size={30} style={{ color: colors.gold }} /> Qaad ama dooro sawir
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: colors.ink2 }}
        >
          <ImageIcon size={14} /> Gallery
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />

        <GoldButton loading={loading} disabled={!file} onClick={() => void runMatch()} className="mb-4 w-full">
          <span className="inline-flex items-center gap-2">
            <ScanLine size={16} /> Baar
          </span>
        </GoldButton>

        {message ? (
          <p className="mb-3 text-center text-sm" style={{ color: colors.inkMut }}>
            {message}
          </p>
        ) : null}

        <div className="space-y-2">
          {matches.map((row) => {
            const photo = resolveTipMediaUrl(row.photo);
            return (
              <button
                type="button"
                key={`${row.source}-${row.id}`}
                onClick={() => {
                  onOpenProfile(row);
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left"
                style={{
                  borderColor: rgba(colors.lineRgb, 0.12),
                  background: rgba(colors.surfRgb, 0.72),
                }}
              >
                <div
                  className="h-14 w-14 overflow-hidden rounded-xl"
                  style={{ background: rgba(colors.goldRgb, 0.14), color: colors.gold }}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-lg font-bold">
                      {row.name.slice(0, 1)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{row.name}</p>
                  <p className="truncate text-xs" style={{ color: colors.inkMut }}>
                    {[
                      row.N_tuhunka,
                      row.degmada,
                      row.match_score != null
                        ? `${row.match_score <= 1 ? Math.round(row.match_score * 100) : Math.round(row.match_score)}%`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
