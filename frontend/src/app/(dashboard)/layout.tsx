"use client";

import { LangProvider } from "@/components/lmsbr/lang-ctx";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { SessionIdleGuard } from "@/components/providers/session-idle-guard";
import { ClientErrorRecovery } from "@/components/providers/client-error-recovery";
import { AuditTrackerProvider } from "@/components/lmsbr/audit-tracker-provider";
import { useTheme } from "@/components/lmsbr/theme-ctx";
import { useColorPalette } from "@/components/lmsbr/color-palette-ctx";
import { dashboardBg, lightPageBackground } from "@/lib/lmsbr/palette";

function DashboardBg({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { palette } = useColorPalette();
  const isDark = theme === "dark";

  return (
    <div style={{
      minHeight: "100vh",
      ...(isDark
        ? { background: dashboardBg(palette, isDark) }
        : lightPageBackground()),
      color: isDark ? "#efe6d6" : "#1A365D",
      fontFamily: "var(--font-outfit)",
      transition: "background .4s, color .4s",
      position: "relative",
    }}>
      {/* Subtle central beam — dark mode only */}
      {isDark && (
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        width: "min(800px,75vw)", height: "120vh",
        transform: "translate(-50%,-50%)",
        pointerEvents: "none", zIndex: 1,
        background: "radial-gradient(ellipse 38% 55% at 50% 50%,rgba(245,222,170,0.05),rgba(214,176,114,0.015) 48%,transparent 72%)",
        animation: "is-beam 6.5s ease-in-out infinite",
      }} />
      )}

      {/* Grain overlay — dark mode only */}
      {isDark && (
      <div style={{
        position: "fixed", inset: 0,
        pointerEvents: "none", zIndex: 91,
        opacity: 0.045,
        mixBlendMode: "soft-light",
        backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')",
      }} />
      )}

      {children}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <PermissionsProvider>
        <AuditTrackerProvider>
          <ClientErrorRecovery />
          <SessionIdleGuard>
            <DashboardBg>{children}</DashboardBg>
          </SessionIdleGuard>
        </AuditTrackerProvider>
      </PermissionsProvider>
    </LangProvider>
  );
}
