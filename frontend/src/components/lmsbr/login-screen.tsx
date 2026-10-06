"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "@/hooks/use-auth";
import { clearTokens, getAccessToken, navigateAfterLogin } from "@/lib/auth";
import { useLang } from "./lang-ctx";
import { useTheme } from "./theme-ctx";
import { useColorPalette } from "./color-palette-ctx";
import { ColorToggle } from "./color-toggle";
import { getDict } from "@/lib/lmsbr/data";
import { loginPageTokens } from "@/lib/lmsbr/palette";
import { LOGIN_DARK } from "@/lib/lmsbr/theme-tokens";
import { Icon } from "./icon";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

/* ─── per-theme tokens ─── */
const DK = { ...LOGIN_DARK };

const LT = {
  page:       "#F5F5F4",
  pageGrad:   "transparent",
  text:       "#1A365D",
  sub:        "#A6742F",
  muted:      "#4B5563",
  cardBg:     "#FFFFFF",
  cardBorder: "#E5E7EB",
  cardShadow: "0 1px 2px rgba(0,0,0,0.04),0 8px 24px rgba(0,0,0,0.05)",
  inputBg:    "#FFFFFF",
  inputBorder:"#E5E7EB",
  inputFocus: "rgba(198,144,73,0.55)",
  inputText:  "#1A365D",
  inputPlaceholder: "#6B7280",
  divider:    "#E5E7EB",
  langBg:     "#FAFAF9",
  btnGrad:    "linear-gradient(120deg,#a36f2a,#c69049 52%,#b07a2e)",
  btnShadow:  "0 8px 24px -6px rgba(198,144,73,0.45),0 2px 6px rgba(26,54,93,0.06)",
  orb1:       "radial-gradient(circle,rgba(198,144,73,0.14),transparent 65%)",
  orb2:       "radial-gradient(circle,rgba(232,200,120,0.12),transparent 65%)",
  orb3:       "radial-gradient(circle,rgba(180,120,50,0.10),transparent 65%)",
  starColor:  "#c69049",
  ringColor:  "rgba(198,144,73,",
  titleGrad:  "linear-gradient(180deg,#1A365D,#A6742F 55%,#c69049)",
};

const STARS = [
  {l:"9%",t:"14%",s:20,an:"is-twinkle 3.4s ease-in-out infinite",c:"✦"},
  {l:"84%",t:"11%",s:14,an:"is-twinkle 2.8s ease-in-out .4s infinite",c:"✦"},
  {l:"22%",t:"74%",s:16,an:"is-twinkle 3.9s ease-in-out .8s infinite",c:"✧"},
  {l:"77%",t:"78%",s:22,an:"is-twinkle 4.2s ease-in-out .2s infinite",c:"✦"},
  {l:"6%",t:"48%",s:12,an:"is-twinkle2 3s ease-in-out infinite",c:"⋆"},
  {l:"92%",t:"44%",s:13,an:"is-twinkle2 2.4s ease-in-out .6s infinite",c:"⋆"},
  {l:"32%",t:"8%",s:11,an:"is-twinkle2 3.6s ease-in-out 1s infinite",c:"⋆"},
  {l:"66%",t:"22%",s:17,an:"is-twinkle 3.1s ease-in-out .5s infinite",c:"✧"},
  {l:"50%",t:"4%",s:15,an:"is-twinkle 3.8s ease-in-out .9s infinite",c:"✦"},
  {l:"18%",t:"89%",s:14,an:"is-twinkle 3.7s ease-in-out .3s infinite",c:"✦"},
  {l:"72%",t:"63%",s:13,an:"is-twinkle 3.5s ease-in-out 1.4s infinite",c:"✧"},
  {l:"40%",t:"82%",s:11,an:"is-twinkle2 2.9s ease-in-out .7s infinite",c:"⋆"},
  {l:"58%",t:"90%",s:12,an:"is-twinkle 4s ease-in-out 1.1s infinite",c:"✧"},
];

