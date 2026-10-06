"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { so } from "@/lib/tiphone/i18n";
import { PttApi, type PttPendingInvite } from "@/lib/tiphone/ptt-api";
import { startPttWebRtc, type PttSessionHandle } from "@/lib/tiphone/ptt-webrtc";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "./theme-provider";

export function IncomingCallOverlay({
  invite,
  onClose,
}: {
  invite: PttPendingInvite;
  onClose: () => void;
}) {
  const { colors } = useTipTheme();
  const [phase, setPhase] = useState<"ringing" | "connecting" | "active" | "failed">("ringing");
  const [status, setStatus] = useState("Wicitaan soo gelaya…");
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<PttSessionHandle | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef({ aborted: false });
  const leavingRef = useRef(false);

  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    abortRef.current.aborted = true;
    onClose();
  }, [onClose]);

  const reject = useCallback(async () => {
    const handle = handleRef.current;
    handleRef.current = null;
    if (handle) await handle.end();
    else await PttApi.end(invite.session_id).catch(() => {});
    leave();
  }, [invite.session_id, leave]);

  const accept = useCallback(async () => {
    setPhase("connecting");
    setStatus(so.pttConnecting);
    abortRef.current = { aborted: false };
    try {
      await PttApi.signal({ session_id: invite.session_id, type: "accept" });
      const handle = await startPttWebRtc({
        sessionId: invite.session_id,
        role: "callee",
        remoteAudioEl: audioRef.current,
        signal: abortRef.current,
        onStatus: setStatus,
        onReady: () => {
          setPhase("active");
          setStatus(so.pttInCall);
        },
        onEnded: () => {
          void (async () => {
            const h = handleRef.current;
            handleRef.current = null;
            if (h) await h.dispose();
            leave();
          })();
        },
      });
      handleRef.current = handle;
      handle.setSpeakerOn(true);
    } catch (err) {
      setPhase("failed");
      setError(err instanceof Error ? err.message : so.pttFailed);
      setStatus(so.pttFailed);
    }
  }, [invite.session_id, leave]);

  useEffect(() => {
    return () => {
      abortRef.current.aborted = true;
      const handle = handleRef.current;
      handleRef.current = null;
      void handle?.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <audio ref={audioRef} autoPlay playsInline className="sr-only" />
      <div
        className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
        style={{ background: colors.bg1, borderColor: rgba(colors.goldRgb, 0.35) }}
      >
        <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: colors.gold }}>
          Wicitaan soo gelaya
        </p>
        <h3 className="mb-1 text-xl font-bold">{invite.from_name || `Agent #${invite.from_user_id}`}</h3>
        {invite.from_phone ? (
          <p className="mb-4 text-sm" style={{ color: colors.gold }}>
            {invite.from_phone}
          </p>
        ) : null}
        <p className="mb-5 text-center text-sm" style={{ color: colors.ink1 }}>
          {status}
        </p>
        {error ? (
          <p className="mb-4 text-center text-xs" style={{ color: colors.rose }}>
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          {phase === "ringing" ? (
            <>
              <button
                type="button"
                onClick={() => void reject()}
                className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white"
                style={{ background: colors.rose }}
              >
                <PhoneOff size={18} /> Diid
              </button>
              <button
                type="button"
                onClick={() => void accept()}
                className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold"
                style={{ background: colors.gold, color: colors.onGold }}
              >
                <Phone size={18} /> Aqbal
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void reject()}
              className="col-span-2 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white"
              style={{ background: colors.rose }}
            >
              <PhoneOff size={18} /> {so.pttEnd}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
