// 株ピック記録 — カラーパレット（Color Hunt 4色、JSからCSS変数へ適用）
// index.html / yutai.html 共通。ページ読み込み時に initPalette() を実行する。

// カラーパレット（Color Hunt の人気パレットから選定、金融・ビジネス向けの
// 落ち着いた色中心。現行・他サイト使用分とは1色も重ならないよう選んだ）
// colors: パレット本来の4色（ストライプ表示用、比重 41/26/18/15）
// vars:   役割（メイン/サブ/ライト/アクセント）と、パレットから導出した
//         背景・面・文字色。暗いパレットは暗背景＋明文字、明るいパレットは
//         明背景＋暗文字になるよう各パレットごとに定義する。
//         端末のダーク/ライトモードでは切り替えず、常にパレットどおり表示する
//         （2026-11-23 Gomi指示）。
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
      main: "#5C8794", sub: "#A5C9CA", light: "#5C8794", accent: "#A5C9CA",
      accentText: "#A5C9CA",
      bg: "#131A1B", surface: "#1E2829", surfaceMuted: "#283435",
      text: "#E7F6F2", muted: "#9DB4B1", border: "#33484A",
      onMain: "#0E1B1E", headerSub: "#0E1B1E",
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
      main: "#4A4E69", sub: "#C9ADA7", light: "#7A6A78", accent: "#C9ADA7",
      accentText: "#D8BCB4",
      bg: "#131320", surface: "#1D1D2E", surfaceMuted: "#282840",
      text: "#F2EDEB", muted: "#ABA3B5", border: "#37374F",
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
      main: "#256D85", sub: "#8FE3CF", light: "#256D85", accent: "#8FE3CF",
      accentText: "#8FE3CF",
      bg: "#0A1A26", surface: "#122836", surfaceMuted: "#1B3648",
      text: "#EBF5F1", muted: "#9FB8B2", border: "#2A4657",
      onMain: "#FFFFFF", headerSub: "#CDEAE0",
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

  // メニュー項目（名前行＋幅いっぱいの4色バー＋選択印）を全パレット分作る
  const items = PALETTES.map((p, i) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "palette-item";
    item.setAttribute("role", "option");
    const head = document.createElement("span");
    head.className = "palette-item-head";
    const name = document.createElement("span");
    name.className = "palette-item-name";
    name.textContent = p.name;
    head.appendChild(name);
    const check = document.createElement("span");
    check.className = "palette-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    head.appendChild(check);
    item.appendChild(head);
    item.appendChild(buildSwatch(p));
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
    try {
      sessionStorage.setItem("appPaletteIndex", String(index));
    } catch (e) {}
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

  // パレットの決め方:
  // - 新規アクセス（外部から開いた）か、このページのリロードのときだけランダムに選び直す
  // - アプリ内移動では sessionStorage に保存した選択（手動変更含む）を引き継ぐ
  const navEntry = performance.getEntriesByType("navigation")[0];
  const navType = navEntry ? navEntry.type : "navigate";
  const fromSameApp =
    !!document.referrer && document.referrer.startsWith(location.origin);
  let savedPalette = null;
  try {
    savedPalette = sessionStorage.getItem("appPaletteIndex");
  } catch (e) {}
  if (navType === "reload" || !fromSameApp) savedPalette = null;
  const savedIndex =
    savedPalette === null ? NaN : parseInt(savedPalette, 10);
  if (
    Number.isInteger(savedIndex) &&
    savedIndex >= 0 &&
    savedIndex < PALETTES.length
  ) {
    setPalette(savedIndex);
  } else {
    setPalette(Math.floor(Math.random() * PALETTES.length));
  }
}

initPalette();