export function LoginScreen() {
  const searchParams = useSearchParams();
  const { lang } = useLang();
  const { theme } = useTheme();
  const { palette } = useColorPalette();
  const t = getDict(lang);
  const login = useLogin();
  const isDark = theme === "dark";
  const C = isDark ? loginPageTokens(DK, palette, true) : LT;

  // Already signed in, or recover from stale is_authenticated cookie without a JWT.
  useEffect(() => {
    if (getAccessToken()) {
      navigateAfterLogin();
      return;
    }
    if (document.cookie.includes("is_authenticated=")) {
      clearTokens();
    }
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const [emailFocus, setEmailFocus] = useState(false);
  const [pwFocus, setPwFocus] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const emailReg = register("email");
  const pwReg = register("password");
  const sessionExpired = searchParams.get("reason") === "session_expired";
  const loginError =
    login.isError && login.error
      ? (() => {
          const err = login.error as { response?: { data?: { detail?: string; email?: string[] } } };
          return (
            err.response?.data?.detail ??
            err.response?.data?.email?.[0] ??
            "Invalid credentials. Please try again."
          );
        })()
      : null;

  const onA = (c: boolean) => c ? "linear-gradient(120deg,#c69049,#a36f2a)" : "transparent";
  const onF = (c: boolean) => c ? (theme === "dark" ? "#1a1206" : "#fff") : C.muted;

  return (
    <div style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 22px", overflow:"hidden", background:C.pageGrad, color:C.text, fontFamily:"var(--font-outfit)", transition:"background .4s,color .4s" }}>

      {/* ── Grain ── */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", opacity: theme === "dark" ? .045 : .025, mixBlendMode:"multiply", backgroundImage:"url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')" }} />

      {/* ── Floating orbs ── */}
      <div style={{ position:"absolute", left:"5%", top:"15%", width:"380px", height:"380px", borderRadius:"50%", background:C.orb1, filter:"blur(70px)", animation:"orb-float-a 12s ease-in-out infinite", pointerEvents:"none", opacity:.85 }} />
      <div style={{ position:"absolute", right:"4%", bottom:"12%", width:"340px", height:"340px", borderRadius:"50%", background:C.orb2, filter:"blur(80px)", animation:"orb-float-b 15s ease-in-out infinite", pointerEvents:"none", opacity:.7 }} />
      <div style={{ position:"absolute", left:"38%", bottom:"5%", width:"280px", height:"280px", borderRadius:"50%", background:C.orb3, filter:"blur(60px)", animation:"orb-float-c 10s ease-in-out infinite", pointerEvents:"none", opacity:.6 }} />

      {/* ── Concentric rings ── */}
      {[
        {sz:680, brd:`1px solid ${C.ringColor}0.08)`, spd:"100s", dir:1},
        {sz:520, brd:`1px dashed ${C.ringColor}0.12)`, spd:"70s", dir:-1},
        {sz:400, brd:`1px solid ${C.ringColor}0.09)`, spd:"55s", dir:1},
        {sz:280, brd:`1px dashed ${C.ringColor}0.07)`, spd:"40s", dir:-1},
      ].map((r, i) => (
        <div key={i} style={{ position:"absolute", left:"50%", top:"44%", width:`${r.sz}px`, height:`${r.sz}px`, maxWidth:"140vw", transform:"translate(-50%,-50%)", border:r.brd, borderRadius:"50%", animation:`${r.dir > 0 ? "is-spin" : "is-spinrev"} ${r.spd} linear infinite`, pointerEvents:"none" }} />
      ))}

      {/* Logo ring pulse */}
      <div style={{ position:"absolute", left:"50%", top:"44%", width:"220px", height:"220px", transform:"translate(-50%,-50%)", borderRadius:"50%", background:`radial-gradient(circle,${C.ringColor}0.18),transparent 65%)`, animation:"logo-ring 8s ease-in-out infinite", pointerEvents:"none" }} />

      {/* ── Stars (dark only) / Light particles ── */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        {STARS.map((s, i) => (
          <span key={i} style={{ position:"absolute", left:s.l, top:s.t, fontSize:`${s.s}px`, color:C.starColor, textShadow:`0 0 12px ${C.starColor}aa`, animation:s.an, opacity: theme === "light" ? 0.4 : 1 }}>{s.c}</span>
        ))}
        {/* Shooting stars */}
        <span style={{ position:"absolute", left:"10%", top:"18%", width:"64px", height:"1.5px", borderRadius:"2px", background:`linear-gradient(90deg,${C.starColor},transparent)`, boxShadow:`0 0 8px ${C.starColor}cc`, animation:"is-shoot 7s ease-in 2s infinite" }} />
        <span style={{ position:"absolute", left:"60%", top:"10%", width:"50px", height:"1.4px", borderRadius:"2px", background:`linear-gradient(90deg,${C.starColor},transparent)`, boxShadow:`0 0 8px ${C.starColor}cc`, animation:"is-shoot 9s ease-in 5.5s infinite" }} />
        <span style={{ position:"absolute", left:"75%", top:"55%", width:"40px", height:"1.2px", borderRadius:"2px", background:`linear-gradient(90deg,${C.starColor},transparent)`, boxShadow:`0 0 6px ${C.starColor}aa`, animation:"is-shoot 11s ease-in 3.2s infinite" }} />
      </div>

      {/* ── Top-right controls (lang + color) ── */}
      <div style={{ position:"absolute", top:"20px", right:"22px", display:"flex", alignItems:"center", gap:"10px", zIndex:10 }}>
        <ColorToggle btnBg={C.langBg} btnBdr={C.cardBorder} menuInactive={C.muted} />
        <div style={{ display:"flex", background:C.langBg, border:`1px solid ${C.cardBorder}`, borderRadius:"9px", padding:"3px", backdropFilter:"blur(8px)" }}>
          {(["en","so"] as const).map(l => (
            <button key={l} onClick={() => {}} style={{ border:"none", cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize:"12px", fontWeight:600, padding:"4px 10px", borderRadius:"6px", transition:".25s", background:onA(lang===l), color:onF(lang===l), textTransform:"uppercase" }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Main card ── */}
      <div style={{ position:"relative", width:"100%", maxWidth:"430px", textAlign:"center", animation:"is-fadeUp .7s ease both" }}>

        {/* Emblem + title */}
        <div style={{ position:"relative", display:"inline-flex", flexDirection:"column", alignItems:"center", marginBottom:"6px" }}>
          {/* Emblem halo */}
          <div style={{ position:"absolute", top:"50%", left:"50%", width:"110px", height:"110px", transform:"translate(-50%,-50%)", borderRadius:"50%", background:`radial-gradient(circle,${C.ringColor}0.28),transparent 70%)`, animation:"is-halo 4.5s ease-in-out infinite", pointerEvents:"none" }} />
          {/* Emblem */}
          <div style={{ width:"64px", height:"64px", WebkitMaskImage:"url('/emblem.png')", WebkitMaskSize:"contain", WebkitMaskRepeat:"no-repeat", WebkitMaskPosition:"center", maskImage:"url('/emblem.png')", maskSize:"contain", maskRepeat:"no-repeat", maskPosition:"center", background:"linear-gradient(135deg,#f5dca6,#c69049 55%,#7a4e15)", filter:"drop-shadow(0 0 12px rgba(198,144,73,.7))", animation:"is-float 5s ease-in-out infinite" }} />
        </div>

        {/* Decorative dots */}
        <div style={{ fontSize:"16px", letterSpacing:".5em", color:"#e2b667", textShadow:"0 0 14px rgba(226,182,103,.7)", animation:"is-glow 4s ease-in-out infinite", paddingLeft:".5em", marginTop:"12px" }}>✦ ✧ ✦</div>

        <h1 className="lmsbr-title" style={{ fontFamily:"var(--font-cinzel)", fontWeight:800, fontSize:"clamp(48px,10vw,64px)", letterSpacing:".16em", margin:"10px 0 0", paddingLeft:".16em", backgroundImage:C.titleGrad, filter:`drop-shadow(0 2px 20px ${C.ringColor}0.45))` }}>LMSBR</h1>
        <div style={{ fontFamily:"var(--font-cinzel)", fontSize:"11.5px", letterSpacing:".38em", color:C.sub, marginTop:"5px", textTransform:"uppercase" }}>{t.systemName}</div>

        {/* Card */}
        <div style={{ marginTop:"28px", padding:"32px 30px", borderRadius:"24px", background:C.cardBg, border:`1px solid ${C.cardBorder}`, boxShadow:C.cardShadow, textAlign:"left", backdropFilter:"blur(16px)", animation: isDark ? "card-glow 5s ease-in-out infinite" : "none", WebkitBackdropFilter:"blur(16px)", transition:"background .4s,border-color .4s,box-shadow .4s" }}>

          {/* Card top accent line */}
          <div style={{ position:"absolute", top:0, left:"10%", right:"10%", height:"2px", background: isDark ? `linear-gradient(90deg,transparent,${C.ringColor}0.55),transparent)` : "linear-gradient(90deg,transparent,rgba(198,144,73,0.65),transparent)", borderRadius:"2px" }} />

          <form onSubmit={handleSubmit(d => login.mutate(d))}>
            {sessionExpired && (
              <div style={{ marginBottom:"18px", padding:"12px 14px", borderRadius:"12px", background:"rgba(224,101,90,.08)", border:"1px solid rgba(224,101,90,.28)", color:"#e0655a", fontSize:"13px", lineHeight:1.45 }}>
                {t.sessionExpired}
              </div>
            )}
            {loginError && (
              <div style={{ marginBottom:"18px", padding:"12px 14px", borderRadius:"12px", background:"rgba(224,101,90,.08)", border:"1px solid rgba(224,101,90,.28)", color:"#e0655a", fontSize:"13px", lineHeight:1.45 }}>
                {loginError}
              </div>
            )}
            {/* Email */}
            <label style={{ display:"block", fontSize:"12.5px", letterSpacing:".06em", color:C.muted, marginBottom:"8px", fontWeight:500, textTransform:"uppercase" }}>{t.email}</label>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"13px 15px", borderRadius:"12px", background:C.inputBg, border:`1.5px solid ${emailFocus ? C.inputFocus : C.inputBorder}`, marginBottom:errors.email ? "8px" : "20px", transition:".25s", boxShadow: emailFocus ? `0 0 0 3px ${C.ringColor}0.12)` : "none" }}>
              <span style={{ display:"flex", color: emailFocus ? "#c69049" : C.muted, transition:".25s", flexShrink:0 }}><Icon name="mail" size={16} sw={1.8} /></span>
              <input type="email" placeholder="admin@lmsbr.so" autoComplete="email"
                onFocus={() => setEmailFocus(true)}
                {...emailReg}
                onBlur={e => { setEmailFocus(false); emailReg.onBlur(e); }}
                style={{ flex:1, border:"none", outline:"none", background:"transparent", color:C.inputText, fontFamily:"var(--font-outfit)", fontSize:"15px" }}
              />
            </div>
            {errors.email && <p style={{ color:"#e0655a", fontSize:"12px", marginTop:"-14px", marginBottom:"14px" }}>{errors.email.message}</p>}

            {/* Password */}
            <label style={{ display:"block", fontSize:"12.5px", letterSpacing:".06em", color:C.muted, marginBottom:"8px", fontWeight:500, textTransform:"uppercase" }}>{t.password}</label>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"13px 15px", borderRadius:"12px", background:C.inputBg, border:`1.5px solid ${pwFocus ? C.inputFocus : C.inputBorder}`, marginBottom:errors.password ? "8px" : "22px", transition:".25s", boxShadow: pwFocus ? `0 0 0 3px ${C.ringColor}0.12)` : "none" }}>
              <span style={{ display:"flex", color: pwFocus ? "#c69049" : C.muted, transition:".25s", flexShrink:0 }}><Icon name="lock" size={16} sw={1.8} /></span>
              <input type={showPw ? "text" : "password"} placeholder="••••••••" autoComplete="current-password"
                onFocus={() => setPwFocus(true)}
                {...pwReg}
                onBlur={e => { setPwFocus(false); pwReg.onBlur(e); }}
                style={{ flex:1, border:"none", outline:"none", background:"transparent", color:C.inputText, fontFamily:"var(--font-outfit)", fontSize:"15px", letterSpacing: showPw ? "normal" : ".1em" }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ display:"flex", border:"none", background:"transparent", color:C.muted, cursor:"pointer", padding:"2px", transition:".2s" }}>
                {showPw
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {errors.password && <p style={{ color:"#e0655a", fontSize:"12px", marginTop:"-14px", marginBottom:"14px" }}>{errors.password.message}</p>}

            {/* Submit */}
            <button type="submit" disabled={login.isPending} style={{ position:"relative", overflow:"hidden", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:"9px", padding:"15px", border:"1px solid rgba(245,220,166,0.3)", borderRadius:"13px", background: login.isPending ? "rgba(198,144,73,0.5)" : C.btnGrad, color:"#fff", fontFamily:"var(--font-outfit)", fontWeight:700, fontSize:"15px", letterSpacing:".04em", cursor: login.isPending ? "wait" : "pointer", boxShadow:C.btnShadow, transition:".3s" }}
              onMouseEnter={e => { if (!login.isPending) { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 20px 50px -16px rgba(198,144,73,.9)"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = C.btnShadow; }}
            >
              {/* Shine sweep on hover */}
              <div style={{ position:"absolute", top:0, left:0, width:"40%", height:"100%", background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)", animation:"btn-shine 3.5s ease-in-out 1s infinite", pointerEvents:"none" }} />
              {login.isPending
                ? <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ animation:"is-spin 0.8s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Signing in…</>
                : <><span style={{ display:"flex" }}><Icon name="lock" size={17} sw={2} /></span>{t.signIn}</>
              }
            </button>
          </form>

          {/* Footer row */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"20px", paddingTop:"18px", borderTop:`1px solid ${C.divider}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#46c08a", boxShadow:"0 0 6px rgba(70,192,138,.6)", display:"inline-block" }} />
              <span style={{ fontSize:"12px", color:C.muted }}>{t.secure}</span>
            </div>
            <div style={{ display:"flex", background:C.langBg, border:`1px solid ${C.cardBorder}`, borderRadius:"9px", padding:"3px" }}>
              {(["en","so"] as const).map(l => (
                <button key={l} onClick={() => {}} style={{ border:"none", cursor:"pointer", fontFamily:"var(--font-outfit)", fontSize:"11.5px", fontWeight:600, padding:"4px 9px", borderRadius:"6px", transition:".25s", background:onA(lang===l), color:onF(lang===l), textTransform:"uppercase" }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom caption */}
        <p style={{ marginTop:"20px", fontSize:"12px", color:C.muted, opacity:.6 }}>© 2026 LMSBR · All rights reserved</p>
      </div>
    </div>
  );
}
