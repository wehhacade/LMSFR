import type { Metadata, Viewport } from "next";
import { TipPhoneSwRegister } from "@/components/tiphone/sw-register";

export const metadata: Metadata = {
  title: "Ilaalo Shacab",
  description: "Ilaalo Shacab field app — PWA",
  applicationName: "Ilaalo Shacab",
  manifest: "/api/tiphone/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ilaalo Shacab",
  },
  icons: {
    icon: [
      { url: "/api/tiphone/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/api/tiphone/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/api/tiphone/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFCFA" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0805" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/** Allow GPS prompt for walkie / nearest-agent on TipPhone PWA. */
export async function headers() {
  return {
    "Permissions-Policy": "geolocation=(self), microphone=(self)",
  };
}

export default function TipPhoneLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="tiphone-root min-h-dvh" data-tip-theme="light" style={{ colorScheme: "light" }}>
      {children}
      <TipPhoneSwRegister />
      <style>{`
        @keyframes tipSlideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tipShimmerSweep {
          from { transform: translateX(-120%); }
          to { transform: translateX(220%); }
        }
        .tip-shimmer-beam {
          animation: tipShimmerSweep 1.3s linear infinite;
        }

        /* Isolate TipPhone forms from LMSBR dark-theme select/input paint */
        .tiphone-root input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),
        .tiphone-root textarea,
        .tiphone-root select {
          background-color: transparent !important;
          background-image: none !important;
          color: inherit !important;
          color-scheme: inherit;
          appearance: none;
          -webkit-appearance: none;
          padding-right: 0 !important;
          box-shadow: none !important;
          -webkit-box-shadow: none !important;
        }
        .tiphone-root input::placeholder,
        .tiphone-root textarea::placeholder {
          opacity: 0.55;
        }
        .tiphone-root select option,
        .tiphone-root select optgroup {
          background-color: #fdfcfa;
          color: #1c1610;
        }
        .tiphone-root[data-tip-theme="warm"] select option,
        .tiphone-root[data-tip-theme="warm"] select optgroup {
          background-color: #14100a;
          color: #fbf3e2;
        }
        .tiphone-root[data-tip-theme="navy"] select option,
        .tiphone-root[data-tip-theme="navy"] select optgroup {
          background-color: #0b1838;
          color: #eef3fb;
        }
        .tiphone-root input:-webkit-autofill,
        .tiphone-root input:-webkit-autofill:hover,
        .tiphone-root input:-webkit-autofill:focus,
        .tiphone-root textarea:-webkit-autofill,
        .tiphone-root select:-webkit-autofill {
          -webkit-text-fill-color: inherit;
          transition: background-color 99999s ease-in-out 0s;
          box-shadow: 0 0 0 1000px transparent inset !important;
          -webkit-box-shadow: 0 0 0 1000px transparent inset !important;
        }

        /* Hide leftover Next / React Query floating badges on TipPhone */
        .tsqd-open-btn,
        .tsqd-transitions-container,
        nextjs-portal,
        [data-nextjs-toast],
        [data-next-badge-root],
        [data-nextjs-dev-overlay] {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
