import "./style.css";

/* =========================
   CazeExchange (v1)
   Remesas: COP → USDT → VES
   Sin usuarios · pensado para móvil
   ========================= */

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);

// Base para API (para que funcione en localhost sin CORS)
// - En producción (Pages) queda "" y usamos /api/rates en el mismo dominio.
// - En local (vite dev) usamos como fallback el dominio de Pages, a menos que el usuario lo cambie.
const API_BASE = (() => {
  try {
    const saved = localStorage.getItem("API_BASE");
    if (saved) return saved.replace(/\/$/, "");
  } catch {}

  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  return isLocal ? "https://cazeexchange.pages.dev" : "";
})();

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

// ------------------------------------------------------------
// Compat: commits anteriores usaban `toNum(...)` y `setValue(...)`.
// En producción (bundle minificado) esto da `ReferenceError` si faltan.
// Los dejamos aquí para que TODO siga funcionando aunque queden referencias.

// Alias: `toNum(x)` => número limpio
function toNum(v) {
  return parseNum(v);
}

// Expone alias globales por si algún handler quedó fuera del scope del módulo.
try {
  if (typeof window !== "undefined") {
    if (typeof window.toNum === "undefined") window.toNum = toNum;
  }
} catch {}

// setValue(id, value, decimals?) -> setInput + dispara evento input
function setValue(id, value, decimals = null) {
  setInput(id, value, decimals);
  const el = $(id);
  if (!el) return;
  try {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } catch {}
}

try {
  if (typeof window !== "undefined") {
    if (typeof window.setValue === "undefined") window.setValue = setValue;
  }
} catch {}

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

  // UI (persistente)
  quoteMode: (typeof localStorage !== "undefined" && localStorage.getItem("quoteMode")) || "goal",
  invLast: (typeof localStorage !== "undefined" && localStorage.getItem("invLast")) || "invVes",
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

        <div class="modeBar">
          <div class="modeBarTop">
            <div class="modeLabel">Modo de cotización</div>
            <div class="segmented" role="tablist" aria-label="Modo de cotización">
              <button id="modeCop" class="segBtn" type="button">Por COP</button>
              <button id="modeGoal" class="segBtn" type="button">Por objetivo</button>
            </div>
          </div>
          <div id="modeHint" class="hint" style="margin-top:8px">—</div>
        </div>


        <div class="row">
          <div class="field">
            <label id="labInCop">Monto que te entrega (COP)</label>
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
          Para <b>USDT/COP</b> y <b>USDT/VES</b> intentamos traer una <i>tasa del día</i> (preferiblemente Binance P2P vía server).
          Si Binance falla o te bloquea, queda manual.
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
              <tr id="row_invVes">
                <td><b>Recibir VES</b></td>
                <td><input id="invVes" inputmode="decimal" placeholder="Ej: 30000" /></td>
                <td id="invVesEq">—</td>
                <td id="invVesCop">—</td>
                <td id="invVesUsd">—</td>
              </tr>

              <tr id="row_invUsdBcv">
                <td><b>Recibir USD equiv (BCV)</b></td>
                <td><input id="invUsdBcv" inputmode="decimal" placeholder="Ej: 50" /></td>
                <td id="invUsdBcvEq">—</td>
                <td id="invUsdBcvCop">—</td>
                <td id="invUsdBcvUsd">—</td>
              </tr>

              <tr id="row_invUsdPar">
                <td><b>Recibir USD equiv (Paralelo)</b></td>
                <td><input id="invUsdPar" inputmode="decimal" placeholder="Ej: 50" /></td>
                <td id="invUsdParEq">—</td>
                <td id="invUsdParCop">—</td>
                <td id="invUsdParUsd">—</td>
              </tr>

              <tr id="row_invUsdEur">
                <td><b>Recibir USD equiv (EUR BCV)</b></td>
                <td><input id="invUsdEur" inputmode="decimal" placeholder="Ej: 50" /></td>
                <td id="invUsdEurEq">—</td>
                <td id="invUsdEurCop">—</td>
                <td id="invUsdEurUsd">—</td>
              </tr>

              <tr id="row_invEur">
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
        <div id="quoteSourceBadge" class="badge mono" style="margin:-4px 0 10px 0">Fuente: —</div>


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

            <div class="posterRate">
              <div class="posterRateLabel">Tasa grande (COP por 1 VES)</div>
              <div id="posterRateValue" class="posterRateValue">—</div>
              <div id="posterRateNote" class="posterRateNote">—</div>
            </div>
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
const INV_LABELS = {
  invVes: "Recibir VES",
  invUsdBcv: "Recibir USD (BCV)",
  invUsdPar: "Recibir USD (Paralelo)",
  invUsdEur: "Recibir USD (EUR BCV)",
  invEur: "Recibir EUR (BCV)",
};

