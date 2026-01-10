import "./style.css";

/* =========================
   CazeExchange (v1)
   Remesas: COP → USDT → VES
   Sin usuarios · pensado para móvil
   ========================= */

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);

function parseNum(x) {
  if (x === null || x === undefined) return 0;
  const s = String(x).trim().replaceAll(".", "").replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}

function fmt(n, d = 2) {
  if (n === null || n === undefined || n === "" || !Number.isFinite(Number(n))) return "—";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(Number(n));
}

function money(code, n, d = 2) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
  return `${code} ${fmt(n, d)}`;
}

function setText(id, text) {
  const node = $(id);
  if (!node) return;
  node.textContent = text;
}

function setInput(id, value, d = null) {
  const node = $(id);
  if (!node) return;
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) {
    node.value = "";
    return;
  }
  node.value = d === null ? String(Number(value)) : fmt(Number(value), d);
}

async function safeJson(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn("Fetch falló:", url, e);
    return null;
  }
}

// html2canvas por CDN (sin npm)
async function getHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;

  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  return window.html2canvas;
}

// ---------- state ----------
const state = {
  // tasas auto
  usdVesOficial: null,     // USD/VES (BCV oficial)
  usdVesParalelo: null,    // USD/VES paralelo
  eurUsd: null,            // USD por 1 EUR
  eurVesBCV: null,         // EUR/VES (BCV)
  updatedAt: null,
};

// ---------- mount ----------
const mount = document.getElementById("app") || document.getElementById("root");
if (!mount) {
  // si algo raro pasa, al menos lo ves
  document.body.innerHTML = `<pre style="padding:16px;color:#fff;background:#111">
No encuentro #app. Revisa index.html y deja: <div id="app"></div>
</pre>`;
  throw new Error("No se encontró #app");
}

