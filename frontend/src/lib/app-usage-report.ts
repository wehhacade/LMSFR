import type { AppUsageAgentRow, AppUsagePrintMode, AppUsageRegistrar, AppUsageReport } from "@/types/app-usage-report";
import { printHtmlDocument } from "@/lib/app-users-report";

function esc(v: string | number | null | undefined) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(value: string | null | undefined, lang: "so" | "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang === "so" ? "so-SO" : "en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Mogadishu",
  }).format(new Date(value));
}

function fmtRange(from: string, to: string, lang: "so" | "en") {
  return `${fmtDate(from, lang)} — ${fmtDate(to, lang)}`;
}

const MEDAL = ["🥇", "🥈", "🥉"];
const MEDAL_COLOR = ["#c4a35a", "#9aa3ad", "#b87333"];

function certificateHtml(opts: {
  title: string;
  subtitle: string;
  rows: AppUsageRegistrar[];
  periodLabel: string;
  lang: "so" | "en";
  emblemSrc: string;
  limit: number;
}) {
  const { title, subtitle, rows, periodLabel, lang, emblemSrc, limit } = opts;
  const display = rows.slice(0, limit);
  const printedAt = new Intl.DateTimeFormat(lang === "so" ? "so-SO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Mogadishu",
  }).format(new Date());

  const cards = display.map((r, i) => `
    <div class="rank-card rank-${i + 1}">
      <div class="rank-badge" style="background:linear-gradient(145deg,${MEDAL_COLOR[i] || "#c4a35a"},#fff2)">${MEDAL[i] || `#${i + 1}`}</div>
      <div class="rank-no" style="color:${MEDAL_COLOR[i] || "#c4a35a"}">#${i + 1}</div>
      <div class="rank-name">${esc(r.name)}</div>
      <div class="rank-meta">${esc(r.county_name || "—")}${r.section_name ? ` · ${esc(r.section_name)}` : ""}</div>
      <div class="rank-id">${lang === "so" ? "Lambarka" : "ID"}: ${esc(r.service_id || "—")} · ${esc(r.phone || "—")}</div>
      <div class="rank-count"><span>${r.suspects_registered}</span> ${lang === "so" ? "tuhunsane" : "suspects"}</div>
    </div>`).join("");

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/>
<title>${esc(title)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #152033;
    font-family: "Segoe UI", Georgia, serif;
    background: linear-gradient(180deg, #fbf8f1 0%, #fff 35%, #f5f8fc 100%);
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .frame {
    border: 3px double #c4a35a; border-radius: 20px; padding: 28px 24px 22px;
    background: #fff; box-shadow: 0 8px 40px rgba(21,32,51,.08);
    position: relative; overflow: hidden;
  }
  .frame::before, .frame::after {
    content: ""; position: absolute; width: 120px; height: 120px; border-radius: 50%;
    border: 1px solid rgba(196,163,90,.25);
  }
  .frame::before { top: -40px; left: -40px; }
  .frame::after { bottom: -50px; right: -50px; }
  .header { text-align: center; margin-bottom: 24px; position: relative; z-index: 1; }
  .header img { width: 72px; height: 72px; object-fit: contain; margin-bottom: 10px; }
  .kicker { font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: #9a7a32; font-weight: 700; margin: 0 0 6px; }
  h1 {
    margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -.02em;
    background: linear-gradient(135deg, #152033, #3d4f68);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .subtitle { margin: 8px 0 0; color: #5b6577; font-size: 13px; }
  .period {
    display: inline-block; margin-top: 12px; padding: 6px 14px; border-radius: 999px;
    background: linear-gradient(135deg, #152033, #243044); color: #f0d59a;
    font-size: 11px; font-weight: 600; letter-spacing: .04em;
  }
  .cards { display: grid; gap: 14px; position: relative; z-index: 1; }
  .rank-card {
    border: 1px solid #eadfc9; border-radius: 16px; padding: 16px 18px 16px 72px;
    background: linear-gradient(135deg, #fff 0%, #faf7f0 100%); position: relative;
  }
  .rank-1 { border-color: #e6d4a8; box-shadow: 0 4px 20px rgba(196,163,90,.15); }
  .rank-badge {
    position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
    width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center;
    font-size: 20px; border: 2px solid rgba(255,255,255,.8);
  }
  .rank-no { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .rank-name { font-size: 18px; font-weight: 700; margin-top: 2px; color: #152033; }
  .rank-meta { font-size: 12px; color: #5b6577; margin-top: 4px; }
  .rank-id { font-size: 11px; color: #8892a0; margin-top: 3px; }
  .rank-count { margin-top: 8px; font-size: 12px; color: #5b6577; }
  .rank-count span { font-size: 24px; font-weight: 800; color: #1f4f8a; margin-right: 4px; }
  .footer {
    margin-top: 22px; padding-top: 14px; border-top: 1px solid #eadfc9;
    display: flex; justify-content: space-between; font-size: 10px; color: #8892a0;
  }
  .footer strong { color: #9a7a32; }
</style></head><body>
  <div class="frame">
    <header class="header">
      <img src="${esc(emblemSrc)}" alt="Emblem"/>
      <p class="kicker">LMSBR · Amniga · C.I.SH</p>
      <h1>${esc(title)}</h1>
      <p class="subtitle">${esc(subtitle)}</p>
      <div class="period">${esc(periodLabel)}</div>
    </header>
    <div class="cards">${cards || `<p style="text-align:center;color:#8892a0">${lang === "so" ? "Wax xog ah ma jiro muddadan." : "No data for this period."}</p>`}</div>
    <div class="footer">
      <span><strong>Amniga System</strong></span>
      <span>${lang === "so" ? "La daabacay" : "Printed"}: ${esc(printedAt)}</span>
    </div>
  </div>
</body></html>`;
}

