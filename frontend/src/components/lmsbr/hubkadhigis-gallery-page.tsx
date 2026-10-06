"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useLang } from "./lang-ctx";
import { getDict, hexA } from "@/lib/lmsbr/data";
import { recordHasDisplayPhoto } from "@/lib/record-display";
import { Icon } from "./icon";
import { useDisarmamentGalleryImages, useDisarmamentRecords } from "@/hooks/use-hubkadhigis";
import { ShimmerBlock } from "./shimmer";
import { HubGalleryPhotoCard, resolveEvidenceUrl } from "./hub-gallery-photo-card";
import { HubkadhigisProfilePage } from "./hubkadhigis-profile-page";
import { HubkadhigisFormModal } from "./hubkadhigis-form-modal";
import type { AccountsThemeColors } from "./accounts-shared";
import { Pagination, TableRowsSelect, DEFAULT_TABLE_PAGE_SIZE } from "./table-pagination";
import type { DisarmamentDetail, DisarmamentRecord } from "@/types/hubkadhigis";

type ThemeColors = AccountsThemeColors & {
  cardBdr: string;
  cardShadow: string;
  panelBg: string;
  panelShadow: string;
  tableSep: string;
  inputBg: string;
  inputBdr: string;
  txtMuted: string;
  txtSecondary: string;
  txtPrimary: string;
};

