"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PttApi, type BroadcastJoinPayload, type BroadcastPending, type PttPendingInvite } from "@/lib/tiphone/ptt-api";
import { canUseIsgaarsiin } from "@/lib/tiphone/utils";
import { useTipAuth } from "./auth-provider";
import { BroadcastOverlay } from "./broadcast-overlay";
import { IncomingCallOverlay } from "./incoming-call-overlay";

export function TipPhoneCallWatcher({ children }: { children: ReactNode }) {
  const { auth } = useTipAuth();
  const [invite, setInvite] = useState<PttPendingInvite | null>(null);
  const [broadcastInvite, setBroadcastInvite] = useState<BroadcastPending | null>(null);
  const [joinedBroadcast, setJoinedBroadcast] = useState<BroadcastJoinPayload | null>(null);
  const [joining, setJoining] = useState(false);
  const mayReceiveCalls = Boolean(
    auth && canUseIsgaarsiin(auth.roles, auth.permissions),
  );

  useEffect(() => {
    if (!auth || !mayReceiveCalls) {
      setInvite(null);
      setBroadcastInvite(null);
      setJoinedBroadcast(null);
      return;
    }
    let alive = true;
    const poll = async () => {
      try {
        const [ptt, broadcast] = await Promise.all([
          PttApi.pending(),
          PttApi.broadcastPending(),
        ]);
        if (!alive) return;
        if (!invite && ptt) setInvite(ptt);
        if (!broadcastInvite && !joinedBroadcast && broadcast) setBroadcastInvite(broadcast);
      } catch {
        /* ignore transient poll errors */
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [auth, mayReceiveCalls, invite, broadcastInvite, joinedBroadcast]);

  return (
    <>
      {children}
      {invite ? (
        <IncomingCallOverlay invite={invite} onClose={() => setInvite(null)} />
      ) : null}
      {broadcastInvite && !joinedBroadcast ? (
        <div className="fixed inset-0 z-[142] flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border bg-black/80 p-6 text-white">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-300">
              Broadcast Degmo
            </p>
            <h3 className="mb-2 text-xl font-bold">{broadcastInvite.from_name}</h3>
            <p className="mb-5 text-sm text-white/70">
              Call degmo ayaa furan. Ma aqbalaysaa? (LiveKit)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="rounded-2xl bg-rose-600 py-3 font-semibold"
                onClick={() => setBroadcastInvite(null)}
              >
                Diid
              </button>
              <button
                type="button"
                disabled={joining}
                className="rounded-2xl bg-amber-400 py-3 font-semibold text-black disabled:opacity-60"
                onClick={() => {
                  void (async () => {
                    setJoining(true);
                    try {
                      const joined = await PttApi.broadcastJoin(broadcastInvite.session_id);
                      setJoinedBroadcast(joined);
                      setBroadcastInvite(null);
                    } catch {
                      setBroadcastInvite(null);
                    } finally {
                      setJoining(false);
                    }
                  })();
                }}
              >
                {joining ? "…" : "Aqbal"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {joinedBroadcast ? (
        <BroadcastOverlay
          session={joinedBroadcast}
          asHost={false}
          onClose={() => setJoinedBroadcast(null)}
        />
      ) : null}
    </>
  );
}