function listReportHtml(opts: {
  title: string;
  rows: AppUsageAgentRow[];
  periodLabel: string;
  filterLabel: string;
  lang: "so" | "en";
  emblemSrc: string;
  extraCols?: boolean;
  showSuspects?: boolean;
}) {
  const { title, rows, periodLabel, filterLabel, lang, emblemSrc, extraCols, showSuspects } = opts;
  const body = rows.length ? `<table>
    <thead><tr>
      <th>#</th><th>${lang === "so" ? "Magac" : "Name"}</th><th>ID</th>
      <th>${lang === "so" ? "Degmo" : "District"}</th><th>${lang === "so" ? "Qayb" : "Section"}</th>
      <th>${lang === "so" ? "Telefoon" : "Phone"}</th><th>${lang === "so" ? "Loogu shubay" : "Installed"}</th>
      ${extraCols ? `<th>${lang === "so" ? "Tuhunsane" : "Suspects"}</th><th>${lang === "so" ? "Waxqabad (muddadan)" : "Activity (period)"}</th>` : ""}
      ${showSuspects ? `<th>${lang === "so" ? "Tuhunsane (muddadan)" : "Suspects (period)"}</th>` : ""}
    </tr></thead>
    <tbody>${rows.map((r, i) => `<tr>
      <td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.service_id)}</td>
      <td>${esc(r.county_name || "—")}</td><td>${esc(r.section_name || "—")}</td>
      <td>${esc(r.phone || "—")}</td><td>${fmtDate(r.installed_at, lang)}</td>
      ${extraCols ? `<td><b>${r.period_suspects_registered}</b></td><td>${esc(r.last_period_activity_relative)}</td>` : ""}
      ${showSuspects ? `<td>${r.period_suspects_registered}</td>` : ""}
    </tr>`).join("")}</tbody>
  </table>` : `<p class="empty">${lang === "so" ? "Wax xog ah ma jiro." : "No data."}</p>`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/>
