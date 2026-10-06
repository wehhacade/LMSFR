"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { useCounties, useCreateQeyb, useDeleteQeyb, useQeybs, useUpdateQeyb, useUsersForPicker } from "@/hooks/use-accounts";
import type { QeybItem } from "@/types/accounts";
import { resolveMediaUrl } from "@/lib/media-url";
import {
  AccountModal,
  ConfirmDialog,
  FormField,
  PrimaryButton,
  RowActions,
  SecondaryButton,
  TextInput,
  type AccountsThemeColors,
} from "./accounts-shared";
import { ShimmerForcesTable } from "./shimmer";

function countyIdNum(id: string | number) {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "");
  return (letters || "?").toUpperCase();
}

function SelectedTaliyeCard({
  name,
  phone,
  photo,
  onClear,
  clearLabel,
  C,
  accent,
}: {
  name: string;
  phone: string;
  photo?: string | null;
  onClear: () => void;
  clearLabel: string;
  C: AccountsThemeColors;
  accent: string;
}) {
  const src = resolveMediaUrl(photo);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${hexA(accent, 0.35)}`,
        background: hexA(accent, 0.1),
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          overflow: "hidden",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: hexA(accent, 0.22),
          color: accent,
          fontFamily: "var(--font-outfit)",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initialsFromName(name)}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-outfit)", fontWeight: 600, fontSize: 14, color: C.txtPrimary, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        {phone ? (
          <div style={{ fontFamily: "var(--font-outfit)", fontSize: 12.5, color: C.txtMuted, marginTop: 2 }}>{phone}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClear}
        title={clearLabel}
        aria-label={clearLabel}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: `1px solid ${C.inputBdr}`,
          background: C.inputBg,
          color: C.txtMuted,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="close" size={14} sw={2} />
      </button>
    </div>
  );
}

function QeybModal({
  open,
  onClose,
  initial,
  C,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  initial?: QeybItem | null;
  C: AccountsThemeColors;
  accent: string;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const create = useCreateQeyb();
  const update = useUpdateQeyb();
  const { data: counties = [] } = useCounties();
  const { data: qeybs = [] } = useQeybs();
  const [name, setName] = useState("");
  const [countyIds, setCountyIds] = useState<number[]>([]);
  const [countySearch, setCountySearch] = useState("");
  const [taliyeSearch, setTaliyeSearch] = useState("");
  const [taliyeId, setTaliyeId] = useState<number | null>(null);
  const [taliyeName, setTaliyeName] = useState("");
  const [taliyePhone, setTaliyePhone] = useState("");
  const [taliyePhoto, setTaliyePhoto] = useState<string | null>(null);
  const { data: usersPage } = useUsersForPicker(taliyeSearch);
  const pickerUsers = usersPage?.results ?? [];

  const clearTaliye = () => {
    setTaliyeId(null);
    setTaliyeName("");
    setTaliyePhone("");
    setTaliyePhoto(null);
    setTaliyeSearch("");
  };

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    const rawIds = (initial?.county_ids?.length ? initial.county_ids : initial?.counties?.map((c) => c.id)) ?? [];
    setCountyIds(rawIds.map((id) => Number(id)).filter((n) => Number.isFinite(n)));
    setCountySearch("");
    setTaliyeSearch("");
    setTaliyeId(initial?.taliye?.id ?? null);
    setTaliyeName(initial?.taliye?.name || "");
    setTaliyePhone(initial?.taliye?.phone || initial?.taliye?.username || "");
    setTaliyePhoto(null);
  }, [open, initial]);

  const takenByOther = useMemo(() => {
    const map = new Map<number, string>();
    for (const q of qeybs) {
      if (initial?.id && q.id === initial.id) continue;
      const ids = (q.county_ids?.length ? q.county_ids : q.counties?.map((c) => c.id)) ?? [];
      for (const raw of ids) {
        const id = countyIdNum(raw);
        if (id != null) map.set(id, q.name);
      }
    }
    return map;
  }, [qeybs, initial?.id]);

  const filteredCounties = useMemo(() => {
    const q = countySearch.trim().toLowerCase();
    const list = counties.filter((c) => !q || c.name.toLowerCase().includes(q));
    const rank = (c: (typeof counties)[number]) => {
      const id = countyIdNum(c.id);
      if (id != null && countyIds.includes(id)) return 0;
      if (id != null && takenByOther.has(id)) return 2;
      return 1;
    };
    return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [counties, countySearch, countyIds, takenByOther]);

  const toggleCounty = (rawId: string | number) => {
    const id = countyIdNum(rawId);
    if (id == null || takenByOther.has(id)) return;
    setCountyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = () => {
    const payload = {
      name: name.trim(),
      county_ids: countyIds,
      taliye_user_id: taliyeId,
    };
    if (initial) {
      update.mutate({ id: initial.id, payload }, { onSuccess: onClose });
      return;
    }
    create.mutate(payload, { onSuccess: onClose });
  };

  if (!open) return null;
  const pending = create.isPending || update.isPending;

  return (
    <AccountModal
      open={open}
      onClose={onClose}
      title={initial ? t.ucQeybEdit : t.ucQeybAdd}
      subtitle={t.ucQeybFormSub}
      C={C}
      accent={accent}
      size="xl"
      footer={
        <>
          <SecondaryButton onClick={onClose} C={C}>{t.cancelAction}</SecondaryButton>
          <PrimaryButton onClick={save} disabled={pending || !name.trim() || countyIds.length === 0} accent={accent}>
            {pending ? t.permSaving : t.userSave}
          </PrimaryButton>
        </>
      }
    >
      <FormField label={t.ucQeybName} required C={C}>
        <TextInput value={name} onChange={setName} placeholder="Qeebta Galbeed Sare" C={C} />
      </FormField>

      <FormField label={t.ucQeybTaliye} C={C}>
        {taliyeId && taliyeName ? (
          <SelectedTaliyeCard
            name={taliyeName}
            phone={taliyePhone}
            photo={taliyePhoto}
            onClear={clearTaliye}
            clearLabel={t.ucQeybTaliyeClear}
            C={C}
            accent={accent}
          />
        ) : null}
        <TextInput
          value={taliyeSearch}
          onChange={setTaliyeSearch}
          placeholder={taliyeId ? t.ucQeybTaliyePh : t.ucQeybTaliyePh}
          C={C}
        />
      </FormField>
      {taliyeSearch.trim().length >= 2 && (
        <div style={{ marginTop: -8, marginBottom: 14, maxHeight: 180, overflowY: "auto", border: `1px solid ${C.inputBdr}`, borderRadius: 12, background: C.cardBg }}>
          {pickerUsers.slice(0, 8).map((u) => {
            const label = u.full_name || u.username;
            const phone = u.phone || u.email || "";
            const src = resolveMediaUrl(u.profile_url);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  const id = Number(u.id);
                  setTaliyeId(Number.isFinite(id) ? id : null);
                  setTaliyeName(label);
                  setTaliyePhone(phone);
                  setTaliyePhoto(u.profile_url ?? null);
                  setTaliyeSearch("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  background: "transparent",
                  border: 0,
                  borderBottom: `1px solid ${C.tableSep}`,
                  color: C.txtPrimary,
                  cursor: "pointer",
                  fontFamily: "var(--font-outfit)",
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    overflow: "hidden",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: hexA(accent, 0.16),
                    color: accent,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initialsFromName(label)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                  {phone ? <span style={{ display: "block", fontSize: 12, color: C.txtMuted, marginTop: 2 }}>{phone}</span> : null}
                </span>
              </button>
            );
          })}
          {pickerUsers.length === 0 && (
            <div style={{ padding: "12px 14px", color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13 }}>{t.noUsers}</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: C.txtSecondary, fontFamily: "var(--font-outfit)", fontWeight: 600 }}>
          {t.ucQeybCounties} ({countyIds.length})<span style={{ color: "#e0655a", marginLeft: 3 }}>*</span>
        </span>
        <TextInput value={countySearch} onChange={setCountySearch} placeholder={t.ucQeybCountySearch} C={C} />
        <div style={{ fontSize: 12.5, color: C.txtMuted, fontFamily: "var(--font-outfit)", lineHeight: 1.4 }}>
          {t.ucQeybCountyHint}
        </div>
        <div
          className="qeeb-counties-grid"
          style={{
            maxHeight: 280,
            overflowY: "auto",
            border: `1px solid ${C.inputBdr}`,
            borderRadius: 14,
            padding: 10,
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {filteredCounties.map((c) => {
            const id = countyIdNum(c.id);
            const checked = id != null && countyIds.includes(id);
            const takenName = id != null && !checked ? takenByOther.get(id) : undefined;
            const taken = Boolean(takenName);
            return (
              <button
                key={String(c.id)}
                type="button"
                onClick={() => toggleCounty(c.id)}
                disabled={taken}
                title={taken ? `${c.name} — ${takenName}` : c.name}
                style={{
                  minHeight: taken ? 54 : 46,
                  padding: "8px 6px",
                  borderRadius: 10,
                  border: `1px solid ${checked ? hexA(accent, 0.55) : taken ? hexA("#9a8a6f", 0.35) : C.inputBdr}`,
                  background: checked ? hexA(accent, 0.16) : taken ? hexA("#9a8a6f", 0.08) : C.inputBg,
                  color: checked ? accent : taken ? C.txtMuted : C.txtPrimary,
                  cursor: taken ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-outfit)",
                  fontSize: 12.5,
                  fontWeight: checked ? 600 : 500,
                  lineHeight: 1.25,
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  opacity: taken ? 0.72 : 1,
                  transition: "background .15s, border-color .15s, color .15s",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0, maxWidth: "100%" }}>
                  {checked ? <Icon name="check" size={13} sw={2.2} /> : taken ? <Icon name="lock" size={12} sw={2} /> : null}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{c.name}</span>
                </span>
                {takenName ? (
                  <span style={{ fontSize: 10.5, fontWeight: 500, color: C.txtMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                    {takenName}
                  </span>
                ) : null}
              </button>
            );
          })}
          {!filteredCounties.length && (
            <div style={{ gridColumn: "1 / -1", padding: 16, textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)", fontSize: 13 }}>
              {t.ucQeybCountySearch}
            </div>
          )}
        </div>
        <style>{`
          @media (max-width: 900px) { .qeeb-counties-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
          @media (max-width: 560px) { .qeeb-counties-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
        `}</style>
      </div>
    </AccountModal>
  );
}

export function QeybahaListPage({
  C, accent, isDark, registerAddAction,
}: {
  C: AccountsThemeColors; accent: string; isDark: boolean;
  registerAddAction?: (open: () => void) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const { data: qeybs = [], isLoading } = useQeybs();
  const del = useDeleteQeyb();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<QeybItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QeybItem | null>(null);

  useEffect(() => {
    registerAddAction?.(() => { setEditing(null); setModalOpen(true); });
  }, [registerAddAction]);

  const showShimmer = isLoading && qeybs.length === 0;
  const actionLabels = { view: t.editAction, edit: t.editAction, delete: t.deleteAction };

  return (
    <div style={{ marginTop: "24px", animation: "is-fadeUp .5s ease both" }}>
      <QeybModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        initial={editing}
        C={C}
        accent={accent}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title={t.ucQeybDelete}
        message={deleteTarget ? `${t.ucQeybDeleteConfirm} “${deleteTarget.name}”?` : ""}
        confirmLabel={t.deleteAction}
        cancelLabel={t.cancelAction}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        onCancel={() => setDeleteTarget(null)}
        C={C}
        accent={accent}
        pending={del.isPending}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "18px" }}>
        <p style={{ margin: 0, fontSize: "14px", color: C.txtMuted, fontFamily: "var(--font-outfit)", maxWidth: "560px", lineHeight: 1.5 }}>
          {t.ucQeybsSub}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <div style={{ padding: "16px 18px", borderRadius: "14px", background: C.cardBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.cardShadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: hexA(accent, 0.14), color: accent }}>
              <Icon name="map" size={18} sw={1.8} />
            </div>
            <div>
              <div style={{ fontSize: "12px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>{t.ucQeybsTitle}</div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: C.txtPrimary, fontFamily: "var(--font-cinzel)" }}>{qeybs.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderRadius: "14px", background: C.panelBg, border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, overflow: "hidden" }}>
        {showShimmer ? (
          <ShimmerForcesTable />
        ) : qeybs.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
            <Icon name="map" size={26} sw={1.8} />
            <p style={{ marginTop: "12px" }}>{t.ucQeybEmpty}</p>
            <PrimaryButton onClick={() => { setEditing(null); setModalOpen(true); }} accent={accent}>{t.ucQeybAdd}</PrimaryButton>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-outfit)" }}>
              <thead>
                <tr style={{ background: C.tableHead, borderBottom: `1px solid ${C.tableSep}` }}>
                  {[t.ucQeybName, t.ucQeybCounties, t.ucQeybTaliye, t.colAction].map((h) => (
                    <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: C.txtMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qeybs.map((q) => (
                  <tr
                    key={q.id}
                    style={{ borderBottom: `1px solid ${C.tableSep}`, cursor: "pointer" }}
                    onClick={() => { setEditing(q); setModalOpen(true); }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = C.tableHov; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "14px 16px", color: C.txtPrimary, fontWeight: 600 }}>{q.name}</td>
                    <td style={{ padding: "14px 16px", color: C.txtSecondary, fontSize: 13 }}>
                      {(q.counties || []).map((c) => c.name).join(", ") || "—"}
                    </td>
                    <td style={{ padding: "14px 16px", color: C.txtSecondary, fontSize: 13 }}>
                      {q.taliye ? `${q.taliye.name}${q.taliye.phone ? ` · ${q.taliye.phone}` : ""}` : "—"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <RowActions
                        actions={["edit", "delete"]}
                        onAction={(action) => {
                          if (action === "delete") { setDeleteTarget(q); return; }
                          setEditing(q);
                          setModalOpen(true);
                        }}
                        C={C}
                        accent={accent}
                        labels={actionLabels}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
