"use strict";

// セクター統計ページ — stats-data.json（sector_stats.py が生成）を表示する

const marketSelect = document.getElementById("market-select");
const statusMsg = document.getElementById("status-msg");
let STATS = null;

function showStatus(text) {
  statusMsg.textContent = text;
  statusMsg.hidden = !text;
}

function fmtPct(v) {
  if (v === null || v === undefined) return "–";
  return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
}

function pctClass(v) {
  if (v === null || v === undefined) return "";
  return v >= 0 ? "pos" : "neg";
}

// 直近63営業日の終値からスパークラインSVGを作る
function sparkline(closes, up) {
  const w = 132, h = 40, pad = 2;
  const min = Math.min(...closes), max = Math.max(...closes);
  const span = max - min || 1;
  const pts = closes.map((c, i) => {
    const x = pad + (i / (closes.length - 1)) * (w - pad * 2);
    const y = h - pad - ((c - min) / span) * (h - pad * 2);
    return x.toFixed(1) + "," + y.toFixed(1);
  });
  const cls = up ? "spark-up" : "spark-down";
  return '<svg class="spark ' + cls + '" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<polygon class="spark-fill" points="' + pad + "," + (h - pad) + " " + pts.join(" ") + " " + (w - pad) + "," + (h - pad) + '"></polygon>' +
    '<polyline class="spark-line" points="' + pts.join(" ") + '"></polyline></svg>';
}

function chip(label, v) {
  return '<span class="stats-chip"><span class="stats-chip-label">' + label + "</span>" +
    '<span class="stats-chip-val ' + pctClass(v) + '">' + fmtPct(v) + "</span></span>";
}

function sectorCard(s, extra) {
  const sym = s.symbols.join(" / ");
  return '<article class="stats-card">' +
    '<div class="stats-card-head"><h3 class="stats-card-name">' + s.sector_name + "</h3>" +
    '<span class="stats-card-sym">' + sym + "</span></div>" +
    sparkline(s.closes, s.ret_3m >= 0) +
    '<div class="stats-chips">' +
    chip("1週", s.ret_1w) + chip("1ヶ月", s.ret_1m) + chip("3ヶ月", s.ret_3m) + chip("対ベンチ比", s.rel_1m) +
    "</div>" +
    (extra ? '<p class="stats-card-reason">' + extra + "</p>" : "") +
    "</article>";
}

// 「次に来そうなテーマ」のルールベース推論
function inferNext(sectors) {
  const scored = [];
  for (const s of sectors) {
    let score = 0;
    const reasons = [];
    // 中期はまだ弱いのに短期モメンタムが上向きへ転じた（ローテーション初期）
    if (s.ret_2w !== null && s.ret_2w > 0 && s.ret_3m <= 5 && s.ret_1w > -3) {
      score += 3;
      reasons.push("3ヶ月ではまだ弱いものの、直近2週でプラスに転じ、短期モメンタムが上向きに転じています。");
    }
    // 全体安の中でベンチマークを大きく上回る（資金の受け皿）
    if (s.rel_1m !== null && s.rel_1m >= 5 && s.ret_1m >= -1) {
      score += 2;
      reasons.push("ベンチマーク比が1ヶ月で " + fmtPct(s.rel_1m) + " と大きく上回り、資金の受け皿になっています。");
    }
    // ベンチマーク比が3ヶ月→1ヶ月で改善（出遅れ解消の初期）
    if (s.rel_1m !== null && s.rel_3m !== null && (s.rel_1m - s.rel_3m) >= 4) {
      score += 2;
      reasons.push("ベンチマーク比が3ヶ月時点より1ヶ月で改善しており、出遅れの解消が始まっている可能性があります。");
    }
    if (score > 0) scored.push({ s, score, reasons });
  }
  scored.sort((a, b) => b.score - a.score || b.s.ret_1m - a.s.ret_1m);
  return scored.slice(0, 3);
}

