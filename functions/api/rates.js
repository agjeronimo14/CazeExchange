// Cloudflare Pages Function: GET /api/rates
//
// Devuelve tasas usadas por el frontend para el cotizador.
// Incluye un estado PRO de calidad (primary/approx/missing) + detalle de fuentes.

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Una cotizaciÃ³n no debe reaparecer desde la cachÃ© del navegador.
      "cache-control": "no-store, max-age=0",
      "access-control-allow-origin": "*",
      ...extraHeaders,
    },
  });
}

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

async function fetchJson(url, init = {}) {
  // Un proveedor lento no debe bloquear la cotizaciÃ³n completa.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const txt = await res.text();
    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${url}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

const P2P_MARKETS = {
  cop: {
    payTypes: ["BancolombiaSA"],
    label: "Bancolombia",
    minCop: 50_000,
    maxCop: 1_000_000,
  },
  ves: {
    payTypes: ["BancoDeVenezuela"],
    label: "Banco de Venezuela / Pago MÃ³vil",
  },
};

async function binanceP2P({ fiat, tradeType, transAmount, payTypes = [] }) {
  const url = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
  const payload = {
    page: 1,
    rows: 10,
    publisherType: null,
    payTypes,
    asset: "USDT",
    fiat,
    tradeType,
  };
  if (transAmount != null) payload.transAmount = String(transAmount);

  const data = await fetchJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (Cloudflare Pages Function)",
    },
    body: JSON.stringify(payload),
  });

  const prices = (data?.data ?? [])
    .map((row) => asNum(row?.adv?.price))
    .filter((n) => Number.isFinite(n));

  return median(prices);
}

async function fetchEurVesBcv() {
  // Opcional: tu Worker que devuelve array con tasas BCV (incluye EUR)
  const url = "https://remesas-proxy.agjeronimo14.workers.dev/bcv";
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return null;
  const eur = data.find((x) => String(x?.symbol || "").toUpperCase() === "EUR");
  const v = asNum(eur?.rate ?? eur?.value ?? eur?.price);
  return Number.isFinite(v) ? v : null;
}

export async function onRequest(context) {
  // --- CORS preflight ---
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
    eurVesBcv: null,

    // meta legacy (para compat con UI existente)
    sources: [],
    warnings: [],
  };

  if (
    Number.isFinite(copAmount) &&
    (copAmount < P2P_MARKETS.cop.minCop || copAmount > P2P_MARKETS.cop.maxCop)
  ) {
    out.warnings.push("Monto COP fuera del rango operativo configurado (50.000 a 1.000.000 COP)");
  }

  // Track fallbacks
  let usedApproxUsdtCop = false;
  let usedApproxUsdtVes = false;
  let binanceCopErr = null;
  let binanceVesErr = null;

  // 1) Binance P2P (USDT/COP y USDT/VES)
  try {
    out.usdtCopBuy = await binanceP2P({
      fiat: "COP",
      tradeType: "BUY",
      transAmount: copAmount,
      payTypes: P2P_MARKETS.cop.payTypes,
    });
    if (Number.isFinite(out.usdtCopBuy)) {
      out.sources.push("Binance P2P USDT/COP (BUY, Bancolombia)");
    }
  } catch (e) {
    binanceCopErr = e;
    out.warnings.push(`Binance P2P COP falló: ${String(e?.message ?? e)}`);
  }

  try {
    out.usdtVesSell = await binanceP2P({
      fiat: "VES",
      tradeType: "SELL",
      transAmount: vesAmount,
      payTypes: P2P_MARKETS.ves.payTypes,
    });
    if (Number.isFinite(out.usdtVesSell)) {
      out.sources.push("Binance P2P USDT/VES (SELL, Banco de Venezuela)");
    }
  } catch (e) {
    binanceVesErr = e;
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
    out.eurUsd = eurPerUsd ? 1 / eurPerUsd : null; // EURUSD
    if (Number.isFinite(out.usdCop)) out.sources.push("ER-API USD/COP");
    if (Number.isFinite(out.eurUsd)) out.sources.push("ER-API EURUSD (derivado)");
  } catch (e) {
    out.warnings.push(`ER-API falló: ${String(e?.message ?? e)}`);
  }

  // 4) EUR/VES BCV (opcional)
  try {
    out.eurVesBcv = await fetchEurVesBcv();
    if (Number.isFinite(out.eurVesBcv)) out.sources.push("Worker BCV (EUR/VES)");
  } catch (e) {
    // no es crítico
    out.warnings.push(`BCV worker falló: ${String(e?.message ?? e)}`);
  }

  // Si Binance no dio USDT/COP o USDT/VES, usamos aproximaciones por forex.
  if (!Number.isFinite(out.usdtCopBuy) && Number.isFinite(out.usdCop)) {
    out.usdtCopBuy = out.usdCop; // aproximación USDT≈USD
    usedApproxUsdtCop = true;
    out.sources.push("USDT/COP ≈ USD/COP (aprox)");
  }
  if (!Number.isFinite(out.usdtVesSell) && Number.isFinite(out.usdVesParallel)) {
    out.usdtVesSell = out.usdVesParallel; // aproximación USDT≈USD
    usedApproxUsdtVes = true;
    out.sources.push("USDT/VES ≈ USD/VES paralelo (aprox)");
  }

  // Estado PRO
  const required = ["usdVesBcv", "usdVesParallel", "usdtCopBuy", "usdtVesSell"];
  const missing = required.filter((k) => !Number.isFinite(out[k]));
  const fallback_rates = [];
  if (usedApproxUsdtCop) fallback_rates.push("usdt_cop");
  if (usedApproxUsdtVes) fallback_rates.push("usdt_ves");

  let quality = "primary";
  if (missing.length) quality = "missing";
  else if (fallback_rates.length) quality = "approx";

  // sources_detail para tooltip (lo usa el frontend)
  const sources_detail = {
    bcv: Number.isFinite(out.usdVesBcv) ? "BCV (DolarAPI)" : "—",
    parallel: Number.isFinite(out.usdVesParallel) ? "Paralelo (DolarAPI)" : "—",
    usdt_cop: Number.isFinite(out.usdtCopBuy)
      ? (usedApproxUsdtCop
          ? `Aprox: USD/COP${binanceCopErr?.status ? ` (Binance ${binanceCopErr.status} → aprox)` : ""}`
          : "Binance P2P")
      : "—",
    usdt_ves: Number.isFinite(out.usdtVesSell)
      ? (usedApproxUsdtVes
          ? `Aprox: USD/VES paralelo${binanceVesErr?.status ? ` (Binance ${binanceVesErr.status} → aprox)` : ""}`
          : "Binance P2P")
      : "—",
  };

  if (!usedApproxUsdtCop && Number.isFinite(out.usdtCopBuy)) {
    sources_detail.usdt_cop = `Binance P2P (${P2P_MARKETS.cop.label})`;
  }
  if (!usedApproxUsdtVes && Number.isFinite(out.usdtVesSell)) {
    sources_detail.usdt_ves = `Binance P2P (${P2P_MARKETS.ves.label})`;
  }

  // status legacy
  out.status = quality === "primary" && out.warnings.length === 0 ? "ok" : "fallback";
  out.missing = missing;
  out.quality = quality;
  out.fallback_rates = fallback_rates;
  out.sources_detail = sources_detail;
  out.market = {
    cop_payment: P2P_MARKETS.cop.label,
    ves_payment: P2P_MARKETS.ves.label,
    cop_range: {
      min: P2P_MARKETS.cop.minCop,
      max: P2P_MARKETS.cop.maxCop,
    },
  };

  return json(out);
}
