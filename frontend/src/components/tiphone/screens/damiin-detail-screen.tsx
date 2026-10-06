"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, MapPin, Phone, Shield, UserRound } from "lucide-react";
import { TipApi } from "@/lib/tiphone/api";
import { rgba } from "@/lib/tiphone/theme";
import type {
  DamiinDetailRow,
  DamiinListRow,
  SuspectCaseRow,
  SuspectListRow,
} from "@/lib/tiphone/types";
import { resolveTipMediaUrl } from "@/lib/tiphone/utils";
import { ScreenAppBar } from "../app-bar";
import { InlinePanelShimmer } from "../shimmer";
import { useTipTheme } from "../theme-provider";

export function DamiinDetailScreen({
  damiin,
  onBack,
  onMenu,
  onOpenSuspect,
}: {
  damiin: DamiinListRow;
  onBack: () => void;
  onMenu: () => void;
  onOpenSuspect: (suspect: SuspectListRow) => void;
}) {
  const { colors } = useTipTheme();
  const [detail, setDetail] = useState<DamiinDetailRow | null>(null);
  const [cases, setCases] = useState<SuspectCaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([TipApi.fetchDamiinDetail(damiin.id), TipApi.fetchDamiinCases(damiin.id)])
      .then(([nextDetail, nextCases]) => {
        if (cancelled) return;
        setDetail(nextDetail);
        setCases(nextCases);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Faahfaahinta lama soo rarin.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [damiin.id]);

  const name = detail?.name || damiin.name || "Damiin";
  const phone = detail?.phone || damiin.phone || damiin.tnumber;
  const photo = resolveTipMediaUrl(detail?.picture || damiin.picture || damiin.photo);

  return (
    <div className="flex min-h-dvh flex-col">
      <ScreenAppBar title="Faahfaahinta Damiinka" onBack={onBack} onMenu={onMenu} />
      <div className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-4">
        <section
          className="overflow-hidden rounded-3xl border p-4"
          style={{
            background: `linear-gradient(145deg, ${rgba(colors.goldRgb, 0.14)}, ${rgba(colors.surfRgb, 0.78)})`,
            borderColor: rgba(colors.goldRgb, 0.3),
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold"
              style={{ background: rgba(colors.goldRgb, 0.16), color: colors.gold }}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold" style={{ color: colors.ink0 }}>
                {name}
              </p>
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="mt-1 flex items-center gap-1.5 text-sm"
                  style={{ color: colors.gold }}
                >
                  <Phone size={14} /> {phone}
                </a>
              ) : null}
              <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: colors.inkMut }}>
                <MapPin size={13} /> {detail?.degmada || damiin.degmada || "Degmo lama hayo"}
              </p>
            </div>
          </div>

          {detail ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Info label="Xiriirka" value={detail.relationship} icon={<Shield size={13} />} />
              <Info label="Shaqada" value={detail.occupation} icon={<BriefcaseBusiness size={13} />} />
              <Info
                label="Goobta shaqada"
                value={detail.goobta_shaqada}
                icon={<MapPin size={13} />}
                wide
              />
            </div>
          ) : null}
        </section>

        {loading ? <InlinePanelShimmer rows={4} /> : null}
        {error ? (
          <div
            className="rounded-2xl border p-4 text-center text-sm"
            style={{ borderColor: rgba(colors.roseRgb, 0.35), color: colors.rose }}
          >
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: colors.inkMut }}>
                Kiisaska uu damiinka ka yahay
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ background: rgba(colors.goldRgb, 0.16), color: colors.gold }}
              >
                {cases.length}
              </span>
            </div>
            {cases.length === 0 ? (
              <p className="rounded-2xl border p-5 text-center text-sm" style={{ color: colors.inkMut }}>
                Kiis lama helin
              </p>
            ) : (
              <div className="space-y-2">
                {cases.map((row, index) => {
                  const suspect = detail?.suspects[index];
                  return (
                    <button
                      type="button"
                      key={row.id ?? index}
                      disabled={!suspect}
                      onClick={() => {
                        if (!suspect) return;
                        onOpenSuspect({
                          id: suspect.suspect_id,
                          name: suspect.name,
                          N_tuhunka: suspect.Tuhunka,
                          degmada: suspect.d_qabashada,
                          waaxda: suspect.w_qabashada,
                          description: suspect.description,
                          source: "amniga",
                        });
                      }}
                      className="w-full rounded-2xl border p-3 text-left"
                      style={{
                        background: rgba(colors.surfRgb, 0.7),
                        borderColor: rgba(colors.lineRgb, 0.11),
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <UserRound size={16} style={{ color: colors.gold }} />
                        <p className="font-semibold" style={{ color: colors.ink0 }}>
                          {suspect?.name || row.case_code || `Kiis #${row.id ?? index + 1}`}
                        </p>
                      </div>
                      <p className="mt-1 text-xs" style={{ color: colors.ink2 }}>
                        {[row.tuhunka || row.Tuhunka, row.d_qabashada, row.w_qabashada]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {row.description ? (
                        <p className="mt-2 text-sm" style={{ color: colors.inkMut }}>
                          {row.description}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  icon,
  wide,
}: {
  label: string;
  value?: string;
  icon: React.ReactNode;
  wide?: boolean;
}) {
  const { colors } = useTipTheme();
  return (
    <div
      className={`rounded-xl border p-2.5 ${wide ? "col-span-2" : ""}`}
      style={{ borderColor: rgba(colors.lineRgb, 0.09), background: rgba(colors.lineRgb, 0.04) }}
    >
      <p className="flex items-center gap-1 text-[10px] uppercase" style={{ color: colors.inkMut }}>
        {icon} {label}
      </p>
      <p className="mt-1 text-sm font-semibold" style={{ color: colors.ink0 }}>
        {value || "—"}
      </p>
    </div>
  );
}
