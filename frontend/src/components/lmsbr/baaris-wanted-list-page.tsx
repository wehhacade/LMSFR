"use client";

import { useEffect, useState } from "react";
import { useLang } from "./lang-ctx";
import { hexA } from "@/lib/lmsbr/data";
import { Icon } from "./icon";
import { SuspectPhoto } from "./suspect-photo";
import { ShimmerSuspectGrid } from "./shimmer";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";
import {
  AccountModal,
  ConfirmDialog,
  PrimaryButton,
  SecondaryButton,
  type AccountsThemeColors,
} from "./accounts-shared";
import { useCreateWanted, useDeleteWanted, useWantedList, useWantedTypes } from "@/hooks/use-baaris";
import type { WantedRow } from "@/types/baaris";

type ThemeColors = AccountsThemeColors & {
  cardBg: string; cardBdr: string; tableSep: string;
};

const emptyForm = () => ({
  full_name: "",
  mother_name: "",
  phone: "",
  gender: "",
  wanted_status: "Wanted",
  priority: "High",
  wanted_type: "",
  details: "",
});

export function BaarisWantedListPage({
  C, accent, isDark, registerAddAction,
}: {
  C: ThemeColors; accent: string; isDark: boolean;
  registerAddAction?: (open: () => void) => void;
}) {
  const { lang } = useLang();
  const so = lang === "so";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const { data, isLoading } = useWantedList({ page, search, pageSize }, true);
  const { data: types } = useWantedTypes(true);
  const createMut = useCreateWanted();
  const deleteMut = useDeleteWanted();

  useEffect(() => {
    registerAddAction?.(() => setShowForm(true));
  }, [registerAddAction]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const rows = data?.results ?? [];
  const totalPages = data?.total_pages ?? 1;

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm());
    setPhoto(null);
    if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  };

  const submit = async () => {
    if (!form.full_name.trim()) return;
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v.trim()) fd.append(k, v.trim());
    });
    if (photo) fd.append("photo", photo);
    await createMut.mutateAsync(fd);
    closeForm();
    setPage(1);
  };

  const fieldStyle = {
    display: "block" as const,
    width: "100%",
    marginTop: 4,
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${C.inputBdr}`,
    background: C.inputBg,
    color: C.txtPrimary,
    fontFamily: "var(--font-outfit)",
    fontSize: 14,
  };

  return (
    <div style={{ animation: "is-fadeUp .4s ease both", paddingBottom: 32 }}>
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flex: "1 1 240px",
          padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.inputBdr}`, background: C.inputBg,
        }}>
          <Icon name="search" size={16} sw={1.9} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={so ? "Raadi wanted (magac / telefoon)…" : "Search wanted (name / phone)…"}
            style={{ border: "none", outline: "none", background: "transparent", width: "100%", color: C.txtPrimary }}
          />
        </div>
      </div>

      <TableRowsSelect
        pageSize={pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
        C={C}
        label={so ? "Tiro" : "Rows"}
      />

      {isLoading ? (
        <ShimmerSuspectGrid />
      ) : rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: C.txtMuted }}>
          {so ? "Wanted lama diiwaangelin weli. Isticmaal Add Wanted." : "No wanted records yet. Use Add Wanted."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
          {rows.map((row: WantedRow) => (
            <article key={row.id} style={{
              borderRadius: 18, overflow: "hidden",
              background: isDark ? hexA("#e0655a", 0.06) : "#fff",
              border: `1px solid ${hexA("#e0655a", 0.28)}`,
            }}>
              <div style={{ position: "relative", aspectRatio: "5/6", background: isDark ? "#1e293b" : "#f8fafc" }}>
                <SuspectPhoto
                  photo={row.photo_url ?? undefined}
                  alt={row.full_name}
                  fallback={
                    <div style={{
                      width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-cinzel)", fontSize: 36, fontWeight: 700, color: hexA("#e0655a", 0.55),
                    }}>{(row.full_name || "?").slice(0, 1)}</div>
                  }
                />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.8) 100%)" }} />
                <span style={{
                  position: "absolute", top: 12, right: 12, fontSize: 11, fontWeight: 700, padding: "4px 10px",
                  borderRadius: 20, background: "#e0655a", color: "#fff",
                }}>{row.wanted_status || "Wanted"}</span>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px" }}>
                  <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: "#fff" }}>{row.full_name}</div>
                  {row.phone ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 3 }}>{row.phone}</div> : null}
                </div>
              </div>
              <div style={{ padding: "12px 14px 14px" }}>
                <div style={{ fontSize: 12, color: C.txtMuted }}>
                  {[row.priority, row.wanted_type, row.citizenship].filter(Boolean).join(" · ") || "—"}
                </div>
                {row.details ? (
                  <p style={{ fontSize: 12, color: C.txtSecondary, marginTop: 8, lineHeight: 1.4 }}>
                    {row.details.slice(0, 90)}{row.details.length > 90 ? "…" : ""}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDeleteId(row.id)}
                  style={{
                    marginTop: 10, border: `1px solid ${hexA("#e0655a", 0.35)}`, background: "transparent",
                    color: "#e0655a", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 12,
                  }}
                >
                  {so ? "Tirtir" : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div style={{ marginTop: 16 }}>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            C={C}
            accent={accent}
            isDark={isDark}
            labels={{ prev: so ? "Dib" : "Prev", next: so ? "Xiga" : "Next", page: so ? "Bog" : "Page", of: so ? "ee" : "of" }}
          />
        </div>
      ) : null}

      <AccountModal
        open={showForm}
        onClose={closeForm}
        title={so ? "Ku dar Wanted" : "Add Wanted"}
        subtitle={so ? "Qofka la doonayo — midaysan mobile search" : "Wanted person — shared with mobile search"}
        C={C}
        accent={accent}
        size="md"
        zIndex={1200}
        footer={
          <>
            <SecondaryButton onClick={closeForm} C={C}>{so ? "Jooji" : "Cancel"}</SecondaryButton>
            <PrimaryButton onClick={() => void submit()} disabled={createMut.isPending || !form.full_name.trim()} accent={accent}>
              {createMut.isPending ? "…" : (so ? "Kaydi" : "Save")}
            </PrimaryButton>
          </>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ gridColumn: "1 / -1", fontSize: 12, color: C.txtMuted }}>
            {so ? "Magaca *" : "Full name *"}
            <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ fontSize: 12, color: C.txtMuted }}>
            {so ? "Hooyo" : "Mother"}
            <input value={form.mother_name} onChange={(e) => setForm((f) => ({ ...f, mother_name: e.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ fontSize: 12, color: C.txtMuted }}>
            {so ? "Telefoon" : "Phone"}
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={fieldStyle} />
          </label>
          <label style={{ fontSize: 12, color: C.txtMuted }}>
            {so ? "Jinsi" : "Gender"}
            <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} style={fieldStyle}>
              <option value="">{so ? "Dooro" : "Select"}</option>
              <option value="Lab">Lab</option>
              <option value="Dhedig">Dhedig</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: C.txtMuted }}>
            Status
            <select value={form.wanted_status} onChange={(e) => setForm((f) => ({ ...f, wanted_status: e.target.value }))} style={fieldStyle}>
              <option value="Wanted">Wanted</option>
              <option value="Watch">Watch</option>
              <option value="Captured">Captured</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: C.txtMuted }}>
            {so ? "Mudnaan" : "Priority"}
            <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} style={fieldStyle}>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: C.txtMuted }}>
            {so ? "Nooca" : "Type"}
            <input
              list="baaris-wanted-types"
              value={form.wanted_type}
              onChange={(e) => setForm((f) => ({ ...f, wanted_type: e.target.value }))}
              style={fieldStyle}
              placeholder={so ? "Tusaale: Argagixi" : "e.g. Argagixi"}
            />
            <datalist id="baaris-wanted-types">
              {(types ?? []).map((t) => <option key={t.id} value={t.name} />)}
            </datalist>
          </label>
          <label style={{ gridColumn: "1 / -1", fontSize: 12, color: C.txtMuted }}>
            {so ? "Faahfaahin" : "Details"}
            <textarea
              value={form.details}
              onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
              rows={3}
              style={{ ...fieldStyle, resize: "vertical" }}
            />
          </label>
          <label style={{ gridColumn: "1 / -1", fontSize: 12, color: C.txtMuted }}>
            {so ? "Sawir" : "Photo"}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 12, overflow: "hidden", flexShrink: 0,
                background: isDark ? "#1e293b" : "#f1f5f9",
                border: `1px solid ${C.inputBdr}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 11, color: C.txtMuted }}>{so ? "Sawir" : "Photo"}</span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
                  setPhoto(file);
                  setPhotoPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </div>
          </label>
        </div>
      </AccountModal>

      <ConfirmDialog
        open={deleteId != null}
        title={so ? "Tirtir Wanted?" : "Delete Wanted?"}
        message={so ? "Ficilkan dib looma celin karo." : "This cannot be undone."}
        confirmLabel={so ? "Tirtir" : "Delete"}
        cancelLabel={so ? "Jooji" : "Cancel"}
        onConfirm={() => {
          if (deleteId != null) void deleteMut.mutateAsync(deleteId).then(() => setDeleteId(null));
        }}
        onCancel={() => setDeleteId(null)}
        C={C}
        accent={accent}
      />
    </div>
  );
}
