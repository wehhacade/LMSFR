"use client";

import { useTheme } from "./theme-ctx";

function useShimmerColors() {
  const { theme } = useTheme();
  return theme === "dark"
    ? { base: "rgba(255,255,255,0.04)", wave: "rgba(255,220,140,0.10)", border: "rgba(214,176,114,0.12)" }
    : { base: "rgba(0,0,0,0.04)", wave: "rgba(255,255,255,0.55)", border: "#E5E7EB" };
}

const LIGHT_SHIMMER_BG = "#FFFFFF"; // cards are white; shimmer placeholder matches

export function ShimmerBlock({ w = "100%", h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  const c = useShimmerColors();
  return (
    <div style={{ width: w, height:`${h}px`, borderRadius:`${radius}px`, background: c.base, border:`1px solid ${c.border}`, overflow:"hidden", position:"relative" }}>
      <div style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent 0%,${c.wave} 50%,transparent 100%)`, animation:"shimmer-sweep 1.6s ease-in-out infinite" }} />
    </div>
  );
}

export function ShimmerText({ lines = 3, lastWidth = "60%" }: { lines?: number; lastWidth?: string }) {
  const c = useShimmerColors();
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ width: i === lines - 1 ? lastWidth : "100%", height:"13px", borderRadius:"6px", background:c.base, overflow:"hidden", position:"relative" }}>
          <div style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent,${c.wave},transparent)`, animation:`shimmer-sweep 1.6s ease-in-out ${i * 0.1}s infinite` }} />
        </div>
      ))}
    </div>
  );
}

export function ShimmerCard() {
  const { theme } = useTheme();
  const c = useShimmerColors();
  const bg = theme === "dark" ? "linear-gradient(160deg,#120d08,#0a0704)" : LIGHT_SHIMMER_BG;
  return (
    <div style={{ padding:"22px 20px", borderRadius:"16px", background:bg, border:`1px solid ${c.border}`, display:"flex", flexDirection:"column", gap:"16px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
        <div style={{ width:"46px", height:"46px", borderRadius:"13px", background:c.base, flexShrink:0, overflow:"hidden", position:"relative" }}>
          <div style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent,${c.wave},transparent)`, animation:"shimmer-sweep 1.6s ease-in-out infinite" }} />
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"8px" }}>
          <ShimmerBlock h={14} radius={6} />
          <ShimmerBlock w="55%" h={11} radius={5} />
        </div>
      </div>
      <ShimmerText lines={3} lastWidth="45%" />
    </div>
  );
}

export function ShimmerRow() {
  const c = useShimmerColors();
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"16px", padding:"14px 0", borderBottom:`1px solid ${c.border}` }}>
      <ShimmerBlock w={120} h={13} radius={6} />
      <ShimmerBlock w={100} h={13} radius={6} />
      <ShimmerBlock w={80} h={13} radius={6} />
      <div style={{ marginLeft:"auto" }}><ShimmerBlock w={70} h={24} radius={12} /></div>
    </div>
  );
}

export function ShimmerList({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display:"flex", flexDirection:"column" }}>
      {Array.from({ length: rows }).map((_, i) => <ShimmerRow key={i} />)}
    </div>
  );
}

export function ShimmerKPI() {
  const c = useShimmerColors();
  const { theme } = useTheme();
  const bg = theme === "dark" ? "linear-gradient(160deg,#120d08,#0a0704)" : LIGHT_SHIMMER_BG;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"16px" }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{ padding:"22px 20px", borderRadius:"16px", background:bg, border:`1px solid ${c.border}`, display:"flex", flexDirection:"column", gap:"14px", animationDelay:`${i*0.08}s` }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <div style={{ width:"46px", height:"46px", borderRadius:"13px", background:c.base, overflow:"hidden", position:"relative" }}>
              <div style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent,${c.wave},transparent)`, animation:`shimmer-sweep 1.6s ease-in-out ${i*0.12}s infinite` }} />
            </div>
            <ShimmerBlock w={54} h={24} radius={12} />
          </div>
          <ShimmerBlock h={32} radius={8} />
          <ShimmerBlock w="65%" h={12} radius={5} />
        </div>
      ))}
    </div>
  );
}

