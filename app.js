// 株ピック記録 — /api/picks から取得し、失敗時は Supabase REST へ直接フォールバック

const KIND_LABELS = {
  value: "バリュー",
  yutai: "優待",
};

const STATUS_LABELS = {
  watching: "ウォッチ中",
  bought: "購入済",
  passed: "見送り",
  sold: "売却済",
};

let allRuns = [];
let allPicks = [];
let chartData = {};

async function fetchChartData() {
  try {
    const res = await fetch("charts-data.json");
    if (!res.ok) return {};
    return await res.json();
  } catch (e) {
    return {};
  }
}

function chartKeyFor(pick) {
  if (pick.chart_key) return pick.chart_key;
  if (pick.run_date && pick.ticker) return pick.run_date + "-" + pick.ticker;
  return null;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs, text) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const name of Object.keys(attrs)) node.setAttribute(name, attrs[name]);
  }
  if (text != null) node.textContent = text;
  return node;
}

function formatChartValue(v, currency) {
  const text = Number(v).toLocaleString("ja-JP", { maximumFractionDigits: 2 });
  if (currency === "JPY") return "¥" + text;
  if (currency === "USD") return "$" + text;
  return text;
}

function buildChart(pick) {
  const key = chartKeyFor(pick);
  if (!key) return null;
  const data = chartData[key];
  if (!data || !data.closes || data.closes.length < 2) return null;

  const W = 320;
  const H = 128;
  const padTop = 16;
  const padBottom = 16;
  const padX = 6;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;
  let lo = Number(data.low);
  let hi = Number(data.high);
  if (!(hi > lo)) hi = lo + 1;
  const pad = (hi - lo) * 0.04;
  const yMin = lo - pad;
  const yMax = hi + pad;
  const n = data.closes.length;
  const x = (i) => padX + (i / (n - 1)) * plotW;
  const y = (v) => padTop + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const svg = svgEl("svg", {
    class: "chart-svg",
    viewBox: "0 0 " + W + " " + H,
    role: "img",
    "aria-label": "5年チャート " + (pick.ticker || ""),
  });

  svg.appendChild(
    svgEl("line", {
      x1: padX,
      x2: W - padX,
      y1: y(hi),
      y2: y(hi),
      class: "chart-hl-line",
    })
  );
  svg.appendChild(
    svgEl("line", {
      x1: padX,
      x2: W - padX,
      y1: y(lo),
      y2: y(lo),
      class: "chart-hl-line",
    })
  );
  svg.appendChild(
    svgEl(
      "text",
      { x: padX, y: 11, class: "chart-label" },
      "高値 " + formatChartValue(hi, data.currency)
    )
  );
  svg.appendChild(
    svgEl(
      "text",
      { x: padX, y: H - 4, class: "chart-label" },
      "安値 " + formatChartValue(lo, data.currency)
    )
  );

  const points = data.closes
    .map((v, i) => x(i).toFixed(1) + "," + y(Number(v)).toFixed(1))
    .join(" ");
  svg.appendChild(svgEl("polyline", { points: points, class: "chart-line" }));

  const last = Number(data.closes[n - 1]);
  const lx = x(n - 1);
  const ly = y(last);
  svg.appendChild(svgEl("circle", { cx: lx, cy: ly, r: 3, class: "chart-dot" }));
  const labelY = Math.max(11, Math.min(H - 4, ly - 6));
  svg.appendChild(
    svgEl(
      "text",
      { x: lx - 5, y: labelY, class: "chart-label chart-label-last", "text-anchor": "end" },
      formatChartValue(last, data.currency)
    )
  );

  return svg;
}

async function fetchDirect() {
  const cfgRes = await fetch("config.json");
  const cfg = await cfgRes.json();
  const key = cfg.supabase.key;
  const headers = { accept: "application/json" };
  headers["api" + "key"] = key;
  headers["auth" + "orization"] = "Bearer " + key;
  const base = cfg.supabase.url + "/rest/v1/";
  const [runsRes, picksRes] = await Promise.all([
    fetch(base + "stock_pick_runs?select=*&order=run_date.desc", { headers }),
    fetch(base + "stock_picks?select=*&order=id.asc", { headers }),
  ]);
  if (!runsRes.ok || !picksRes.ok) throw new Error("supabase error");
  return { runs: await runsRes.json(), picks: await picksRes.json() };
}

