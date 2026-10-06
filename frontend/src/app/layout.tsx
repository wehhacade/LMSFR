import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/lmsbr/theme-ctx";
import { ThemeInitScript } from "@/components/lmsbr/theme-init-script";
import { ColorPaletteProvider } from "@/components/lmsbr/color-palette-ctx";

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "LMSBR", template: "%s | LMSBR" },
  description: "LMSBR Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className={poppins.variable} style={{ margin: 0, padding: 0 }} suppressHydrationWarning>
        <ThemeInitScript />
        <ThemeProvider>
          <ColorPaletteProvider>
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </ColorPaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
