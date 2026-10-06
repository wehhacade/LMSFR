import api from "@/lib/axios";
import { fetchMe } from "@/lib/auth-api";

/** Fetch current user's effective permissions, always bypassing server cache. */
export async function fetchLivePermissions(): Promise<string[]> {
  try {
    const { data } = await api.get<{ permissions: string[] }>("/auth/me/permissions/", {
      params: { fresh: 1, _: Date.now() },
    });
    return data.permissions ?? [];
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    // Fallback when /me/permissions/ is not deployed yet (404) or unavailable.
    if (status === 404 || status === 405) {
      const user = await fetchMe({ fresh: true });
      return user.permissions ?? [];
    }
    throw err;
  }
}