function setInvLast(id) {
  state.invLast = id;
  try { localStorage.setItem("invLast", id); } catch (_) {}
  highlightInvRows();
}

function highlightInvRows() {
  const rows = [
    ["invVes","row_invVes"],
    ["invUsdBcv","row_invUsdBcv"],
    ["invUsdPar","row_invUsdPar"],
    ["invUsdEur","row_invUsdEur"],
    ["invEur","row_invEur"],
  ];
  rows.forEach(([key, rid]) => {
    const tr = document.getElementById(rid);
    if (!tr) return;
    const on = state.quoteMode === "goal" && state.invLast === key;
    tr.classList.toggle("rowActive", on);
  });
}

function applyQuoteModeUI() {
  const isGoal = state.quoteMode === "goal";

  const bCop = $("modeCop");
  const bGoal = $("modeGoal");
  if (bCop && bGoal) {
    bCop.classList.toggle("active", !isGoal);
    bGoal.classList.toggle("active", isGoal);
  }

  const inCop = $("inCop");
  if (inCop) {
    inCop.readOnly = isGoal;
    inCop.classList.toggle("readonly", isGoal);
    inCop.placeholder = isGoal ? "Se calcula por objetivo" : "Ej: 200000";
  }

  const lab = $("labInCop");
  if (lab) lab.textContent = isGoal ? "Monto que te entrega (COP) — calculado" : "Monto que te entrega (COP)";

  const hint = $("modeHint");
  if (hint) {
    hint.textContent = isGoal
      ? "Usa la tabla inversa: escribe cuánto quieres que llegue y el sistema calcula cuánto debe entregar el cliente."
      : "Usa el monto en COP: escribe cuánto entrega el cliente y el sistema calcula cuánto recibe en Venezuela.";
  }

  const badge = $("quoteSourceBadge");
  if (badge) {
    badge.textContent = isGoal
      ? `Fuente: Objetivo (${INV_LABELS[state.invLast] || "tabla inversa"})`
      : "Fuente: COP (monto entregado)";
  }

  highlightInvRows();
}

function setQuoteMode(mode) {
  state.quoteMode = mode === "cop" ? "cop" : "goal";
  try { localStorage.setItem("quoteMode", state.quoteMode); } catch (_) {}
  applyQuoteModeUI();
  recalcAll();
}

function getActiveQuote(main, inv) {
  return state.quoteMode === "goal" ? (inv?.cop ? inv : null) : (main?.cop ? main : null);
}

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

function setSummaryBlank(note = "Completa datos") {
  setText("kpiCopPerVes", "—");
  setText("kpiNote", note);
  setText("outEntrega", "—");
  setText("outRecibe", "—");
  setText("outBaseUsdt", "—");
  setText("outFeeUsdt", "—");
  setText("outNetUsdt", "—");
  setText("outFeeCop", "—");
  $("wa").value = "";
}

