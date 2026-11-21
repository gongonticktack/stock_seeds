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

// カラーパレット（Color Hunt の人気パレットから選定、金融・ビジネス向けの
// 落ち着いた色中心。現行・他サイト使用分とは1色も重ならないよう選んだ）
// colors: パレット本来の4色（ストライプ表示用、比重 41/26/18/15）
// vars:   役割（メイン/サブ/ライト/アクセント）と、パレットから導出した
//         背景・面・文字色。暗いパレットは暗背景＋明文字、明るいパレットは
//         明背景＋暗文字になるよう各パレットごとに定義する。
const PALETTES = [
  {
    name: "Deep Ocean",
    colors: ["#1B262C", "#0F4C75", "#3282B8", "#BBE1FA"],
    vars: {
      main: "#64B2E0", sub: "#BBE1FA", light: "#64B2E0", accent: "#BBE1FA",
      accentText: "#8FD0F0",
      bg: "#121A20", surface: "#1B262C", surfaceMuted: "#24333C",
      text: "#E9F2F7", muted: "#A7BCC7", border: "#31434E",
      onMain: "#0B1C26", headerSub: "#0B1C26",
    },
  },
  {
    name: "Slate Teal",
    colors: ["#2C3333", "#395B64", "#A5C9CA", "#E7F6F2"],
    vars: {
      main: "#395B64", sub: "#2C3333", light: "#2E6E6A", accent: "#A5C9CA",
      accentText: "#256B66",
      bg: "#F2F7F5", surface: "#FFFFFF", surfaceMuted: "#E3EDEA",
      text: "#2C3333", muted: "#4E6058", border: "#CBDBD6",
      onMain: "#FFFFFF", headerSub: "#CBE3DF",
    },
  },
  {
    name: "Royal Mist",
    colors: ["#F9F7F7", "#DBE2EF", "#3F72AF", "#112D4E"],
    vars: {
      main: "#112D4E", sub: "#3F72AF", light: "#3F72AF", accent: "#DBE2EF",
      accentText: "#2F5D8F",
      bg: "#F4F7FB", surface: "#FFFFFF", surfaceMuted: "#E4EAF3",
      text: "#112D4E", muted: "#54687F", border: "#D3DCE9",
      onMain: "#FFFFFF", headerSub: "#C7D5E8",
    },
  },
  {
    name: "Mauve Gray",
    colors: ["#22223B", "#4A4E69", "#9A8C98", "#C9ADA7"],
    vars: {
      main: "#4A4E69", sub: "#22223B", light: "#7A6A78", accent: "#C9ADA7",
      accentText: "#96604F",
      bg: "#F7F3F1", surface: "#FFFFFF", surfaceMuted: "#EAE2DE",
      text: "#22223B", muted: "#5D5A6E", border: "#DCD2CC",
      onMain: "#FFFFFF", headerSub: "#D8CFDD",
    },
  },
  {
    name: "Sky Business",
    colors: ["#06283D", "#1363DF", "#47B5FF", "#DFF6FF"],
    vars: {
      main: "#06283D", sub: "#1363DF", light: "#1363DF", accent: "#47B5FF",
      accentText: "#0B54B8",
      bg: "#EFF7FC", surface: "#FFFFFF", surfaceMuted: "#DFF0FA",
      text: "#06283D", muted: "#40607A", border: "#C6DFEF",
      onMain: "#FFFFFF", headerSub: "#BFE0F5",
    },
  },
  {
    name: "Deep Sea",
    colors: ["#002B5B", "#2B4865", "#256D85", "#8FE3CF"],
    vars: {
      main: "#002B5B", sub: "#2B4865", light: "#256D85", accent: "#8FE3CF",
      accentText: "#1E6E7E",
      bg: "#EEF6F3", surface: "#FFFFFF", surfaceMuted: "#DDEAE4",
      text: "#10314E", muted: "#47616E", border: "#C8DAD2",
      onMain: "#FFFFFF", headerSub: "#A8DCC8",
    },
  },
  {
    name: "Charcoal Teal",
    colors: ["#222222", "#434242", "#22A39F", "#F3EFE0"],
    vars: {
      main: "#22A39F", sub: "#F3EFE0", light: "#22A39F", accent: "#F3EFE0",
      accentText: "#F3EFE0",
      bg: "#141414", surface: "#222222", surfaceMuted: "#2C2C2C",
      text: "#F3EFE0", muted: "#BDB7A6", border: "#3A3A3A",
      onMain: "#0E2422", headerSub: "#0E2422",
    },
  },
  {
    name: "Forest Calm",
    colors: ["#1C6758", "#3D8361", "#D6CDA4", "#EEF2E6"],
    vars: {
      main: "#1C6758", sub: "#3D8361", light: "#3D8361", accent: "#D6CDA4",
      accentText: "#7A5E12",
      bg: "#F3F6EC", surface: "#FFFFFF", surfaceMuted: "#E6EBD8",
      text: "#17352B", muted: "#4C6656", border: "#D2DCC0",
      onMain: "#FFFFFF", headerSub: "#CFE3D2",
    },
  },
  {
    name: "Coral Mist",
    colors: ["#497174", "#D6E4E5", "#EFF5F5", "#EB6440"],
    vars: {
      main: "#497174", sub: "#35565A", light: "#497174", accent: "#EB6440",
      accentText: "#C24A24",
      bg: "#F2F7F6", surface: "#FFFFFF", surfaceMuted: "#E1ECEB",
      text: "#2C4245", muted: "#54696B", border: "#CBDDDA",
      onMain: "#FFFFFF", headerSub: "#E8F4F0",
    },
  },
  {
    name: "Warm Taupe",
    colors: ["#967E76", "#D7C0AE", "#B7C4CF", "#EEE3CB"],
    vars: {
      main: "#6B574E", sub: "#7D655B", light: "#7D655B", accent: "#D7C0AE",
      accentText: "#7A5B4A",
      bg: "#FAF6EF", surface: "#FFFFFF", surfaceMuted: "#F0E7D8",
      text: "#3E322B", muted: "#6E5F55", border: "#E0D3BE",
      onMain: "#FFFFFF", headerSub: "#E5D9C8",
    },
  },
];

