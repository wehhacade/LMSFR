"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "./lang-ctx";
import { useTheme } from "./theme-ctx";
import { useColorPalette } from "./color-palette-ctx";
import { ColorToggle } from "./color-toggle";
import { HeaderProfileMenu } from "./header-profile-menu";
import { useLogout } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { getDict, getModules, hexA, MODULE_ORDER, type ModuleId } from "@/lib/lmsbr/data";
import { defaultModuleNav, persistModuleNav, readNavLayoutPreference, signalOpenMyProfile } from "@/lib/lmsbr/module-nav-persist";
import { launcherBarBg } from "@/lib/lmsbr/palette";
import { Icon } from "./icon";

function LangToggle() {
  const { lang, setLang } = useLang();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const onA = (c: boolean) => c ? "linear-gradient(120deg,#c69049,#a36f2a)" : "transparent";
  const onF = (c: boolean) => c ? "#fff" : (isDark ? "#bfb097" : "#8B7D6B");
  const wrapBg  = isDark ? "rgba(255,255,255,0.03)" : "#FAFAF9";
  const wrapBdr = isDark ? "rgba(214,176,114,0.18)" : "#E5E7EB";
  return (
    <div style={{ display:"flex", background:wrapBg, border:`1px solid ${wrapBdr}`, borderRadius:"9px", padding:"3px" }}>
      <button onClick={() => setLang("en")} style={{ border:"none", cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize:"12px", fontWeight:600, padding:"5px 10px", borderRadius:"6px", transition:".25s", background:onA(lang==="en"), color:onF(lang==="en") }}>EN</button>
      <button onClick={() => setLang("so")} style={{ border:"none", cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize:"12px", fontWeight:600, padding:"5px 10px", borderRadius:"6px", transition:".25s", background:onA(lang==="so"), color:onF(lang==="so") }}>SO</button>
    </div>
  );
}