function setSummary({
  cop,
  baseUsdt,
  feeUsdt,
  netUsdt,
  feeCop,
  vesUsed,
  methodLabel,
  copPerVes,
  waPrefix = "CazeExchange — Cotización remesa",
} = {}) {
  // UI
  setText("outEntrega", Number.isFinite(cop) ? money("COP", cop, 0) : "—");
  setText("outBaseUsdt", Number.isFinite(baseUsdt) ? money("USDT", baseUsdt, 2) : "—");
  setText("outFeeUsdt", Number.isFinite(feeUsdt) ? money("USDT", feeUsdt, 2) : "—");
  setText("outNetUsdt", Number.isFinite(netUsdt) ? money("USDT", netUsdt, 2) : "—");
  setText("outFeeCop", Number.isFinite(feeCop) ? money("COP", feeCop, 0) : "—");

  if (Number.isFinite(copPerVes) && copPerVes > 0) {
    setText("kpiCopPerVes", `COP ${fmt(copPerVes, 6)}`);
    setText("kpiNote", `COP por 1 VES (usando ${methodLabel || "—"})`);
  } else {
    setText("kpiCopPerVes", "—");
    setText("kpiNote", "Faltan tasas para calcular la tasa grande");
  }

  const recibeTxt = Number.isFinite(vesUsed) && vesUsed > 0
    ? `${money("VES", vesUsed, 2)} (${methodLabel || "—"})`
    : "—";
  setText("outRecibe", recibeTxt);

  const lines = [
    waPrefix,
    `Entrega: ${Number.isFinite(cop) ? money("COP", cop, 0) : "—"}`,
    `Recibe: ${Number.isFinite(vesUsed) ? money("VES", vesUsed, 2) : "—"} VES`,
    `Tasa (COP/VES): ${Number.isFinite(copPerVes) ? fmt(copPerVes, 6) : "—"}`,
  ];
  $("wa").value = lines.join("\n");
}

