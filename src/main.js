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

// Fetch helper (same-origin by default)
async function apiFetch(path, opts = {}) {
  const url = `${path.startsWith("http") ? "" : ""}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    credentials: "include",
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function setUserBadge() {
  const el = $("userBadge");
  if (!el) return;
  if (!state.user) {
    el.textContent = "Modo: demo (sin login)";
    applyRoleGates();
    return;
  }
  const exp = state.user.expires_at ? ` · expira ${state.user.expires_at}` : "";
  el.textContent = `${state.user.email} · ${state.user.role}/${state.user.plan}${exp}`;
  applyRoleGates();
}

function isLimitedUser() {
  if (state.demo || !state.user) return true;
  return ["trial", "viewer"].includes(state.user.role);
}

function applyRoleGates() {
  const limited = isLimitedUser();
  if ($("btnExport")) $("btnExport").disabled = limited;
  const msg = limited ? "Funciones limitadas (demo/trial). Para Pro, pide activación por WhatsApp." : "";
  const el = $("loginMsg"); // reuse? no
  // show in status badge title
  if ($("status")) $("status").title = msg;
}


function openAuthModal(msg = "") {
  const m = $("authModal");
  if (!m) return;
  m.classList.remove("hidden");
  m.setAttribute("aria-hidden", "false");
  if ($("loginMsg")) $("loginMsg").textContent = msg;
}

function closeAuthModal() {
  const m = $("authModal");
  if (!m) return;
  m.classList.add("hidden");
  m.setAttribute("aria-hidden", "true");
  if ($("loginMsg")) $("loginMsg").textContent = "";
}

// Tabs
function setActiveTab(tab) {
  document.querySelectorAll(".tabBtn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  const panes = document.querySelectorAll("[data-tabs]");
  panes.forEach((p) => {
    const list = String(p.dataset.tabs || "").split(/\s+/).filter(Boolean);
    p.style.display = list.includes(tab) ? "" : "none";
  });

  // Columns: hide if empty
  ["colLeft", "colRight"].forEach((id) => {
    const col = $(id);
    if (!col) return;
    const visible = [...col.querySelectorAll("[data-tabs]")].some((p) => p.style.display !== "none");
    col.style.display = visible ? "" : "none";
  });
}




// -------- Phase 2 UI/UX: split panes into separate cards + mobile bottom tabs --------
function applyPhase2Layout() {
  // idempotente
  if (document.getElementById('bottomTabs')) return;

  // 1) Mobile bottom tabs
  const container = document.querySelector('.container');
  if (container) {
    const nav = document.createElement('nav');
    nav.id = 'bottomTabs';
    nav.className = 'tabsBottom no-export';
    nav.setAttribute('aria-label', 'Navegación móvil');
    nav.innerHTML = `
      <button class="tabBtn" data-tab="quote" type="button">Cotizar</button>
      <button class="tabBtn" data-tab="rates" type="button">Tasas</button>
      <button class="tabBtn" data-tab="summary" type="button">Resumen</button>
      <button class="tabBtn" data-tab="whatsapp" type="button">WhatsApp</button>
      <button class="tabBtn" data-tab="admin" id="tabAdminMobile" type="button" style="display:none">Admin</button>
    `;
    container.appendChild(nav);
  }

  // 2) Split each column (which used to be ONE big .card) into a stack of cards
  function splitColumn(id) {
    const root = document.getElementById(id);
    if (!root) return;

    // only split if current element is a single card wrapper
    if (!root.classList.contains('card')) return;

    const col = document.createElement('div');
    col.id = id;
    col.className = 'colStack';

    const panes = Array.from(root.querySelectorAll('.pane'));
    for (const pane of panes) {
      const tabs = pane.dataset.tabs || '';
      const wrapper = document.createElement('section');
      wrapper.className = 'card';
      wrapper.dataset.tabs = tabs;

      // carry classes like adminOnly
      if (pane.classList.contains('adminOnly')) wrapper.classList.add('adminOnly');

      // move children (avoid nested [data-tabs])
      const children = Array.from(pane.childNodes);
      for (const ch of children) wrapper.appendChild(ch);
      pane.remove();

      col.appendChild(wrapper);
    }

    root.replaceWith(col);
  }

  splitColumn('colLeft');
  splitColumn('colRight');

  // 3) Convert certain .row blocks (form-like) into grid for cleaner layout
  document.querySelectorAll('.row').forEach((row) => {
    const fields = row.querySelectorAll('.field');
    if (fields.length >= 2) row.classList.add('formRow');
  });

  // 4) Add WhatsApp quick actions if not present
  const wa = document.getElementById('wa');
  if (wa && !document.getElementById('btnCopyWA')) {
    const bar = document.createElement('div');
    bar.className = 'waActions no-export';
    bar.innerHTML = `
      <button id="btnCopyWA" class="btn" type="button">Copiar</button>
      <button id="btnOpenWA" class="btn primary" type="button">Abrir WhatsApp</button>
      <span id="waMsg" class="hint" style="margin-left:auto"></span>
    `;
    wa.insertAdjacentElement('afterend', bar);
  }
}

function wireTabButtons() {
  document.querySelectorAll('.tabBtn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });
}

function wireWhatsappActions() {
  const btnCopy = document.getElementById('btnCopyWA');
  const btnOpen = document.getElementById('btnOpenWA');
  const wa = document.getElementById('wa');
  const msg = document.getElementById('waMsg');

  if (btnCopy && wa) {
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(wa.value || '');
        if (msg) msg.textContent = 'Copiado ✅';
      } catch {
        // fallback
        wa.focus();
        wa.select();
        document.execCommand('copy');
        if (msg) msg.textContent = 'Copiado ✅';
      }
      setTimeout(() => { if (msg) msg.textContent = ''; }, 1200);
    });
  }

  if (btnOpen && wa) {
    btnOpen.addEventListener('click', () => {
      const text = encodeURIComponent(wa.value || '');
      const url = `https://wa.me/?text=${text}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }
}
function parseNum(x) {
  if (x === null || x === undefined) return 0;
  const s = String(x).trim().replaceAll(".", "").replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}

