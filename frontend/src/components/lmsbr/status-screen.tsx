"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

type Code = "404" | "403" | "500";

type Action =
  | { kind: "link"; label: string; href: string; variant?: "primary" | "secondary" }
  | { kind: "back"; label: string; variant?: "primary" | "secondary" }
  | { kind: "button"; label: string; onClick: () => void; variant?: "primary" | "secondary" };

const TONE: Record<Code, { icon: string; accent: string }> = {
  "404": { icon: "search", accent: "var(--primary)" },
  "403": { icon: "shield", accent: "var(--destructive)" },
  "500": { icon: "alert", accent: "var(--destructive)" },
};

export function StatusScreen({
  code,
  title,
  description,
  actions,
  reference,
}: {
  code: Code;
  title: string;
  description: string;
  actions?: Action[];
  reference?: string;
}) {
  const router = useRouter();
  const tone = TONE[code];
  const glow = `color-mix(in oklch, ${tone.accent} 28%, transparent)`;
  const glowSoft = `color-mix(in oklch, ${tone.accent} 10%, transparent)`;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6 py-16 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{ background: `radial-gradient(circle, ${glow}, transparent 70%)` }}
      />
      <div
        aria-hidden
        className="anim-glow-9 pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse 60% 42% at 50% 0%, ${glowSoft}, transparent 72%)` }}
      />

      <div className="anim-fadeUp relative z-10 w-full max-w-lg text-center">
        <div
          aria-hidden
          className="mx-auto mb-7 h-9 w-9 opacity-40"
          style={{
            WebkitMaskImage: "url('/emblem.png')",
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskImage: "url('/emblem.png')",
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            background: "var(--muted-foreground)",
          }}
        />

        <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center">
          <div
            aria-hidden
            className="anim-halo absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle, ${glow}, transparent 70%)` }}
          />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
            <span style={{ color: tone.accent }}>
              <Icon name={tone.icon} size={24} sw={1.8} />
            </span>
          </div>
        </div>

        <h1
          className="lmsbr-title mx-auto text-[84px] font-extrabold leading-none tracking-tight sm:text-[104px]"
          style={{ backgroundImage: "linear-gradient(180deg, var(--foreground), var(--primary) 70%)" }}
        >
          {code}
        </h1>

        <h2 className="mt-4 text-xl font-semibold sm:text-2xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          {description}
        </p>

        {actions?.length ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {actions.map((a) => {
              const className = buttonClass(a.variant);
              if (a.kind === "link") {
                return (
                  <Link key={a.label} href={a.href} className={className}>
                    {a.label}
                  </Link>
                );
              }
              if (a.kind === "back") {
                return (
                  <button key={a.label} type="button" onClick={() => router.back()} className={className}>
                    {a.label}
                  </button>
                );
              }
              return (
                <button key={a.label} type="button" onClick={a.onClick} className={className}>
                  {a.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {reference && (
          <p className="mt-8 text-xs text-muted-foreground/70">
            Reference: <span className="font-mono">{reference}</span>
          </p>
        )}

        <p className="mt-10 text-xs text-muted-foreground/60">© 2026 LMSBR</p>
      </div>
    </div>
  );
}

function buttonClass(variant: Action["variant"]) {
  return cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200",
    variant === "secondary"
      ? "border border-border bg-card text-foreground hover:bg-accent"
      : "bg-primary text-primary-foreground shadow-[0_10px_30px_-14px_var(--ring)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_var(--ring)]"
  );
}
