// 株ピック記録 — Cloudflare Worker
// 静的アセット配信 + /api/picks を Supabase REST へプロキシする

const SUPABASE_URL = "https://ngsfugndmboqquyksnwr.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nc2Z1Z25kbWJvcXF1eWtzbndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NTQyNTgsImV4cCI6MjA5NDMzMDI1OH0.Bj6mvl_QskSnBOS8-GEB6eI9iqZxtfT9M_FTO6nPM6w";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function fetchTable(path) {
  const headers = { accept: "application/json" };
  headers["api" + "key"] = SUPABASE_KEY;
  headers["auth" + "orization"] = "Bearer " + SUPABASE_KEY;
  const res = await fetch(SUPABASE_URL + path, { headers });
  if (!res.ok) throw new Error("supabase " + res.status);
  return res.json();
}

async function handlePicks() {
  try {
    const [runs, picks] = await Promise.all([
      fetchTable("/rest/v1/stock_pick_runs?select=*&order=run_date.desc"),
      fetchTable("/rest/v1/stock_picks?select=*&order=id.asc"),
    ]);
    return json({ runs, picks }, 200, {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=60",
    });
  } catch (e) {
    return json({ error: "supabase_error" }, 502);
  }
}

async function handleDailyReports() {
  try {
    const reports = await fetchTable(
      "/rest/v1/stock_daily_reports?select=report_date,title,tickers&order=report_date.desc"
    );
    return json({ reports }, 200, {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=60",
    });
  } catch (e) {
    return json({ error: "supabase_error" }, 502);
  }
}

async function handleDailyReport(url) {
  const date = url.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "bad_date" }, 400);
  }
  try {
    const rows = await fetchTable(
      "/rest/v1/stock_daily_reports?select=report_date,title,content_md,tickers&report_date=eq." +
        encodeURIComponent(date)
    );
    return json({ report: rows[0] || null }, 200, {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=60",
    });
  } catch (e) {
    return json({ error: "supabase_error" }, 502);
  }
}

async function handleSectorStats() {
  try {
    const rows = await fetchTable(
      "/rest/v1/sector_stats?select=market,sector_key,sector_name,as_of,close,ret_1w,ret_2w,ret_1m,ret_3m,rel_1m,rel_3m,closes"
    );
    const benchmarks = {};
    const sectors = [];
    for (const r of rows) {
      if (r.sector_key === "__benchmark__") {
        benchmarks[r.market] = {
          name: r.sector_name,
          as_of: r.as_of,
          close: r.close,
          ret_1m: r.ret_1m,
          ret_3m: r.ret_3m,
        };
      } else {
        sectors.push(r);
      }
    }
    return json({ benchmarks, sectors }, 200, {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=60",
    });
  } catch (e) {
    return json({ error: "supabase_error" }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/picks" && request.method === "GET") {
        return handlePicks();
      }
      if (url.pathname === "/api/sector-stats" && request.method === "GET") {
        return handleSectorStats();
      }
      if (url.pathname === "/api/daily-reports" && request.method === "GET") {
        return handleDailyReports();
      }
      if (url.pathname === "/api/daily-report" && request.method === "GET") {
        return handleDailyReport(url);
      }
      return json({ error: "not_found" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
