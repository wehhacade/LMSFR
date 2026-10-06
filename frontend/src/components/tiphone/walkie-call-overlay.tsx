"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneOff } from "lucide-react";
import { so } from "@/lib/tiphone/i18n";
import { PttApi } from "@/lib/tiphone/ptt-api";
import { startPttWebRtc, type PttSessionHandle } from "@/lib/tiphone/ptt-webrtc";
import type { ManagedUserRow } from "@/lib/tiphone/types";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "./theme-provider";

type WalkieCallOverlayProps = {
  peer: ManagedUserRow;
  onClose: () => void;
};

export function WalkieCallOverlay({ peer, onClose }: WalkieCallOverlayProps) {
  const { colors } = useTipTheme();
  const [status, setStatus] = useState<string>(so.pttConnecting);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const handleRef = useRef<PttSessionHandle | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const leavingRef = useRef(false);
  const abortRef = useRef({ aborted: false });

  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    abortRef.current.aborted = true;
    onClose();
  }, [onClose]);

  const hangUp = useCallback(async () => {
    if (leavingRef.current) return;
    const h = handleRef.current;
    handleRef.current = null;
    if (h) await h.end();
    leave();
  }, [leave]);

  const onRemoteEnded = useCallback(async () => {
    if (leavingRef.current) return;
    const h = handleRef.current;
    handleRef.current = null;
    if (h) await h.dispose();
    leave();
  }, [leave]);

  useEffect(() => {
    let cancelled = false;
    abortRef.current = { aborted: false };

    void (async () => {
      try {
        setStatus(so.pttCalling);
        const started = await PttApi.start(peer.id);
        if (cancelled) {
          await PttApi.end(started.session_id).catch(() => {});
          return;
        }
        if (started.push_sent === 0) {
          setError(so.pttNoPush);
        }

        const handle = await startPttWebRtc({
          sessionId: started.session_id,
          role: "caller",
          remoteAudioEl: audioRef.current,
          signal: abortRef.current,
          onStatus: (s) => {
            if (!cancelled) setStatus(s);
          },
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            setStatus(so.pttInCall);
          },
          onEnded: () => {
            if (cancelled) return;
            void onRemoteEnded();
          },
        });

        if (cancelled) {
          await handle.dispose();
          return;
        }
        handleRef.current = handle;
        handle.setSpeakerOn(true);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : so.pttFailed;
          setError(msg);
          setStatus(so.pttFailed);
        }
      }
    })();

    return () => {
      cancelled = true;
      abortRef.current.aborted = true;
      const h = handleRef.current;
      handleRef.current = null;
      void (async () => {
        if (h) await h.dispose();
      })();
    };
  }, [peer.id, onRemoteEnded]);

  const displayName = peer.username?.trim() || `Agent #${peer.id}`;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <audio ref={audioRef} autoPlay playsInline className="sr-only" />
      <div
        className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
        style={{
          background: colors.bg1,
          borderColor: rgba(colors.goldRgb, 0.3),
        }}
      >
        <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: colors.gold }}>
          {so.pttTitle}
        </p>
        <h3 className="mb-1 text-xl font-bold" style={{ color: colors.ink0 }}>
          {displayName}
        </h3>
        {peer.phone ? (
          <p className="mb-4 text-sm" style={{ color: colors.gold }}>
            {peer.phone}
          </p>
        ) : null}
        {peer.distanceKm != null && Number.isFinite(peer.distanceKm) ? (
          <p className="mb-4 text-xs" style={{ color: colors.inkMut }}>
            {peer.distanceKm < 1
              ? `${Math.max(1, Math.round(peer.distanceKm * 1000))} m`
              : `${peer.distanceKm < 10 ? peer.distanceKm.toFixed(1) : Math.round(peer.distanceKm)} km`}
          </p>
        ) : null}

        <div
          className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full"
          style={{
            background: rgba(colors.goldRgb, ready ? 0.25 : 0.12),
            border: `2px solid ${rgba(colors.goldRgb, ready ? 0.55 : 0.25)}`,
          }}
        >
          <span className="text-3xl">{ready ? "🎙️" : "📞"}</span>
        </div>

        <p className="mb-2 text-center text-sm" style={{ color: colors.ink1 }}>
          {status}
        </p>
        {error ? (
          <p className="mb-4 text-center text-xs" style={{ color: colors.rose }}>
            {error}
          </p>
        ) : null}
        {!ready ? (
          <p className="mb-4 text-center text-xs leading-relaxed" style={{ color: colors.inkMut }}>
            Agent-ka waa inuu aqbalo call-ka app-ka mobile. Sug ilaa uu jawaabo.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void hangUp()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white"
          style={{ background: colors.rose }}
        >
          <PhoneOff size={18} />
          {so.pttEnd}
        </button>
      </div>
    </div>
  );
}