mount.innerHTML = `
  <div class="container">
    <div class="header">
      <div class="brand">
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
          <h1 style="margin:0">Remesas (COP → USDT → VES)</h1>
          <span class="badge mono">CAZEEXCHANGE</span>
        </div>
        <small class="badge">Modo: sin usuarios · pensado para móvil · tasas automáticas (con edición manual)</small>
      </div>
      <div class="actions">
        <button id="btnUpdate" class="btn primary">Actualizar tasas</button>
        <button id="btnExport" class="btn">Exportar imagen</button>
        <span id="status" class="badge mono">Listo</span>
      </div>
    </div>

    <div class="grid">
      <!-- LEFT -->
      <div class="card">
        <h2>Entradas (lo que te pregunta el cliente)</h2>
        <div class="row">
          <div class="field">
            <label>Monto que te entrega (COP)</label>
            <input id="inCop" inputmode="decimal" placeholder="Ej: 200000" />
          </div>

          <div class="field">
            <label>Tipo de ganancia</label>
            <select id="feeType">
              <option value="pct">Porcentaje (%) sobre USDT</option>
              <option value="fixed">Fijo (USDT)</option>
            </select>
          </div>

          <div class="field">
            <label>Ganancia %</label>
            <input id="feePct" inputmode="decimal" value="10" />
          </div>

          <div class="field">
            <label>Ganancia fija (USDT)</label>
            <input id="feeFixed" inputmode="decimal" value="0" />
          </div>
        </div>

        <hr/>

        <h2>Tasas (auto + manual)</h2>
        <p class="hint">
          Las tasas marcadas “auto” se llenan al presionar <b>Actualizar tasas</b>, pero <b>puedes editarlas</b> si falla la automática.
          Binance P2P directo desde navegador suele dar CORS; por ahora <b>USDT/COP</b> y <b>USDT/VES</b> quedan manual.
        </p>

        <div class="row">
          <div class="field">
            <label>USD/VES (Oficial / BCV) [auto editable]</label>
            <input id="usdVesOf" inputmode="decimal" placeholder="Auto o manual" />
          </div>

          <div class="field">
            <label>USD/VES (Paralelo) [auto editable]</label>
            <input id="usdVesPar" inputmode="decimal" placeholder="Auto o manual" />
          </div>

          <div class="field">
            <label>EUR/VES (BCV) [auto editable]</label>
            <input id="eurVes" inputmode="decimal" placeholder="Auto o manual" />
          </div>

          <div class="field">
            <label>EURUSD [auto editable] (USD por 1 EUR)</label>
            <input id="eurUsd" inputmode="decimal" placeholder="Auto o manual" />
          </div>

          <div class="field">
            <label>USDT/COP (Comprar USDT en CO) [manual por ahora]</label>
            <input id="usdtCopBuy" inputmode="decimal" placeholder="Ej: 3950" />
          </div>

          <div class="field">
            <label>USDT/VES (Vender USDT en VE) [manual por ahora]</label>
            <input id="usdtVesSell" inputmode="decimal" placeholder="Ej: 690" />
          </div>
        </div>

        <hr/>

        <h2>Cálculo inverso (opcional): “quiero que me llegue…”</h2>
        <p class="hint">Escribe el objetivo y te calcula cuánto debe entregar el cliente (COP) considerando tu ganancia.</p>

        <div class="invTableWrap">
          <table class="invTable">
            <thead>
              <tr>
                <th style="width:34%">Objetivo</th>
                <th style="width:18%">Monto objetivo</th>
                <th style="width:20%">Equiv. VES objetivo</th>
                <th style="width:14%">Debe entregar (COP)</th>
                <th style="width:14%">Debe entregar (USD)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Recibir VES</b></td>
                <td><input id="invVes" inputmode="decimal" placeholder="Ej: 30000" /></td>
                <td id="invVesEq">—</td>
                <td id="invVesCop">—</td>
                <td id="invVesUsd">—</td>
              </tr>

              <tr>
                <td><b>Recibir USD equiv (BCV)</b></td>
                <td><input id="invUsdBcv" inputmode="decimal" placeholder="Ej: 50" /></td>
                <td id="invUsdBcvEq">—</td>
                <td id="invUsdBcvCop">—</td>
                <td id="invUsdBcvUsd">—</td>
              </tr>

              <tr>
                <td><b>Recibir USD equiv (Paralelo)</b></td>
                <td><input id="invUsdPar" inputmode="decimal" placeholder="Ej: 50" /></td>
                <td id="invUsdParEq">—</td>
                <td id="invUsdParCop">—</td>
                <td id="invUsdParUsd">—</td>
              </tr>

              <tr>
                <td><b>Recibir USD equiv (EUR BCV)</b></td>
                <td><input id="invUsdEur" inputmode="decimal" placeholder="Ej: 50" /></td>
                <td id="invUsdEurEq">—</td>
                <td id="invUsdEurCop">—</td>
                <td id="invUsdEurUsd">—</td>
              </tr>

              <tr>
                <td><b>Recibir EUR (BCV)</b></td>
                <td><input id="invEur" inputmode="decimal" placeholder="Ej: 50" /></td>
                <td id="invEurEq">—</td>
                <td id="invEurCop">—</td>
                <td id="invEurUsd">—</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      <!-- RIGHT -->
      <div class="card">
        <h2>Resumen para el cliente</h2>

        <div class="kpi">
          <div class="cap">Tasa grande (COP por 1 VES)</div>
          <div id="kpiCopPerVes" class="big">—</div>
          <div class="cap mono" id="kpiNote">—</div>
        </div>

        <div style="height:10px"></div>

        <div class="kpi">
          <div class="cap">Entrega (cliente)</div>
          <div id="outEntrega" class="big">—</div>
          <div class="cap">Recibe (beneficiario)</div>
          <div id="outRecibe" class="big">—</div>
        </div>

        <hr/>

        <div class="row">
          <div class="kpi">
            <div class="cap">Base (USDT comprado)</div>
            <div id="outBaseUsdt" class="big">—</div>
            <div class="cap">Ganancia (USDT)</div>
            <div id="outFeeUsdt" class="big">—</div>
          </div>

          <div class="kpi">
            <div class="cap">USDT neto a enviar</div>
            <div id="outNetUsdt" class="big">—</div>
            <div class="cap">Ganancia estimada (COP)</div>
            <div id="outFeeCop" class="big">—</div>
          </div>
        </div>

        <hr/>

        <h2>Mensaje WhatsApp (copiar/pegar)</h2>
        <textarea id="wa" readonly></textarea>

        <hr/>

        <div class="posterHeader">
          <div>
            <h2 style="margin:0">Tabla para redes (exportable)</h2>
            <div class="hint">Genera una imagen tipo “flyer” con montos ejemplo (COP → VES).</div>
          </div>
        </div>

        <div id="poster" class="poster">
          <div class="posterTop">
            <div class="posterBrand">CAZEEXCHANGE</div>
            <div class="posterTitle">Cotiza en segundos. Envía a Venezuela.</div>
            <div class="posterSub no-export" id="posterMeta">—</div>
          </div>

          <div class="posterBody">
            <div class="posterTableWrap">
              <table class="posterTable">
                <thead>
                  <tr>
                    <th>Entrega (COP)</th>
                    <th>Recibe (VES)</th>
                  </tr>
                </thead>
                <tbody id="posterRows"></tbody>
              </table>
            </div>
          </div>

          <div class="posterBottom">
            <div class="posterNote no-export">
              Actualiza tasas arriba. USDT/COP y USDT/VES son manuales por ahora.
            </div>
            <div class="posterFooter no-export">
              Elaborado por Alejandro Gomez
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
`;