<title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  body { margin:0; font:9px/1.35 "Segoe UI",system-ui,sans-serif; color:#152033; }
  .topbar { display:grid; grid-template-columns:60px 1fr auto; gap:12px; padding:10px; border:1px solid #e6dcc4; border-radius:12px; margin-bottom:10px; }
  .topbar img { width:50px; height:50px; }
  h1 { margin:0; font-size:16px; }
  .meta { background:#152033; color:#fff; padding:8px 10px; border-radius:8px; font-size:10px; }
  table { width:100%; border-collapse:collapse; }
  th,td { border:1px solid #d8dde6; padding:5px 7px; text-align:left; }
  th { background:#152033; color:#fff; }
  tr:nth-child(even) td { background:#f6f8fb; }
  .empty { color:#8892a0; font-style:italic; }
</style></head><body>
  <header class="topbar">
    <img src="${esc(emblemSrc)}" alt=""/>
    <div><h1>${esc(title)}</h1><div>${esc(filterLabel)} · ${esc(periodLabel)} · <b>${rows.length}</b> ${lang === "so" ? "ciidan" : "agents"}</div></div>
    <div class="meta">C.I.SH App</div>
  </header>
  ${body}
</body></html>`;
}

export function buildAppUsagePrintHtml(opts: {
  mode: AppUsagePrintMode;
  report: AppUsageReport;
  lang: "so" | "en";
  emblemSrc: string;
  filterLabel: string;
  selectedScopeLabel?: string;
}): string {
  const { mode, report, lang, emblemSrc, filterLabel, selectedScopeLabel } = opts;
  const periodLabel = fmtRange(report.period.date_from, report.period.date_to, lang);

  if (mode === "top3-overall") {
    return certificateHtml({
      title: lang === "so" ? "Top 3 Tuhunsane — Guud" : "Top 3 Registrars — Overall",
      subtitle: lang === "so" ? "Abaalmarinta diiwaangelinta tuhunsanayaasha" : "Suspect registration excellence award",
      rows: report.top_registrars.overall_top3,
      periodLabel, lang, emblemSrc, limit: 3,
    });
  }

  if (mode === "top3-section") {
    const name = report.top_registrars.section_name || filterLabel;
    return certificateHtml({
      title: lang === "so" ? `Top 3 Tuhunsane — ${name}` : `Top 3 Registrars — ${name}`,
      subtitle: lang === "so" ? "Qaybta — abaalmarinta diiwaangelinta" : "Section — registration excellence award",
      rows: report.top_registrars.section_top3,
      periodLabel, lang, emblemSrc, limit: 3,
    });
  }

  if (mode === "top3-district") {
    const name = report.top_registrars.district_name || filterLabel;
    return certificateHtml({
      title: lang === "so" ? `Top 3 Tuhunsane — ${name}` : `Top 3 Registrars — ${name}`,
      subtitle: lang === "so" ? "Degmada — abaalmarinta diiwaangelinta" : "District — registration excellence award",
      rows: report.top_registrars.district_top3,
      periodLabel, lang, emblemSrc, limit: 3,
    });
  }

  if (mode === "top10-overall") {
    return certificateHtml({
      title: lang === "so" ? "Top 10 Tuhunsane — Guud" : "Top 10 Registrars — Overall",
      subtitle: lang === "so" ? "Liiska ciidanka ugu waxqabadka badan" : "Highest performing field agents",
      rows: report.top_registrars.overall_top10,
      periodLabel, lang, emblemSrc, limit: 10,
    });
  }

  if (mode === "inactive") {
    return listReportHtml({
      title: lang === "so" ? "Loogu shubay — tuhunsane lama diiwaangelin" : "Installed — no suspects registered",
      rows: report.inactive_agents,
      periodLabel, filterLabel, lang, emblemSrc, showSuspects: true,
    });
  }

  if (mode === "active") {
    return listReportHtml({
      title: lang === "so" ? "Ciidanka shaqaynaya muddadan" : "Active agents this period",
      rows: report.active_agents,
      periodLabel, filterLabel, lang, emblemSrc, extraCols: true,
    });
  }

  return listReportHtml({
    title: lang === "so" ? "Warbixinta App-ka — Dhammaan" : "App usage report — all installed",
    rows: report.agents,
    periodLabel, filterLabel, lang, emblemSrc, extraCols: true,
  });
}

export async function printAppUsageReport(opts: {
  mode: AppUsagePrintMode;
  report: AppUsageReport;
  lang: "so" | "en";
  emblemSrc: string;
  filterLabel: string;
  selectedScopeLabel?: string;
}) {
  const html = buildAppUsagePrintHtml(opts);
  await printHtmlDocument(html, `amniga-app-usage-print-${opts.mode}`);
}