const PALETTE_VAR_KEYS = {
  main: "--main",
  sub: "--sub",
  light: "--light",
  accent: "--accent",
  accentText: "--accent-text",
  bg: "--bg",
  surface: "--surface",
  surfaceMuted: "--surface-muted",
  text: "--text",
  muted: "--muted",
  border: "--border",
  onMain: "--on-main",
  headerSub: "--header-sub",
};

function applyPalette(palette) {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(PALETTE_VAR_KEYS)) {
    root.style.setProperty(cssVar, palette.vars[key]);
  }
  // ストライプはパレット本来の4色をそのまま使う
  const stripe = document.querySelectorAll(".palette-stripe > span");
  stripe.forEach((span, i) => {
    if (palette.colors[i]) span.style.background = palette.colors[i];
  });
}

function buildSwatch(palette) {
  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.setAttribute("aria-hidden", "true");
  palette.colors.forEach((color) => {
    const seg = document.createElement("span");
    seg.style.background = color;
    swatch.appendChild(seg);
  });
  return swatch;
}

function initPalette() {
  const picker = document.getElementById("palette-picker");
  const button = document.getElementById("palette-button");
  const buttonSwatch = document.getElementById("palette-button-swatch");
  const buttonName = document.getElementById("palette-button-name");
  const menu = document.getElementById("palette-menu");
  let currentIndex = -1;

  // メニュー項目（4色ストライプ＋名前＋選択印）を全パレット分作る
  const items = PALETTES.map((p, i) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "palette-item";
    item.setAttribute("role", "option");
    item.appendChild(buildSwatch(p));
    const name = document.createElement("span");
    name.className = "palette-item-name";
    name.textContent = p.name;
    item.appendChild(name);
    const check = document.createElement("span");
    check.className = "palette-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    item.appendChild(check);
    item.addEventListener("click", () => {
      setPalette(i);
      closeMenu();
      button.focus();
    });
    menu.appendChild(item);
    return item;
  });

  function setPalette(index) {
    currentIndex = index;
    const palette = PALETTES[index];
    applyPalette(palette);
    // ボタンの表示（現在選択中のストライプと名前）を更新する
    buttonSwatch.replaceChildren(...palette.colors.map((color) => {
      const seg = document.createElement("span");
      seg.style.background = color;
      return seg;
    }));
    buttonName.textContent = palette.name;
    items.forEach((item, i) => {
      const selected = i === index;
      item.classList.toggle("selected", selected);
      item.setAttribute("aria-selected", String(selected));
    });
  }

  function openMenu() {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    picker.classList.add("open");
  }

  function closeMenu() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    picker.classList.remove("open");
  }

  button.addEventListener("click", () => {
    if (menu.hidden) openMenu();
    else closeMenu();
  });
  // 外側クリックで閉じる
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !picker.contains(e.target)) closeMenu();
  });
  // Escで閉じる
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      closeMenu();
      button.focus();
    }
  });

  // アクセスごとにランダムで1つ選ぶ（前回の選択は保存・復元しない）
  // ドロップダウンで選んだ場合はその訪問中だけ即時反映する
  setPalette(Math.floor(Math.random() * PALETTES.length));
}

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

initPalette();
init();
