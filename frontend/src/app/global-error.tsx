"use client";

import { useEffect } from "react";

/**
 * Fallback for errors thrown by the root layout itself, where the normal
 * error.tsx boundary can't run because it lives inside that layout. Next.js
 * requires this file to render its own <html>/<body> — it replaces the
 * entire tree, so it can't assume globals.css, fonts, or providers loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          background: "#0a0806",
          color: "#efe6d6",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
          <div
            style={{
              margin: "0 auto 20px",
              width: 60,
              height: 60,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(224,101,90,0.1)",
              border: "1px solid rgba(224,101,90,0.3)",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e0655a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5 21 19H3z" />
              <line x1="12" y1="10" x2="12" y2="14" />
              <line x1="12" y1="16.5" x2="12" y2="16.6" />
            </svg>
          </div>

          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1, color: "#f2ebe0" }}>500</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "16px 0 0" }}>Application error</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a89c88", margin: "10px 0 0" }}>
            Something broke at the core of the app. Reloading usually fixes it — if it keeps
            happening, let the team know.
          </p>

          <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                height: 44,
                padding: "0 20px",
                borderRadius: 12,
                border: "1px solid rgba(245,220,166,0.3)",
                background: "linear-gradient(120deg,#a36f2a,#c69049 52%,#b07a2e)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <a
              href="/dashboard"
              style={{
                height: 44,
                padding: "0 20px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "transparent",
                color: "#efe6d6",
                fontWeight: 600,
                fontSize: 14,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Back to Dashboard
            </a>
          </div>

          {error.digest && (
            <p style={{ marginTop: 24, fontSize: 12, color: "#6b6255" }}>
              Reference: <span style={{ fontFamily: "monospace" }}>{error.digest}</span>
            </p>
          )}

          <p style={{ marginTop: 24, fontSize: 12, color: "#544c40" }}>© 2026 LMSBR</p>
        </div>
      </body>
    </html>
  );
}