function calcMain(opts = { paint: true }) {
  const cop = parseNum($("inCop").value);
  const usdtCopBuy = parseNum($("usdtCopBuy").value);
  const usdtVesSell = parseNum($("usdtVesSell").value);

  const feeType = $("feeType").value;
  const feePct = parseNum($("feePct").value) / 100;
  const feeFixed = parseNum($("feeFixed").value);

  if (!cop || !usdtCopBuy) {
    // OJO: si el usuario usa la tabla inversa (objetivo), esto se sobreescribe luego.
    if (opts.paint !== false) setSummaryBlank("Completa COP + USDT/COP o usa la tabla inversa");
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

  if (opts.paint !== false) {
  setSummary({
    cop,
    baseUsdt,
    feeUsdt,
    netUsdt,
    feeCop,
    vesUsed,
    methodLabel,
    copPerVes,
  });
  }

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

  // Vamos a devolver un "primary" para pintar el Resumen cuando el usuario use la tabla inversa.
  const primary = {
    cop: null,
    vesUsed: null,
    methodLabel: null,
    copPerVes: null,
    baseUsdt: null,
    feeUsdt: null,
    netUsdt: null,
    feeCop: null,
  };

  const candidates = {};


  // Si quieres “VES directo”, usamos preferencia EUR BCV si existe; si no, Binance (USDT/VES)
  const invVes = parseNum($("invVes").value);
  const rateForVes = usdViaEur || usdtVesSell || null;
  const r0 = inverseCopForTargetVes(invVes, rateForVes, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invVesEq", invVes ? `VES ${fmt(invVes, 2)}` : "—");
  setText("invVesCop", r0 ? money("COP", r0.cop, 0) : "—");
  setText("invVesUsd", r0 ? money("USD", r0.usd, 2) : "—");

  if (invVes && r0) {
    const baseUsdt = r0.cop / usdtCopBuy;
    const feeUsdt = feeType === "pct" ? (baseUsdt * feePct) : feeFixed;
    const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
    const methodLabel = usdViaEur ? "EUR BCV" : (usdtVesSell ? "Binance manual" : "—");
    const copPerVes = r0.cop / invVes;
    primary.cop = r0.cop;
    primary.vesUsed = invVes;
    primary.methodLabel = methodLabel;
    primary.copPerVes = copPerVes;
    primary.baseUsdt = baseUsdt;
    primary.feeUsdt = feeUsdt;
    primary.netUsdt = netUsdt;
    primary.feeCop = feeUsdt * usdtCopBuy;
    candidates.invVes = { cop: primary.cop, vesUsed: primary.vesUsed, methodLabel: primary.methodLabel, copPerVes: primary.copPerVes, baseUsdt: primary.baseUsdt, feeUsdt: primary.feeUsdt, netUsdt: primary.netUsdt, feeCop: primary.feeCop };
  }

  // USD equiv (BCV)
  const invUsdBcv = parseNum($("invUsdBcv").value);
  const targetVesBcv = (invUsdBcv && usdBcv) ? invUsdBcv * usdBcv : null;
  const r1 = inverseCopForTargetVes(targetVesBcv, usdViaEur || usdtVesSell || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invUsdBcvEq", targetVesBcv ? `VES ${fmt(targetVesBcv, 2)}` : "—");
  setText("invUsdBcvCop", r1 ? money("COP", r1.cop, 0) : "—");
  setText("invUsdBcvUsd", r1 ? money("USD", r1.usd, 2) : "—");

  if (!primary.cop && invUsdBcv && targetVesBcv && r1) {
    const baseUsdt = r1.cop / usdtCopBuy;
    const feeUsdt = feeType === "pct" ? (baseUsdt * feePct) : feeFixed;
    const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
    const methodLabel = usdViaEur ? "EUR BCV" : (usdtVesSell ? "Binance manual" : "—");
    const copPerVes = r1.cop / targetVesBcv;
    primary.cop = r1.cop;
    primary.vesUsed = targetVesBcv;
    primary.methodLabel = methodLabel;
    primary.copPerVes = copPerVes;
    primary.baseUsdt = baseUsdt;
    primary.feeUsdt = feeUsdt;
    primary.netUsdt = netUsdt;
    primary.feeCop = feeUsdt * usdtCopBuy;
    candidates.invUsdBcv = { cop: primary.cop, vesUsed: primary.vesUsed, methodLabel: primary.methodLabel, copPerVes: primary.copPerVes, baseUsdt: primary.baseUsdt, feeUsdt: primary.feeUsdt, netUsdt: primary.netUsdt, feeCop: primary.feeCop };
  }

  // USD equiv (Paralelo)
  const invUsdPar = parseNum($("invUsdPar").value);
  const targetVesPar = (invUsdPar && usdPar) ? invUsdPar * usdPar : null;
  const r2 = inverseCopForTargetVes(targetVesPar, usdtVesSell || usdViaEur || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invUsdParEq", targetVesPar ? `VES ${fmt(targetVesPar, 2)}` : "—");
  setText("invUsdParCop", r2 ? money("COP", r2.cop, 0) : "—");
  setText("invUsdParUsd", r2 ? money("USD", r2.usd, 2) : "—");

  if (!primary.cop && invUsdPar && targetVesPar && r2) {
    const baseUsdt = r2.cop / usdtCopBuy;
    const feeUsdt = feeType === "pct" ? (baseUsdt * feePct) : feeFixed;
    const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
    const methodLabel = usdtVesSell ? "Binance manual" : (usdViaEur ? "EUR BCV" : "—");
    const copPerVes = r2.cop / targetVesPar;
    primary.cop = r2.cop;
    primary.vesUsed = targetVesPar;
    primary.methodLabel = methodLabel;
    primary.copPerVes = copPerVes;
    primary.baseUsdt = baseUsdt;
    primary.feeUsdt = feeUsdt;
    primary.netUsdt = netUsdt;
    primary.feeCop = feeUsdt * usdtCopBuy;
    candidates.invUsdPar = { cop: primary.cop, vesUsed: primary.vesUsed, methodLabel: primary.methodLabel, copPerVes: primary.copPerVes, baseUsdt: primary.baseUsdt, feeUsdt: primary.feeUsdt, netUsdt: primary.netUsdt, feeCop: primary.feeCop };
  }

  // USD equiv (EUR BCV)
  const invUsdEur = parseNum($("invUsdEur").value);
  const targetVesEur = (invUsdEur && usdViaEur) ? invUsdEur * usdViaEur : null;
  const r3 = inverseCopForTargetVes(targetVesEur, usdViaEur || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invUsdEurEq", targetVesEur ? `VES ${fmt(targetVesEur, 2)}` : "—");
  setText("invUsdEurCop", r3 ? money("COP", r3.cop, 0) : "—");
  setText("invUsdEurUsd", r3 ? money("USD", r3.usd, 2) : "—");

  if (!primary.cop && invUsdEur && targetVesEur && r3) {
    const baseUsdt = r3.cop / usdtCopBuy;
    const feeUsdt = feeType === "pct" ? (baseUsdt * feePct) : feeFixed;
    const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
    const methodLabel = usdViaEur ? "EUR BCV" : "—";
    const copPerVes = r3.cop / targetVesEur;
    primary.cop = r3.cop;
    primary.vesUsed = targetVesEur;
    primary.methodLabel = methodLabel;
    primary.copPerVes = copPerVes;
    primary.baseUsdt = baseUsdt;
    primary.feeUsdt = feeUsdt;
    primary.netUsdt = netUsdt;
    primary.feeCop = feeUsdt * usdtCopBuy;
    candidates.invUsdEur = { cop: primary.cop, vesUsed: primary.vesUsed, methodLabel: primary.methodLabel, copPerVes: primary.copPerVes, baseUsdt: primary.baseUsdt, feeUsdt: primary.feeUsdt, netUsdt: primary.netUsdt, feeCop: primary.feeCop };
  }

  // EUR (BCV)
  const invEur = parseNum($("invEur").value);
  const targetVesEurOnly = (invEur && eurVes) ? invEur * eurVes : null;
  const r4 = inverseCopForTargetVes(targetVesEurOnly, usdViaEur || usdtVesSell || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invEurEq", targetVesEurOnly ? `VES ${fmt(targetVesEurOnly, 2)}` : "—");
  setText("invEurCop", r4 ? money("COP", r4.cop, 0) : "—");
  setText("invEurUsd", r4 ? money("USD", r4.usd, 2) : "—");

  if (!primary.cop && invEur && targetVesEurOnly && r4) {
    const baseUsdt = r4.cop / usdtCopBuy;
    const feeUsdt = feeType === "pct" ? (baseUsdt * feePct) : feeFixed;
    const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
    const methodLabel = usdViaEur ? "EUR BCV" : (usdtVesSell ? "Binance manual" : "—");
    const copPerVes = r4.cop / targetVesEurOnly;
    primary.cop = r4.cop;
    primary.vesUsed = targetVesEurOnly;
    primary.methodLabel = methodLabel;
    primary.copPerVes = copPerVes;
    primary.baseUsdt = baseUsdt;
    primary.feeUsdt = feeUsdt;
    primary.netUsdt = netUsdt;
    primary.feeCop = feeUsdt * usdtCopBuy;
    candidates.invEur = { cop: primary.cop, vesUsed: primary.vesUsed, methodLabel: primary.methodLabel, copPerVes: primary.copPerVes, baseUsdt: primary.baseUsdt, feeUsdt: primary.feeUsdt, netUsdt: primary.netUsdt, feeCop: primary.feeCop };
  }

  // En modo "Por objetivo", si el usuario tocó una fila específica, esa manda.
  if (state.quoteMode === "goal") {
    const last = state.invLast;
    if (last && candidates[last] && candidates[last].cop) return candidates[last];
  }

  return primary;
}

function renderPoster(activeQuote) {
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

  // Tasa grande en el flyer (SÍ se exporta)
  const rateSource = (activeQuote && activeQuote.copPerVes) ? activeQuote : null;
  if (rateSource && rateSource.copPerVes) {
    setText("posterRateValue", `COP ${fmt(rateSource.copPerVes, 6)}`);
    setText("posterRateNote", `COP por 1 VES (${rateSource.methodLabel || methodLabel})`);
  } else {
    setText("posterRateValue", "—");
    setText("posterRateNote", "Completa USDT/COP + tasas" );
  }

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

  // Nota: para evitar CORS y tener una sola fuente, primero intentamos un endpoint propio
  // (Cloudflare Pages Functions). Si no existe (por ejemplo en Vite dev), caemos a fetch directo.
  const copNow = parseNum($("inCop")?.value);
  const ratesPath = Number.isFinite(copNow) && copNow > 0
    ? `/api/rates?cop=${encodeURIComponent(String(copNow))}`
    : "/api/rates";
  const ratesUrl = `${API_BASE}${ratesPath}`;
  const serverRates = await safeJson(ratesUrl);
  if (serverRates && serverRates.ok) {
    // Valores base
    // IDs del UI (definidos en createUI): usdVesOf (BCV) y usdVesPar (Paralelo)
    if (Number.isFinite(serverRates.usdVesBcv)) setValue("usdVesOf", serverRates.usdVesBcv);
    if (Number.isFinite(serverRates.usdVesParallel)) setValue("usdVesPar", serverRates.usdVesParallel);
    if (Number.isFinite(serverRates.eurVesBcv)) setValue("eurVes", serverRates.eurVesBcv);
    if (Number.isFinite(serverRates.eurUsd)) setValue("eurUsd", serverRates.eurUsd);
    // “Tasas del día” para P2P
    // - Preferimos lo que venga directo de Binance (usdtCopBuy/usdtVesSell)
    // - Si no viene, caemos a aproximaciones (usdCop y usdVesParallel)
    const usdtCop = serverRates.usdtCopBuy ?? serverRates.usdCop ?? null;
    const usdtVes = serverRates.usdtVesSell ?? serverRates.usdVesP2P ?? serverRates.usdVesParallel ?? null;
    if (Number.isFinite(usdtCop)) setValue("usdtCopBuy", usdtCop);
    if (Number.isFinite(usdtVes)) setValue("usdtVesSell", usdtVes);

    // Marca de fuente para el resumen
    state.lastRateMeta = {
      ok: true,
      sources: serverRates.sources || "API",
      ts: serverRates.ts || new Date().toISOString(),
    };

    status.textContent = "Listo";
    paint();
    return;
  }

  // DolarApi VE (USD oficial / paralelo)
  const usdOf = await safeJson("https://ve.dolarapi.com/v1/dolares/oficial");
  const usdPar = await safeJson("https://ve.dolarapi.com/v1/dolares/paralelo");

  // FX (gratis, sin key)
  const fx = await safeJson("https://open.er-api.com/v6/latest/EUR"); // EURUSD
  const usdFx = await safeJson("https://open.er-api.com/v6/latest/USD"); // USDCOP

  // BCV (EUR/VES) via tu Worker
  const bcv = await safeJson("https://remesas-proxy.agjeronimo14.workers.dev/bcv");

  const ofVal = usdOf?.promedio ?? usdOf?.venta ?? usdOf?.compra ?? null;
  const parVal = usdPar?.promedio ?? usdPar?.venta ?? usdPar?.compra ?? null;

  // BCV array: buscamos EUR
  const eurItem = Array.isArray(bcv) ? bcv.find(x => (x?.symbol || "").toUpperCase() === "EUR") : null;
  const eurVes = eurItem?.rate ?? eurItem?.value ?? eurItem?.price ?? null;

  const eurUsd = fx?.rates?.USD ?? null;
  const usdCop = usdFx?.rates?.COP ?? null;

  if (ofVal) state.usdVesOficial = Number(ofVal);
  if (parVal) state.usdVesParalelo = Number(parVal);
  if (eurUsd) state.eurUsd = Number(eurUsd);
  if (eurVes) state.eurVesBCV = Number(eurVes);
  if (usdCop) state.usdCop = Number(usdCop);

  state.updatedAt = new Date();

  // pinta en inputs (pero quedan editables)
  setInput("usdVesOf", state.usdVesOficial, 4);
  const ok = [];

  setInput("usdVesOfi", state.usdVesOficial, 4);
  setInput("usdVesPar", state.usdVesParalelo, 4);
  setInput("eurUsd", state.eurUsd, 6);
  setInput("eurVes", state.eurVesBCV, 4);

  // “tasas del día” aproximadas para campos manuales (USDT ~ 1 USD)
  if (Number.isFinite(state.usdCop) && state.usdCop > 0) {
    setInput("usdtCopBuy", state.usdCop, 2);
    ok.push("USDT/COP (aprox)");
  }
  if (Number.isFinite(state.usdVesParalelo) && state.usdVesParalelo > 0) {
    setInput("usdtVesSell", state.usdVesParalelo, 2);
    ok.push("USDT/VES (aprox)");
  }
  if (state.usdVesOficial) ok.push("USD/BCV");
  if (state.usdVesParalelo) ok.push("USD Paralelo");
  if (state.eurUsd) ok.push("EURUSD");
  if (state.eurVesBCV) ok.push("EUR/BCV");
  ok.push("P2P: auto (si responde)");

  status.textContent = `OK: ${ok.join(" · ")} · ${state.updatedAt.toLocaleString()}`;

  // recalcula todo
  readRatesFromInputs();
  const main = calcMain({ paint: state.quoteMode === "cop" });
  const primaryInv = calcInverse();
  const active = getActiveQuote(main, primaryInv);

  // En modo objetivo: copiamos el COP calculado a la casilla principal (solo lectura)
  if (state.quoteMode === "goal") {
    setInput("inCop", active?.cop ?? null, 0);
    if (active) {
      setSummary({
        cop: active.cop,
        baseUsdt: active.baseUsdt,
        feeUsdt: active.feeUsdt,
        netUsdt: active.netUsdt,
        feeCop: active.feeCop,
        vesUsed: active.vesUsed,
        methodLabel: active.methodLabel,
        copPerVes: active.copPerVes,
        waPrefix: "CazeExchange — Cotización remesa (objetivo)",
      });
    } else {
      setSummaryBlank("Escribe un objetivo en la tabla inversa");
    }
  }

  const badge = $("quoteSourceBadge");
  if (badge) {
    badge.textContent = state.quoteMode === "goal"
      ? `Fuente: Objetivo (${INV_LABELS[state.invLast] || "tabla inversa"})`
      : "Fuente: COP (monto entregado)";
  }

  renderPoster(active);
}

function recalcAll() {
  readRatesFromInputs();

  const main = calcMain({ paint: state.quoteMode === "cop" });
  const primaryInv = calcInverse();
  const active = getActiveQuote(main, primaryInv);

  const badge = $("quoteSourceBadge");
  if (badge) {
    badge.textContent = state.quoteMode === "goal"
      ? `Fuente: Objetivo (${INV_LABELS[state.invLast] || "tabla inversa"})`
      : "Fuente: COP (monto entregado)";
  }

  if (state.quoteMode === "goal") {
    setInput("inCop", active?.cop ?? null, 0);

    if (active) {
      setSummary({
        cop: active.cop,
        baseUsdt: active.baseUsdt,
        feeUsdt: active.feeUsdt,
        netUsdt: active.netUsdt,
        feeCop: active.feeCop,
        vesUsed: active.vesUsed,
        methodLabel: active.methodLabel,
        copPerVes: active.copPerVes,
        waPrefix: "CazeExchange — Cotización remesa (objetivo)",
      });
    } else {
      setSummaryBlank("Escribe un objetivo en la tabla inversa");
    }
  }

  renderPoster(active);
}

// ---------- events ----------
// En algunos entornos (o si alguien cambia el HTML) estos botones pueden no existir.
// Evitamos que la app se caiga por un null.addEventListener().
$("btnUpdate")?.addEventListener("click", updateRates);
$("btnExport")?.addEventListener("click", exportPoster);

// Modo pro (COP vs Objetivo)
$("modeCop")?.addEventListener("click", () => setQuoteMode("cop"));
$("modeGoal")?.addEventListener("click", () => setQuoteMode("goal"));

[
  "inCop","feeType","feePct","feeFixed",
  "usdVesOf","usdVesPar","eurVes","eurUsd",
  "usdtCopBuy","usdtVesSell",
  "invVes","invUsdBcv","invUsdPar","invUsdEur","invEur"
].forEach(id => {
  const n = $(id);
  if (!n) return;
  if (id.startsWith("inv")) {
    n.addEventListener("focus", () => setInvLast(id));
    n.addEventListener("input", () => setInvLast(id));
  }
  n.addEventListener("input", recalcAll);
  n.addEventListener("change", recalcAll);
});

// auto al abrir
applyQuoteModeUI();
updateRates();
