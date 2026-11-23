"use strict";

// 株式日報ページ — Supabase（stock_daily_reports）から日次レポートを表示する

const dateSelect = document.getElementById("date-select");
const reportEl = document.getElementById("report");
const statusMsg = document.getElementById("status-msg");

function showStatus(text) {
  statusMsg.textContent = text;
  statusMsg.hidden = !text;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// インライン書式: **太字** と [text](url)
function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (m, label, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

// 日報 Markdown の最小レンダラ（見出し・表・リスト・段落のみ）
function renderMarkdown(md) {
  const lines = md.split(/\r?\n/);
  const html = [];
  let i = 0;
  const isTableRow = (l) => /^\|.*\|\s*$/.test(l.trim());
  const isTableSep = (l) => /^\|[\s:|-]+\|\s*$/.test(l.trim());
  const cells = (l) =>
    l.trim().replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(cells(lines[i]));
        i++;
      }
      let t = '<div class="report-table-wrap"><table class="report-table"><thead><tr>';
      t += head.map((c) => `<th>${renderInline(c)}</th>`).join("");
      t += "</tr></thead><tbody>";
      for (const row of bodyRows) {
        t += "<tr>" + row.map((c) => `<td>${renderInline(c)}</td>`).join("") + "</tr>";
      }
      t += "</tbody></table></div>";
      html.push(t);
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 4); // # はページ内で h2 相当
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) { html.push("<hr>"); i++; continue; }

    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      html.push("<ul>" + items.map((it) => `<li>${renderInline(it)}</li>`).join("") + "</ul>");
      continue;
    }

    // 段落（空行までを連結）
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s+/.test(lines[i].trim()) && !isTableRow(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    html.push(`<p>${para.map(renderInline).join("<br>")}</p>`);
  }
  return html.join("\n");
}

async function loadReport(date) {
  reportEl.innerHTML = "";
  showStatus("読み込み中…");
  try {
    const res = await fetch(`/api/daily-report?date=${encodeURIComponent(date)}`);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    if (!data.report) throw new Error("not found");
    reportEl.innerHTML = renderMarkdown(data.report.content_md);
    showStatus("");
  } catch (e) {
    showStatus("日報を読み込めませんでした。");
  }
}

async function init() {
  try {
    const res = await fetch("/api/daily-reports");
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    const reports = data.reports || [];
    document.getElementById("count-days").textContent = reports.length;
    if (!reports.length) { showStatus("日報がまだありません。"); return; }
    const latest = reports[0];
    document.getElementById("latest-date").textContent = latest.report_date;
    document.getElementById("count-tickers").textContent =
      (latest.tickers || []).length;

    for (const r of reports) {
      const opt = document.createElement("option");
      opt.value = r.report_date;
      opt.textContent = r.title || r.report_date;
      dateSelect.appendChild(opt);
    }
    dateSelect.value = latest.report_date;
    dateSelect.addEventListener("change", () => loadReport(dateSelect.value));
    loadReport(latest.report_date);
  } catch (e) {
    showStatus("日報一覧を読み込めませんでした。");
  }
}

init();

