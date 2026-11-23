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
