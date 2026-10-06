import axios from "axios";
import { so } from "./i18n";
import { PttApi } from "./ptt-api";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

const POLL_MS = 400;
const ACCEPT_WAIT_MS = 45_000;

export type PttRole = "caller" | "callee";

export type PttSessionHandle = {
  setSpeakerOn: (on: boolean) => void;
  dispose: () => Promise<void>;
  end: () => Promise<void>;
};

async function ensureMicPermission(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Browser WebRTC audio (caller role for PWA home walkie). */
export async function startPttWebRtc(opts: {
  sessionId: string;
  role: PttRole;
  remoteAudioEl?: HTMLAudioElement | null;
  onRemoteStream?: (stream: MediaStream | null) => void;
  onStatus?: (status: string) => void;
  onReady?: () => void;
  onEnded?: () => void;
  signal?: { aborted: boolean };
}): Promise<PttSessionHandle> {
  const {
    sessionId,
    role,
    remoteAudioEl,
    onRemoteStream,
    onStatus,
    onReady,
    onEnded,
    signal,
  } = opts;

  let closed = false;
  let remoteEndedNotified = false;
  let pc: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = null;
  let localAudio: MediaStreamTrack | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let polling = false;
  let remoteDescSet = false;
  let offerApplied = false;
  let answerApplied = false;
  let readyFired = false;
  let speakerOn = true;
  const pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  const seenCandidates = new Set<string>();

  const isAborted = () => closed || Boolean(signal?.aborted);

  const notifyRemoteEnded = () => {
    if (remoteEndedNotified) return;
    remoteEndedNotified = true;
    onStatus?.(so.pttEnded);
    onEnded?.();
  };

  const applyRemoteAudio = (stream: MediaStream | null | undefined) => {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
    if (remoteAudioEl) {
      remoteAudioEl.srcObject = stream;
      remoteAudioEl.volume = speakerOn ? 1 : 0.4;
      void remoteAudioEl.play().catch(() => {});
    }
    onRemoteStream?.(stream);
  };

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    try {
      localAudio?.stop();
    } catch {
      // ignore
    }
    try {
      localStream?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    try {
      pc?.close();
    } catch {
      // ignore
    }
    pc = null;
    localStream = null;
    localAudio = null;
    if (remoteAudioEl) remoteAudioEl.srcObject = null;
    onRemoteStream?.(null);
  };

  const dispose = async () => {
    await cleanup();
  };

  const end = async () => {
    await cleanup();
    try {
      await PttApi.end(sessionId);
    } catch {
      // ignore
    }
  };

  const markReady = () => {
    if (readyFired || closed) return;
    readyFired = true;
    if (localAudio) localAudio.enabled = true;
    onStatus?.(so.pttConnected);
    onReady?.();
  };

  const ok = await ensureMicPermission();
  if (!ok) {
    await cleanup();
    throw new Error(so.pttMicDenied);
  }

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  localAudio = localStream.getAudioTracks()[0] ?? null;
  if (!localAudio) {
    await cleanup();
    throw new Error(so.pttMicDenied);
  }
  localAudio.enabled = true;

  if (role === "caller") {
    onStatus?.(so.pttWaitingAgent);
    const waitStart = Date.now();
    let accepted = false;
    while (!accepted && !isAborted()) {
      if (Date.now() - waitStart > ACCEPT_WAIT_MS) {
        await cleanup();
        throw new Error("Agent ma aqbalin call-ka — isku day mar kale");
      }
      try {
        const snap = await PttApi.getSession(sessionId);
        if (snap.status === "ended") {
          await cleanup();
          throw new Error(so.pttEnded);
        }
        if (
          snap.status === "accepted" ||
          snap.status === "offering" ||
          snap.status === "active" ||
          Boolean(snap.answer)
        ) {
          accepted = true;
          break;
        }
      } catch (err) {
        if (isAborted()) {
          await cleanup();
          return makeHandle();
        }
        console.warn("[PTT] wait-accept poll failed", err);
      }
      await sleep(400);
    }
    if (isAborted()) {
      await cleanup();
      return makeHandle();
    }
    onStatus?.(so.pttCreatingOffer);
  } else {
    await PttApi.signal({ session_id: sessionId, type: "accept" });
    onStatus?.(so.pttWaitingAnswer);
  }

  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.onicecandidate = (ev) => {
    const candidate = ev.candidate;
    if (!candidate || closed) return;
    void PttApi.signal({
      session_id: sessionId,
      type: "candidate",
      candidate: candidate.toJSON(),
    }).catch((err) => console.warn("[PTT] candidate send failed", err));
  };

  pc.ontrack = (ev) => {
    if (ev.track) ev.track.enabled = true;
    const stream = ev.streams[0] ?? null;
    applyRemoteAudio(stream);
    onStatus?.(so.pttLinking);
  };

  pc.oniceconnectionstatechange = () => {
    const s = pc?.iceConnectionState ?? "";
    if (s === "checking" || s === "new") onStatus?.(so.pttIceChecking);
    if (s === "connected" || s === "completed") markReady();
    if (s === "failed") onStatus?.(so.pttIceFailed);
  };

  pc.onconnectionstatechange = () => {
    if (pc?.connectionState === "connected") markReady();
  };

  const flushPendingCandidates = async () => {
    if (!pc || !remoteDescSet || closed) return;
    while (pendingRemoteCandidates.length) {
      const c = pendingRemoteCandidates.shift();
      if (!c) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.warn("[PTT] addIceCandidate failed", err);
      }
    }
  };

  const queueOrAddCandidate = async (c: RTCIceCandidateInit) => {
    if (!c || closed) return;
    const key = JSON.stringify(c);
    if (seenCandidates.has(key)) return;
    seenCandidates.add(key);
    if (!remoteDescSet) {
      pendingRemoteCandidates.push(c);
      return;
    }
    try {
      await pc?.addIceCandidate(new RTCIceCandidate(c));
    } catch (err) {
      console.warn("[PTT] addIceCandidate failed", err);
    }
  };

  pc.addTrack(localAudio, localStream);

  if (role === "caller") {
    onStatus?.(so.pttCreatingOffer);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await PttApi.signal({
      session_id: sessionId,
      type: "offer",
      sdp: offer.sdp ?? "",
    });
    onStatus?.(so.pttWaitingAnswer);
  }

  const tick = async () => {
    if (closed || polling || !pc) return;
    polling = true;
    try {
      const snap = await PttApi.getSession(sessionId);
      if (closed || !pc) return;
      if (snap.status === "ended") {
        await cleanup();
        notifyRemoteEnded();
        return;
      }

      for (const c of snap.candidates ?? []) {
        await queueOrAddCandidate(c as RTCIceCandidateInit);
      }
      if (closed || !pc) return;

      if (role === "callee" && snap.offer && !offerApplied) {
        onStatus?.(so.pttCreatingOffer);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: snap.offer }));
          remoteDescSet = true;
          offerApplied = true;
          await flushPendingCandidates();
          if (closed || !pc) return;
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await PttApi.signal({
            session_id: sessionId,
            type: "answer",
            sdp: answer.sdp ?? "",
          });
          onStatus?.(so.pttIceChecking);
        } catch (err) {
          offerApplied = false;
          remoteDescSet = false;
          console.warn("[PTT] apply offer failed — will retry", err);
        }
      }

      if (role === "caller" && snap.answer && !answerApplied) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: snap.answer }));
          remoteDescSet = true;
          answerApplied = true;
          await flushPendingCandidates();
          onStatus?.(so.pttIceChecking);
        } catch (err) {
          answerApplied = false;
          remoteDescSet = false;
          console.warn("[PTT] apply answer failed — will retry", err);
        }
      }
    } catch (err) {
      if (!closed) {
        const ax = axios.isAxiosError(err) ? err : null;
        const apiMsg =
          ax?.response?.data &&
          typeof ax.response.data === "object" &&
          "message" in ax.response.data
            ? String((ax.response.data as { message?: unknown }).message ?? "")
            : "";
        const msg = `${apiMsg} ${err instanceof Error ? err.message : String(err)}`;
        if (ax?.response?.status === 404 || /404|lama helin|dhacay|not found/i.test(msg)) {
          await cleanup();
          notifyRemoteEnded();
          return;
        }
      }
      if (!closed) console.warn("[PTT] poll failed", err);
    } finally {
      polling = false;
    }
  };

  pollTimer = setInterval(() => {
    void tick();
  }, POLL_MS);
  void tick();

  function makeHandle(): PttSessionHandle {
    return {
      setSpeakerOn: (on: boolean) => {
        speakerOn = on;
        if (remoteAudioEl) remoteAudioEl.volume = on ? 1 : 0.4;
      },
      dispose,
      end,
    };
  }

  return makeHandle();
}
