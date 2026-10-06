import { tiphoneApi } from "./axios";
import { ENDPOINTS } from "./endpoints";

export type PttSessionPayload = {
  session_id: string;
  status: string;
  from_user_id: number;
  to_user_id: number;
  from_name: string;
  from_phone?: string;
  offer: string | null;
  answer: string | null;
  candidates: unknown[];
};

export type PttPendingInvite = {
  session_id: string;
  status: string;
  from_user_id: number;
  to_user_id: number;
  from_name: string;
  from_phone?: string;
};

export type BroadcastStartPayload = {
  session_id: string;
  county_id: number;
  room_name: string;
  livekit_url: string;
  token: string;
  agent_count: number;
  push_sent: number;
  push_failed: number;
  status: string;
};

export type BroadcastJoinPayload = {
  session_id: string;
  room_name: string;
  livekit_url: string;
  token: string;
  role: string;
  county_id: number;
};

export type BroadcastPending = {
  session_id: string;
  county_id: number;
  room_name: string;
  from_user_id: number;
  from_name: string;
  status: string;
};

function unwrap<T>(data: { Message?: T; isError?: boolean; message?: string }): T {
  if (data?.isError) {
    throw new Error(data.message || "PTT request failed");
  }
  if (data?.Message == null) {
    throw new Error(data?.message || "PTT response empty");
  }
  return data.Message;
}

export const PttApi = {
  async start(toUserId: number): Promise<{
    session_id: string;
    status: string;
    to_user_id: number;
    push_sent: number;
    push_failed: number;
  }> {
    const { data } = await tiphoneApi.post(ENDPOINTS.pttStart, { to_user_id: toUserId });
    return unwrap(data);
  },

  async pending(): Promise<PttPendingInvite | null> {
    const { data } = await tiphoneApi.get<{ Message?: PttPendingInvite | null; isError?: boolean }>(
      ENDPOINTS.pttPending,
    );
    if (data?.isError) return null;
    return data?.Message ?? null;
  },

  async getSession(sessionId: string): Promise<PttSessionPayload> {
    const { data } = await tiphoneApi.get(`${ENDPOINTS.pttSession}/${sessionId}`);
    return unwrap(data);
  },

  async signal(body: {
    session_id: string;
    type: "offer" | "answer" | "candidate" | "accept";
    sdp?: string;
    candidate?: unknown;
  }): Promise<void> {
    const { data } = await tiphoneApi.post(ENDPOINTS.pttSignal, body);
    unwrap(data);
  },

  async end(sessionId: string): Promise<void> {
    const { data } = await tiphoneApi.post(ENDPOINTS.pttEnd, { session_id: sessionId });
    unwrap(data);
  },

  async broadcastStart(countyId: number): Promise<BroadcastStartPayload> {
    const { data } = await tiphoneApi.post(ENDPOINTS.pttBroadcastStart, { county_id: countyId });
    return unwrap(data);
  },

  async broadcastPending(): Promise<BroadcastPending | null> {
    const { data } = await tiphoneApi.get<{ Message?: BroadcastPending | null; isError?: boolean }>(
      ENDPOINTS.pttBroadcastPending,
    );
    if (data?.isError) return null;
    return data?.Message ?? null;
  },

  async broadcastJoin(sessionId: string): Promise<BroadcastJoinPayload> {
    const { data } = await tiphoneApi.post(ENDPOINTS.pttBroadcastJoin, { session_id: sessionId });
    return unwrap(data);
  },

  async broadcastEnd(sessionId: string): Promise<void> {
    const { data } = await tiphoneApi.post(ENDPOINTS.pttBroadcastEnd, { session_id: sessionId });
    unwrap(data);
  },
};