export function HubkadhigisGalleryPage({
  C,
  accent,
  isDark,
  search,
  moduleName,
  profileId = null,
  setProfileId,
}: {
  C: ThemeColors;
  accent: string;
  isDark: boolean;
  search: string;
  moduleName?: string;
  profileId?: number | null;
  setProfileId?: (id: number | null) => void;
}) {
  const { lang } = useLang();
  const t = getDict(lang);
  const [recordPage, setRecordPage] = useState(1);
  const [evidencePage, setEvidencePage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [evidencePageSize, setEvidencePageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [localProfileId, setLocalProfileId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [prefillFrom, setPrefillFrom] = useState<DisarmamentRecord | DisarmamentDetail | null>(null);
  const deferredSearch = useDeferredValue(search);

  const activeProfileId = profileId ?? localProfileId;
  const openProfile = setProfileId ?? setLocalProfileId;

  useEffect(() => {
    setRecordPage(1);
    setEvidencePage(1);
  }, [deferredSearch, recordPageSize, evidencePageSize]);

  const { data: recordsData, isLoading: recordsLoading } = useDisarmamentRecords({
    page: recordPage,
    pageSize: recordPageSize,
    search: deferredSearch,
    has_images: true,
  });
  const { data: evidenceData, isLoading: evidenceLoading } = useDisarmamentGalleryImages(
    evidencePage,
    deferredSearch,
    evidencePageSize,
  );

  const records = (recordsData?.results ?? []).filter(recordHasDisplayPhoto);
  const recordTotalPages = Math.max(1, Math.ceil((recordsData?.count ?? 0) / recordPageSize));
  const evidence = evidenceData?.results ?? [];
  const evidenceTotalPages = Math.max(1, Math.ceil((evidenceData?.count ?? 0) / evidencePageSize));

  if (activeProfileId !== null) {
    return (
      <>
        <HubkadhigisProfilePage
          recordId={activeProfileId}
          onBack={() => openProfile(null)}
          onEdit={() => { setEditId(activeProfileId); setPrefillFrom(null); setModalOpen(true); }}
          onRegisterNew={(r) => { setPrefillFrom(r); setEditId(null); setModalOpen(true); }}
          onOpenRecord={(id) => openProfile(id)}
          C={C}
          accent={accent}
          isDark={isDark}
        />
        <HubkadhigisFormModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditId(null); setPrefillFrom(null); }}
          editId={editId}
          prefillFrom={prefillFrom}
          C={C}
          accent={accent}
        />
      </>
    );
  }

  return (
    <div style={{ marginTop: 0, animation: "is-fadeUp .45s ease both", paddingBottom: 48 }}>
      <div
        className="hub-compact-header"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: accent,
              boxShadow: isDark ? `0 0 10px ${hexA(accent, 0.5)}` : `0 0 0 3px ${hexA(accent, 0.15)}`,
            }} />
            {moduleName && (
              <span style={{
                fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
                color: accent, fontWeight: 600, fontFamily: "var(--font-outfit)",
              }}>
                {moduleName}
              </span>
            )}
          </div>
          <h1 style={{
            fontFamily: "var(--font-cinzel)", fontWeight: 600,
            fontSize: "clamp(22px, 2.8vw, 30px)", color: C.txtPrimary, margin: 0, lineHeight: 1.15,
          }}>
            {t.hubGalleryTitle}
          </h1>
          <p style={{ fontSize: 13, color: C.txtMuted, margin: "6px 0 0", lineHeight: 1.45 }}>
            {t.hubGallerySub}
          </p>
        </div>
      </div>

      <section style={{
        borderRadius: 14, overflow: "hidden", background: C.panelBg,
        border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow, marginBottom: 16,
      }}>
        <div style={{
          padding: "18px 22px", borderBottom: `1px solid ${C.tableSep}`,
          background: isDark ? hexA(accent, 0.03) : "#FAFAF9",
        }}>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary }}>
            {t.hubPersonPhoto} & {t.hubWeaponPhoto}
          </div>
          <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 3, fontFamily: "var(--font-outfit)" }}>
            {recordsLoading ? "…" : `${recordsData?.count ?? 0} records with photos`}
            {!recordsLoading && records.length < (recordsData?.results?.length ?? 0) && (
              <span style={{ marginLeft: 6, opacity: 0.8 }}>
                · showing {records.length} on this page with loadable images
              </span>
            )}
          </div>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <TableRowsSelect
            pageSize={recordPageSize}
            onPageSizeChange={(n) => { setRecordPageSize(n); setRecordPage(1); }}
            C={C}
            label={lang === "so" ? "Tiro" : "Rows"}
          />
          {recordsLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <ShimmerBlock key={i} h={160} radius={12} />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
              {t.hubNoResults}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 16 }}>
                {records.map((r) => (
                  <HubGalleryPhotoCard
                    key={r.id}
                    record={r}
                    accent={accent}
                    isDark={isDark}
                    border={C.cardBdr}
                    onClick={() => openProfile(r.id)}
                  />
                ))}
              </div>
              <Pagination
                page={recordPage}
                totalPages={recordTotalPages}
                onPage={setRecordPage}
                C={C}
                accent={accent}
                isDark={isDark}
                labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
                hideWhenSinglePage
                bordered={false}
                align="center"
                style={{ marginTop: 24 }}
              />
            </>
          )}
        </div>
      </section>

      <section style={{
        borderRadius: 14, overflow: "hidden", background: C.panelBg,
        border: `1px solid ${C.cardBdr}`, boxShadow: C.panelShadow,
      }}>
        <div style={{
          padding: "18px 22px", borderBottom: `1px solid ${C.tableSep}`,
          background: isDark ? hexA(accent, 0.03) : "#FAFAF9",
        }}>
          <div style={{ fontFamily: "var(--font-cinzel)", fontWeight: 600, fontSize: 16, color: C.txtPrimary }}>
            {t.hubHistoryImages}
          </div>
          <div style={{ fontSize: 12, color: C.txtMuted, marginTop: 3, fontFamily: "var(--font-outfit)" }}>
            {evidenceLoading ? "…" : `${evidenceData?.count ?? 0} evidence uploads`}
          </div>
        </div>
        <div style={{ padding: "20px 22px" }}>
          <TableRowsSelect
            pageSize={evidencePageSize}
            onPageSizeChange={(n) => { setEvidencePageSize(n); setEvidencePage(1); }}
            C={C}
            label={lang === "so" ? "Tiro" : "Rows"}
          />
          {evidenceLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <ShimmerBlock key={i} h={140} radius={10} />
              ))}
            </div>
          ) : evidence.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", color: C.txtMuted, fontFamily: "var(--font-outfit)" }}>
              {t.hubNoResults}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                {evidence.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => openProfile(img.record)}
                    style={{
                      border: `1px solid ${C.cardBdr}`, borderRadius: 10, overflow: "hidden",
                      padding: 0, cursor: "pointer", background: C.inputBg, textAlign: "left",
                    }}
                  >
                    <div style={{ aspectRatio: "1", background: "#f3f4f6" }}>
                      {resolveEvidenceUrl(img.file_url) ? (
                        <img src={resolveEvidenceUrl(img.file_url)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                      ) : (
                        <div style={{
                          width: "100%", height: "100%", display: "flex", alignItems: "center",
                          justifyContent: "center", color: C.txtMuted,
                        }}>
                          <Icon name="clipboard" size={24} sw={1.6} />
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: accent, fontFamily: "var(--font-outfit)" }}>
                        {img.record_reference ?? `#${img.record}`}
                      </div>
                      {img.record_person_name && (
                        <div style={{
                          fontSize: 11, color: C.txtMuted, marginTop: 2, fontFamily: "var(--font-outfit)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {img.record_person_name}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <Pagination
                page={evidencePage}
                totalPages={evidenceTotalPages}
                onPage={setEvidencePage}
                C={C}
                accent={accent}
                isDark={isDark}
                labels={{ prev: t.prev, next: t.next, page: t.page, of: t.of }}
                hideWhenSinglePage
                bordered={false}
                align="center"
                style={{ marginTop: 24 }}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