export function ShimmerSuspectCard() {
  const c = useShimmerColors();
  const { theme } = useTheme();
  const bg = theme === "dark" ? "linear-gradient(160deg,#120d08,#0a0704)" : LIGHT_SHIMMER_BG;
  return (
    <div style={{ borderRadius:"16px", overflow:"hidden", background:bg, border:`1px solid ${c.border}`, display:"flex", flexDirection:"column" }}>
      <div style={{ position:"relative", width:"100%", aspectRatio:"4/3", background:c.base, overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent,${c.wave},transparent)`, animation:"shimmer-sweep 1.6s ease-in-out infinite" }} />
      </div>
      <div style={{ padding:"16px 18px 18px", display:"flex", flexDirection:"column", gap:"10px" }}>
        <ShimmerBlock h={16} radius={6} />
        <ShimmerBlock w="70%" h={12} radius={5} />
        <div style={{ display:"flex", gap:"8px", marginTop:"4px" }}>
          <ShimmerBlock w={72} h={24} radius={12} />
          <ShimmerBlock w={56} h={24} radius={12} />
        </div>
      </div>
    </div>
  );
}

export function ShimmerSuspectGrid({ count = 8 }: { count?: number }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:"18px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ animation:"is-fadeUp .4s ease both", animationDelay:`${i * 0.05}s` }}>
          <ShimmerSuspectCard />
        </div>
      ))}
    </div>
  );
}

export function ShimmerSuspectRow() {
  const c = useShimmerColors();
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"16px", padding:"14px 20px", borderBottom:`1px solid ${c.border}` }}>
      <div style={{ width:52, height:52, borderRadius:14, background:c.base, flexShrink:0, overflow:"hidden", position:"relative" }}>
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent,${c.wave},transparent)`, animation:"shimmer-sweep 1.6s ease-in-out infinite" }} />
      </div>
      <div style={{ flex:1, display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 0.8fr 0.8fr", gap:"12px", alignItems:"center" }}>
        <ShimmerBlock h={14} radius={6} />
        <ShimmerBlock h={13} radius={6} />
        <ShimmerBlock h={13} radius={6} />
        <ShimmerBlock h={24} radius={12} />
        <ShimmerBlock h={24} radius={12} />
      </div>
    </div>
  );
}

export function ShimmerSuspectList({ rows = 6 }: { rows?: number }) {
  const c = useShimmerColors();
  const { theme } = useTheme();
  const bg = theme === "dark" ? "linear-gradient(160deg,#110c07,#090603)" : LIGHT_SHIMMER_BG;
  return (
    <div style={{ borderRadius:"14px", overflow:"hidden", background:bg, border:`1px solid ${c.border}` }}>
      <div style={{ padding:"14px 20px", borderBottom:`1px solid ${c.border}`, display:"grid", gridTemplateColumns:"52px 1fr", gap:"16px" }}>
        <div />
        <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 0.8fr 0.8fr", gap:"12px" }}>
          {[0,1,2,3,4].map(i => <ShimmerBlock key={i} h={11} radius={5} />)}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => <ShimmerSuspectRow key={i} />)}
    </div>
  );
}

export function ShimmerForcesRow() {
  const c = useShimmerColors();
  return (
    <div style={{ display:"grid", gridTemplateColumns:"52px 1.8fr 0.9fr 0.9fr 1fr 1fr 0.8fr", alignItems:"center", gap:"12px", padding:"14px 20px", borderBottom:`1px solid ${c.border}` }}>
      <div style={{ width:40, height:40, borderRadius:10, background:c.base, flexShrink:0, overflow:"hidden", position:"relative" }}>
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent,${c.wave},transparent)`, animation:"shimmer-sweep 1.6s ease-in-out infinite" }} />
      </div>
      {[0,1,2,3,4,5].map(i => <ShimmerBlock key={i} h={13} radius={6} />)}
    </div>
  );
}

export function ShimmerForcesTable({ rows = 8 }: { rows?: number }) {
  const c = useShimmerColors();
  const { theme } = useTheme();
  const bg = theme === "dark" ? "linear-gradient(160deg,#110c07,#090603)" : LIGHT_SHIMMER_BG;
  return (
    <div style={{ borderRadius:"14px", overflow:"hidden", background:bg, border:`1px solid ${c.border}` }}>
      <div style={{ padding:"14px 20px", borderBottom:`1px solid ${c.border}`, display:"grid", gridTemplateColumns:"52px 1.8fr 0.9fr 0.9fr 1fr 1fr 0.8fr", gap:"12px" }}>
        <div />
        {[0,1,2,3,4,5].map(i => <ShimmerBlock key={i} h={11} radius={5} />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => <ShimmerForcesRow key={i} />)}
    </div>
  );
}

export function ShimmerSuspectProfile() {
  const c = useShimmerColors();
  const { theme } = useTheme();
  const bg = theme === "dark" ? "linear-gradient(160deg,#120d08,#0a0704)" : LIGHT_SHIMMER_BG;
  return (
    <div className="lmsbr-split-aside" style={{ display:"grid", gridTemplateColumns:"minmax(260px,320px) 1fr", gap:"24px", animation:"is-fadeUp .4s ease both" }}>
      <div style={{ borderRadius:"18px", overflow:"hidden", background:bg, border:`1px solid ${c.border}` }}>
        <div style={{ aspectRatio:"3/4", background:c.base, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, background:`linear-gradient(90deg,transparent,${c.wave},transparent)`, animation:"shimmer-sweep 1.6s ease-in-out infinite" }} />
        </div>
        <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:"10px" }}>
          <ShimmerBlock h={22} radius={8} />
          <ShimmerBlock w="60%" h={14} radius={6} />
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
        <div style={{ padding:"24px", borderRadius:"16px", background:bg, border:`1px solid ${c.border}`, display:"flex", flexDirection:"column", gap:"14px" }}>
          <ShimmerBlock w="40%" h={18} radius={6} />
          <ShimmerText lines={4} />
        </div>
        <div style={{ padding:"24px", borderRadius:"16px", background:bg, border:`1px solid ${c.border}` }}>
          <ShimmerBlock w="30%" h={16} radius={6} />
          <div style={{ marginTop:"16px" }}><ShimmerText lines={5} lastWidth="80%" /></div>
        </div>
      </div>
    </div>
  );
}
