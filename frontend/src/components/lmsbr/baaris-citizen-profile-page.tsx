"use client";

import { useState } from "react";
import { useLang } from "./lang-ctx";
import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { SuspectPhoto } from "./suspect-photo";
import { ShimmerSuspectProfile } from "./shimmer";
import { useBaarisCitizenDetail } from "@/hooks/use-baaris";
import type { AccountsThemeColors } from "./accounts-shared";

type ThemeColors = AccountsThemeColors & {
  cardShadow?: string;
  panelShadow?: string;
  tableSep: string;
};

type TabId = "aqoonsi" | "degganaan" | "shaqo" | "dukumenti" | "sarkaalka";

function Panel({ children, C }: { children: React.ReactNode; C: ThemeColors }) {
  return (
    <div style={{
      padding: "22px 24px", borderRadius: 16, background: C.panelBg,
      border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow,
    }}>
      {children}
    </div>
  );
}

function FieldCard({
  label, value, C, accent, isDark, highlight,
}: {
  label: string; value: string; C: ThemeColors; accent: string; isDark: boolean; highlight?: boolean;
}) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      background: isDark ? "rgba(255,255,255,0.02)" : C.tableHead ?? C.inputBg,
      border: `1px solid ${C.tableSep}`,
    }}>
      <div style={{
        fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
        color: C.txtMuted, fontFamily: "var(--font-outfit)", marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 15, fontWeight: highlight ? 600 : 500,
        color: highlight ? accent : C.txtPrimary, fontFamily: "var(--font-outfit)",
      }}>{value || "—"}</div>
    </div>
  );
}

function txt(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v);
}

