import { tiphoneApi } from "./axios";
import { ENDPOINTS, TIPHONE_BASE_URL } from "./endpoints";
import { TipStorage, TipTokenService } from "./storage";
import {
  AuthError,
  type LoginApiResponse,
  type LoginCredentials,
  type ProfileApiResponse,
  type StoredAuth,
  type StoredUser,
} from "./types";
import axios from "axios";

function normalizeUser(raw: ProfileApiResponse & Record<string, unknown>): StoredUser {
  return {
    id: (raw.id as string | number) ?? "",
    username: (raw.username as string) ?? "",
    email: (raw.email as string) ?? "",
    firstName: raw.first_name as string | undefined,
    lastName: raw.last_name as string | undefined,
    phone: raw.phone as string | undefined,
    avatar: raw.avatar as string | undefined,
  };
}

async function fetchAgentLogin(userId?: string | number): Promise<Record<string, unknown>> {
  const { data } = await tiphoneApi.post<Record<string, unknown>>(ENDPOINTS.agentLogin, {
    user_id: userId,
  });
  if (data?.Message && typeof data.Message === "object" && !Array.isArray(data.Message)) {
    return data.Message as Record<string, unknown>;
  }
  return data;
}

function extractRoleLabel(agentData: Record<string, unknown>): string | undefined {
  const candidates = [
    agentData.Permission,
    agentData.permission,
    agentData.user_permission,
    agentData.user_type,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

function stringList(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return fallback;
}

function mergeAgentData(auth: StoredAuth, agentData: Record<string, unknown>): StoredAuth {
  const displayName = agentData.username as string | undefined;
  let firstName = auth.user.firstName;
  let lastName = auth.user.lastName;
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    firstName = parts[0] ?? firstName;
    lastName = parts.slice(1).join(" ") || undefined;
  }

  const agentPermission = extractRoleLabel(agentData);
  const roles = agentPermission
    ? [agentPermission]
    : stringList(agentData.roles, auth.roles);

  return {
    ...auth,
    user: {
      ...auth.user,
      id: (agentData.id as string | number | undefined) ?? auth.user.id,
      firstName,
      lastName,
      ...(agentData.email ? { email: agentData.email as string } : {}),
      ...(agentData.phone ? { phone: agentData.phone as string } : {}),
      ...(agentData.image ? { avatar: agentData.image as string } : {}),
    },
    permissions: stringList(agentData.permissions, auth.permissions),
    roles,
    hasPin: (agentData.change_app_pin as boolean | undefined) ?? auth.hasPin,
    forcePasswordChange:
      (agentData.change_password as boolean | undefined) ?? auth.forcePasswordChange,
  };
}

function classifyError(err: unknown): AuthError {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      if (err.code === "ECONNABORTED") {
        return new AuthError("TIMEOUT", "Codsiga wuu dheeraaday. Isku day mar kale.");
      }
      return new AuthError("NETWORK", "Internetka lama xiriirin karo.");
    }
    if (err.response.status === 401 || err.response.status === 400) {
      return new AuthError(
        "INVALID_CREDENTIALS",
        "Magaca isticmaale ama furaha sirta ah waa khaldan.",
      );
    }
    if (err.response.status >= 500) {
      return new AuthError("SERVER_ERROR", "Server-ka waa khalad. Isku day mar kale.");
    }
  }
  return new AuthError("UNKNOWN", err instanceof Error ? err.message : "Wax baa khaldamay.");
}

export const TipAuth = {
  async login(credentials: LoginCredentials): Promise<StoredAuth> {
    try {
      TipTokenService.clear();
      const loginId = credentials.username.trim();
      const { data: res } = await tiphoneApi.post<LoginApiResponse>(ENDPOINTS.login, {
        username: loginId,
        email: loginId,
        password: credentials.password,
      });

      const tokens = {
        access: res.access,
        refresh: res.refresh ?? res.refresh_token ?? "",
        refreshEndpoint: res.refresh_endpoint ?? `${TIPHONE_BASE_URL}/login/`,
      };

      let auth: StoredAuth = {
        tokens,
        user: normalizeUser({
          id: res.id ?? res.user_id,
          username: res.username ?? credentials.username,
          email: res.email ?? (res.user?.email as string) ?? "",
          ...res.user,
        }),
        permissions: stringList(res.permissions),
        roles: stringList(res.roles),
        hasPin: res.has_pin ?? false,
        forcePasswordChange: res.force_password_change ?? false,
        loginAt: Date.now(),
      };

      TipTokenService.setTokens(tokens);
      TipStorage.saveAuth(auth);

      // Enrich with agent profile (role Permission) — required for drawer gates
      try {
        const agent = await fetchAgentLogin(auth.user.id);
        auth = mergeAgentData(auth, agent);
        TipStorage.saveAuth(auth);
      } catch {
        /* ignore */
      }

      try {
        await tiphoneApi.post(ENDPOINTS.updateLocationAttempts, {});
      } catch {
        /* ignore */
      }

      return auth;
    } catch (err) {
      throw classifyError(err);
    }
  },

  hydrate(): StoredAuth | null {
    return TipStorage.loadAuth();
  },

  /** Refresh Permission/roles from get-agent-login (call on app open). */
  async refreshSession(): Promise<StoredAuth | null> {
    const cached = TipStorage.loadAuth();
    if (!cached?.tokens?.access) return null;
    TipTokenService.setTokens(cached.tokens);
    try {
      const agent = await fetchAgentLogin(cached.user.id);
      const updated = mergeAgentData(cached, agent);
      TipStorage.saveAuth(updated);
      return updated;
    } catch {
      return cached;
    }
  },

  logout() {
    TipStorage.clearAuth();
  },
};
