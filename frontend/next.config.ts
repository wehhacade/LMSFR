import type { NextConfig } from "next";

const djangoOrigin =
  process.env.LMSBR_DJANGO_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Hide Next.js dev badge (N + corner glyph) during phone/PWA testing.
  devIndicators: false,
  // Django login URLs use a trailing slash; without this, Next 308s POST /api/v3/.../ to
  // the slashless path and the browser never reaches Django.
  skipTrailingSlashRedirect: true,
  // Allow phone / LAN testing in `next dev` (otherwise chunks/HMR are blocked).
  allowedDevOrigins: ["10.161.1.2", "127.0.0.1", "localhost"],
  async headers() {
    return [
      {
        source: "/api/tiphone/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), microphone=(self)",
          },
        ],
      },
      {
        source: "/tiphone/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), microphone=(self)",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v3/:path*",
        destination: `${djangoOrigin}/api/v3/:path*/`,
      },
      {
        source: "/media/:path*",
        destination: `${djangoOrigin}/media/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "http", hostname: "10.161.1.2" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
    ],
  },
};

export default nextConfig;