export function BaarisCitizenProfilePage({
  citizenId, onBack, C, accent, isDark,
}: {
  citizenId: number;
  onBack: () => void;
  C: ThemeColors;
  accent: string;
  isDark: boolean;
}) {
  const { lang } = useLang();
  const so = lang === "so";
  const { data, isLoading, isError } = useBaarisCitizenDetail(citizenId, true);
  const [tab, setTab] = useState<TabId>("aqoonsi");

  if (isLoading) return <ShimmerSuspectProfile />;

  if (isError || !data) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", borderRadius: 14, background: C.panelBg, border: `1px solid ${C.cardBdr}` }}>
        <p style={{ color: C.txtSecondary }}>{so ? "Lama helin" : "Not found"}</p>
        <button type="button" onClick={onBack} style={{
          marginTop: 16, padding: "10px 18px", borderRadius: 10,
          border: `1px solid ${hexA(accent, 0.35)}`, background: hexA(accent, 0.1),
          color: accent, cursor: "pointer",
        }}>{so ? "Dib u noqo" : "Back"}</button>
      </div>
    );
  }

  const p = { ...(data.identity ?? {}), ...(data.profile ?? {}) } as Record<string, unknown>;
  const name = txt(p.name);
  const photo = p.photo ? String(p.photo) : undefined;
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "aqoonsi", label: so ? "Aqoonsi" : "Identity", icon: "users" },
    { id: "degganaan", label: so ? "Degganaansho" : "Residence", icon: "map" },
    { id: "shaqo", label: so ? "Shaqo & Qoys" : "Work & Family", icon: "clipboard" },
    { id: "dukumenti", label: so ? "Dukumentiyo" : "Documents", icon: "badge" },
    { id: "sarkaalka", label: so ? "Sarkaalka" : "Officer", icon: "shield" },
  ];

  return (
    <div style={{ animation: "is-fadeUp .45s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px",
            borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.cardBg,
            color: C.txtSecondary, cursor: "pointer", fontFamily: "var(--font-outfit)", fontSize: 13.5,
          }}
        >
          <span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="arrow" size={15} sw={2} /></span>
          {so ? "Liiska" : "Back to list"}
        </button>
      </div>

      <div className="lmsbr-split-aside" style={{ display: "grid", gridTemplateColumns: "minmax(240px,300px) 1fr", gap: 24, alignItems: "start" }}>
        <div style={{
          borderRadius: 18, overflow: "hidden", background: C.cardBg,
          border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow,
        }}>
          <div style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden" }}>
            <SuspectPhoto
              photo={photo}
              alt={name}
              loading="eager"
              fallback={
                <div style={{
                  width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(160deg,${hexA(accent, 0.35)},${hexA(accent, 0.08)})`,
                  fontFamily: "var(--font-cinzel)", fontSize: 48, fontWeight: 700, color: hexA(accent, 0.7),
                }}>{initials || "?"}</div>
              }
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 55%,rgba(0,0,0,0.85) 100%)" }} />
            <div style={{ position: "absolute", top: 14, left: 14 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 20,
                background: hexA(accent, 0.92), color: "#fff", fontFamily: "var(--font-outfit)",
              }}>Baaris</span>
            </div>
          </div>
          <div style={{ padding: "20px 22px 24px" }}>
            <h2 style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 22, color: C.txtPrimary, margin: 0, lineHeight: 1.25 }}>
              {name}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: C.txtMuted }}>
              {txt(p.mother) !== "—" ? `${so ? "Hooyo" : "Mother"}: ${txt(p.mother)}` : ""}
            </p>
            <div style={{
              marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.tableSep}`,
              display: "flex", flexDirection: "column", gap: 10, fontSize: 13.5, color: C.txtSecondary,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", color: accent }}><Icon name="map" size={16} sw={1.8} /></span>
                {txt(p.degmada || p.district)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", color: accent }}><Icon name="users" size={16} sw={1.8} /></span>
                {txt(p.tnumber || p.phone || p.hormuud)}
              </div>
              <div style={{ fontSize: 12, color: C.txtMuted }}>{txt(p.case_ref)}</div>
            </div>
          </div>
        </div>

        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 2, borderBottom: `1px solid ${C.tableSep}`,
            marginBottom: 24, overflowX: "auto",
          }}>
            {tabs.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "11px 16px", border: "none",
                    cursor: "pointer", background: "transparent", fontFamily: "var(--font-outfit)",
                    fontSize: 13.5, fontWeight: on ? 600 : 400,
                    color: on ? accent : C.txtMuted,
                    borderBottom: on ? `2px solid ${accent}` : "2px solid transparent",
                    marginBottom: -1, whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ display: "flex" }}><Icon name={t.icon} size={15} sw={on ? 2.2 : 1.8} /></span>
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "aqoonsi" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Panel C={C}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18, color: C.txtPrimary, marginBottom: 20 }}>
                  {so ? "Xogta aqoonsiga" : "Identity details"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
                  <FieldCard label={so ? "Magaca" : "Name"} value={name} C={C} accent={accent} isDark={isDark} highlight />
                  <FieldCard label={so ? "Hooyo" : "Mother"} value={txt(p.mother)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Jinsi" : "Gender"} value={txt(p.gender)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Dhalasho" : "DOB"} value={txt(p.Dob || p.date_of_birth)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Da'da" : "Age"} value={txt(p.age_reported)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Qabiil" : "Clan"} value={txt(p.qabiilka || p.tribe)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Gobolka" : "Origin region"} value={txt(p.gobolka_kasoo_jeedo)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label="Case ref" value={txt(p.case_ref)} C={C} accent={accent} isDark={isDark} highlight />
                </div>
              </Panel>
              {(txt(p.qoraallo_dheeraad) !== "—" || txt(p.description) !== "—") && (
                <Panel C={C}>
                  <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18, color: C.txtPrimary, marginBottom: 14 }}>
                    {so ? "Qoraallo" : "Notes"}
                  </div>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: C.txtSecondary, whiteSpace: "pre-wrap" }}>
                    {txt(p.qoraallo_dheeraad !== "—" ? p.qoraallo_dheeraad : p.description)}
                  </p>
                </Panel>
              )}
            </div>
          )}

          {tab === "degganaan" && (
            <Panel C={C}>
              <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18, color: C.txtPrimary, marginBottom: 20 }}>
                {so ? "Degganaanshaha" : "Residence"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
                <FieldCard label={so ? "Degmo" : "District"} value={txt(p.degmada || p.district)} C={C} accent={accent} isDark={isDark} highlight />
                <FieldCard label={so ? "Waaxda" : "Section"} value={txt(p.waaxda)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Xaafadda" : "Neighborhood"} value={txt(p.xaafadda)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Ijaar / Milkiyad" : "Rent / Own"} value={txt(p.ijaar_ama_milkiyad)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Mudada" : "Duration"} value={txt(p.mudada_uu_deggan_yahay)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Yaa ka ijaaray" : "Landlord"} value={txt(p.yaa_ka_ijaaray)} C={C} accent={accent} isDark={isDark} />
              </div>
              {txt(p.deegaannadiisa_hore) !== "—" && (
                <p style={{ margin: "18px 0 0", fontSize: 14, color: C.txtSecondary, lineHeight: 1.6 }}>
                  <strong style={{ color: C.txtMuted }}>{so ? "Deegaanno hore: " : "Previous areas: "}</strong>
                  {txt(p.deegaannadiisa_hore)}
                </p>
              )}
            </Panel>
          )}

          {tab === "shaqo" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Panel C={C}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18, color: C.txtPrimary, marginBottom: 20 }}>
                  {so ? "Xiriir & Shaqo" : "Contact & Work"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
                  <FieldCard label="Hormuud" value={txt(p.hormuud || p.tnumber || p.phone)} C={C} accent={accent} isDark={isDark} highlight />
                  <FieldCard label="Somnet" value={txt(p.somnet)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label="Somtel" value={txt(p.somtel)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Nuuca shaqada" : "Job type"} value={txt(p.nuuca_shaqada || p.occupation)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Goobta" : "Workplace"} value={txt(p.goobta_shaqada)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Maamule" : "Manager"} value={txt(p.maamulaha_shaqada)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Muddo" : "Duration"} value={txt(p.muddada_shaqada)} C={C} accent={accent} isDark={isDark} />
                </div>
              </Panel>
              <Panel C={C}>
                <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18, color: C.txtPrimary, marginBottom: 20 }}>
                  {so ? "Qoyska" : "Family"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
                  <FieldCard label={so ? "Guurka" : "Marital"} value={txt(p.xaaladda_guurka || p.marital)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Carruurta" : "Children"} value={txt(p.tirada_carruurta ?? p.children)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Dadka guriga" : "Household"} value={txt(p.tirada_dadka_guriga)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Qof degdeg" : "Emergency"} value={txt(p.qof_degdeg)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Nabadoon" : "Nabadoon"} value={txt(p.nabadoonkiisa)} C={C} accent={accent} isDark={isDark} />
                  <FieldCard label={so ? "Horay maloo xiray" : "Previously jailed"} value={txt(p.horay_maloo_xiray || p.jailed)} C={C} accent={accent} isDark={isDark} />
                </div>
              </Panel>
            </div>
          )}

          {tab === "dukumenti" && (
            <Panel C={C}>
              <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18, color: C.txtPrimary, marginBottom: 20 }}>
                {so ? "Dukumentiyo & Gaadiid" : "Documents & Vehicle"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
                <FieldCard label="NIRA" value={txt(p.nira || p.lambarka_diiwaanka)} C={C} accent={accent} isDark={isDark} highlight />
                <FieldCard label={so ? "Baasaboor" : "Passport"} value={txt(p.baasaboor)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label="License" value={txt(p.license_doc)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Gaadiid" : "Vehicle"} value={txt(p.gaadiid_nooca)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Taargada" : "Plate"} value={txt(p.gaadiid_taargada)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Lisence gaadiid" : "Vehicle license"} value={txt(p.gaadiid_lisence)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Milkiyad/Ijaar" : "Own/Rent"} value={txt(p.gaadiid_milkiyad_mise_ijaar)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Calaamado" : "Marks"} value={txt(p.calaamado_aqoonsi)} C={C} accent={accent} isDark={isDark} />
              </div>
            </Panel>
          )}

          {tab === "sarkaalka" && (
            <Panel C={C}>
              <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 18, color: C.txtPrimary, marginBottom: 20 }}>
                {so ? "Xaqiijinta sarkaalka" : "Officer verification"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
                <FieldCard label={so ? "Sarkaalka" : "Officer"} value={txt(p.sarkaalka_magaca || p.registered_by)} C={C} accent={accent} isDark={isDark} highlight />
                <FieldCard label={so ? "Goobta" : "Place"} value={txt(p.goobta_xaqiijinta)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Taariikh" : "Date"} value={txt(p.taariikhda_xaqiijinta || p.date_opp || p.created_at)} C={C} accent={accent} isDark={isDark} />
                <FieldCard label={so ? "Lambarka foomka" : "Form no."} value={txt(p.form_number)} C={C} accent={accent} isDark={isDark} />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