// ── 日米市場の休場日カレンダー ─────────────────────────────
// 平日の休場日のみ収載（土日はカレンダー側で休場表示）
// jp/us: 休場（名称）, usEarly: 米国株の短縮取引日（名称）
const MARKET_HOLIDAYS = {
  // 2025
  "2025-01-01": { jp: "年末年始", us: "元日" },
  "2025-01-02": { jp: "年末年始" },
  "2025-01-13": { jp: "成人の日" },
  "2025-01-20": { us: "キング牧師誕生日" },
  "2025-02-11": { jp: "建国記念の日" },
  "2025-02-17": { us: "プレジデンツ・デー" },
  "2025-02-24": { jp: "天皇誕生日（振替）" },
  "2025-03-20": { jp: "春分の日" },
  "2025-04-18": { us: "聖金曜日" },
  "2025-04-29": { jp: "昭和の日" },
  "2025-05-05": { jp: "こどもの日" },
  "2025-05-06": { jp: "振替休日" },
  "2025-05-26": { us: "メモリアル・デー" },
  "2025-06-19": { us: "ジューンティーンス" },
  "2025-07-03": { usEarly: "独立記念日前日" },
  "2025-07-04": { us: "独立記念日" },
  "2025-07-21": { jp: "海の日" },
  "2025-08-11": { jp: "山の日" },
  "2025-09-01": { us: "レイバー・デー" },
  "2025-09-15": { jp: "敬老の日" },
  "2025-09-23": { jp: "秋分の日" },
  "2025-10-13": { jp: "スポーツの日" },
  "2025-11-03": { jp: "文化の日" },
  "2025-11-24": { jp: "勤労感謝の日（振替）" },
  "2025-11-27": { us: "感謝祭" },
  "2025-11-28": { usEarly: "感謝祭翌日" },
  "2025-12-24": { usEarly: "クリスマス前日" },
  "2025-12-25": { us: "クリスマス" },
  "2025-12-31": { jp: "年末休場" },
  // 2026
  "2026-01-01": { jp: "年末年始", us: "元日" },
  "2026-01-02": { jp: "年末年始" },
  "2026-01-12": { jp: "成人の日" },
  "2026-01-19": { us: "キング牧師誕生日" },
  "2026-02-11": { jp: "建国記念の日" },
  "2026-02-16": { us: "プレジデンツ・デー" },
  "2026-02-23": { jp: "天皇誕生日" },
  "2026-03-20": { jp: "春分の日" },
  "2026-04-03": { us: "聖金曜日" },
  "2026-04-29": { jp: "昭和の日" },
  "2026-05-04": { jp: "みどりの日" },
  "2026-05-05": { jp: "こどもの日" },
  "2026-05-06": { jp: "振替休日" },
  "2026-05-25": { us: "メモリアル・デー" },
  "2026-06-19": { us: "ジューンティーンス" },
  "2026-07-02": { usEarly: "独立記念日（振替）の前日" },
  "2026-07-03": { us: "独立記念日（振替）" },
  "2026-07-20": { jp: "海の日" },
  "2026-08-11": { jp: "山の日" },
  "2026-09-07": { us: "レイバー・デー" },
  "2026-09-21": { jp: "敬老の日" },
  "2026-09-22": { jp: "国民の休日" },
  "2026-09-23": { jp: "秋分の日" },
  "2026-10-12": { jp: "スポーツの日" },
  "2026-11-03": { jp: "文化の日" },
  "2026-11-23": { jp: "勤労感謝の日" },
  "2026-11-26": { us: "感謝祭" },
  "2026-11-27": { usEarly: "感謝祭翌日" },
  "2026-12-24": { usEarly: "クリスマス前日" },
  "2026-12-25": { us: "クリスマス" },
  "2026-12-31": { jp: "年末休場" },
  // 2027
  "2027-01-01": { jp: "年末年始", us: "元日" },
  "2027-01-11": { jp: "成人の日" },
  "2027-01-18": { us: "キング牧師誕生日" },
  "2027-02-11": { jp: "建国記念の日" },
  "2027-02-15": { us: "プレジデンツ・デー" },
  "2027-02-23": { jp: "天皇誕生日" },
  "2027-03-26": { us: "聖金曜日" },
  "2027-04-29": { jp: "昭和の日" },
  "2027-05-03": { jp: "憲法記念日" },
  "2027-05-04": { jp: "みどりの日" },
  "2027-05-05": { jp: "こどもの日" },
  "2027-05-31": { us: "メモリアル・デー" },
  "2027-06-18": { us: "ジューンティーンス（振替）" },
  "2027-07-05": { us: "独立記念日（振替）" },
  "2027-07-19": { jp: "海の日" },
  "2027-08-11": { jp: "山の日" },
  "2027-09-06": { us: "レイバー・デー" },
  "2027-09-20": { jp: "敬老の日" },
  "2027-09-23": { jp: "秋分の日" },
  "2027-10-11": { jp: "スポーツの日" },
  "2027-11-03": { jp: "文化の日" },
  "2027-11-23": { jp: "勤労感謝の日" },
  "2027-11-25": { us: "感謝祭" },
  "2027-11-26": { usEarly: "感謝祭翌日" },
  "2027-12-24": { us: "クリスマス（振替）" },
  "2027-12-31": { jp: "年末休場" },
};

const calTitle = document.getElementById("cal-title");
const calGrid = document.getElementById("cal-grid");
const calNote = document.getElementById("cal-note");
const nowJst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
let calYear = nowJst.getFullYear();
let calMonth = nowJst.getMonth();
const todayKey = `${nowJst.getFullYear()}-${String(nowJst.getMonth() + 1).padStart(2, "0")}-${String(nowJst.getDate()).padStart(2, "0")}`;

function renderCalendar() {
  calTitle.textContent = `${calYear}年${calMonth + 1}月`;
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  let html = "";
  for (let i = 0; i < firstDow; i++) html += '<div class="market-cal-cell empty"></div>';
  const notes = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(calYear, calMonth, d).getDay();
    const h = MARKET_HOLIDAYS[key] || {};
    const classes = ["market-cal-cell"];
    if (dow === 0 || dow === 6) classes.push("weekend");
    if (key === todayKey) classes.push("today");
    let badges = "";
    if (h.jp) { badges += '<i class="cal-badge jp">日</i>'; notes.push(`${d}日 日本：${h.jp}`); }
    if (h.us) { badges += '<i class="cal-badge us">米</i>'; notes.push(`${d}日 米国：${h.us}`); }
    if (h.usEarly) { badges += '<i class="cal-badge early">短</i>'; notes.push(`${d}日 米国：短縮取引（${h.usEarly}）`); }
    html += `<div class="${classes.join(" ")}"><span class="market-cal-day">${d}</span>${badges}</div>`;
  }
  calGrid.innerHTML = html;
  calNote.textContent = notes.length ? notes.join(" ／ ") : "この月の平日休場日はありません。";
}

document.getElementById("cal-prev").addEventListener("click", () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar();
});
document.getElementById("cal-next").addEventListener("click", () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar();
});
renderCalendar();
