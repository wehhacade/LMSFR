"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  authKeys,
  changePassword,
  fetchMe,
  forgotPassword,
  login,
  logout,
  register,
  resetPassword,
  updateProfile,
  verifyOtp,
} from "@/lib/auth-api";
import { setTokens, clearTokens, getAccessToken, getRefreshToken, navigateAfterLogin } from "@/lib/auth";
import { toast } from "@/components/ui/use-toast";
import type {
  ChangePasswordPayload,
  LoginCredentials,
  ProfileUpdatePayload,
  RegisterData,
  ResetPasswordPayload,
} from "@/types";

function loginErrorMessage(error: unknown): string {
  const err = error as { response?: { data?: { detail?: string; email?: string[] } } };
  return (
    err.response?.data?.detail ??
    err.response?.data?.email?.[0] ??
    "Invalid credentials. Please try again."
  );
}

export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => fetchMe({ fresh: true }),
    enabled: !!getAccessToken(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      if (data.otp_required) {
        toast({
          title: "OTP required",
          description: `Enter the code sent to ${data.email ?? "your device"}.`,
        });
        return;
      }
      setTokens(data);
      queryClient.invalidateQueries({ queryKey: authKeys.me });
      toast({ title: "Welcome back!", description: "Successfully signed in." });
      navigateAfterLogin();
    },
    onError: (error: unknown) => {
      const msg = loginErrorMessage(error);
      toast({ title: "Sign in failed", description: msg, variant: "destructive" });
    },
  });
}

export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: RegisterData) => register(payload),
    onSuccess: () => {
      toast({ title: "Account created!", description: "Please sign in with your new account." });
      router.push("/login");
    },
    onError: (error: unknown) => {
      const err = error as {
        response?: { data?: { email?: string[]; username?: string[]; password?: string[]; detail?: string } };
      };
      const d = err.response?.data;
      const msg =
        d?.email?.[0] ?? d?.username?.[0] ?? d?.password?.[0] ?? d?.detail ?? "Registration failed.";
      toast({ title: "Registration failed", description: msg, variant: "destructive" });
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await logout(refresh);
      } catch {
        // ignore logout API errors
      }
    }
    clearTokens();
    queryClient.clear();
    toast({ title: "Signed out" });
    router.push("/login");
  };
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProfileUpdatePayload) => updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me });
      toast({ title: "Profile updated" });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      toast({
        title: "Update failed",
        description: err.response?.data?.detail ?? "Could not update profile.",
        variant: "destructive",
      });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changePassword(payload),
    onSuccess: () => {
      toast({ title: "Password changed", description: "Your password was updated successfully." });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      toast({
        title: "Password change failed",
        description: err.response?.data?.detail ?? "Could not change password.",
        variant: "destructive",
      });
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => forgotPassword(email),
    onSuccess: () => {
      toast({
        title: "Check your email",
        description: "If the account exists, reset instructions were sent.",
      });
    },
  });
}

export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => resetPassword(payload),
    onSuccess: () => {
      toast({ title: "Password reset", description: "You can now sign in with your new password." });
      router.push("/login");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      toast({
        title: "Reset failed",
        description: err.response?.data?.detail ?? "Invalid reset code.",
        variant: "destructive",
      });
    },
  });
}

export function useVerifyOtp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => verifyOtp(email, code),
    onSuccess: (data) => {
      setTokens(data);
      queryClient.invalidateQueries({ queryKey: authKeys.me });
      toast({ title: "Verified", description: "Successfully signed in." });
      navigateAfterLogin();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { detail?: string } } };
      toast({
        title: "Verification failed",
        description: err.response?.data?.detail ?? "Invalid OTP.",
        variant: "destructive",
      });
    },
  });
}