// ---------------- ajustes (%) para aproximar a Binance ----------------
const ADJ_KEY = "CAZE_RATE_ADJ";
const DEFAULT_ADJ = Object.freeze({
  // Ejemplos iniciales (puedes cambiarlos desde la UI):
  // -1.5% significa "bajar 1.5%"
  bcvPct: -1.5,        // USD/VES Oficial (BCV)
  parallelPct: -2.0,   // USD/VES Paralelo
  usdtCopPct: 1.0,     // USDT/COP (comprar USDT en CO)
  usdtVesPct: -2.5,    // USDT/VES (vender USDT en VE)
});

function loadAdj() {
  try {
    const raw = localStorage.getItem(ADJ_KEY);
    if (!raw) return { ...DEFAULT_ADJ };
    const obj = JSON.parse(raw);
    return { ...DEFAULT_ADJ, ...(obj || {}) };
  } catch {
    return { ...DEFAULT_ADJ };
  }
}

function saveAdj(adj) {
  try {
    localStorage.setItem(ADJ_KEY, JSON.stringify(adj));
  } catch {}
  scheduleSaveSettings(adj);
}

let _saveSettingsTimer = null;
function scheduleSaveSettings(adj) {
  if (state.demo || !state.user) return;
  if (_saveSettingsTimer) clearTimeout(_saveSettingsTimer);
  _saveSettingsTimer = setTimeout(async () => {
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          adj_bcv: adj.bcvPct,
          adj_parallel: adj.parallelPct,
          adj_usdt_cop: adj.usdtCopPct,
          adj_usdt_ves: adj.usdtVesPct,
        }),
      });
    } catch (e) {
      console.warn("No se pudo guardar settings en server:", e?.message || e);
      // seguimos en localStorage para no romper UX
    }
  }, 500);
}


function applyPct(value, pct) {
  if (!Number.isFinite(value)) return value;
  const p = Number.isFinite(pct) ? pct : 0;
  return value * (1 + p / 100);
}

function fmtPct(p) {
  // Para mostrar porcentajes en inputs con coma
  return fmt(Number(p) || 0, 2);
}

