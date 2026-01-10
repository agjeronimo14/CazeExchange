// src/index.js
const URLS = {
  dolarOficial: "https://ve.dolarapi.com/v1/dolares/oficial",
  dolarParalelo: "https://ve.dolarapi.com/v1/dolares/paralelo",
  eurUsd: "https://open.er-api.com/v6/latest/EUR",
  bcvRates: "https://bcv-api.rafnixg.dev/rates/",
  // Binance P2P (puede dar 403 en Workers)
  binanceP2P: "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
};

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(data, request, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function fetchJson(url, cfCacheSeconds = 60) {
  const res = await fetch(url, {
    cf: { cacheTtl: cfCacheSeconds, cacheEverything: true },
    headers: {
      "Accept": "application/json,text/plain,*/*",
      "User-Agent": "Mozilla/5.0 (compatible; CazeExchange/1.0; +https://workers.cloudflare.com)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function pickNumber(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function findEurVesFromBCV(bcvArray) {
  if (!Array.isArray(bcvArray)) return null;
  const eur = bcvArray.find(x => String(x?.symbol || "").toUpperCase() === "EUR");
  const v = eur?.rate ?? eur?.value ?? eur?.price ?? null;
  return (typeof v === "number" && Number.isFinite(v)) ? v : null;
}

// ---------- Binance P2P (opcional) ----------
async function binanceP2P({ fiat, tradeType, asset = "USDT", payTypes = [] }) {
  const payload = {
    page: 1,
    rows: 10,
    payTypes,
    asset,
    fiat,
    tradeType, // "BUY" o "SELL"
  };

  // “Headers humanos” (a veces ayuda, a veces no)
  const res = await fetch(URLS.binanceP2P, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json,text/plain,*/*",
      "Origin": "https://p2p.binance.com",
      "Referer": "https://p2p.binance.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Binance HTTP ${res.status} ${txt?.slice(0, 120)}`);
  }

  const data = await res.json();
  const priceStr = data?.data?.[0]?.adv?.price;
  const price = Number(priceStr);
  if (!Number.isFinite(price)) throw new Error("No price in Binance response");
  return price;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        return json({ ok: true, endpoints: ["/rates", "/bcv", "/dolar/oficial", "/dolar/paralelo", "/fx/eurusd", "/binance/p2p"] }, request);
      }

      if (url.pathname === "/dolar/oficial") {
        const data = await fetchJson(URLS.dolarOficial, 60);
        return json({ ok: true, data }, request);
      }

      if (url.pathname === "/dolar/paralelo") {
        const data = await fetchJson(URLS.dolarParalelo, 60);
        return json({ ok: true, data }, request);
      }

      if (url.pathname === "/fx/eurusd") {
        const fx = await fetchJson(URLS.eurUsd, 3600);
        const eurUsd = fx?.rates?.USD ?? null;
        return json({ ok: true, eurUsd, raw: fx }, request);
      }

      if (url.pathname === "/bcv") {
        const bcv = await fetchJson(URLS.bcvRates, 300);
        return json({ ok: true, data: bcv }, request);
      }

      // Todo junto (lo que usará tu app)
      if (url.pathname === "/rates") {
        const [oficial, paralelo, fx, bcv] = await Promise.all([
          fetchJson(URLS.dolarOficial, 60).catch(() => null),
          fetchJson(URLS.dolarParalelo, 60).catch(() => null),
          fetchJson(URLS.eurUsd, 3600).catch(() => null),
          fetchJson(URLS.bcvRates, 300).catch(() => null),
        ]);

        const usdVesOficial =
          pickNumber(oficial, ["promedio", "venta", "compra"]) ??
          pickNumber(oficial?.data, ["promedio", "venta", "compra"]) ??
          null;

        const usdVesParalelo =
          pickNumber(paralelo, ["promedio", "venta", "compra"]) ??
          pickNumber(paralelo?.data, ["promedio", "venta", "compra"]) ??
          null;

        const eurUsd = fx?.rates?.USD ?? null;
        const eurVesBCV = findEurVesFromBCV(bcv);

        return json(
          {
            ok: true,
            usdVesOficial,
            usdVesParalelo,
            eurUsd,
            eurVesBCV,
            fetchedAt: new Date().toISOString(),
          },
          request
        );
      }

      // Binance P2P (opcional)
      if (url.pathname === "/binance/p2p" && request.method === "POST") {
        const body = await request.json();
        const price = await binanceP2P(body);
        return json({ ok: true, price }, request);
      }

      return json({ ok: false, error: "Not found" }, request, 404);
    } catch (e) {
      return json({ ok: false, error: String(e?.message || e) }, request, 500);
    }
  },
};