function barChart(sectors) {
  const rows = [...sectors].sort((a, b) => b.ret_1m - a.ret_1m);
  const maxAbs = Math.max(...rows.map((s) => Math.abs(s.ret_1m || 0)), 1);
  const W = 680, rowH = 26, labelW = 118, valW = 64;
  const chartW = W - labelW - valW;
  const zeroX = labelW + chartW / 2;
  const H = rows.length * rowH + 4;
  let svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="stats-bars" role="img" aria-label="1ヶ月騰落率グラフ">';
  svg += '<line x1="' + zeroX + '" y1="0" x2="' + zeroX + '" y2="' + H + '" class="stats-zero"></line>';
  rows.forEach((s, i) => {
    const y = i * rowH + 4;
    const v = s.ret_1m || 0;
    const bw = Math.abs(v) / maxAbs * (chartW / 2 - 4);
    const x = v >= 0 ? zeroX : zeroX - bw;
    const cls = v >= 0 ? "bar-pos" : "bar-neg";
    svg += '<text x="' + (labelW - 8) + '" y="' + (y + 13) + '" class="stats-bar-label" text-anchor="end">' + s.sector_name + "</text>";
    svg += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + Math.max(bw, 1).toFixed(1) + '" height="17" rx="3" class="' + cls + '"></rect>';
    svg += '<text x="' + (v >= 0 ? zeroX + bw + 6 : zeroX - bw - 6) + '" y="' + (y + 13) + '" class="stats-bar-val" text-anchor="' + (v >= 0 ? "start" : "end") + '">' + fmtPct(s.ret_1m) + "</text>";
  });
  return svg + "</svg>";
}

function heatCell(v) {
  if (v === null || v === undefined) return "<td>–</td>";
  const intensity = Math.min(Math.abs(v) / 20, 1) * 55;
  const color = v >= 0 ? "var(--light)" : "var(--accent-text)";
  const style = ' style="background: color-mix(in srgb, ' + color + " " + intensity.toFixed(0) + '%, transparent)"';
  return "<td" + style + ">" + fmtPct(v) + "</td>";
}

function heatTable(sectors) {
  const rows = [...sectors].sort((a, b) => b.ret_1m - a.ret_1m);
  let html = "<thead><tr><th>セクター</th><th>1週</th><th>1ヶ月</th><th>3ヶ月</th><th>対ベンチ比</th></tr></thead><tbody>";
  for (const s of rows) {
    html += "<tr><td>" + s.sector_name + "</td>" +
      heatCell(s.ret_1w) + heatCell(s.ret_1m) + heatCell(s.ret_3m) + heatCell(s.rel_1m) + "</tr>";
  }
  return html + "</tbody>";
}

function render(market) {
  const sectors = STATS.sectors.filter((s) => s.market === market);
  const bench = STATS.benchmarks[market];
  document.getElementById("stats-asof").textContent =
    "基準日 " + bench.as_of + "（ベンチマーク：" + bench.name + " 1ヶ月 " + fmtPct(bench.ret_1m) + "）";

  const up = sectors.filter((s) => s.ret_1m > 0).length;
  document.getElementById("count-up").textContent = up + " / " + sectors.length;
  document.getElementById("count-down").textContent = (sectors.length - up) + " / " + sectors.length;
  const byMonth = [...sectors].sort((a, b) => b.ret_1m - a.ret_1m);
  document.getElementById("strongest").textContent = byMonth[0].sector_name;
  document.getElementById("weakest").textContent = byMonth[byMonth.length - 1].sector_name;

  document.getElementById("hot-cards").innerHTML = byMonth.slice(0, 3).map((s) => sectorCard(s)).join("");
  document.getElementById("cold-cards").innerHTML = byMonth.slice(-3).reverse().map((s) => sectorCard(s)).join("");
  document.getElementById("bar-chart").innerHTML = barChart(sectors);
  document.getElementById("heat-table").innerHTML = heatTable(sectors);

  const next = inferNext(sectors);
  document.getElementById("next-cards").innerHTML = next.length
    ? next.map((n) => sectorCard(n.s, n.reasons.join(" "))).join("")
    : '<p class="stats-note">現在の相場では、短期モメンタムの反転やベンチマーク比の改善が見られるテーマはありません。</p>';
}

async function init() {
  try {
    const res = await fetch("stats-data.json");
    if (!res.ok) throw new Error("fetch failed");
    STATS = await res.json();
    marketSelect.addEventListener("change", () => render(marketSelect.value));
    render(marketSelect.value);
  } catch (e) {
    showStatus("統計データを読み込めませんでした。");
  }
}

init();
