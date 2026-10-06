"use client";

import { TipAuthProvider } from "@/components/tiphone/auth-provider";
import { TipPhoneApp } from "@/components/tiphone/tiphone-app";

export default function TipPhonePage() {
  return (
    <TipAuthProvider>
      <TipPhoneApp />
    </TipAuthProvider>
  );
}