// ---------- logic ----------
function readRatesFromInputs() {
  // permitimos manual override
  state.usdVesOficial = parseNum($("usdVesOf").value) || state.usdVesOficial;
  state.usdVesParalelo = parseNum($("usdVesPar").value) || state.usdVesParalelo;
  state.eurVesBCV = parseNum($("eurVes").value) || state.eurVesBCV;
  state.eurUsd = parseNum($("eurUsd").value) || state.eurUsd;
}

function usdVesViaEur() {
  const eurVes = parseNum($("eurVes").value);
  const eurUsd = parseNum($("eurUsd").value);
  if (eurVes > 0 && eurUsd > 0) return eurVes / eurUsd;
  return null;
}

function calcMain() {
  const cop = parseNum($("inCop").value);
  const usdtCopBuy = parseNum($("usdtCopBuy").value);
  const usdtVesSell = parseNum($("usdtVesSell").value);

  const feeType = $("feeType").value;
  const feePct = parseNum($("feePct").value) / 100;
  const feeFixed = parseNum($("feeFixed").value);

  if (!cop || !usdtCopBuy) {
    setText("kpiCopPerVes", "—");
    setText("kpiNote", "Completa COP + USDT/COP");
    setText("outEntrega", "—");
    setText("outRecibe", "—");
    setText("outBaseUsdt", "—");
    setText("outFeeUsdt", "—");
    setText("outNetUsdt", "—");
    setText("outFeeCop", "—");
    $("wa").value = "";
    return {
      cop, usdtCopBuy, usdtVesSell, feeType, feePct, feeFixed,
      baseUsdt: null, feeUsdt: null, netUsdt: null,
      vesUsed: null, methodLabel: null, copPerVes: null
    };
  }

  // 1) compras USDT con COP
  const baseUsdt = cop / usdtCopBuy;

  // 2) cobras ganancia en USDT
  const feeUsdt = feeType === "pct" ? (baseUsdt * feePct) : feeFixed;
  const netUsdt = Math.max(baseUsdt - feeUsdt, 0);

  // 3) VES por método
  const usdViaEur = usdVesViaEur(); // USD/VES derivado del EUR BCV
  const vesByEurBCV = usdViaEur ? netUsdt * usdViaEur : null;
  const vesByBinance = usdtVesSell ? netUsdt * usdtVesSell : null;

  // preferencia: EUR BCV si existe, sino Binance manual
  const useEur = Number.isFinite(vesByEurBCV) && vesByEurBCV > 0;
  const vesUsed = useEur ? vesByEurBCV : vesByBinance;

  const methodLabel = useEur ? "EUR BCV" : "Binance manual";

  const copPerVes = vesUsed ? (cop / vesUsed) : null;
  const feeCop = feeUsdt * usdtCopBuy;

  // UI
  setText("outEntrega", money("COP", cop, 0));
  setText("outBaseUsdt", money("USDT", baseUsdt, 2));
  setText("outFeeUsdt", money("USDT", feeUsdt, 2));
  setText("outNetUsdt", money("USDT", netUsdt, 2));
  setText("outFeeCop", money("COP", feeCop, 0));

  if (copPerVes) {
    setText("kpiCopPerVes", `COP ${fmt(copPerVes, 6)}`);
    setText("kpiNote", `COP por 1 VES (usando ${methodLabel})`);
  } else {
    setText("kpiCopPerVes", "—");
    setText("kpiNote", "Falta EUR/VES+EURUSD o USDT/VES");
  }

  const recibeTxt = vesUsed
    ? `${money("VES", vesUsed, 2)} (${methodLabel})`
    : "—";

  setText("outRecibe", recibeTxt);

  // WhatsApp SOLO lo que pediste + CazeExchange
  const lines = [
    "CazeExchange — Cotización remesa",
    `Entrega: ${money("COP", cop, 0)}`,
    `Recibe: ${vesUsed ? money("VES", vesUsed, 2) : "—"} VES`,
    `Tasa (COP/VES): ${copPerVes ? fmt(copPerVes, 6) : "—"}`,
  ];
  $("wa").value = lines.join("\n");

  return {
    cop, usdtCopBuy, usdtVesSell, feeType, feePct, feeFixed,
    baseUsdt, feeUsdt, netUsdt,
    vesUsed, methodLabel, copPerVes
  };
}

