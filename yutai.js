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
  "2503": "https://wisewideweb.com/wp-content/uploads/2019/03/yutai-2503-7.jpg", // キリンHD：優待のビール詰合せ
  "2502": "https://yutaikobouzu.com/wp-content/uploads/2024/04/IMG_4123-scaled.jpeg", // アサヒGHD：株主限定プレミアムビール
  "3197": "https://biz-journal.jp/wp-content/uploads/2026/08/post_395719_GUSTO.jpg", // すかいらーくHD：ガスト店舗
  "2702": "https://www.ssnp.co.jp/uploads/2023/06/230622mac1.jpg", // 日本マクドナルドHD：マクドナルド店舗
  "9861": "https://tk.ismcdn.jp/mwimgs/3/6/-/img_364b64e88199d094dd812710e5cbde9d130657.jpg", // 吉野家HD：吉野家店舗・牛丼
  "4661": "https://ayatatsu0314.com/wp-content/uploads/2024/07/sinndererajou-scaled.jpg", // オリエンタルランド：シンデレラ城
  "9202": "https://flyteam.jp/assets/images/photo/4480622/640x640.jpg", // ANAHD：ANA機体
  "2897": "https://stat.ameba.jp/user_images/20250714/11/donaldakkun/9d/a7/j/o4608345615633905542.jpg", // 日清食品HD：優待の製品詰合せ
  "2810": "https://blog-imgs-156.fc2.com/p/o/c/pochi12345/20250305002342f53.jpg", // ハウス食品G：優待の製品詰合せ
  "3397": "https://saikura.info/wp-content/uploads/2026/02/file2-3.jpg", // トリドールHD：丸亀製麺店舗
  "4912": "https://wisewideweb.com/wp-content/uploads/2019/03/yutai-4912-13.jpg",
  "2268": "https://www.anesis-ltd.co.jp/photo/31aeontownmoriya1.jpg",
  "4665": "https://www.forval-iot.jp/wp/wp-content/uploads/2021/09/img_2021_10_14.jpg",
  "2809": "https://media.rakuten-sec.net/mwimgs/5/a/-/img_5a88ec8a2e6b6024922626dc7ab2f71269210.jpg",
  "2698": "https://www.prope.or.jp/wp-content/uploads/2017/01/IMG_3896-768x512.jpg",
  "2590": "https://reeell.com/wp-content/uploads/2022/04/20220412_2590_4.jpg",
  "3399": "https://emunoranchi.com/wp-content/uploads/2024/05/IMG_2863.jpg",
  "3193": "https://torikizoku.co.jp/wp-public/wp-content/themes/torikizoku/images/top/menu_img1.jpg",
  "2531": "https://d2seevf4vrbvhc.cloudfront.net/uploads/shareholder_benefit_image/image/1114/2531_260623_1.jpg",
  "3048": "https://mz-cdn.shoeisha.jp/static/images/article/72291/13333_01.jpg",
  "7545": "https://myakuzumi.com/manage/wp-content/uploads/2024/07/8B0A46A6-AF4D-428D-BC5F-8EF216D786D0-1024x768.jpeg",
  "7649": "https://lh5.googleusercontent.com/p/AF1QipNhxzYlgnd5_Gds4YSbQ5CZng4TQ_ItCPrjGPI1=s1600-w800-k-no",
  "3543": "https://community.dl-asobica.com/public/uploads/announcement/caption_image/fwqmiff6gei4ozhw/cb810a1a-4ce5-456f-9df1-4ff1959dcb59.jpeg",
  "9946": "https://www.ministop.co.jp/site_common/ogp_softcream.jpg",
  "7630": "https://rensai.jp/wp-content/uploads/2023/11/02_IMG_4433.jpg",
  "7611": "https://livedoor.blogimg.jp/amaozisan/imgs/4/0/4016089d.jpg",
  "8185": "https://www.chiyodagrp.co.jp/store_develop/img/200124_tsrc_1000-460.png",
  "8276": "https://img01.suumo.com/front/gazo/fr/bukken/298/100521965298/100521965298_s3o.jpg",
  "2801": "https://downshifters.net/wp-content/uploads/2020/10/sakata20200916-661x1024.jpeg.webp",
  "2802": "https://mitsurugi-group.com/img/blog/43/ajinomoto-yutai.jpg",
  "2819": "https://sbisec.akamaized.net/sbisec/images/base/yutai/2819-3.jpg",
  "2264": "https://precious-bud.com/wp-content/uploads/2023/02/img_0042.jpg",
  "4526": "https://sbisec.akamaized.net/sbisec/images/base/yutai/4526-1.jpg",
  "2908": "https://sbisec.akamaized.net/sbisec/images/base/yutai/2908-3.jpg",
  "2804": "https://dfinance.ismcdn.jp/zai/mwimgs/6/a/580/img_6aad61644b40e608e9026591ba0d6a1437929.jpg",
  "2201": "https://downshifters.net/wp-content/uploads/2026/02/morinaga20260214-04-1024x768.jpg",
  "9201": "https://nij.nikon.com/cms/learn/phototech/shutter-stories/img/nakano_airplane1/pic_03.jpg",
  "9020": "https://jr-shinkansen.net/images/e59301.jpg",
  "9022": "https://tetsudo-ch.com/wp-content/uploads/2022/12/n700s.jpg",
  "9041": "https://tetsudo-shimbun.com/archives/002/201911/5dd38a44af169.jpg",
  "9042": "https://images.tetsudo.com/column/1290/250715c14.jpg",
  "9602": "https://www.cinemacafe.net/imgs/ogp_f/780082.jpg",
  "9601": "https://appllio.com/sites/default/files/styles/cover_xl_1/public/2025/05/22/how-to-use-movix-app-2025-top.jpg",
  "8136": "https://stat.ameba.jp/user_images/20240129/11/i-rashiku/ac/70/j/o2898217315395008342.jpg",
  "7550": "https://drdo50jm8vowu.cloudfront.net/uploads/article/58197/thumb_%E7%89%9B%E4%B8%BC2021%E5%B9%B45%E6%9C%8817%E6%97%A5.jpg",
  "2681": "https://lh5.googleusercontent.com/p/AF1QipMFWEEIJ-6zu7c2mh_fAOS1gpTGO72WGFUNGfsR=s1600-w800-k-no",
  "2695": "https://cdn.macaro-ni.jp/image/summary/137/137015/okawqtRSLMsxzlTNr7lyo3HNxYOkCKhPc2yuKjQG.jpg",
  "9603": "https://lh3.googleusercontent.com/p/AF1QipPLkDu5msoiXOFFdTM2r65yjb-Bnf1Atoton2VA=s1600-w800-k-no",
  "8079": "https://cdn-ak.f.st-hatena.com/images/fotolife/k/kabuinu/20241109/20241109162645.jpg",
  "8207": "https://gokigenbiyori.com/wp-content/uploads/2024/08/tengu-shinjyukunisiguti-pallet-building-6.jpg",
  "2792": "https://www.latov.com/wp-content/uploads/2017/05/%E3%83%8F%E3%83%8B%E3%83%BC%E3%82%BA1-1-1024x682.jpg",
  "2811": "https://stat.ameba.jp/user_images/20231019/19/boowoo2018/64/eb/j/o0604080615353060396.jpg",
  "2206": "https://wisewideweb.com/wp-content/uploads/2021/12/yutai-2206-3.jpg",
  "3091": "https://lh3.googleusercontent.com/p/AF1QipNqJ4XIMCjQaXIHahUCtRJcZQIiOLdZg0nEF8EY=s1600-w800-k-no",
  "8214": "https://senken.co.jp/production/uploads/file_content/file/316939/large_AOKI%E3%82%AA%E3%83%AA%E3%83%92%E3%82%AB760.png",
  "3097": "https://www.shiosai-foods.co.jp/resources/images/king_nagaoka.jpg",
  "8200": "https://rocketnews24.com/wp-content/uploads/sites/2/2023/06/copperinger2.jpg",
  "3387": "https://soritravl.com/wp-content/uploads/2024/12/img-4-5.webp",
  "3395": "https://asakatsu-shiyo.com/wp-content/uploads/2025/08/image-194-1024x768.jpg",
  "3196": "https://preresearch.image.itmedia.co.jp/nl/articles/2311/06/cover_news067.jpg",
  "2002": "https://www.nisshin-seifun-welna.com/index/products/product_file/file/4902110266597.jpg",
  "2220": "https://www.kamedaseika.co.jp/wp-content/uploads/2026/04/273081_1200_630.jpg",
  "2212": "https://img1.esimg.jp/image/food/00/00/52/2938660_original.jpg",
  "2594": "https://www.keycoffee.co.jp/cms/img/kaigyo-navi/fb/2099-14.png",
  "2875": "https://images-fe.ssl-images-amazon.com/images/I/517GflP5sJL.jpg",
  "2296": "https://shaddy.jp/shop/49980000/commodity/1742437.jpg",
  "4985": "https://www.earth.jp/products/mondahmin-peppermint-1080/images/0022446T_4901080504715_00.jpg",
  "9831": "https://parksky-ebina.com/img/location/location08.jpg",
  "8227": "https://media.image.infoseek.co.jp/isnews/photos/toushin1/toushin1_29396_0.jpg",
  "2685": "https://diamond-rm.net/wp-content/uploads/2023/08/47f3b3a956c84bfcf9de2fde11487ea1.png",
  "9942": "https://libs.edit.pref.oita.jp/wp/wp-content/uploads/2022/05/13131739/series-my-fave-002-photo10.jpg",
  "9850": "https://prcdn.freetls.fastly.net/release_image/90386/126/90386-126-a2bc8c9facfb2cc93bf261d2392211dd-2555x1704.jpg",
  "3563": "https://dol.ismcdn.jp/mwimgs/8/9/-/img_8956f5209f2ebd3bce36b95db320b05f476255.jpg",
  "3053": "https://biz-journal.jp/wp-content/uploads/2020/07/post_168277_1.jpg",
  "9731": "https://www.astekawanishi.com/cms/wp-content/uploads/2022/03/4900a151a8c6bd89677f02559c192b5d.jpg",
  "9021": "https://travel.watch.impress.co.jp/img/trw/list/1335/376/01.jpg",
  "9142": "https://cdn-ak.f.st-hatena.com/images/fotolife/g/graham42/20260525/20260525204627.jpg",
  "9048": "https://www.meitetsu.co.jp/library/rolling_stock/detail_exp/__icsFiles/afieldfile/2021/06/24/library_rolling_stock_6800_1.jpg",
  "9005": "https://s.eximg.jp/exnews/feed/Trafficnews/Trafficnews_113622_854f_1.jpg",
  "9007": "https://images.tetsudo.com/news/20220713/site-728944-a-001.jpg",
  "4680": "https://www.round1.co.jp/service/spo-cha/img/minibowling.jpg",
  "7867": "https://www.takaratomy.co.jp/products/tomica/tomicaworld/list/img/img_item_006.jpg",
  "2305": "https://prtimes.jp/i/3306/7/resize/d3306-7-424629-5.jpg",
  "4923": "https://www.cota.co.jp/i-care_officialsite/product/images/shampoo_main_ph.jpg",
  "8233": "https://static.hokkaido-np.co.jp/image/article/size1/f/1/6/0/f160bfbb5a5499a70d297ea5cc757cfa_4.webp",
  "3099": "https://cp.mistore.jp/content/dam/isetan_mitsukoshi/global/common/shinjuku/img/shinjuku_traffic_img01.jpg",
  "3549": "https://lh5.googleusercontent.com/p/AF1QipMtSVQhVgMxuF9xIaZ5unm1oa1ccjiXP_4XSdx3=s1600-w800-k-no",
  "9948": "https://news.shoninsha.co.jp/wp-content/uploads/2019/04/ralse_20190412_01.png",
  "4666": "https://cdn-webcartop.com/wp-content/uploads/2021/04/webcartop_newcar_011.jpg",
  "2818": "https://www.pietro.co.jp/assets/upload/product/20260105_DS.jpg",
};

