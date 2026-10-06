import type { AgentAppUser } from "@/types/agents";
import type { QeybItem } from "@/types/accounts";

export type AppUsersPrintMode = "full" | "not_installed";

type RelativeFn = (value: string | null, lang: "so" | "en") => string;
type ExactFn = (value: string | null, lang: "so" | "en") => string;

function esc(v: string) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Compact print timestamp — saves column width. */
function compactExact(value: string | null, lang: "so" | "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(lang === "so" ? "so-SO" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Mogadishu",
  }).format(new Date(value));
}

export function buildAppUsersQeybReportHtml(opts: {
  mode: AppUsersPrintMode;
  rows: AgentAppUser[];
  lang: "so" | "en";
  qeyb: QeybItem | undefined;
  countyLabel: string;
  countyFilterActive: boolean;
  emblemSrc: string;
  relativeTime: RelativeFn;
  exactTime: ExactFn;
}): string {
  const {
    mode,
    rows,
    lang,
    qeyb,
    countyLabel,
    countyFilterActive,
    emblemSrc,
    relativeTime,
  } = opts;

  const qeebLabel = qeyb?.name || (lang === "so" ? "Qeebta" : "Qeebta");
  const taliye = qeyb?.taliye;
  const taliyeName = taliye?.name || taliye?.username || (lang === "so" ? "Lama cayimin" : "Not assigned");
  const taliyePhone = taliye?.phone || "—";
  const districtNames =
    qeyb?.counties?.map((c) => c.name).filter(Boolean).join(", ") || "—";

  const printedAt = new Intl.DateTimeFormat(lang === "so" ? "so-SO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Mogadishu",
  }).format(new Date());

  const completed = rows.filter((r) => r.installation_status === "completed");
  const iphone = rows.filter((r) => r.installation_status === "iphone");
  const notInstalled = rows.filter((r) => r.installation_status === "not_installed");

  const reasonText = (r: AgentAppUser) => {
    const detail = (r.not_installed_reason_detail || "").trim();
    const label = (r.not_installed_reason_label || "").trim();
    const code = (r.not_installed_reason || "").trim();
    if (detail) return detail;
    if (label && !/^sabab lama sheegin$/i.test(label)) return label;
    if (code) return label || code;
    return "";
  };
  const hasInstallReason = (r: AgentAppUser) => Boolean(reasonText(r));

  const notInstalledWithReason = notInstalled.filter(hasInstallReason);
  const notInstalledNoReason = notInstalled.filter((r) => !hasInstallReason(r));
  const pct = (n: number) => (rows.length ? ((n / rows.length) * 100).toFixed(1) : "0.0");

  const countyOrder = new Map(
    (qeyb?.counties || []).map((c, i) => [c.name.toLowerCase(), i]),
  );

  const sortByName = (a: AgentAppUser, b: AgentAppUser) =>
    (a.full_name || "").localeCompare(b.full_name || "", undefined, { sensitivity: "base" });

  const groupByDistrict = (list: AgentAppUser[]) => {
    const map = new Map<string, AgentAppUser[]>();
    for (const r of list) {
      const key = (r.county_name || "").trim() || (lang === "so" ? "Degmo aan la cayimin" : "Unassigned");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const agents of map.values()) agents.sort(sortByName);
    return [...map.entries()].sort((a, b) => {
      const ai = countyOrder.get(a[0].toLowerCase());
      const bi = countyOrder.get(b[0].toLowerCase());
      if (ai != null && bi != null) return ai - bi;
      if (ai != null) return -1;
      if (bi != null) return 1;
      return a[0].localeCompare(b[0]);
    });
  };

  const groupByReason = (list: AgentAppUser[]) => {
    const map = new Map<string, AgentAppUser[]>();
    for (const r of list) {
      const key = reasonText(r) || (lang === "so" ? "Sabab kale" : "Other");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  };

  const reasonBreakdownHtml = (list: AgentAppUser[]) => {
    if (!list.length) return "";
    const parts = groupByReason(list)
      .map(
        ([reason, agents]) =>
          `<span class="reason-pill"><b>${agents.length}</b> ${esc(reason)}</span>`,
      )
      .join("");
    return `<div class="reason-summary">${parts}</div>`;
  };

  const renderAgentTable = (
    list: AgentAppUser[],
    optsTable: { showReason: boolean; showApp: boolean; startNo: number },
  ) => {
    const { showReason, showApp, startNo } = optsTable;
    const head = `
      <thead><tr>
        <th class="num">#</th>
        <th class="name-col">Magaca</th>
        <th class="email-col">Email</th>
        <th class="phone-col">Telefoon</th>
        ${showApp ? '<th class="app-col">App</th>' : ""}
        ${showReason ? '<th class="reason-col">Sababta</th>' : ""}
        <th class="act-col">Activity</th>
        <th class="time-col">Waqti</th>
      </tr></thead>`;
    const body = list
      .map((r, i) => {
        const email = r.email || r.user_email || "—";
        const phone = (r.phone || "").replace(/ /g, "") || "—";
        const appLabel =
          r.installation_status === "completed"
            ? "Loogu shubay"
            : r.installation_status === "iphone"
              ? "iPhone"
              : "Looguma shubin";
        const reason =
          r.installation_status === "not_installed"
            ? reasonText(r) || "Sabab lama sheegin"
            : "—";
        const pill =
          r.installation_status === "completed"
            ? "ok"
            : r.installation_status === "iphone"
              ? "warn"
              : "bad";
        return `<tr>
          <td class="num">${startNo + i}</td>
          <td class="name">${esc(r.full_name || r.personal_number || "—")}</td>
          <td class="email">${esc(email)}</td>
          <td class="nowrap">${esc(phone)}</td>
          ${showApp ? `<td><span class="pill ${pill}">${esc(appLabel)}</span></td>` : ""}
          ${showReason ? `<td class="reason">${esc(reason)}</td>` : ""}
          <td class="nowrap muted">${esc(relativeTime(r.last_login, lang))}</td>
          <td class="nowrap muted">${esc(compactExact(r.last_login, lang))}</td>
        </tr>`;
      })
      .join("");
    return `<table>${head}<tbody>${body}</tbody></table>`;
  };

  const renderDistrictSections = (
    list: AgentAppUser[],
    optsSec: { showReason: boolean; showApp: boolean },
  ) => {
    if (!list.length) {
      return `<p class="empty">${lang === "so" ? "Wax agent ah lama helin." : "No agents."}</p>`;
    }
    let running = 1;
    return groupByDistrict(list)
      .map(([district, agents]) => {
        const startNo = running;
        running += agents.length;
        return `
      <div class="district">
        <div class="district-head">
          <span class="district-title">Degmada ${esc(district)}</span>
          <span class="chip">${agents.length}</span>
        </div>
        ${renderAgentTable(agents, { ...optsSec, startNo })}
      </div>`;
      })
      .join("");
  };

  const renderReasonThenDistrictSections = (list: AgentAppUser[]) => {
    if (!list.length) {
      return `<p class="empty">${lang === "so" ? "Wax agent ah lama helin." : "No agents."}</p>`;
    }
    let running = 1;
    return groupByReason(list)
      .map(([reason, agents]) => {
        const districtBlocks = groupByDistrict(agents)
          .map(([district, districtAgents]) => {
            const startNo = running;
            running += districtAgents.length;
            return `
          <div class="district">
            <div class="district-head">
              <span class="district-title">Degmada ${esc(district)}</span>
              <span class="chip">${districtAgents.length}</span>
            </div>
            ${renderAgentTable(districtAgents, { showReason: true, showApp: false, startNo })}
          </div>`;
          })
          .join("");
        return `
      <div class="reason-block">
        <div class="reason-head">
          <h3>${esc(reason)}</h3>
          <span class="chip">${agents.length} agent</span>
        </div>
        ${districtBlocks}
      </div>`;
      })
      .join("");
  };

  const reportTitle =
    mode === "not_installed"
      ? lang === "so"
        ? "Warbixin — Looguma shubin"
        : "Report — Not installed"
      : lang === "so"
        ? "Warbixinta Isticmalaayasha App-ka"
        : "App Users Installation Report";

  const subtitle =
    lang === "so"
      ? "Siyaabaha buuxda ee rakibidda App-ka C.I.SH — degmo degmo"
      : "Full C.I.SH app installation status — by district";

  let sectionNo = 1;
  const sn = () => `${sectionNo++}. `;

  const sectionsHtml = (() => {
    const parts: string[] = [];

    if (mode === "full") {
      parts.push(`
        <section class="block">
          <div class="block-head ok">
            <h2>${sn()}Loogu shubay</h2>
            <span>${completed.length}</span>
          </div>
          ${renderDistrictSections(completed, { showReason: false, showApp: false })}
        </section>`);
      if (iphone.length) {
        parts.push(`
        <section class="block">
          <div class="block-head warn">
            <h2>${sn()}iPhone</h2>
            <span>${iphone.length}</span>
          </div>
          ${renderDistrictSections(iphone, { showReason: false, showApp: false })}
        </section>`);
      }
    }

    parts.push(`
        <section class="block">
          <div class="block-head reason">
            <h2>${mode === "full" ? sn() : ""}Looguma shubin — sabab leh</h2>
            <span>${notInstalledWithReason.length}</span>
          </div>
          <p class="block-note">${
            lang === "so"
              ? "Agents aan app-ka loogu shubin oo sabab la qoray — kala saaran sabab + degmo."
              : "Not installed with a recorded reason — grouped by reason, then district."
          }</p>
          ${reasonBreakdownHtml(notInstalledWithReason)}
          ${renderReasonThenDistrictSections(notInstalledWithReason)}
        </section>`);

    parts.push(`
        <section class="block">
          <div class="block-head bad">
            <h2>${mode === "full" ? sn() : ""}Looguma shubin — sabab lama sheegin</h2>
            <span>${notInstalledNoReason.length}</span>
          </div>
          <p class="block-note">${
            lang === "so"
              ? "Agents aan weli sabab loo qorin — degmo degmo."
              : "Not installed with no reason recorded — by district."
          }</p>
          ${renderDistrictSections(notInstalledNoReason, { showReason: false, showApp: false })}
        </section>`);

    return parts.join("");
  })();

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8"/>
<title>${esc(reportTitle)} — ${esc(qeebLabel)}</title>
<style>
  @page { size: A4 landscape; margin: 7mm 8mm 9mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #152033;
    font: 8.5px/1.28 "Segoe UI", system-ui, -apple-system, sans-serif;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { padding: 0; }

  /* —— Premium header —— */
  .topbar {
    display: grid;
    grid-template-columns: 78px 1fr auto;
    gap: 14px;
    align-items: center;
    padding: 10px 12px;
    margin: 0 0 8px;
    border-radius: 14px;
    background: linear-gradient(135deg, #fbf8f1 0%, #ffffff 48%, #f5f8fc 100%);
    border: 1px solid #e6dcc4;
    box-shadow: 0 2px 10px rgba(21, 32, 51, 0.05);
    position: relative;
  }
  .topbar::before {
    content: "";
    position: absolute;
    left: 0; top: 12px; bottom: 12px;
    width: 4px;
    border-radius: 999px;
    background: linear-gradient(180deg, #c4a35a 0%, #8a7350 100%);
  }
  .logo-wrap {
    width: 72px;
    height: 72px;
    border-radius: 16px;
    background: #fff;
    border: 1px solid #eadfc9;
    display: grid;
    place-items: center;
    box-shadow: 0 2px 8px rgba(21, 32, 51, 0.08);
  }
  .topbar img {
    width: 58px;
    height: 58px;
    object-fit: contain;
    display: block;
  }
  .brand-block { min-width: 0; padding-right: 4px; }
  .brand-kicker {
    margin: 0 0 4px;
    font-size: 10px; font-weight: 700; letter-spacing: .16em;
    text-transform: uppercase; color: #9a7a32;
  }
  .brand-title {
    margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.025em;
    color: #152033; line-height: 1.15;
  }
  .brand-sub {
    margin: 4px 0 0; font-size: 11px; color: #5b6577; line-height: 1.3;
  }
  .meta-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 168px;
    padding: 10px 12px;
    border-radius: 14px;
    background: linear-gradient(160deg, #1a2a42 0%, #152033 100%);
    border: 1px solid #c4a35a;
    box-shadow: 0 4px 14px rgba(21, 32, 51, 0.18);
  }
  .meta-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .meta-box .meta-label {
    color: #f0d59a;
    font-weight: 700;
    font-size: 9px;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .meta-box .meta-value {
    color: #fff;
    font-weight: 600;
    font-size: 11.5px;
    line-height: 1.25;
  }

  /* —— Compact meta + stats —— */
  .info-strip {
    display: flex; flex-wrap: wrap; gap: 6px 16px;
    padding: 7px 10px; margin-bottom: 7px;
    border-radius: 7px; background: #f7f4ee; border: 1px solid #eadfc9;
    font-size: 10px; color: #3f4654;
  }
  .info-strip b { color: #152033; font-weight: 700; }

  .summary {
    display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px;
  }
  .stat {
    flex: 1 1 0; min-width: 110px;
    display: flex; align-items: center; gap: 8px;
    border: 1px solid #e4e8ef; border-radius: 7px;
    padding: 5px 8px; background: #fff;
  }
  .stat .ico {
    width: 22px; height: 22px; border-radius: 6px;
    display: grid; place-items: center;
    font-size: 10px; font-weight: 800; color: #fff; flex-shrink: 0;
  }
  .stat .lbl {
    font-size: 7.5px; font-weight: 700; letter-spacing: .05em;
    text-transform: uppercase; color: #7a8496; line-height: 1.1;
  }
  .stat .val {
    font-size: 14px; font-weight: 700; color: #152033; letter-spacing: -0.03em; line-height: 1.1;
  }
  .stat .pct { font-size: 7.5px; color: #8892a0; }
  .stat.total .ico { background: #1f4f8a; }
  .stat.ok .ico { background: #1f7a55; }
  .stat.warn .ico { background: #b07a20; }
  .stat.bad .ico { background: #b2413b; }
  .stat.reason .ico { background: #6b4f1e; }
  .stat.ok .val { color: #1f7a55; }
  .stat.warn .val { color: #b07a20; }
  .stat.bad .val { color: #b2413b; }
  .stat.reason .val { color: #6b4f1e; }

  /* —— Sections —— */
  .block { margin-bottom: 8px; }
  .block-head {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 4px 8px; border-radius: 5px; margin-bottom: 4px;
  }
  .block-head h2 { margin: 0; font-size: 10.5px; font-weight: 700; }
  .block-head span {
    font-size: 9px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
    background: rgba(255,255,255,.65);
  }
  .block-head.ok { background: #e7f6ef; color: #176b49; border-left: 3px solid #1f7a55; }
  .block-head.warn { background: #fbf3e0; color: #8a5f12; border-left: 3px solid #b07a20; }
  .block-head.bad { background: #fbebea; color: #9b3530; border-left: 3px solid #b2413b; }
  .block-head.reason { background: #f3e8cf; color: #6b4f1e; border-left: 3px solid #c4a35a; }
  .block-note { margin: 0 0 5px; color: #667085; font-size: 8.5px; }

  .reason-summary {
    display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 6px;
  }
  .reason-pill {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 7px; border-radius: 999px;
    background: #fff8ea; border: 1px solid #e6d4a8;
    font-size: 8px; color: #5b4520;
  }
  .reason-pill b {
    display: inline-grid; place-items: center;
    min-width: 16px; height: 14px; padding: 0 4px;
    border-radius: 999px; background: #c4a35a; color: #fff; font-size: 7.5px;
  }
  .reason-block { margin: 0 0 7px; padding: 5px 6px 4px; border: 1px solid #eadfc9; border-radius: 6px; background: #fcfaf5; }
  .reason-head {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    margin: 0 0 4px; padding-bottom: 3px; border-bottom: 1px dashed #e0d2b0;
  }
  .reason-head h3 { margin: 0; font-size: 9.5px; font-weight: 700; color: #5b4520; }

  .district { margin: 0 0 5px; }
  .district-head {
    display: flex; align-items: center; gap: 6px;
    margin: 0 0 2px; padding: 2px 0;
  }
  .district-title {
    font-size: 9px; font-weight: 700; color: #243044;
    padding-left: 6px; border-left: 2px solid #c4a35a;
  }
  .chip {
    font-size: 8px; font-weight: 700; color: #6b4f1e; background: #f3e8cf;
    border-radius: 999px; padding: 0 6px; line-height: 1.5;
  }

  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td {
    border: 1px solid #d8dde6; padding: 4px 6px; text-align: left;
    vertical-align: middle; word-wrap: break-word;
  }
  th {
    background: #152033; color: #fff; font-size: 9px; font-weight: 700;
    letter-spacing: .04em; text-transform: uppercase;
  }
  td { font-size: 10px; color: #243044; line-height: 1.35; }
  tr:nth-child(even) td { background: #f6f8fb; }
  td.num, th.num { width: 26px; text-align: center; }
  th.name-col, td.name { width: 22%; }
  th.email-col, td.email { width: 20%; }
  th.phone-col { width: 11%; }
  th.app-col { width: 10%; }
  th.reason-col, td.reason { width: 18%; }
  th.act-col { width: 10%; }
  th.time-col { width: 11%; }
  td.name { font-weight: 600; }
  td.nowrap { white-space: nowrap; }
  td.muted { color: #5b6577; }
  .pill {
    display: inline-block; padding: 1px 6px; border-radius: 999px;
    font-size: 8.5px; font-weight: 700; line-height: 1.45;
  }
  .pill.ok { background: #e7f6ef; color: #176b49; }
  .pill.warn { background: #fbf3e0; color: #8a5f12; }
  .pill.bad { background: #fbebea; color: #9b3530; }
  .empty { color: #8892a0; font-style: italic; padding: 4px 0; margin: 0; }

  .footer {
    margin-top: 6px; padding: 5px 8px;
    background: #152033; color: #c9d2e0; border-radius: 0 0 6px 6px;
    font-size: 7.5px; display: flex; justify-content: space-between; gap: 10px;
    border-top: 2px solid #c4a35a;
  }
  .footer strong { color: #f0d59a; }

  @media print {
    tr { page-break-inside: avoid; }
    .block-head, .district-head { page-break-after: avoid; }
    /* Do NOT force whole district/block onto one page — that wasted space & inflated page count. */
  }
</style>
</head>
<body>
  <div class="sheet">
    <header class="topbar">
      <div class="logo-wrap">
        <img src="${esc(emblemSrc)}" alt="Emblem" />
      </div>
      <div class="brand-block">
        <p class="brand-kicker">LMSBR · Amniga · C.I.SH</p>
        <h1 class="brand-title">${esc(reportTitle)}</h1>
        <p class="brand-sub">${esc(subtitle)}</p>
      </div>
      <div class="meta-box">
        <div class="meta-row">
          <span class="meta-label">${lang === "so" ? "La daabacay" : "Printed"}</span>
          <span class="meta-value">${esc(printedAt)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">${lang === "so" ? "Filter" : "Filter"}</span>
          <span class="meta-value">${esc(countyFilterActive ? countyLabel : (lang === "so" ? "Dhammaan degmooyinka" : "All districts"))}</span>
        </div>
      </div>
    </header>

    <div class="info-strip">
      <span><b>Qeebta:</b> ${esc(qeebLabel)}</span>
      <span><b>${lang === "so" ? "Taliyaha Qeybta" : "Sector commander"}:</b> ${esc(taliyeName)}${
        taliyePhone !== "—" ? ` · ${esc(taliyePhone)}` : ""
      }</span>
      <span><b>${lang === "so" ? "Degmooyinka" : "Districts"}:</b> ${esc(districtNames)}</span>
    </div>

    <div class="summary">
      <div class="stat total">
        <div class="ico">Σ</div>
        <div>
          <div class="lbl">${lang === "so" ? "Tirada guud" : "Total"}</div>
          <div class="val">${rows.length}</div>
        </div>
      </div>
      <div class="stat ok">
        <div class="ico">✓</div>
        <div>
          <div class="lbl">Loogu shubay</div>
          <div class="val">${completed.length} <span class="pct">${pct(completed.length)}%</span></div>
        </div>
      </div>
      <div class="stat warn">
        <div class="ico">i</div>
        <div>
          <div class="lbl">iPhone</div>
          <div class="val">${iphone.length} <span class="pct">${pct(iphone.length)}%</span></div>
        </div>
      </div>
      <div class="stat bad">
        <div class="ico">×</div>
        <div>
          <div class="lbl">Looguma shubin</div>
          <div class="val">${notInstalled.length} <span class="pct">${pct(notInstalled.length)}%</span></div>
        </div>
      </div>
      <div class="stat reason">
        <div class="ico">?</div>
        <div>
          <div class="lbl">${lang === "so" ? "Sabab leh" : "With reason"}</div>
          <div class="val">${notInstalledWithReason.length} <span class="pct">${pct(notInstalledWithReason.length)}%</span></div>
        </div>
      </div>
    </div>

    ${sectionsHtml}

    <div class="footer">
      <span><strong>LMSBR · Amniga</strong> · ${esc(qeebLabel)}</span>
      <span>${lang === "so" ? "Warbixin nidaamsan — degmo degmo" : "Structured report — district by district"}</span>
      <span>${lang === "so" ? "Diyaariyey" : "Prepared by"}: Amniga System</span>
    </div>
  </div>
</body>
</html>`;
}

export function printHtmlDocument(html: string, frameId = "amniga-app-users-print-frame") {
  const prev = document.getElementById(frameId);
  if (prev) prev.remove();

  const iframe = document.createElement("iframe");
  iframe.id = frameId;
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("print_frame_failed");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 800);
  };
  win.addEventListener("afterprint", cleanup);

  return new Promise<void>((resolve) => {
    const trigger = () => {
      try {
        win.focus();
        win.print();
      } finally {
        cleanup();
        resolve();
      }
    };
    const img = doc.querySelector("img");
    if (img && !(img as HTMLImageElement).complete) {
      let done = false;
      const once = () => {
        if (done) return;
        done = true;
        setTimeout(trigger, 40);
      };
      img.addEventListener("load", once);
      img.addEventListener("error", once);
      setTimeout(once, 1200);
    } else {
      setTimeout(trigger, 80);
    }
  });
}