function inverseCopForTargetVes(targetVes, rateVesPerUsdt, usdtCopBuy, feeType, feePct, feeFixed) {
  if (!targetVes || !rateVesPerUsdt || !usdtCopBuy) return null;

  // netUsdt necesario para lograr targetVes
  const netUsdt = targetVes / rateVesPerUsdt;

  let baseUsdt = null;
  if (feeType === "pct") {
    const k = 1 - feePct;
    if (k <= 0) return null;
    baseUsdt = netUsdt / k;
  } else {
    baseUsdt = netUsdt + feeFixed;
  }

  const cop = baseUsdt * usdtCopBuy;
  const usd = baseUsdt; // aproximación: USD ≈ USDT

  return { cop, usd, ves: targetVes };
}

function calcInverse() {
  const usdtCopBuy = parseNum($("usdtCopBuy").value);
  const usdtVesSell = parseNum($("usdtVesSell").value);

  const feeType = $("feeType").value;
  const feePct = parseNum($("feePct").value) / 100;
  const feeFixed = parseNum($("feeFixed").value);

  const usdBcv = parseNum($("usdVesOf").value);      // USD/VES
  const usdPar = parseNum($("usdVesPar").value);     // USD/VES
  const eurVes = parseNum($("eurVes").value);        // EUR/VES
  const eurUsd = parseNum($("eurUsd").value);        // USD por 1 EUR
  const usdViaEur = (eurVes > 0 && eurUsd > 0) ? (eurVes / eurUsd) : null;

  // Si quieres “VES directo”, usamos preferencia EUR BCV si existe; si no, Binance (USDT/VES)
  const invVes = parseNum($("invVes").value);
  const rateForVes = usdViaEur || usdtVesSell || null;
  const r0 = inverseCopForTargetVes(invVes, rateForVes, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invVesEq", invVes ? `VES ${fmt(invVes, 2)}` : "—");
  setText("invVesCop", r0 ? money("COP", r0.cop, 0) : "—");
  setText("invVesUsd", r0 ? money("USD", r0.usd, 2) : "—");

  // USD equiv (BCV)
  const invUsdBcv = parseNum($("invUsdBcv").value);
  const targetVesBcv = (invUsdBcv && usdBcv) ? invUsdBcv * usdBcv : null;
  const r1 = inverseCopForTargetVes(targetVesBcv, usdViaEur || usdtVesSell || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invUsdBcvEq", targetVesBcv ? `VES ${fmt(targetVesBcv, 2)}` : "—");
  setText("invUsdBcvCop", r1 ? money("COP", r1.cop, 0) : "—");
  setText("invUsdBcvUsd", r1 ? money("USD", r1.usd, 2) : "—");

  // USD equiv (Paralelo)
  const invUsdPar = parseNum($("invUsdPar").value);
  const targetVesPar = (invUsdPar && usdPar) ? invUsdPar * usdPar : null;
  const r2 = inverseCopForTargetVes(targetVesPar, usdtVesSell || usdViaEur || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invUsdParEq", targetVesPar ? `VES ${fmt(targetVesPar, 2)}` : "—");
  setText("invUsdParCop", r2 ? money("COP", r2.cop, 0) : "—");
  setText("invUsdParUsd", r2 ? money("USD", r2.usd, 2) : "—");

  // USD equiv (EUR BCV)
  const invUsdEur = parseNum($("invUsdEur").value);
  const targetVesEur = (invUsdEur && usdViaEur) ? invUsdEur * usdViaEur : null;
  const r3 = inverseCopForTargetVes(targetVesEur, usdViaEur || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invUsdEurEq", targetVesEur ? `VES ${fmt(targetVesEur, 2)}` : "—");
  setText("invUsdEurCop", r3 ? money("COP", r3.cop, 0) : "—");
  setText("invUsdEurUsd", r3 ? money("USD", r3.usd, 2) : "—");

  // EUR (BCV)
  const invEur = parseNum($("invEur").value);
  const targetVesEurOnly = (invEur && eurVes) ? invEur * eurVes : null;
  const r4 = inverseCopForTargetVes(targetVesEurOnly, usdViaEur || usdtVesSell || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invEurEq", targetVesEurOnly ? `VES ${fmt(targetVesEurOnly, 2)}` : "—");
  setText("invEurCop", r4 ? money("COP", r4.cop, 0) : "—");
  setText("invEurUsd", r4 ? money("USD", r4.usd, 2) : "—");
}

function renderPoster(main) {
  const tbody = $("posterRows");
  if (!tbody) return;

  const amounts = [20000, 50000, 100000, 200000, 350000, 750000, 1000000];

  // Reutilizamos el cálculo principal con cada monto, manteniendo tasas y ganancia actuales
  const usdtCopBuy = parseNum($("usdtCopBuy").value);
  const usdtVesSell = parseNum($("usdtVesSell").value);
  const feeType = $("feeType").value;
  const feePct = parseNum($("feePct").value) / 100;
  const feeFixed = parseNum($("feeFixed").value);

  const usdViaEur = usdVesViaEur();
  const methodLabel = (usdViaEur ? "EUR BCV" : "Binance manual");

  // meta (pero NO export)
  const gainLabel = feeType === "pct" ? `${fmt(feePct * 100, 0)}%` : `${fmt(feeFixed, 2)} USDT`;
  setText("posterMeta", `Ganancia: ${gainLabel} · Método: ${methodLabel}`);

  tbody.innerHTML = amounts.map((cop) => {
    if (!usdtCopBuy) return `
      <tr><td>${money("COP", cop, 0)}</td><td>—</td></tr>
    `;

    const baseUsdt = cop / usdtCopBuy;
    const feeUsdt = feeType === "pct" ? baseUsdt * feePct : feeFixed;
    const netUsdt = Math.max(baseUsdt - feeUsdt, 0);

    const ves = usdViaEur
      ? netUsdt * usdViaEur
      : (usdtVesSell ? netUsdt * usdtVesSell : null);

    return `
      <tr>
        <td><b>${money("COP", cop, 0)}</b></td>
        <td><b>${ves ? money("VES", ves, 2) : "—"}</b></td>
      </tr>
    `;
  }).join("");
}

async function exportPoster() {
  const poster = $("poster");
  if (!poster) return;

  const html2canvas = await getHtml2Canvas();

  // Oculta lo marcado como no-export SOLO durante export
  document.body.classList.add("exporting");

  const canvas = await html2canvas(poster, {
    backgroundColor: null,
    scale: 2,
  });

  document.body.classList.remove("exporting");

  const a = document.createElement("a");
  a.download = `cazeexchange_tabla_${new Date().toISOString().slice(0,10)}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

async function updateRates() {
  const status = $("status");
  status.textContent = "Actualizando…";

  // DolarApi VE (USD oficial / paralelo)
  const usdOf = await safeJson("https://ve.dolarapi.com/v1/dolares/oficial");
  const usdPar = await safeJson("https://ve.dolarapi.com/v1/dolares/paralelo");

  // EURUSD (sin key)
  const fx = await safeJson("https://open.er-api.com/v6/latest/EUR");

  // BCV (EUR/VES) via tu Worker
  const bcv = await safeJson("https://remesas-proxy.agjeronimo14.workers.dev/bcv");

  const ofVal = usdOf?.promedio ?? usdOf?.venta ?? usdOf?.compra ?? null;
  const parVal = usdPar?.promedio ?? usdPar?.venta ?? usdPar?.compra ?? null;

  // BCV array: buscamos EUR
  const eurItem = Array.isArray(bcv) ? bcv.find(x => (x?.symbol || "").toUpperCase() === "EUR") : null;
  const eurVes = eurItem?.rate ?? eurItem?.value ?? eurItem?.price ?? null;

  const eurUsd = fx?.rates?.USD ?? null;

  if (ofVal) state.usdVesOficial = Number(ofVal);
  if (parVal) state.usdVesParalelo = Number(parVal);
  if (eurUsd) state.eurUsd = Number(eurUsd);
  if (eurVes) state.eurVesBCV = Number(eurVes);

  state.updatedAt = new Date();

  // pinta en inputs (pero quedan editables)
  setInput("usdVesOf", state.usdVesOficial, 4);
  setInput("usdVesPar", state.usdVesParalelo, 4);
  setInput("eurUsd", state.eurUsd, 6);
  setInput("eurVes", state.eurVesBCV, 4);

  const ok = [];
  if (state.usdVesOficial) ok.push("USD/BCV");
  if (state.usdVesParalelo) ok.push("USD Paralelo");
  if (state.eurUsd) ok.push("EURUSD");
  if (state.eurVesBCV) ok.push("EUR/BCV");
  ok.push("Binance: manual");

  status.textContent = `OK: ${ok.join(" · ")} · ${state.updatedAt.toLocaleString()}`;

  // recalcula todo
  readRatesFromInputs();
  const main = calcMain();
  calcInverse();
  renderPoster(main);
}

function recalcAll() {
  readRatesFromInputs();
  const main = calcMain();
  calcInverse();
  renderPoster(main);
}

// ---------- events ----------
$("btnUpdate").addEventListener("click", updateRates);
$("btnExport").addEventListener("click", exportPoster);

[
  "inCop","feeType","feePct","feeFixed",
  "usdVesOf","usdVesPar","eurVes","eurUsd",
  "usdtCopBuy","usdtVesSell",
  "invVes","invUsdBcv","invUsdPar","invUsdEur","invEur"
].forEach(id => {
  const n = $(id);
  if (!n) return;
  n.addEventListener("input", recalcAll);
  n.addEventListener("change", recalcAll);
});

// auto al abrir
updateRates();