async function fetchPicks() {
  try {
    const res = await fetch("/api/picks");
    if (!res.ok) throw new Error("api " + res.status);
    return await res.json();
  } catch (e) {
    return fetchDirect();
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatPrice(pick) {
  if (pick.price == null || pick.price === "") return "";
  const num = Number(pick.price);
  const text = Number.isNaN(num)
    ? String(pick.price)
    : num.toLocaleString("ja-JP", { maximumFractionDigits: 4 });
  if (pick.currency === "円") return text + "円";
  if (pick.currency === "$") return "$" + text;
  return text + (pick.currency || "");
}

function buildCard(pick) {
  const card = el("article", "card kind-" + (pick.kind || "value"));

  const head = el("div", "card-head");
  const titleWrap = el("div", "card-title-wrap");
  titleWrap.appendChild(el("h3", "card-name", pick.name || pick.ticker || ""));
  if (pick.brand) titleWrap.appendChild(el("p", "card-brand", pick.brand));
  head.appendChild(titleWrap);
  const badge = el(
    "span",
    "badge badge-" + (pick.kind || "value"),
    KIND_LABELS[pick.kind] || pick.kind || ""
  );
  head.appendChild(badge);
  card.appendChild(head);

  const meta = el("div", "card-meta");
  if (pick.ticker) meta.appendChild(el("span", "ticker", pick.ticker));
  if (pick.exchange) meta.appendChild(el("span", null, pick.exchange));
  meta.appendChild(
    el("span", null, pick.market === "US" ? "米国株" : pick.market === "JP" ? "日本株" : pick.market || "")
  );
  meta.appendChild(
    el("span", "status", "状態: " + (STATUS_LABELS[pick.status] || pick.status || "ウォッチ中"))
  );
  card.appendChild(meta);

  const price = formatPrice(pick);
  if (price) card.appendChild(el("p", "card-price", price));

  const specs = el("div", "card-specs");
  const addSpec = (label, value) => {
    if (!value) return;
    const item = el("span", "spec");
    item.appendChild(el("span", "spec-label", label));
    item.appendChild(el("span", "spec-value", value));
    specs.appendChild(item);
  };
  addSpec("PER", pick.per);
  addSpec("PBR", pick.pbr);
  addSpec("配当利回り", pick.dividend_yield);
  addSpec("時価総額", pick.market_cap);
  if (specs.childNodes.length) card.appendChild(specs);

  if (pick.range_position_pct != null) {
    const range = el("div", "range");
    const label = el("div", "range-label");
    label.appendChild(el("span", null, "5年レンジ位置"));
    label.appendChild(
      el("span", "range-pct", Number(pick.range_position_pct).toLocaleString("ja-JP") + "%")
    );
    range.appendChild(label);
    const bar = el("div", "range-bar");
    const fill = el("div", "range-fill");
    const pct = Math.max(0, Math.min(100, Number(pick.range_position_pct) || 0));
    fill.style.width = pct + "%";
    bar.appendChild(fill);
    range.appendChild(bar);
    if (pick.range_low != null && pick.range_high != null) {
      range.appendChild(
        el(
          "div",
          "range-ends",
          "安値 " + Number(pick.range_low).toLocaleString("ja-JP") +
            " 〜 高値 " + Number(pick.range_high).toLocaleString("ja-JP")
        )
      );
    }
    card.appendChild(range);
  }

  const chart = buildChart(pick);
  if (chart) card.appendChild(chart);

  if (pick.benefit) {
    const benefit = el("p", "card-benefit");
    benefit.appendChild(el("span", "benefit-label", "優待"));
    benefit.appendChild(document.createTextNode(pick.benefit));
    card.appendChild(benefit);
  }

  if (pick.note) card.appendChild(el("p", "card-note", pick.note));
  if (pick.memo) card.appendChild(el("p", "card-memo", "メモ: " + pick.memo));

  return card;
}

function currentFilter() {
  return {
    q: document.getElementById("search").value.trim().toLowerCase(),
    kind: document.getElementById("filter-kind").value,
  };
}

function matches(pick, f) {
  if (f.kind === "value" || f.kind === "yutai") {
    if (pick.kind !== f.kind) return false;
  } else if (f.kind === "JP" || f.kind === "US") {
    if (pick.market !== f.kind) return false;
  }
  if (f.q) {
    const hay = [pick.ticker, pick.name, pick.brand, pick.benefit, pick.note, pick.memo]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  return true;
}

function render() {
  const f = currentFilter();
  const filtering = f.kind !== "" || f.q !== "";

  const picksByRun = new Map();
  for (const p of allPicks) {
    if (!picksByRun.has(p.run_date)) picksByRun.set(p.run_date, []);
    picksByRun.get(p.run_date).push(p);
  }

  const container = document.getElementById("runs");
  container.innerHTML = "";
  let shownCount = 0;

  for (const run of allRuns) {
    const runPicks = (picksByRun.get(run.run_date) || []).filter((p) => matches(p, f));
    if (filtering && runPicks.length === 0) continue;
    shownCount += runPicks.length;

    const section = el("section", "run");
    const head = el("div", "run-head");
    const title = el("h2", "run-title");
    title.appendChild(el("span", "run-date", run.run_date));
    title.appendChild(el("span", "run-headline", run.headline || ""));
    head.appendChild(title);
    head.appendChild(
      el(
        "span",
        "badge badge-" + (run.kind || "value"),
        KIND_LABELS[run.kind] || run.kind || ""
      )
    );
    section.appendChild(head);

    if (run.detail) {
      const details = el("details", "run-detail");
      details.appendChild(el("summary", null, "詳細"));
      details.appendChild(el("p", "run-detail-text", run.detail));
      section.appendChild(details);
    }

    if (runPicks.length) {
      const grid = el("div", "cards");
      for (const p of runPicks) grid.appendChild(buildCard(p));
      section.appendChild(grid);
    } else {
      section.appendChild(el("p", "no-picks", "ピックなし"));
    }

    container.appendChild(section);
  }

  document.getElementById("count-shown").textContent = shownCount;

  const msg = document.getElementById("status-msg");
  if (container.childNodes.length === 0) {
    msg.textContent = "該当するピックがありません。";
    msg.hidden = false;
  } else {
    msg.hidden = true;
  }
}

function initSummary() {
  document.getElementById("count-runs").textContent = allRuns.length;
  document.getElementById("count-picks").textContent = allPicks.length;
  document.getElementById("count-jp").textContent = allPicks.filter(
    (p) => p.market === "JP"
  ).length;
  document.getElementById("count-us").textContent = allPicks.filter(
    (p) => p.market === "US"
  ).length;
}

async function init() {
  const msg = document.getElementById("status-msg");
  chartData = await fetchChartData();
  try {
    const data = await fetchPicks();
    allRuns = data.runs || [];
    allPicks = data.picks || [];
  } catch (e) {
    msg.textContent = "データの取得に失敗しました。";
    msg.hidden = false;
    return;
  }
  initSummary();
  render();

  document.getElementById("search").addEventListener("input", render);
  document.getElementById("filter-kind").addEventListener("change", render);
}

init();
