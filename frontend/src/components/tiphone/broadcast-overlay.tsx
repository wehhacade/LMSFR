"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PhoneOff, Radio } from "lucide-react";
import { Room, RoomEvent, Track } from "livekit-client";
import { PttApi, type BroadcastJoinPayload, type BroadcastStartPayload } from "@/lib/tiphone/ptt-api";
import { rgba } from "@/lib/tiphone/theme";
import { useTipTheme } from "./theme-provider";

type BroadcastSession = BroadcastStartPayload | BroadcastJoinPayload;

export function BroadcastOverlay({
  session,
  asHost,
  onClose,
}: {
  session: BroadcastSession;
  asHost: boolean;
  onClose: () => void;
}) {
  const { colors } = useTipTheme();
  const [status, setStatus] = useState("LiveKit waa la xiranayaa…");
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);

  const title = useMemo(
    () => (asHost ? "Broadcast Degmo" : "Broadcast soo gelaya"),
    [asHost],
  );

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const attachTrack = (track: Track) => {
      if (track.kind !== Track.Kind.Audio || !audioHostRef.current) return;
      const el = track.attach() as HTMLAudioElement;
      el.autoplay = true;
      el.setAttribute("playsinline", "true");
      audioHostRef.current.appendChild(el);
      void el.play().catch(() => {});
    };

    room.on(RoomEvent.TrackSubscribed, (track) => attachTrack(track));
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) onClose();
    });

    void (async () => {
      try {
        await room.connect(session.livekit_url, session.token);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (cancelled) {
          await room.disconnect();
          return;
        }
        setConnected(true);
        setStatus(asHost ? "Broadcast waa furan yahay" : "Waad ku jirtaa broadcast-ka");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "LiveKit connection failed");
        setStatus("Broadcast way fashilantay");
      }
    })();

    return () => {
      cancelled = true;
      void room.disconnect();
      roomRef.current = null;
    };
  }, [asHost, onClose, session.livekit_url, session.token]);

  const hangUp = async () => {
    try {
      if (asHost) await PttApi.broadcastEnd(session.session_id);
    } catch {
      /* ignore */
    }
    await roomRef.current?.disconnect();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[145] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
        style={{ background: colors.bg1, borderColor: rgba(colors.goldRgb, 0.35) }}
      >
        <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: colors.gold }}>
          {title}
        </p>
        <h3 className="mb-2 text-xl font-bold">Degmo #{session.county_id}</h3>
        <div
          className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full"
          style={{
            background: rgba(colors.goldRgb, connected ? 0.24 : 0.1),
            border: `2px solid ${rgba(colors.goldRgb, connected ? 0.55 : 0.25)}`,
          }}
        >
          <Radio size={34} style={{ color: colors.gold }} />
        </div>
        <p className="mb-2 text-center text-sm" style={{ color: colors.ink1 }}>
          {status}
        </p>
        {error ? (
          <p className="mb-4 text-center text-xs" style={{ color: colors.rose }}>
            {error}
          </p>
        ) : (
          <p className="mb-4 text-center text-xs" style={{ color: colors.inkMut }}>
            LiveKit voice room · BLE background lama taageero browser-ka.
          </p>
        )}
        <div ref={audioHostRef} className="sr-only" />
        <button
          type="button"
          onClick={() => void hangUp()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white"
          style={{ background: colors.rose }}
        >
          <PhoneOff size={18} /> Jooji
        </button>
      </div>
    </div>
  );
}