export function Launcher() {
  const router = useRouter();
  const logout = useLogout();
  const { lang } = useLang();
  const { theme } = useTheme();
  const { palette } = useColorPalette();
  const isDark = theme === "dark";
  const t = getDict(lang);
  const MODS = getModules(lang);
  const { canModule, user, permissions, revision } = usePermissions();
  const visibleModules = useMemo(
    () => MODULE_ORDER.filter((id) => canModule(id)),
    [canModule, user, permissions, revision],
  );

  const so = lang === "so";
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.full_name?.trim() ||
    user?.username?.trim() ||
    (so ? "Isticmaale" : "User");
  const welcomeGreeting = so ? `Ku soo dhawoow, ${displayName}` : `Welcome back, ${displayName}`;

  const bar    = launcherBarBg(palette, isDark);
  const barBdr = isDark ? "rgba(214,176,114,0.12)" : "#E5E7EB";
  const barShad= isDark ? "none" : "0 1px 0 #E5E7EB,0 2px 6px rgba(0,0,0,0.04)";
  const btnBdr = isDark ? "rgba(214,176,114,0.18)" : "#E5E7EB";
  const btnBg  = isDark ? "rgba(255,255,255,0.03)" : "#F3F4F6";
  const pageBg = "transparent";
  const logoTxt= isDark ? "#f1e8d8" : "#1C1917";
  const mutedTxt=isDark ? "#cdbfa6" : "#78716C";
  const headingC=isDark ? "#f1e8d8" : "#1C1917";
  const subC   = isDark ? "#d9a850" : "#A6742F";
  const bodyC  = isDark ? "#b6a589" : "#44403C";

  return (
    <div style={{ position:"relative", zIndex:1, minHeight:"100vh", background: pageBg }}>

      {/* Emblem watermark — full viewport, flex-centred */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:2, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:"min(600px,55vw)", height:"min(600px,55vw)", WebkitMaskImage:"url('/emblem.png')", WebkitMaskSize:"contain", WebkitMaskRepeat:"no-repeat", WebkitMaskPosition:"center", maskImage:"url('/emblem.png')", maskSize:"contain", maskRepeat:"no-repeat", maskPosition:"center", background: isDark ? "radial-gradient(circle at 46% 40%,#fbeebc,#eccd7a 52%,#c89238 88%)" : "radial-gradient(circle at 46% 40%,#b8934a,#8a6020 52%,#5c3d10 88%)", opacity: isDark ? 0.08 : 0.12, mixBlendMode: (isDark ? "screen" : "multiply") as React.CSSProperties["mixBlendMode"], animation:"is-drift 14s ease-in-out infinite" }} />
      </div>

      {/* Top bar */}
      <div style={{ position:"sticky", top:0, zIndex:40, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 4vw", background:bar, backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderBottom:`1px solid ${barBdr}`, boxShadow: barShad, transition:"background .4s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"13px" }}>
          <div style={{ width:"40px", height:"38px", WebkitMaskImage:"url('/emblem.png')", WebkitMaskSize:"contain", WebkitMaskRepeat:"no-repeat", WebkitMaskPosition:"center", maskImage:"url('/emblem.png')", maskSize:"contain", maskRepeat:"no-repeat", maskPosition:"center", background:"linear-gradient(135deg,#f5dca6,#c69049 55%,#7a4e15)", filter:"drop-shadow(0 0 7px rgba(198,144,73,.5))" }} />
          <div style={{ fontFamily:"var(--font-cinzel)", fontWeight:700, fontSize:"19px", letterSpacing:".2em", color:logoTxt }}>{`LMSBR`}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <LangToggle />
          <ColorToggle btnBg={btnBg} btnBdr={btnBdr} menuInactive={isDark ? "#bfb097" : "#8B7D6B"} />
          <button style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"38px", height:"38px", borderRadius:"10px", border:`1px solid ${btnBdr}`, background:btnBg, color:"#c69049", cursor:"pointer" }}>
            <Icon name="bell" size={19} />
          </button>
          <HeaderProfileMenu
            C={{
              txtPrimary: logoTxt,
              txtSecondary: bodyC,
              txtMuted: mutedTxt,
              cardBdr: btnBdr,
              panelBg: isDark ? "linear-gradient(160deg,#150f09,#090603)" : "#FFFFFF",
              panelShadow: isDark ? "0 24px 50px -20px rgba(0,0,0,.55)" : "0 1px 2px rgba(0,0,0,0.04),0 8px 22px rgba(0,0,0,0.06)",
              tableSep: isDark ? "rgba(214,176,114,0.12)" : "#E5E7EB",
              logoutHovC: "#e0655a",
              logoutHovBg: "rgba(224,101,90,.06)",
              btnBg,
              btnBdr,
              inputBdr: btnBdr,
            }}
            accent="#c69049"
            isDark={isDark}
            onLogout={logout}
            onProfileClick={() => {
              if (!user?.id || visibleModules.length === 0) return;
              signalOpenMyProfile();
              router.push(`/dashboard/${visibleModules[0]}`);
            }}
            profileLabel={t.myProfile}
            signOutLabel={t.signOut}
            signOutConfirmTitle={t.confirmSignOut}
            signOutConfirmMessage={t.confirmSignOutMsg}
            cancelLabel={t.cancelAction}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:"1180px", margin:"0 auto", padding:"60px 4vw 80px" }}>
        <div style={{ animation:"is-fadeUp .7s ease both" }}>
          <div style={{ fontFamily:"var(--font-cinzel)", fontSize:"12.5px", letterSpacing:".4em", color:subC, textTransform:"uppercase" }}>{t.workspace}</div>
          <h2 style={{ fontFamily:"var(--font-cinzel)", fontWeight:600, fontSize:"clamp(30px,4.5vw,46px)", color:headingC, margin:"12px 0 0" }}>{welcomeGreeting}</h2>
          <p style={{ fontSize:"16px", color:bodyC, margin:"12px 0 0", maxWidth:"560px", lineHeight:1.6 }}>{t.welcomeSub}</p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))", gap:"22px", marginTop:"46px" }}>
          {visibleModules.map((id, i) => {
            const m = MODS[id];
            return (
              <ModuleCard
                key={id}
                name={m.name}
                tagline={m.tagline}
                metaA={m.metaA}
                metaB={m.metaB}
                grad={m.grad}
                glow={m.glow}
                accent={m.accent}
                icon={m.icon}
                delay={i * 0.09}
                shineDelay={i * 1.1 + 1.5}
                onClick={() => {
                  persistModuleNav(id, { ...defaultModuleNav(id), navMode: readNavLayoutPreference() });
                  router.push(`/dashboard/${id}`);
                }}
              />
            );
          })}
        </div>

        {/* Footer */}
        <footer style={{ marginTop:"56px", paddingBottom:"36px", borderTop:`1px solid ${isDark ? "rgba(214,176,114,0.10)" : "#E5E7EB"}`, paddingTop:"28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
            <div style={{ width:"32px", height:"32px", flexShrink:0, WebkitMaskImage:"url('/emblem.png')", WebkitMaskSize:"contain", WebkitMaskRepeat:"no-repeat", WebkitMaskPosition:"center", maskImage:"url('/emblem.png')", maskSize:"contain", maskRepeat:"no-repeat", maskPosition:"center", background:"linear-gradient(135deg,#f5dca6,#c69049 55%,#7a4e15)", opacity:0.7 }} />
            <div>
              <span style={{ fontFamily:"var(--font-cinzel)", fontWeight:700, fontSize:"15px", letterSpacing:".16em", color:"#c69049" }}>LMSBR</span>
              <span style={{ fontSize:"12px", color: isDark ? "#6a5a3c" : "#9A8A6F", marginLeft:"10px", letterSpacing:".04em" }}>Management System</span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"24px" }}>
            <span style={{ fontSize:"12px", color: isDark ? "#5a4a2c" : "#9A8A6F", letterSpacing:".04em" }}>v2.0.0</span>
            <span style={{ fontSize:"12px", color: isDark ? "#5a4a2c" : "#D9CAB5" }}>·</span>
            <span style={{ fontSize:"12px", color: isDark ? "#6a5a3c" : "#8B7D6B" }}>© 2026 LMSBR</span>
            <span style={{ fontSize:"12px", color: isDark ? "#5a4a2c" : "#D9CAB5" }}>·</span>
            <span style={{ fontSize:"12px", color: isDark ? "#6a5a3c" : "#8B7D6B", cursor:"pointer" }}>Privacy</span>
            <span style={{ fontSize:"12px", color: isDark ? "#6a5a3c" : "#8B7D6B", cursor:"pointer" }}>Support</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ModuleCard({ name, tagline, metaA, metaB, grad, glow, accent, icon, delay, shineDelay, onClick }: {
  name: string; tagline: string; metaA: string; metaB: string; grad: string; glow: string; accent: string; icon: string; delay: number; shineDelay: number; onClick: () => void;
}) {
  const { theme } = useTheme();
  const { palette } = useColorPalette();
  const isDark = theme === "dark";
  const cardBg  = isDark
    ? (palette === "navy" ? "linear-gradient(160deg,#0c1835,#070F26)" : "linear-gradient(160deg,#150f09,#090603)")
    : "#FFFFFF";
  const cardBdr  = isDark ? "rgba(214,176,114,0.16)" : "#E5E7EB";

  const cardShad = isDark
    ? "0 26px 56px -34px rgba(0,0,0,.8),inset 0 1px 0 rgba(248,228,180,0.06)"
    : "0 1px 3px rgba(0,0,0,0.08),0 6px 20px rgba(0,0,0,0.07)";
  const nameC   = isDark ? "#f3ead9" : "#1C1917";
  const tagC    = isDark ? "#b6a589" : "#44403C";
  const metaC   = isDark ? "#9a8a6f" : "#78716C";
  const dotC    = isDark ? "#5a4a2c" : "#D9CAB5";
  return (
    <button
      onClick={onClick}
      style={{ position:"relative", overflow:"hidden", textAlign:"left", cursor:"pointer", padding:"26px 24px", borderRadius:"14px", background:cardBg, border:`1px solid ${cardBdr}`, boxShadow:cardShad, fontFamily:"var(--font-outfit)", color:"inherit", transition:"transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s,border-color .35s", animation:`is-pop .6s cubic-bezier(.2,.7,.2,1) both`, animationDelay:`${delay}s`, width:"100%" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-6px)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = isDark ? hexA(accent, 0.55) : hexA(accent, 0.55);
        (e.currentTarget as HTMLButtonElement).style.boxShadow = isDark
          ? `0 32px 60px -24px ${glow},inset 0 1px 0 rgba(255,255,255,0.9)`
          : `0 0 0 1px ${hexA(accent,0.28)},0 6px 14px rgba(26,54,93,0.06),0 20px 48px -8px rgba(26,54,93,0.12)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "";
        (e.currentTarget as HTMLButtonElement).style.borderColor = cardBdr;
        (e.currentTarget as HTMLButtonElement).style.boxShadow = cardShad;
      }}
    >
      {/* Shine sweep */}
      <div style={{ position:"absolute", top:0, left:0, width:"38%", height:"100%", background: isDark ? "linear-gradient(90deg,transparent,rgba(255,255,255,0.13),transparent)" : "linear-gradient(90deg,transparent,rgba(198,144,73,0.07),transparent)", animation:`is-shine 6s ease-in-out ${shineDelay}s infinite`, pointerEvents:"none" }} />
      {/* Light-mode top accent bar */}
      {!isDark && <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:`linear-gradient(90deg,${accent},${hexA(accent,0.35)})`, borderRadius:"14px 14px 0 0", pointerEvents:"none" }} />}

      <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ position:"relative", width:"64px", height:"64px" }}>
          <div style={{ position:"absolute", inset:"-7px", borderRadius:"24px", background:glow, filter:"blur(15px)", opacity:.5, animation:"is-halo 4.5s ease-in-out infinite", animationDelay:`${shineDelay}s`, pointerEvents:"none" }} />
          <div style={{ position:"relative", width:"64px", height:"64px", borderRadius:"19px", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", background:grad, boxShadow:`0 14px 30px -12px ${glow},inset 0 1px 0 rgba(255,255,255,0.28),inset 0 -2px 6px rgba(0,0,0,0.18)` }}>
            <Icon name={icon} size={30} sw={1.7} />
          </div>
        </div>
        <span style={{ display:"flex", color: isDark ? "rgba(255,255,255,0.3)" : "rgba(100,60,10,0.3)" }}>
          <Icon name="open" size={18} sw={1.8} />
        </span>
      </div>

      <div style={{ position:"relative", fontFamily:"var(--font-cinzel)", fontWeight:600, fontSize:"23px", color:nameC, marginTop:"22px", letterSpacing:".03em" }}>{name}</div>
      <div style={{ position:"relative", fontSize:"14px", color:tagC, marginTop:"8px", lineHeight:1.5 }}>{tagline}</div>
      <div style={{ position:"relative", display:"flex", alignItems:"center", gap:"14px", marginTop:"20px", paddingTop:"16px", borderTop:`1px solid ${isDark ? "rgba(214,176,114,0.12)" : "rgba(15,23,42,0.06)"}` }}>
        <span style={{ fontSize:"12.5px", color:metaC }}>{metaA}</span>
        <span style={{ width:"4px", height:"4px", borderRadius:"50%", background:dotC }} />
        <span style={{ fontSize:"12.5px", color:metaC }}>{metaB}</span>
      </div>
    </button>
  );
}