// カード見出し用の短いタイトル（「100株で〜」の詳細は折りたたみの中に表示）
const SHORT_TITLES = {
  "3160": "アミカ商品券2,000円分",
  "9215": "家事代行ギフト8,000円分",
  "138A": "食事券 年10,000円分",
  "2769": "お買物券10,000円分",
  "3547": "食事券 年4,000円分",
  "4825": "ウェザーニュースPro無料",
  "8923": "施設利用割引券3,000円分",
  "7501": "お買物20%OFF券",
  "4755": "楽天モバイル6ヶ月無料",
  "2269": "お菓子詰め合わせ",
  "2503": "飲料詰め合わせ",
  "2502": "ビール詰め合わせ",
  "3197": "食事券2,000円分",
  "2702": "食事券1冊（6食分）",
  "9861": "食事券2,000円分",
  "4661": "1デーパスポート1枚",
  "9202": "国内線50%割引券",
  "2897": "食品詰め合わせ",
  "2810": "食品詰め合わせ",
  "3397": "食事券3,000円分",
  "4912": "日用品詰め合わせ",
  "2268": "アイス引換eGift1,200円分",
  "4665": "優待券1,000円分",
  "2809": "食品詰め合わせ",
  "2698": "買物割引券2,200円相当",
  "2590": "飲料詰め合わせ",
  "3399": "ラーメン無料券2枚",
  "3193": "食事券500円分",
  "2531": "お酒・調味料詰め合わせ",
  "3048": "買物優待券 年3,000円分",
  "7545": "お買物カード1,000円相当",
  "7649": "優待券1,000円相当",
  "3543": "コメカ1,000円分チャージ",
  "9946": "ソフトクリーム無料券5枚",
  "7630": "食事券1,000円相当",
  "7611": "優待券1,000円分",
  "8185": "20%割引券5枚",
  "8276": "優待券1,000円分",
  "2801": "しょうゆ詰め合わせ",
  "2802": "調味料詰め合わせ",
  "2819": "調味料セット",
  "2264": "食品詰め合わせ",
  "4526": "ドレッシング詰め合わせ",
  "2908": "煮豆・佃煮詰め合わせ",
  "2804": "ソース詰め合わせ",
  "2201": "お菓子詰め合わせ",
  "9201": "国内線50%割引券",
  "9020": "サービス券・割引券",
  "9022": "運賃・料金1割引券",
  "9041": "招待乗車券4枚",
  "9042": "共通回数カード",
  "9602": "映画招待券1枚",
  "9601": "映画優待ポイント80pt",
  "8136": "テーマパーク優待券1枚",
  "7550": "食事券1,000円分",
  "2681": "リユース割引券2,000円分",
  "2695": "食事券1,000円分",
  "9603": "旅行優待券1,000円分",
  "8079": "ナッツ・菓子詰め合わせ",
  "8207": "食事券1,000円分",
  "2792": "商品引換券3,000円分",
  "2811": "野菜ジュース詰め合わせ",
  "2206": "お菓子詰め合わせ",
  "3091": "食事券2,000円分",
  "8214": "20%割引券セット",
  "3097": "食事券3,500円分",
  "8200": "食事券1,650円相当",
  "3387": "食事券1,500円相当",
  "3395": "飲食20%OFFカード",
  "3196": "優待券1,500円分",
  "2002": "食品詰め合わせ",
  "2220": "通販クーポン500円分",
  "2212": "お菓子詰め合わせ",
  "2594": "コーヒー詰め合わせ",
  "2875": "即席麺詰め合わせ",
  "2296": "ハム詰め合わせ",
  "4985": "日用品詰め合わせ",
  "9831": "買物優待券 年1,500円分",
  "8227": "お買物券2,000円相当",
  "2685": "買物優待券 年3,000円分",
  "9942": "食事15%OFF割引券",
  "9850": "食事券 年2,000円相当",
  "3563": "食事券1,100円分",
  "3053": "食事券3,000円分",
  "9731": "クリーニング券",
  "9021": "鉄道割引券",
  "9142": "1日乗車券と優待券",
  "9048": "招待乗車券と入場券",
  "9005": "電車・バス乗車券",
  "9007": "全線優待乗車証",
  "4680": "500円割引券",
  "7867": "オリジナルトミカ",
  "2305": "写真撮影券",
  "4923": "ヘアケア製品詰合せ",
  "8233": "買物10%OFFカード",
  "3099": "買物10%OFFカード",
  "3549": "選べる優待2,000円相当",
  "9948": "選べる優待（りんご等）",
  "4666": "カーシェア入会特典",
  "2818": "ドレッシング詰め合わせ",
};

