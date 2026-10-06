/** Local security prefs for TipPhone PWA (PIN + Face ID) — mirrors mobile SecurityStorage. */

const PIN_KEY = "tiphone_app_pin";
const PIN_LOCK_KEY = "tiphone_pin_lock";
const LAST_AUTH_KEY = "tiphone_last_auth";
const BIO_KEY = "tiphone_biometric_enabled";
const BIO_CRED_KEY = "tiphone_webauthn_cred";

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const SecurityStorage = {
  getPin(): string | null {
    return read(PIN_KEY);
  },

  setPin(pin: string): void {
    write(PIN_KEY, pin);
  },

  clearPin(): void {
    remove(PIN_KEY);
  },

  isPinLockEnabled(): boolean {
    return read(PIN_LOCK_KEY) === "1";
  },

  setPinLockEnabled(enabled: boolean): void {
    write(PIN_LOCK_KEY, enabled ? "1" : "0");
  },

  isBiometricEnabled(): boolean {
    return read(BIO_KEY) === "1" && Boolean(read(BIO_CRED_KEY));
  },

  getBiometricCredentialId(): string | null {
    return read(BIO_CRED_KEY);
  },

  setBiometricEnabled(enabled: boolean, credentialId?: string): void {
    if (enabled && credentialId) {
      write(BIO_KEY, "1");
      write(BIO_CRED_KEY, credentialId);
      return;
    }
    write(BIO_KEY, "0");
    remove(BIO_CRED_KEY);
  },

  getLastAuthTime(): number {
    const raw = read(LAST_AUTH_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  },

  setLastAuthTime(ts: number = Date.now()): void {
    write(LAST_AUTH_KEY, String(ts));
  },

  /** True when overlay should show (PIN saved + lock toggle on). */
  shouldUseAppLock(): boolean {
    return Boolean(this.isPinLockEnabled() && this.getPin());
  },
};
