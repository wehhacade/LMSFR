import api from "@/lib/axios";
import type {
  AuthTokens,
  ChangePasswordPayload,
  LoginCredentials,
  ProfileUpdatePayload,
  RegisterData,
  ResetPasswordPayload,
  User,
} from "@/types";

export const authKeys = {
  me: ["me"] as const,
};

export async function fetchMe(options?: { fresh?: boolean }) {
  const { data } = await api.get<User>("/auth/me/", {
    params: options?.fresh ? { fresh: 1, _: Date.now() } : undefined,
  });
  return data;
}

/** Lightweight poll endpoint — used for live permission sync without full profile fetch. */
export async function fetchMyPermissions(fresh = true) {
  const { data } = await api.get<{ permissions: string[] }>("/auth/me/permissions/", {
    params: fresh ? { fresh: 1, _: Date.now() } : undefined,
  });
  return data.permissions;
}

export async function login(credentials: LoginCredentials) {
  const { data } = await api.post<AuthTokens & { user?: User; otp_required?: boolean; email?: string }>(
    "/auth/login/",
    credentials,
  );
  return data;
}

export async function register(payload: RegisterData) {
  const { data } = await api.post("/auth/register/", payload);
  return data;
}

export async function logout(refresh: string) {
  const { data } = await api.post("/auth/logout/", { refresh });
  return data;
}

export async function updateProfile(payload: ProfileUpdatePayload) {
  const { data } = await api.patch<User>("/auth/me/", payload);
  return data;
}

export async function changePassword(payload: ChangePasswordPayload) {
  const { data } = await api.post<{ detail: string }>("/auth/change-password/", payload);
  return data;
}

export async function forgotPassword(email: string) {
  const { data } = await api.post<{ detail: string }>("/auth/forgot-password/", { email });
  return data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const { data } = await api.post<{ detail: string }>("/auth/reset-password/", payload);
  return data;
}

export async function verifyOtp(email: string, code: string) {
  const { data } = await api.post<AuthTokens & { user: User }>("/auth/verify-otp/", { email, code });
  return data;
}
