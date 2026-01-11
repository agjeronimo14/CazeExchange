// Cloudflare Pages Function: GET /api/rates
//
// Objetivo:
// - Dar tasas "del día" sin costos (sin keys), desde fuentes públicas.
// - Evitar CORS: el frontend llama a este endpoint, y este endpoint hace fetch server-side.
// - Si alguna fuente falla, devolvemos lo que tengamos (y el frontend permite edición manual).
//
// Fuentes:
// - Binance P2P (sin key) para USDT/COP (BUY) y USDT/VES (SELL) -> precio "market" P2P.
// - DolarAPI (Venezuela) para USD/VES oficial (BCV) y paralelo.
// - ER-API (ExchangeRate-API mirror) para USD/COP y EURUSD.

function asNum(x) {
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function pickRate(obj) {
  // DolarAPI suele traer compra/venta/promedio.
  return (
    asNum(obj?.promedio) ??
    asNum(obj?.venta) ??
    asNum(obj?.compra) ??
    asNum(obj?.rate) ??
    null
  );
}

function median(values) {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.json();
}

async function binanceP2P({ fiat, tradeType, transAmount }) {
  // Endpoint público usado ampliamente (puede cambiar en el tiempo).
  const url = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
  const payload = {
    page: 1,
    rows: 10,
    publisherType: null,
    asset: "USDT",
    fiat,
    tradeType,
  };
  if (transAmount != null) payload.transAmount = String(transAmount);

  const data = await fetchJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // algunos entornos de CF agradecen un UA explícito
      "user-agent": "Mozilla/5.0 (Cloudflare Pages Function)",
    },
    body: JSON.stringify(payload),
  });

  const prices = (data?.data ?? [])
    .map((row) => asNum(row?.adv?.price))
    .filter((n) => Number.isFinite(n));

  // Usamos mediana de los primeros 10 anuncios para reducir outliers.
  return median(prices);
}

export async function onRequest(context) {
  // --- CORS (para que funcione desde localhost durante desarrollo) ---
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const url = new URL(context.request.url);
  const copAmount = asNum(url.searchParams.get("cop"));
  const vesAmount = asNum(url.searchParams.get("ves"));

  const out = {
    ok: true,
    ts: new Date().toISOString(),
    // valores principales
    usdtCopBuy: null,
    usdtVesSell: null,
    usdVesBcv: null,
    usdVesParallel: null,
    usdCop: null,
    eurUsd: null,
    // meta
    sources: [],
    warnings: [],
  };

  // 1) Binance P2P (USDT/COP y USDT/VES)
  try {
    out.usdtCopBuy = await binanceP2P({ fiat: "COP", tradeType: "BUY", transAmount: copAmount });
    if (Number.isFinite(out.usdtCopBuy)) out.sources.push("Binance P2P USDT/COP (BUY)");
  } catch (e) {
    out.warnings.push(`Binance P2P COP falló: ${String(e?.message ?? e)}`);
  }

  try {
    out.usdtVesSell = await binanceP2P({ fiat: "VES", tradeType: "SELL", transAmount: vesAmount });
    if (Number.isFinite(out.usdtVesSell)) out.sources.push("Binance P2P USDT/VES (SELL)");
  } catch (e) {
    out.warnings.push(`Binance P2P VES falló: ${String(e?.message ?? e)}`);
  }

  // 2) DolarAPI (Venezuela: oficial/BCV y paralelo)
  try {
    const [oficial, paralelo] = await Promise.all([
      fetchJson("https://ve.dolarapi.com/v1/dolares/oficial"),
      fetchJson("https://ve.dolarapi.com/v1/dolares/paralelo"),
    ]);
    out.usdVesBcv = pickRate(oficial);
    out.usdVesParallel = pickRate(paralelo);
    if (Number.isFinite(out.usdVesBcv)) out.sources.push("DolarAPI USD/VES oficial (BCV)");
    if (Number.isFinite(out.usdVesParallel)) out.sources.push("DolarAPI USD/VES paralelo");
  } catch (e) {
    out.warnings.push(`DolarAPI VE falló: ${String(e?.message ?? e)}`);
  }

  // 3) USD/COP y EURUSD (desde USD base)
  try {
    const fx = await fetchJson("https://open.er-api.com/v6/latest/USD");
    const cop = asNum(fx?.rates?.COP ?? fx?.conversion_rates?.COP);
    const eurPerUsd = asNum(fx?.rates?.EUR ?? fx?.conversion_rates?.EUR);
    out.usdCop = cop;
    out.eurUsd = eurPerUsd ? 1 / eurPerUsd : null;
    if (Number.isFinite(out.usdCop)) out.sources.push("ER-API USD/COP");
    if (Number.isFinite(out.eurUsd)) out.sources.push("ER-API EURUSD (derivado)");
  } catch (e) {
    out.warnings.push(`ER-API falló: ${String(e?.message ?? e)}`);
  }

  // Si Binance no dio USDT/COP o USDT/VES, usamos aproximaciones por forex.
  if (!Number.isFinite(out.usdtCopBuy) && Number.isFinite(out.usdCop)) {
    out.usdtCopBuy = out.usdCop; // aproximación USDT≈USD
    out.sources.push("USDT/COP ≈ USD/COP (aprox)");
  }
  if (!Number.isFinite(out.usdtVesSell) && Number.isFinite(out.usdVesParallel)) {
    out.usdtVesSell = out.usdVesParallel; // aproximación USDT≈USD
    out.sources.push("USDT/VES ≈ USD/VES paralelo (aprox)");
  }

  // Cache corto para evitar rate limit (60s)
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=60",
    "Access-Control-Allow-Origin": "*",
  };
  return new Response(JSON.stringify(out), { headers });
}
