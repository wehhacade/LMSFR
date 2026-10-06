import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/lmsbr/login-screen";

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