function readAdjFromUI() {
  // Acepta "1,5" o "1.5"
  const bcvPct = parseNum($("adjBcv")?.value);
  const parallelPct = parseNum($("adjPar")?.value);
  const usdtCopPct = parseNum($("adjUsdtCop")?.value);
  const usdtVesPct = parseNum($("adjUsdtVes")?.value);
  return { bcvPct, parallelPct, usdtCopPct, usdtVesPct };
}

function hydrateAdjUI() {
  const a = state.adj || { ...DEFAULT_ADJ };
  if ($("adjBcv")) $("adjBcv").value = fmtPct(a.bcvPct);
  if ($("adjPar")) $("adjPar").value = fmtPct(a.parallelPct);
  if ($("adjUsdtCop")) $("adjUsdtCop").value = fmtPct(a.usdtCopPct);
  if ($("adjUsdtVes")) $("adjUsdtVes").value = fmtPct(a.usdtVesPct);
}

function applyServerSettingsToState(settings) {
  if (!settings) return;
  // map DB fields -> local adj fields
  state.adj = {
    ...state.adj,
    bcvPct: Number(settings.adj_bcv ?? 0),
    parallelPct: Number(settings.adj_parallel ?? 0),
    usdtCopPct: Number(settings.adj_usdt_cop ?? 0),
    usdtVesPct: Number(settings.adj_usdt_ves ?? 0),
  };
  hydrateAdjUI();
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
  // Importante: usamos coma decimal (es-ES). Si metemos un "." como decimal,
  // nuestro parseNum lo interpreta como separador de miles y rompe el cálculo.
  // Por eso, por defecto formateamos con coma y limitamos decimales.
  const n = Number(value);
  const defaultDecimalsById = {
    usdVesBCV: 2,
    usdVesParallel: 2,
    eurVes: 2,
    eurUsd: 6,
    usdtCopBuy: 2,
    usdtVesSell: 2,
  };
  const autoD = d === null ? (defaultDecimalsById[id] ?? (Math.abs(n) < 10 ? 6 : 2)) : d;
  node.value = fmt(n, autoD);
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
  user: null,
  demo: true,
  adj: loadAdj(),
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
          <span id="ratesBadge" class="badge mono">Tasas: —</span>
        </div>
        <small id="userBadge" class="badge">Modo: demo (sin login)</small>
      </div>
      <div class="actions">
        <button id="btnUpdate" class="btn primary">Actualizar tasas</button>
        <button id="btnExport" class="btn">Exportar imagen</button>
        <button id="btnLogout" class="btn" style="display:none">Salir</button>
        <span id="status" class="badge mono">Listo</span>
      </div>
    </div>

    <div class="tabsTop" role="tablist" aria-label="Navegación">
      <button class="tabBtn active" data-tab="quote" id="tabQuote" type="button">Cotizar</button>
      <button class="tabBtn" data-tab="rates" id="tabRates" type="button">Tasas</button>
      <button class="tabBtn" data-tab="summary" id="tabSummary" type="button">Resumen</button>
      <button class="tabBtn" data-tab="whatsapp" id="tabWhatsApp" type="button">WhatsApp</button>
      <button class="tabBtn" data-tab="admin" id="tabAdmin" type="button" style="display:none">Admin</button>
    </div>

    <div class="grid">
      <!-- LEFT -->
      <div id="colLeft" class="card">
        <section class="pane" data-tabs="quote">
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

        
        </section>

        <section class="pane" data-tabs="rates">
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


        
        </section>

        <section class="pane" data-tabs="rates">
          <h2>Ajustes de tasa (editable)</h2>
        <p class="hint">Estos % se aplican <b>encima</b> de las tasas automáticas para acercarlas a tu referencia. Se guardan en este navegador.</p>

        <div class="row">
          <div class="field">
            <label>USD/VES (Oficial / BCV) ajuste %</label>
            <input id="adjBcv" inputmode="decimal" placeholder="-1,50" />
          </div>
          <div class="field">
            <label>USD/VES (Paralelo) ajuste %</label>
            <input id="adjPar" inputmode="decimal" placeholder="-2,00" />
          </div>
        </div>

        <div class="row">
          <div class="field">
            <label>USDT/COP (Comprar USDT en CO) ajuste %</label>
            <input id="adjUsdtCop" inputmode="decimal" placeholder="1,00" />
          </div>
          <div class="field">
            <label>USDT/VES (Vender USDT en VE) ajuste %</label>
            <input id="adjUsdtVes" inputmode="decimal" placeholder="-2,50" />
          </div>
        </div>

        <div class="row" style="justify-content:flex-end;">
          <button id="btnAdjReset" class="btn secondary" type="button">Restablecer ajustes</button>
        </div>

        <hr/>

        
        </section>

        <section class="pane" data-tabs="quote">
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

      
        </section>

        <section class="pane adminOnly" data-tabs="admin">
          <h2>Administración (SaaS)</h2>
          <p class="hint">Crea usuarios manualmente para cobrar por WhatsApp. También puedes resetear claves y activar/desactivar.</p>

          <div class="row">
            <div class="field">
              <label>Email</label>
              <input id="adminEmail" inputmode="email" placeholder="cliente@email.com" />
            </div>
            <div class="field">
              <label>Rol</label>
              <select id="adminRole">
                <option value="trial">trial</option>
                <option value="viewer">viewer</option>
                <option value="pro">pro</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>Plan</label>
              <select id="adminPlan">
                <option value="trial">trial</option>
                <option value="pro">pro</option>
              </select>
            </div>
            <div class="field">
  <label>Expira en (seleccionable)</label>
  <div class="row" style="gap:8px; align-items:end">
    <input id="adminExpireQty" type="number" min="0" placeholder="30" style="max-width:110px" />
    <select id="adminExpireUnit">
      <option value="hours">horas</option>
      <option value="days" selected>días</option>
      <option value="months">meses</option>
      <option value="years">años</option>
    </select>
    <button id="btnAdminExpireApply" class="btn xs" type="button">Aplicar</button>
    <button id="btnAdminExpireClear" class="btn xs" type="button">Sin expirar</button>
  </div>
  <div class="hint">Esto llena el campo ISO automáticamente (desde “ahora”).</div>
</div>

<div class="field">
  <label>Expira (ISO)</label>
  <input id="adminExpires" placeholder="2026-02-01T00:00:00Z" />
</div>

          </div>

          <div class="row">
            <div class="field">
              <label>Contraseña (vacío = generar)</label>
              <input id="adminPassword" placeholder="mín 6" />
            </div>
            <div class="field">
              <label>Activo</label>
              <select id="adminActive">
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </div>
          </div>

          <div class="row">
            <button id="btnAdminCreate" class="btn primary" type="button">Crear usuario</button>
            <button id="btnAdminReload" class="btn" type="button">Refrescar lista</button>
          </div>

          <div id="adminResult" class="hint" style="margin-top:10px"></div>

          <hr/>

          <h2 style="margin:0">Usuarios</h2>
          <div class="hint" style="margin:6px 0 10px">Tip: para resetear, usa el botón en la fila.</div>
          <div style="overflow:auto">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th><th>Email</th><th>Role</th><th>Plan</th><th>Expira</th><th>Activo</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody id="adminUsersTbody"></tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- RIGHT -->
      <div id="colRight" class="card">
        <section class="pane" data-tabs="summary">
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

        
        </section>

        <section class="pane" data-tabs="whatsapp">
          <h2>Mensaje WhatsApp (copiar/pegar)</h2>
        <textarea id="wa" readonly></textarea>

        <hr/>

        
        </section>

        <section class="pane" data-tabs="summary">
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
        </section>
      </div>
    </div>
  </div>

  <!-- Auth Modal -->
  <div id="authModal" class="modal hidden" aria-hidden="true">
    <div class="modalCard">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <h2 style="margin:0">Iniciar sesión</h2>
        <span class="badge mono">CazeExchange</span>
      </div>
      <p class="hint">Si no tienes usuario aún, puedes usar el modo demo. Para Pro, te activan por WhatsApp.</p>

      <div class="field">
        <label>Email</label>
        <input id="loginEmail" inputmode="email" placeholder="tu@email.com" />
      </div>
      <div class="field">
        <label>Contraseña</label>
        <input id="loginPassword" type="password" placeholder="••••••••" />
      </div>

      <div class="row">
        <button id="btnLogin" class="btn primary" type="button">Entrar</button>
        <button id="btnDemo" class="btn" type="button">Usar demo</button>
      </div>

      <div id="loginMsg" class="hint" style="margin-top:10px"></div>
    </div>
  </div>
`;


// ---------- auth + tabs init ----------
applyPhase2Layout();
setActiveTab("quote");
wireTabButtons();
wireWhatsappActions();

// demo & login
$("btnDemo")?.addEventListener("click", () => {
  state.demo = true;
  state.user = null;
  setUserBadge();
  $("btnLogout").style.display = "none";
  closeAuthModal();
  // demo: keep local adjustments
  hydrateAdjUI();
  updateAll();
});

$("btnLogin")?.addEventListener("click", async () => {
  const email = $("loginEmail")?.value?.trim();
  const password = $("loginPassword")?.value || "";
  $("loginMsg").textContent = "Entrando...";
  try {
    await apiFetch("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
    const me = await apiFetch("/api/me", { method: "GET" });
    state.user = me.user;
    state.demo = false;
    applyServerSettingsToState(me.settings);
    setUserBadge();
    $("btnLogout").style.display = "";
    // admin tab visibility
    const isAdmin = state.user?.role === "admin";
    $("tabAdmin").style.display = isAdmin ? "" : "none";
    if ($("tabAdminMobile")) $("tabAdminMobile").style.display = isAdmin ? "" : "none";
    if (isAdmin) loadAdminUsers().catch(() => {});
    closeAuthModal();
    updateAll();
  } catch (e) {
    $("loginMsg").textContent = `Error: ${e.message || e}`;
  }
});

$("btnLogout")?.addEventListener("click", async () => {
  try { await apiFetch("/api/logout", { method: "POST" }); } catch {}
  state.user = null;
  state.demo = true;
  setUserBadge();
  $("btnLogout").style.display = "none";
  $("tabAdmin").style.display = "none";
  if ($("tabAdminMobile")) $("tabAdminMobile").style.display = "none";
  openAuthModal("Sesión cerrada.");
  updateAll();
});

async function bootstrapAuth() {
  try {
    const me = await apiFetch("/api/me", { method: "GET" });
    state.user = me.user;
    state.demo = false;
    applyServerSettingsToState(me.settings);
    $("btnLogout").style.display = "";
    $("tabAdmin").style.display = state.user?.role === "admin" ? "" : "none";
    if ($("tabAdminMobile")) $("tabAdminMobile").style.display = state.user?.role === "admin" ? "" : "none";
    setUserBadge();
    closeAuthModal();
  } catch {
    // no session: start in demo + show modal
    state.user = null;
    state.demo = true;
    setUserBadge();
    openAuthModal("");
  }
}



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
// Tasa grande en el flyer (SÍ se exporta)
  const rateSource = (activeQuote && activeQuote.copPerVes) ? activeQuote : null;
  if (rateSource && rateSource.copPerVes) {
    setText("posterRateValue", `COP ${fmt(rateSource.copPerVes, 6)}`);
    setText("posterRateNote", "COP por 1 VES");
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
  const rb0 = $("ratesBadge");
  if (rb0) { rb0.textContent = "Tasas: …"; rb0.classList.remove("ok","warn"); }

  // Nota: para evitar CORS y tener una sola fuente, primero intentamos un endpoint propio
  // (Cloudflare Pages Functions). Si no existe (por ejemplo en Vite dev), caemos a fetch directo.
  const copNow = parseNum($("inCop")?.value);
  const ratesPath = Number.isFinite(copNow) && copNow > 0
    ? `/api/rates?cop=${encodeURIComponent(String(copNow))}`
    : "/api/rates";
  const ratesUrl = `${API_BASE}${ratesPath}`;
  const serverRates = await safeJson(ratesUrl);
  if (serverRates && serverRates.ok) {
    const adj = state.adj || { ...DEFAULT_ADJ };
    // Valores base
    // IDs del UI (definidos en createUI): usdVesOf (BCV) y usdVesPar (Paralelo)
    if (Number.isFinite(serverRates.usdVesBcv)) setValue("usdVesOf", applyPct(serverRates.usdVesBcv, adj.bcvPct), 2);
    if (Number.isFinite(serverRates.usdVesParallel)) setValue("usdVesPar", applyPct(serverRates.usdVesParallel, adj.parallelPct), 2);
    if (Number.isFinite(serverRates.eurVesBcv)) setValue("eurVes", serverRates.eurVesBcv);
    if (Number.isFinite(serverRates.eurUsd)) setValue("eurUsd", serverRates.eurUsd, 6);
    // “Tasas del día” para P2P
    // - Preferimos lo que venga directo de Binance (usdtCopBuy/usdtVesSell)
    // - Si no viene, caemos a aproximaciones (usdCop y usdVesParallel)
    const usdtCop = applyPct((serverRates.usdtCopBuy ?? serverRates.usdCop ?? null), adj.usdtCopPct);
    const usdtVes = applyPct((serverRates.usdtVesSell ?? serverRates.usdVesP2P ?? serverRates.usdVesParallel ?? null), adj.usdtVesPct);
    if (Number.isFinite(usdtCop)) setValue("usdtCopBuy", usdtCop);
    if (Number.isFinite(usdtVes)) setValue("usdtVesSell", usdtVes);

    // Marca de fuente para el resumen
    state.lastRateMeta = {
      ok: true,
      sources: serverRates.sources || "API",
      ts: serverRates.ts || new Date().toISOString(),
    };

    // UI badge: OK vs fallback
    const rb = $("ratesBadge");
    if (rb) {
      const st = serverRates.status || (serverRates.warnings && serverRates.warnings.length ? "fallback" : "ok");
      rb.textContent = st === "ok" ? "Tasas: OK" : "Tasas: fallback";
      rb.classList.toggle("ok", st === "ok");
      rb.classList.toggle("warn", st !== "ok");
      if (serverRates.missing && serverRates.missing.length) {
        rb.title = `Faltan: ${serverRates.missing.join(", ")}`;
      } else {
        rb.title = String(serverRates.sources || "");
      }
    }

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

  status.textContent = `OK: ${ok.join(" · ")} · ${state.updatedAt.toLocaleString()} · Ajustes: BCV ${fmt(adj.bcvPct,2)}% | Par ${fmt(adj.parallelPct,2)}% | USDT/COP ${fmt(adj.usdtCopPct,2)}% | USDT/VES ${fmt(adj.usdtVesPct,2)}%`;

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


// ---------- admin UI ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
}

async function loadAdminUsers() {
  if (state.user?.role !== "admin") return;
  const data = await apiFetch("/api/admin/users", { method: "GET" });
  const tbody = $("adminUsersTbody");
  if (!tbody) return;
  const users = data.users || [];
  tbody.innerHTML = users
    .map((u) => {
      const exp = u.expires_at || "";
      const active = Number(u.is_active) === 1;
      return `<tr>
        <td class="mono">${u.id}</td>
        <td>${escapeHtml(u.email)}</td>
        <td class="mono">${escapeHtml(u.role)}</td>
        <td class="mono">${escapeHtml(u.plan)}</td>
        <td class="mono">${escapeHtml(exp)}</td>
        <td class="mono">${active ? "1" : "0"}</td>
        <td>
          <button class="btn xs" data-action="reset" data-id="${u.id}">Reset</button>
          <button class="btn xs" data-action="toggle" data-id="${u.id}" data-active="${active ? "1":"0"}">${active ? "Desactivar":"Activar"}</button>
          <button class="btn xs" data-action="delete" data-id="${u.id}">Eliminar</button>
        </td>

      </tr>`;
    })
    .join("");

  // row actions
  tbody.querySelectorAll("button[data-action]").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = Number(b.dataset.id);
      const action = b.dataset.action;
      if (!id) return;
      if (action === "reset") {
        if (!confirm(`Resetear contraseña del usuario ${id}?`)) return;
        try {
          const r = await apiFetch("/api/admin/reset-password", {
            method: "POST",
            body: JSON.stringify({ user_id: id }),
          });
          $("adminResult").textContent = `Temp password (envíala por WhatsApp): ${r.temp_password}`;
        } catch (e) {
          $("adminResult").textContent = `Error: ${e.message || e}`;
        }
      }
      if (action === "toggle") {
        const current = b.dataset.active === "1";
        try {
          await apiFetch("/api/admin/update-user", {
            method: "POST",
            body: JSON.stringify({ user_id: id, is_active: !current }),
          });
          $("adminResult").textContent = "Actualizado.";
          await loadAdminUsers();
        } catch (e) {
          $("adminResult").textContent = `Error: ${e.message || e}`;
        }
      }
      if (action === "delete") {
  if (!confirm(`ELIMINAR usuario ${id}? Esto borra settings/sesiones/historial por cascade.`)) return;
  try {
    await apiFetch("/api/admin/delete-user", {
      method: "POST",
      body: JSON.stringify({ user_id: id }),
    });
    $("adminResult").textContent = "Usuario eliminado.";
    await loadAdminUsers();
  } catch (e) {
    $("adminResult").textContent = `Error: ${e.message || e}`;
  }
}

    });
    
  });
}

function addToNow(qty, unit) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date();

  if (unit === "hours") d.setHours(d.getHours() + n);
  if (unit === "days") d.setDate(d.getDate() + n);
  if (unit === "months") d.setMonth(d.getMonth() + n);
  if (unit === "years") d.setFullYear(d.getFullYear() + n);

  return d.toISOString();
}

$("btnAdminExpireApply")?.addEventListener("click", () => {
  const qty = $("adminExpireQty")?.value;
  const unit = $("adminExpireUnit")?.value || "days";
  const iso = addToNow(qty, unit);
  $("adminExpires").value = iso;
});

$("btnAdminExpireClear")?.addEventListener("click", () => {
  if ($("adminExpireQty")) $("adminExpireQty").value = "";
  $("adminExpires").value = "";
});


async function adminCreateUser() {
  const email = $("adminEmail")?.value?.trim();
  const role = $("adminRole")?.value;
  const plan = $("adminPlan")?.value;
  const expires_at = $("adminExpires")?.value?.trim() || null;
  const password = $("adminPassword")?.value || "";
  const is_active = $("adminActive")?.value === "1";

  $("adminResult").textContent = "Creando...";
  try {
    const r = await apiFetch("/api/admin/create-user", {
      method: "POST",
      body: JSON.stringify({ email, role, plan, expires_at, password: password || undefined, is_active }),
    });
    const temp = r.temp_password ? ` Temp password: ${r.temp_password}` : "";
    $("adminResult").textContent = `OK: ${r.user.email}.${temp}`;
    $("adminEmail").value = "";
    $("adminPassword").value = "";
    await loadAdminUsers();
  } catch (e) {
    $("adminResult").textContent = `Error: ${e.message || e}`;
  }
}
$("btnUpdate")?.addEventListener("click", updateRates);
$("btnExport")?.addEventListener("click", exportPoster);
$("btnAdminCreate")?.addEventListener("click", adminCreateUser);
$("btnAdminReload")?.addEventListener("click", loadAdminUsers);

// ajustes (%)
["adjBcv","adjPar","adjUsdtCop","adjUsdtVes"].forEach((id) => {
  const el = $(id);
  if (!el) return;
  el.addEventListener("input", () => {
    state.adj = readAdjFromUI();
    saveAdj(state.adj);
  });
  el.addEventListener("change", () => {
    state.adj = readAdjFromUI();
    saveAdj(state.adj);
    updateRates();
  });
});

$("btnAdjReset")?.addEventListener("click", () => {
  state.adj = { ...DEFAULT_ADJ };
  saveAdj(state.adj);
  hydrateAdjUI();
  updateRates();
});




// Modo pro (COP vs Objetivo)
$("modeCop")?.addEventListener("click", () => setQuoteMode("cop"));
$("modeGoal")?.addEventListener("click", () => setQuoteMode("goal"));

[
  "inCop","feeType","feePct","feeFixed",
  "usdVesOf","usdVesPar","eurVes","eurUsd",
  "usdtCopBuy","usdtVesSell","adjBcv","adjPar","adjUsdtCop","adjUsdtVes",
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
// Primero intentamos sesión (si existe) y luego cargamos tasas
bootstrapAuth().finally(() => {
  hydrateAdjUI();
  updateRates();
});
