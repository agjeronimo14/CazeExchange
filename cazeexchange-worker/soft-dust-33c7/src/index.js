export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (path === "/" || path === "/health") {
        return json({ ok: true, endpoints: ["/rates", "/bcv"] });
      }

      if (path === "/bcv") {
        // Tu fuente BCV actual (la que ya te funciona)
        const data = await fetchJson("https://bcv-api.rafnixg.dev/rates/");
        return json(data);
      }

      if (path === "/rates") {
        const [usdOf, usdPar, eur, bcv] = await Promise.all([
          fetchJson("https://ve.dolarapi.com/v1/dolares/oficial"),
          fetchJson("https://ve.dolarapi.com/v1/dolares/paralelo"),
          fetchJson("https://open.er-api.com/v6/latest/EUR"),
          fetchJson("https://bcv-api.rafnixg.dev/rates/"),
        ]);

        // EURUSD (USD por 1 EUR)
        const eurUsd = eur?.rates?.USD ?? null;

        // EUR/VES desde BCV
        let eurVes = null;
        if (Array.isArray(bcv)) {
          const eurItem = bcv.find(x => (x?.symbol || "").toUpperCase() === "EUR");
          eurVes = eurItem?.rate ?? eurItem?.value ?? eurItem?.price ?? null;
        }

        // USD oficial / paralelo (promedio/venta/compra)
        const usdOficial = usdOf?.promedio ?? usdOf?.venta ?? usdOf?.compra ?? null;
        const usdParalelo = usdPar?.promedio ?? usdPar?.venta ?? usdPar?.compra ?? null;

        return json({
          updatedAt: new Date().toISOString(),
          usdVesOficial: usdOficial,
          usdVesParalelo: usdParalelo,
          eurUsd,
          eurVesBCV: eurVes,
          note: "USDT/COP y USDT/VES quedan manuales (P2P suele bloquear CORS o pedir API key).",
        });
      }

      return new Response("Not found", { status: 404, headers: corsHeaders() });
    } catch (err) {
      return json({ ok: false, error: String(err?.message || err) }, 500);
    }

    function corsHeaders() {
      return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Cache-Control": "no-store",
      };
    }

    function json(obj, status = 200) {
      return new Response(JSON.stringify(obj, null, 2), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() },
      });
    }

    async function fetchJson(u) {
      const r = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0 (CazeExchange Worker)" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${u}`);
      return r.json();
    }
  },
};
