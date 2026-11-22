// 株主優待ピック専用ページ — 「何がもらえるか」を一目で見せるカード表示
// データは /api/picks（失敗時は Supabase REST 直接）から kind = yutai のみ抽出

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

function num(text) {
  if (text == null) return null;
  const n = Number(String(text).replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

function fmtYen(n) {
  return Number(n).toLocaleString("ja-JP") + "円";
}

function fmtDateJP(iso) {
  const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return Number(m[2]) + "月" + Number(m[3]) + "日";
}

// ---- benefit / note からの情報抽出 ----

// 優待カテゴリ（絵文字＋ラベル）。benefit の文面から判定する
function benefitCategory(benefit) {
  const t = benefit || "";
  if (/食事/.test(t)) return { emoji: "🍽️", label: "食事券" };
  if (/施設|宿泊|ホテル/.test(t)) return { emoji: "🏨", label: "宿泊・施設" };
  if (/%OFF|割引/.test(t)) return { emoji: "🏷️", label: "割引券" };
  if (/お買物券|買物券|商品券/.test(t)) return { emoji: "🛍️", label: "お買物券・商品券" };
  if (/家事|代行|クリーニング/.test(t)) return { emoji: "🧹", label: "サービス" };
  if (/お菓子|菓子|詰合せ|自社製品/.test(t)) return { emoji: "🍫", label: "自社製品" };
  if (/コンテンツ|無料/.test(t)) return { emoji: "📱", label: "デジタル特典" };
  return { emoji: "🎁", label: "優待" };
}

// もらえる金額（円額が無ければ %OFF を拾う）
function parseAmount(benefit) {
  const t = benefit || "";
  const yen = t.match(/([\d,]+)円(分|相当)?/);
  if (yen) return { value: num(yen[1]), text: yen[1] + "円" + (yen[2] || "") };
  const off = t.match(/(\d+)%OFF/);
  if (off) return { value: null, text: off[1] + "%OFF" };
  return { value: null, text: "" };
}

function parseShares(benefit) {
  const m = (benefit || "").match(/^(\d[\d,]*)株/);
  return m ? num(m[1]) : null;
}

function parseFreq(benefit) {
  const m = (benefit || "").match(/年(\d)回/);
  return m ? "年" + m[1] + "回" : "";
}

// 優待利回り：年換算の記載があればそちらを優先し、無ければ「／回」等の単回値
function parseYield(note) {
  const t = note || "";
  const annual = t.match(/年約?([\d.]+)%/);
  if (annual) return { value: Number(annual[1]), text: annual[1] + "%" };
  const per = t.match(/優待利回り約?([\d.]+)%/);
  if (per) return { value: Number(per[1]), text: per[1] + "%" };
  return { value: null, text: "" };
}

function parseMinCost(note) {
  const m = (note || "").match(/最低(?:取得額|投資額)([\d,]+)円/);
  return m ? num(m[1]) : null;
}

function parseDate(note, label) {
  const m = (note || "").match(new RegExp(label + "(\\d{4}-\\d{2}-\\d{2})"));
  return m ? m[1] : null;
}

function enrich(pick) {
  const amount = parseAmount(pick.benefit);
  const y = parseYield(pick.note);
  return {
    pick,
    category: benefitCategory(pick.benefit),
    amountText: amount.text,
    amountValue: amount.value,
    shares: parseShares(pick.benefit),
    freq: parseFreq(pick.benefit),
    yieldText: y.text,
    yieldValue: y.value,
    minCost: parseMinCost(pick.note),
    deadline: parseDate(pick.note, "権利付最終日"),
    kakutei: parseDate(pick.note, "権利確定日"),
  };
}

function daysUntil(iso) {
  if (!iso) return null;
  const target = new Date(iso + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

// ---- カード ----

// 銘柄ごとの写真（もらえるもの・使える場所が一目で分かる実写）。出典は各社公式・店舗紹介ページ
const PHOTO_URLS = {
  "3160": "https://amica-official.com/wp-content/uploads/2023/04/akabanenishi_small2.jpg", // 大光：業務用スーパー「アミカ」店舗
  "9215": "https://journal.casy.co.jp/wp-content/themes/casy_journal/assets/img/casy-service.jpg", // CaSy：家事代行スタッフ
  "138A": "https://ximg.retty.me/crop/s524x524/q80/das/-/retty/img_ebisu/restaurant/100001712654/archive/3372716-66acbac5330cb.jpg", // 光フード：居酒屋「大黒」
  "2769": "https://www.tsukashin.com/photo/425-480.jpg", // ヴィレッジヴァンガード店内
  "3547": "https://tsu.goguynet.jp/wp-content/uploads/sites/231/2022/03/IMG_20220313_163543.jpg", // ユニシアHD：串カツ田中 店舗
  "4825": "https://www.au.com/content/dam/au-com/entertainment/smartpass/en_smartpass_img_10.png", // ウェザーニューズ：アプリ画面
  "8923": "https://tosei-hotel.co.jp/kanda/files/ogp.jpg", // トーセイ：トーセイホテル ココネ
  "7501": "https://store.castingnet.jp/img/goods/L/4549769200277.jpg", // ティムコ：Foxfire フィッシングベスト
  "4755": "https://network.mobile.rakuten.co.jp/static/assets/img/shop/detail/interior/5321_002.png", // 楽天グループ：楽天モバイルショップ店内
  "2269": "https://public.muragon.com/utkqqdmw/fw7r68q3/resize/440x640.jpg", // 明治HD：優待のお菓子詰め合わせ
};

function buildCard(item) {
  const pick = item.pick;
  const card = el("article", "ycard");

  // 何がもらえるか（最上段・最大表示）
  const visual = el("div", "ycard-visual");
  visual.appendChild(el("span", "ycard-emoji", item.category.emoji));
  const vtext = el("div", "ycard-visual-text");
  vtext.appendChild(el("span", "ycard-cat", item.category.label));
  if (item.amountText) vtext.appendChild(el("span", "ycard-amount", item.amountText));
  visual.appendChild(vtext);
  if (item.yieldText) {
    visual.appendChild(el("span", "ycard-yield", "利回り " + item.yieldText));
  }

  // 写真がある銘柄は写真バンドを最上段に（読み込めなければ絵文字バンドに差し替え）
  const photoUrl = PHOTO_URLS[pick.ticker];
  if (photoUrl) {
    const photo = el("div", "ycard-photo");
    const img = el("img", "ycard-photo-img");
    img.alt = (pick.brand || pick.name || "") + "の写真";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => photo.replaceWith(visual));
    img.src = photoUrl;
    photo.appendChild(img);
    const overlay = el("div", "ycard-photo-overlay");
    overlay.appendChild(el("span", "ycard-emoji", item.category.emoji));
    const otext = el("div", "ycard-visual-text");
    otext.appendChild(el("span", "ycard-cat", item.category.label));
    if (item.amountText) otext.appendChild(el("span", "ycard-amount", item.amountText));
    overlay.appendChild(otext);
    photo.appendChild(overlay);
    if (item.yieldText) {
      photo.appendChild(el("span", "ycard-yield", "利回り " + item.yieldText));
    }
    card.appendChild(photo);
  } else {
    card.appendChild(visual);
  }

  if (pick.benefit) card.appendChild(el("p", "ycard-benefit", pick.benefit));

  // 要点チップ
  const chips = el("div", "ycard-chips");
  const addChip = (label, value, urgent) => {
    if (!value) return;
    const chip = el("span", "ychip" + (urgent ? " urgent" : ""));
    chip.appendChild(el("span", "ychip-label", label));
    chip.appendChild(el("span", "ychip-value", value));
    chips.appendChild(chip);
  };
  if (item.shares != null) addChip("必要株数", item.shares.toLocaleString("ja-JP") + "株〜");
  if (item.minCost != null) addChip("最低投資額", fmtYen(item.minCost));
  if (item.deadline) {
    const d = daysUntil(item.deadline);
    let text = fmtDateJP(item.deadline);
    let urgent = false;
    if (d != null && d >= 0 && d <= 14) {
      text += "（あと" + d + "日）";
      urgent = d <= 7;
    }
    addChip("権利付最終日", text, urgent);
  }
  if (item.freq) addChip("頻度", item.freq);
  if (pick.price != null && pick.price !== "") {
    addChip("株価", fmtYen(Number(pick.price)));
  }
  if (chips.childNodes.length) card.appendChild(chips);

  // 銘柄
  const company = el("div", "ycard-company");
  const h = el("h3", "ycard-name", pick.name || pick.ticker || "");
  if (pick.ticker) {
    const t = el("span", "ycard-ticker", pick.ticker);
    h.appendChild(t);
  }
  company.appendChild(h);
  if (pick.brand) company.appendChild(el("p", "ycard-brand", pick.brand));
  card.appendChild(company);

  if (pick.note) card.appendChild(el("p", "ycard-note", pick.note));
  if (pick.memo) card.appendChild(el("p", "ycard-note", "メモ: " + pick.memo));

  return card;
}

// ---- 描画 ----

let allItems = []; // enrich 済み（全ラン分）
let runsOrder = []; // run_date の新しい順

const SORTERS = {
  yield: (a, b) => (b.yieldValue ?? -1) - (a.yieldValue ?? -1),
  amount: (a, b) => (b.amountValue ?? -1) - (a.amountValue ?? -1),
  mincost: (a, b) => (a.minCost ?? Infinity) - (b.minCost ?? Infinity),
  deadline: (a, b) =>
    String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")),
};

function render() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const sortKey = document.getElementById("sort").value;
  const sorter = SORTERS[sortKey] || SORTERS.yield;

  const container = document.getElementById("yutai-runs");
  container.innerHTML = "";
  let shown = 0;

  for (const runDate of runsOrder) {
    let items = allItems.filter((it) => it.pick.run_date === runDate);
    if (q) {
      items = items.filter((it) => {
        const p = it.pick;
        const hay = [p.ticker, p.name, p.brand, p.benefit, p.note, p.memo]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (!items.length) continue;
    items = items.slice().sort(sorter);
    shown += items.length;

    const section = el("section", "run");
    const head = el("div", "run-head");
    const title = el("h2", "run-title");
    const kakuteis = new Set(items.map((it) => it.kakutei).filter(Boolean));
    if (kakuteis.size === 1) {
      title.appendChild(
        el("span", "run-date", "権利確定 " + fmtDateJP([...kakuteis][0]))
      );
    } else {
      title.appendChild(el("span", "run-date", runDate));
    }
    title.appendChild(el("span", "run-headline", items.length + "銘柄"));
    head.appendChild(title);
    section.appendChild(head);

    const grid = el("div", "cards ycards");
    for (const it of items) grid.appendChild(buildCard(it));
    section.appendChild(grid);
    container.appendChild(section);
  }

  document.getElementById("count-shown").textContent = shown;
  const msg = document.getElementById("status-msg");
  if (container.childNodes.length === 0) {
    msg.textContent = "該当する優待ピックがありません。";
    msg.hidden = false;
  } else {
    msg.hidden = true;
  }
}

function initSummary() {
  document.getElementById("count-yutai").textContent = allItems.length;

  const now = new Date();
  const todayIso =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");
  const future = allItems
    .map((it) => it.deadline)
    .filter((d) => d && d >= todayIso)
    .sort();
  document.getElementById("next-deadline").textContent = future.length
    ? fmtDateJP(future[0])
    : "–";

  const yields = allItems.map((it) => it.yieldValue).filter((v) => v != null);
  document.getElementById("max-yield").textContent = yields.length
    ? Math.max(...yields).toLocaleString("ja-JP", { maximumFractionDigits: 2 }) + "%"
    : "–";
}

async function init() {
  const msg = document.getElementById("status-msg");
  let data;
  try {
    data = await fetchPicks();
  } catch (e) {
    msg.textContent = "データの取得に失敗しました。";
    msg.hidden = false;
    return;
  }
  const picks = (data.picks || []).filter((p) => p.kind === "yutai");
  allItems = picks.map(enrich);
  const runDates = new Set(picks.map((p) => p.run_date));
  runsOrder = (data.runs || [])
    .map((r) => r.run_date)
    .filter((d) => runDates.has(d));
  for (const d of runDates) if (!runsOrder.includes(d)) runsOrder.push(d);

  initSummary();
  render();

  document.getElementById("search").addEventListener("input", render);
  document.getElementById("sort").addEventListener("change", render);
}

init();