function deriveShortTitle(benefit) {
  let t = String(benefit || "").replace(/^\d[\d,]*株(以上)?で/, "").trim();
  const cut = t.search(/[（(、※]/);
  if (cut > 0) t = t.slice(0, cut).trim();
  if (t.length > 18) t = t.slice(0, 18);
  return t || "株主優待";
}

function shortTitle(pick) {
  return SHORT_TITLES[pick.ticker] || deriveShortTitle(pick.benefit);
}

function buildCard(item) {
  const pick = item.pick;
  const card = el("article", "ycard");

  // 何がもらえるか（最上段・最大表示）
  const visual = el("div", "ycard-visual");
  visual.appendChild(el("span", "ycard-emoji", item.category.emoji));
  const vtext = el("div", "ycard-visual-text");
  vtext.appendChild(el("span", "ycard-cat", item.category.label));
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
    overlay.appendChild(otext);
    photo.appendChild(overlay);
    if (item.yieldText) {
      photo.appendChild(el("span", "ycard-yield", "利回り " + item.yieldText));
    }
    card.appendChild(photo);
  } else {
    card.appendChild(visual);
  }

  // 短いタイトル（何がもらえるか）
  card.appendChild(el("h3", "ycard-title", shortTitle(pick)));

  // 銘柄
  const company = el("div", "ycard-company");
  const nameLine = el("p", "ycard-name", pick.name || pick.ticker || "");
  if (pick.ticker) {
    nameLine.appendChild(el("span", "ycard-ticker", pick.ticker));
  }
  company.appendChild(nameLine);
  if (pick.brand) company.appendChild(el("p", "ycard-brand", pick.brand));
  card.appendChild(company);

  const addChip = (chips, label, value, urgent) => {
    if (!value) return;
    const chip = el("span", "ychip" + (urgent ? " urgent" : ""));
    chip.appendChild(el("span", "ychip-label", label));
    chip.appendChild(el("span", "ychip-value", value));
    chips.appendChild(chip);
  };

  // 表側の要点チップ（権利付最終日・最低投資額だけ）
  const frontChips = el("div", "ycard-chips front");
  if (item.deadline) {
    const d = daysUntil(item.deadline);
    let text = fmtDateJP(item.deadline);
    let urgent = false;
    if (d != null && d >= 0 && d <= 14) {
      text += "（あと" + d + "日）";
      urgent = d <= 7;
    }
    addChip(frontChips, "権利付最終日", text, urgent);
  }
  if (item.minCost != null) addChip(frontChips, "最低投資額", fmtYen(item.minCost));
  if (frontChips.childNodes.length) card.appendChild(frontChips);

  // 詳細（初期は折りたたみ。「何株で何がもらえるか」はここ）
  const details = el("div", "ycard-details");
  details.hidden = true;
  if (pick.benefit) details.appendChild(el("p", "ycard-benefit", pick.benefit));
  const detailChips = el("div", "ycard-chips");
  if (item.shares != null) addChip(detailChips, "必要株数", item.shares.toLocaleString("ja-JP") + "株〜");
  if (item.freq) addChip(detailChips, "頻度", item.freq);
  if (pick.price != null && pick.price !== "") {
    addChip(detailChips, "株価", fmtYen(Number(pick.price)));
  }
  if (detailChips.childNodes.length) details.appendChild(detailChips);
  if (pick.note) details.appendChild(el("p", "ycard-note", pick.note));
  if (pick.memo) details.appendChild(el("p", "ycard-note", "メモ: " + pick.memo));
  card.appendChild(details);

  const toggle = el("button", "ycard-toggle", "詳細を見る ▾");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    const open = details.hidden;
    details.hidden = !open;
    toggle.textContent = open ? "詳細を閉じる ▴" : "詳細を見る ▾";
    toggle.setAttribute("aria-expanded", String(open));
  });
  card.appendChild(toggle);

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

  // 権利確定月ごとにグルーピング（近い月から表示）
  let pool = allItems;
  if (q) {
    pool = pool.filter((it) => {
      const p = it.pick;
      const hay = [p.ticker, p.name, p.brand, p.benefit, p.note, p.memo]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  const groups = new Map(); // "YYYY-MM" -> items
  for (const it of pool) {
    const key = it.kakutei ? it.kakutei.slice(0, 7) : "未設定";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const monthKeys = [...groups.keys()].sort((a, b) => {
    if (a === "未設定") return 1;
    if (b === "未設定") return -1;
    return a.localeCompare(b);
  });

  for (const key of monthKeys) {
    const items = groups.get(key).slice().sort(sorter);
    shown += items.length;

    const section = el("section", "run");
    const head = el("div", "run-head");
    const title = el("h2", "run-title");
    if (key === "未設定") {
      title.appendChild(el("span", "run-date", "権利月 未設定"));
    } else {
      const [yy, mm] = key.split("-");
      title.appendChild(
        el("span", "run-date", yy + "年" + Number(mm) + "月権利")
      );
      const deadlines = items.map((it) => it.deadline).filter(Boolean).sort();
      if (deadlines.length) {
        title.appendChild(
          el("span", "run-headline", "権利付最終日 " + fmtDateJP(deadlines[0]))
        );
      }
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
