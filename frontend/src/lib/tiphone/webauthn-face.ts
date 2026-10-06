/** WebAuthn platform biometrics (Face ID on iPhone) for TipPhone PWA. */

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64ToBuf(b64: string): ArrayBuffer {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const normalized = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(normalized);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

export async function canUsePlatformBiometric(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch {
    return false;
  }
  return true;
}

export type FaceIdResult =
  | { ok: true }
  | { ok: false; code: "unsupported" | "insecure" | "cancelled" | "failed"; message: string };

export async function registerFaceId(opts: {
  userId: string | number;
  userName: string;
}): Promise<FaceIdResult & { credentialId?: string }> {
  if (typeof window === "undefined") {
    return { ok: false, code: "unsupported", message: "Biometric lama heli karo." };
  }
  if (!window.isSecureContext) {
    return {
      ok: false,
      code: "insecure",
      message:
        "Face ID wuxuu u baahan yahay HTTPS (ama localhost). HTTP LAN kuma shaqeeyo iPhone Safari.",
    };
  }
  if (!isWebAuthnSupported()) {
    return { ok: false, code: "unsupported", message: "Face ID lama taageero browser-kan." };
  }

  const available = await canUsePlatformBiometric();
  if (!available) {
    return {
      ok: false,
      code: "unsupported",
      message: "Face ID lama heli karo qalabkan. Hubi in Face ID uu furanyahay Settings.",
    };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(`tiphone:${opts.userId}`);
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "Ilaalo Shacab",
          id: window.location.hostname,
        },
        user: {
          id: userIdBytes,
          name: opts.userName.slice(0, 64) || `user-${opts.userId}`,
          displayName: opts.userName.slice(0, 64) || "Agent",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 90_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!cred) {
      return { ok: false, code: "cancelled", message: "Face ID waa la joojiyay." };
    }

    return { ok: true, credentialId: bufToB64(cred.rawId) };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "AbortError") {
      return { ok: false, code: "cancelled", message: "Face ID waa la joojiyay." };
    }
    return {
      ok: false,
      code: "failed",
      message: err instanceof Error ? err.message : "Face ID diiwaangelintu way fashilantay.",
    };
  }
}

export async function authenticateFaceId(credentialId: string): Promise<FaceIdResult> {
  if (typeof window === "undefined" || !window.isSecureContext || !isWebAuthnSupported()) {
    return {
      ok: false,
      code: "insecure",
      message: "Face ID wuxuu u baahan yahay HTTPS.",
    };
  }
  if (!credentialId) {
    return { ok: false, code: "failed", message: "Face ID lama diiwaangelin." };
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [
          {
            type: "public-key",
            id: b64ToBuf(credentialId),
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 90_000,
      },
    });

    if (!assertion) {
      return { ok: false, code: "cancelled", message: "Face ID waa la joojiyay." };
    }
    return { ok: true };
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "AbortError") {
      return { ok: false, code: "cancelled", message: "Face ID waa la joojiyay ama wuu fashilmay." };
    }
    return {
      ok: false,
      code: "failed",
      message: err instanceof Error ? err.message : "Face ID xaqiijintu way fashilantay.",
    };
  }
}
