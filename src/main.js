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
    if (saved) {
      const trimmed = saved.replace(/\/$/, "");
      if (trimmed.includes("cazeexchange.pages.dev") || trimmed.includes("cazeexchange.com")) {
        localStorage.removeItem("API_BASE");
        return "";
      }
      return trimmed;
    }
  } catch {}

  return "";
})();

// Fetch helper (same-origin by default)
async function apiFetch(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
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

// ---------------- Branding (por usuario) ----------------
const BRANDING_KEY = "CAZE_BRANDING";
const BRAND_THEMES = ["ocean", "emerald", "sunset", "midnight", "minimal"];
const DEFAULT_BRANDING = Object.freeze({
  theme: "ocean",
  accent: "#4ea1ff",
  brand_name: "CAZEEXCHANGE",
});

function safeLsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeLsSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function isHexColor(v) {
  const s = String(v || "").trim();
  return /^#?[0-9a-fA-F]{6}$/.test(s) || /^#?[0-9a-fA-F]{3}$/.test(s);
}

function normalizeBranding(input = {}) {
  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      parsed = {};
    }
  }
  if (!parsed || typeof parsed !== "object") {
    parsed = {};
  }

  const out = { ...DEFAULT_BRANDING };

  // theme
  const theme = String(parsed.theme || "").trim().toLowerCase();
  out.theme = BRAND_THEMES.includes(theme) ? theme : DEFAULT_BRANDING.theme;

  // accent
  let accent = String(parsed.accent || parsed.accent_color || "").trim();
  if (accent && !accent.startsWith("#")) accent = `#${accent}`;
  if (/^#[0-9a-fA-F]{3}$/.test(accent)) {
    accent = `#${accent[1]}${parsed.accent[1]}${parsed.accent[2]}${parsed.accent[2]}${parsed.accent[3]}${parsed.accent[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) accent = DEFAULT_BRANDING.accent;
  out.accent = accent.toLowerCase();

  // brand name
  let name = String(parsed.brand_name ?? parsed.brandName ?? "");
  name = name.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim();
  if (!name) name = DEFAULT_BRANDING.brand_name;
  if (name.length > 40) name = name.slice(0, 40).trim();
  out.brand_name = name;

  // Preserve accounts
  out.receive_cop = parsed.receive_cop || parsed.receiveCop || "";
  out.receive_ves = parsed.receive_ves || parsed.receiveVes || "";

  // Preserve operations!
  if (Array.isArray(parsed.operations)) {
    out.operations = parsed.operations;
  } else if (parsed.operations && typeof parsed.operations === "string") {
    try {
      out.operations = JSON.parse(parsed.operations);
    } catch {
      out.operations = [];
    }
  } else {
    out.operations = [];
  }

  return out;
}

function loadBrandingLocal() {
  const raw = safeLsGet(BRANDING_KEY);
  if (!raw) return { ...DEFAULT_BRANDING };
  try {
    const obj = JSON.parse(raw);
    return normalizeBranding(obj);
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

function saveBrandingLocal(branding) {
  const b = normalizeBranding(branding);
  safeLsSet(BRANDING_KEY, JSON.stringify(b));
}

function hexToRgbTriplet(hex) {
  const h = String(hex || "").trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function getBranding() {
  return state?.branding ? normalizeBranding(state.branding) : { ...DEFAULT_BRANDING };
}

function getBrandName() {
  return getBranding().brand_name || DEFAULT_BRANDING.brand_name;
}

function brandSlug() {
  const name = getBrandName();
  const s = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return s || "cazeexchange";
}

function applyBrandingToUI(branding = getBranding()) {
  const b = normalizeBranding(branding);
  document.documentElement.dataset.theme = b.theme;
  document.documentElement.style.setProperty("--accent", b.accent);
  const triplet = hexToRgbTriplet(b.accent);
  if (triplet) document.documentElement.style.setProperty("--accent-rgb", triplet);

  const bb = document.getElementById("brandBadge");
  if (bb) bb.textContent = b.brand_name;

  const ab = document.getElementById("authBrandBadge");
  if (ab) ab.textContent = b.brand_name;

  const pb = document.getElementById("posterBrand");
  if (pb) pb.textContent = b.brand_name;
}

function hydrateBrandingUI() {
  const b = getBranding();
  const nameEl = document.getElementById("brandName");
  const themeEl = document.getElementById("brandTheme");
  const accentEl = document.getElementById("brandAccent");
  const pickEl = document.getElementById("brandAccentPicker");
  const receiveCopEl = document.getElementById("brandReceiveCop");
  const receiveVesEl = document.getElementById("brandReceiveVes");

  if (nameEl) nameEl.value = b.brand_name || "";
  if (themeEl) themeEl.value = b.theme || "ocean";
  if (accentEl) accentEl.value = b.accent || "";
  if (pickEl) pickEl.value = b.accent || "";
  if (receiveCopEl) receiveCopEl.value = b.receive_cop || "";
  if (receiveVesEl) receiveVesEl.value = b.receive_ves || "";

  const saveBtn = document.getElementById("btnBrandSave");
  if (saveBtn) saveBtn.disabled = !state.user;

  const msgEl = document.getElementById("brandMsg");
  if (msgEl) {
    msgEl.textContent = !state.user
      ? "Inicia sesión para poder guardar las configuraciones de marca."
      : "";
  }
}

function readBrandingFromUI() {
  const current = getBranding();
  return normalizeBranding({
    brand_name: document.getElementById("brandName")?.value,
    theme: document.getElementById("brandTheme")?.value,
    accent: document.getElementById("brandAccent")?.value,
    receive_cop: document.getElementById("brandReceiveCop")?.value,
    receive_ves: document.getElementById("brandReceiveVes")?.value,
    operations: current.operations
  });
}

async function saveBrandingToServer() {
  const msgEl = document.getElementById("brandMsg");

  if (!state.user) {
    if (msgEl) msgEl.textContent = "Inicia sesión para guardar tu marca.";
    openAuthModal("Inicia sesión para guardar tu marca");
    return;
  }

  const branding = readBrandingFromUI();
  if (msgEl) msgEl.textContent = "Guardando…";

  try {
    await apiFetch("/api/branding", {
      method: "POST",
      body: JSON.stringify(branding),
    });

    state.branding = branding;
    saveBrandingLocal(branding);
    applyBrandingToUI(branding);
    if (msgEl) msgEl.textContent = "Guardado ✅";
  } catch (e) {
    if (msgEl) msgEl.textContent = `Error: ${e?.message || "No se pudo guardar"}`;
  } finally {
    setTimeout(() => {
      if (msgEl && msgEl.textContent === "Guardado ✅") msgEl.textContent = "";
    }, 1600);
  }
}

function wireBrandingUI() {
  const nameEl = document.getElementById("brandName");
  const themeEl = document.getElementById("brandTheme");
  const accentEl = document.getElementById("brandAccent");
  const pickEl = document.getElementById("brandAccentPicker");
  const saveBtn = document.getElementById("btnBrandSave");
  const resetBtn = document.getElementById("btnBrandReset");

  function preview() {
    const b = readBrandingFromUI();
    state.branding = b;
    saveBrandingLocal(b);
    applyBrandingToUI(b);
  }

  nameEl?.addEventListener("input", preview);
  themeEl?.addEventListener("change", preview);

  // hex input ↔ picker
  pickEl?.addEventListener("input", () => {
    if (accentEl) accentEl.value = pickEl.value;
    preview();
  });

  accentEl?.addEventListener("input", () => {
    if (pickEl && isHexColor(accentEl.value)) {
      let v = String(accentEl.value).trim();
      if (v && !v.startsWith("#")) v = `#${v}`;
      if (/^#[0-9a-fA-F]{3}$/.test(v)) {
        v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
      }
      if (/^#[0-9a-fA-F]{6}$/.test(v)) pickEl.value = v;
    }
    preview();
  });

  saveBtn?.addEventListener("click", saveBrandingToServer);
  resetBtn?.addEventListener("click", () => {
    const b = { ...DEFAULT_BRANDING };
    state.branding = b;
    saveBrandingLocal(b);
    hydrateBrandingUI();
    applyBrandingToUI(b);
  });
}



function setUserBadge() {
  const el = $("userBadge");
  if (!el) return;
  if (!state.user) {
    el.textContent = "Sin sesión activa";
    applyRoleGates();
    return;
  }
  const exp = state.user.expires_at ? ` · expira ${state.user.expires_at}` : "";
  el.textContent = `${state.user.email} · ${state.user.role}/${state.user.plan}${exp}`;
  applyRoleGates();
}

function isLimitedUser() {
  if (!state.user) return true;
  return ["trial", "viewer"].includes(state.user.role);
}

function applyRoleGates() {
  const limited = isLimitedUser();
  if ($("btnExportPosterLocal")) $("btnExportPosterLocal").disabled = limited;

  const canSaveBranding = !!state.user;
  if ($("btnBrandSave")) $("btnBrandSave").disabled = !canSaveBranding;

  const msg = limited ? "Funciones limitadas. Para activar tu cuenta Pro, contacta a soporte corporativo." : "";
  // show in status badge title
  if ($("status")) $("status").title = msg;

  const bmsg = $("brandMsg");
  if (bmsg) {
    if (!canSaveBranding && !bmsg.textContent) {
      bmsg.textContent = "Debes iniciar sesión para poder guardar marcas e información.";
    }
    if (canSaveBranding && bmsg.textContent.startsWith("Debes iniciar")) bmsg.textContent = "";
  }
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
      <button class="tabBtn" data-tab="quote" type="button">COP ➔ VES</button>
      <button class="tabBtn" data-tab="vesToCop" type="button">VES ➔ COP</button>
      <button class="tabBtn" data-tab="rates" type="button">Tasas/Ajustes</button>
      <button class="tabBtn" data-tab="myRecords" id="tabMyRecordsMobile" type="button" style="display:none">Mis Registros</button>
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
      <button id="btnManualRegister" class="btn success" type="button" style="background:#25d366; color:#000; font-weight:700; border:none; display:inline-flex; align-items:center; gap:4px">💾 Registrar</button>
      <span id="waMsg" class="hint" style="margin-left:auto"></span>
    `;
    wa.insertAdjacentElement('afterend', bar);
  }
}

function wireTabButtons() {
  document.querySelectorAll('.tabBtn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      setActiveTab(btn.dataset.tab);
      if (btn.dataset.tab === "myRecords") {
        renderMyRecordsUI();
      }
    });
  });
}

function loadVesCurrencyLocal() {
  try {
    return localStorage.getItem("CAZE_VES_CURRENCY") || "ves";
  } catch {
    return "ves";
  }
}

function saveVesCurrencyLocal(val) {
  try {
    localStorage.setItem("CAZE_VES_CURRENCY", val);
  } catch {}
}

function wireVesCurrencyButtons() {
  const btnVes = document.getElementById("vesCurrencyVes");
  const btnUsd = document.getElementById("vesCurrencyUsd");
  if (!btnVes || !btnUsd) return;

  const updateButtons = () => {
    btnVes.classList.toggle("active", state.vesCurrency === "ves");
    btnUsd.classList.toggle("active", state.vesCurrency === "usd");

    // Show/hide rate selector
    const rateSelectorField = document.getElementById("vesUsdRateTypeField");
    if (rateSelectorField) {
      rateSelectorField.style.display = state.vesCurrency === "ves" ? "" : "none";
    }

    // Change label and placeholder
    const labelInVes = document.getElementById("labInVes");
    const inputInVes = document.getElementById("inVes");
    if (labelInVes) {
      labelInVes.textContent = state.vesCurrency === "ves" ? "Monto que te entrega (VES)" : "Monto que te entrega (USD)";
    }
    if (inputInVes) {
      inputInVes.placeholder = state.vesCurrency === "ves" ? "Ej: 50000" : "Ej: 100";
    }

    // Change result labels
    const capRate = document.getElementById("capVesCopRate");
    if (capRate) {
      capRate.textContent = state.vesCurrency === "ves" ? "Tasa inversa (COP por 1 VES)" : "Tasa inversa (COP por 1 USD)";
    }
    const capEntrega = document.getElementById("capVesEntrega");
    if (capEntrega) {
      capEntrega.textContent = state.vesCurrency === "ves" ? "Entrega en Venezuela (VES)" : "Entrega en Venezuela (USD)";
    }
  };

  btnVes.addEventListener("click", () => {
    state.vesCurrency = "ves";
    saveVesCurrencyLocal("ves");
    updateButtons();
    recalcAll();
  });

  btnUsd.addEventListener("click", () => {
    state.vesCurrency = "usd";
    saveVesCurrencyLocal("usd");
    updateButtons();
    recalcAll();
  });

  updateButtons();
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
  usdtVesBuyPct: 1.5,  // USDT/VES (comprar USDT con VES en VE)
  usdtCopSellPct: -1.5, // USDT/COP (vender USDT por COP en CO)
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
  if (!state.user) return;
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
  const usdtVesBuyPct = parseNum($("adjUsdtVesBuy")?.value);
  const usdtCopSellPct = parseNum($("adjUsdtCopSell")?.value);
  return { bcvPct, parallelPct, usdtCopPct, usdtVesPct, usdtVesBuyPct, usdtCopSellPct };
}

function hydrateAdjUI() {
  const a = state.adj || { ...DEFAULT_ADJ };
  if ($("adjBcv")) $("adjBcv").value = fmtPct(a.bcvPct);
  if ($("adjPar")) $("adjPar").value = fmtPct(a.parallelPct);
  if ($("adjUsdtCop")) $("adjUsdtCop").value = fmtPct(a.usdtCopPct);
  if ($("adjUsdtVes")) $("adjUsdtVes").value = fmtPct(a.usdtVesPct);
  if ($("adjUsdtVesBuy")) $("adjUsdtVesBuy").value = fmtPct(a.usdtVesBuyPct ?? 1.5);
  if ($("adjUsdtCopSell")) $("adjUsdtCopSell").value = fmtPct(a.usdtCopSellPct ?? -1.5);
}

function applyServerSettingsToState(settings) {
  if (!settings) return;
  // map DB fields -> local adj fields
  state.adj = {
    ...state.adj,
    bcvPct: Number(settings.adj_bcv ?? -1.5),
    parallelPct: Number(settings.adj_parallel ?? -2.0),
    usdtCopPct: Number(settings.adj_usdt_cop ?? 1.0),
    usdtVesPct: Number(settings.adj_usdt_ves ?? -2.5),
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
    usdtVesBuy: 2,
    usdtCopSell: 2,
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
  demo: false,
  adj: loadAdj(),
  branding: loadBrandingLocal(),
  // tasas auto
  usdVesOficial: null,     // USD/VES (BCV oficial)
  usdVesParalelo: null,    // USD/VES paralelo
  eurUsd: null,            // USD por 1 EUR
  eurVesBCV: null,         // EUR/VES (BCV)
  updatedAt: null,

  // UI (persistente)
  quoteMode: (typeof localStorage !== "undefined" && localStorage.getItem("quoteMode")) || "goal",
  invLast: (typeof localStorage !== "undefined" && localStorage.getItem("invLast")) || "invVes",
  vesCurrency: (typeof localStorage !== "undefined" && localStorage.getItem("CAZE_VES_CURRENCY")) || "ves",
  activePosterTab: "cop_ves",

  // Nuevos Ajustes Profesionales
  deferredInstallPrompt: null,
  liveRatesInterval: null,
  liveRatesEnabled: true,
  liveRatesTimeLeft: 30,
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
  <div id="operatorView">
    <div class="container">
      <div class="header">
        <div class="brand">
          <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
            <h1 style="margin:0">Remesas (COP → USDT → VES)</h1>
            <span class="badge mono" id="brandBadge">CAZEEXCHANGE</span>
            <span id="ratesBadge" class="badge mono">Tasas: —</span>
          </div>
          <small id="userBadge" class="badge">Sin sesión activa</small>
        </div>
        <div class="actions">
          <!-- Tasa en vivo pulsing dot -->
          <div id="liveBadge" class="live-badge no-export" style="display:none;">
            <span class="pulse-dot"></span>
            <span id="liveTimerText">En vivo: 30s</span>
          </div>

          <!-- PWA install button -->
          <button id="btnPWAInstall" class="pwa-badge no-export" style="display:none; border:none; padding: 4px 10px; height: auto;">
            <span>📲 Instalar App</span>
          </button>

          <!-- Toggle Client Mode -->
          <button id="btnToggleClientMode" class="btn success no-export" style="background:rgba(36,193,106,0.15); border-color:rgba(36,193,106,0.3); color:var(--ok); font-weight:700;" type="button">👥 Modo Cliente</button>

          <button id="btnUpdate" class="btn primary">Actualizar tasas</button>
          <button id="btnLogout" class="btn" style="display:none">Salir</button>
          <span id="status" class="badge mono">Listo</span>
        </div>
      </div>

    <div class="tabsTop" role="tablist" aria-label="Navegación">
      <button class="tabBtn active" data-tab="quote" id="tabQuote" type="button">De COP a VES</button>
      <button class="tabBtn" data-tab="vesToCop" id="tabVesToCop" type="button">De VES a COP</button>
      <button class="tabBtn" data-tab="rates" id="tabRates" type="button">Tasas y Ajustes</button>
      <button class="tabBtn" data-tab="myRecords" id="tabMyRecords" type="button" style="display:none">Mis Registros</button>
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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 10px; flex-wrap: wrap;">
            <h2 style="margin: 0;">Tasas (auto + manual)</h2>
            <label class="live-switch no-export" style="margin: 0; display: inline-flex;">
              <input id="chkLiveRates" type="checkbox" checked style="width:16px; height:16px; accent-color:#24c16a;" />
              <span style="font-weight: 600; color: var(--ok); display: flex; align-items: center; gap: 4px; font-size:12px;">
                <span class="pulse-dot" style="margin-right:2px;"></span>
                Tasas en vivo (30s)
              </span>
            </label>
          </div>
        <p class="hint">
          Las tasas marcadas “auto” se llenan al presionar <b>Actualizar tasas</b>, pero <b>puedes editarlas</b> si falla la automática.
          Para <b>USDT/COP</b> y <b>USDT/VES</b> intentamos traer una <i>tasa del día</i> (preferiblemente Binance P2P vía server).
          Si Binance falla o te bloquea, queda manual.
        </p>

        <div class="row">
          <div class="field">
            <label>USD/VES (Oficial / BCV) [auto/manual]</label>
            <input id="usdVesOf" inputmode="decimal" placeholder="Auto o manual" />
          </div>

          <div class="field">
            <label>USD/VES (Paralelo) [auto/manual]</label>
            <input id="usdVesPar" inputmode="decimal" placeholder="Auto o manual" />
          </div>

          <div class="field">
            <label>EUR/VES (BCV) [auto/manual]</label>
            <input id="eurVes" inputmode="decimal" placeholder="Auto o manual" />
          </div>

          <div class="field">
            <label>EURUSD [auto/manual] (USD por 1 EUR)</label>
            <input id="eurUsd" inputmode="decimal" placeholder="Auto o manual" />
          </div>

          <div class="field">
            <label>USDT/COP (Comprar USDT con COP en CO) [auto/manual]</label>
            <input id="usdtCopBuy" inputmode="decimal" placeholder="Ej: 3950" />
          </div>

          <div class="field">
            <label>USDT/VES (Vender USDT por VES en VE) [auto/manual]</label>
            <input id="usdtVesSell" inputmode="decimal" placeholder="Ej: 690" />
          </div>

          <div class="field">
            <label>USDT/VES (Comprar USDT con VES en VE) [auto/manual]</label>
            <input id="usdtVesBuy" inputmode="decimal" placeholder="Ej: 766" />
          </div>

          <div class="field">
            <label>USDT/COP (Vender USDT por COP en CO) [auto/manual]</label>
            <input id="usdtCopSell" inputmode="decimal" placeholder="Ej: 3279" />
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

        <div class="row">
          <div class="field">
            <label>USDT/VES (Comprar con VES) ajuste %</label>
            <input id="adjUsdtVesBuy" inputmode="decimal" placeholder="1,50" />
          </div>
          <div class="field">
            <label>USDT/COP (Vender por COP) ajuste %</label>
            <input id="adjUsdtCopSell" inputmode="decimal" placeholder="-1,50" />
          </div>
        </div>

        <div class="row" style="justify-content:flex-end;">
          <button id="btnAdjReset" class="btn secondary" type="button">Restablecer ajustes</button>
        </div>

        <hr/>

        
        </section>

        <section class="pane" data-tabs="rates">
          <h2>Branding (tu marca)</h2>
          <p class="hint">Personaliza el nombre y los colores que salen en la imagen exportada para que coincida con tu identidad de negocio.</p>

          <div class="row">
            <div class="field">
              <label>Nombre de marca (sale en la imagen)</label>
              <input id="brandName" placeholder="Ej: Remesas El Caribe" />
            </div>

            <div class="field">
              <label>Tema</label>
              <select id="brandTheme">
                <option value="ocean">Ocean</option>
                <option value="emerald">Emerald</option>
                <option value="sunset">Sunset</option>
                <option value="midnight">Midnight</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>

            <div class="field">
              <label>Accent color</label>
              <div class="colorRow">
                <input id="brandAccent" placeholder="#4ea1ff" />
                <input id="brandAccentPicker" type="color" value="#4ea1ff" />
              </div>
            </div>
          </div>

          <div class="row" style="margin-top: 10px;">
            <div class="field">
              <label>Cuentas para recibir Pesos Colombianos (COP) [Modo Cliente]</label>
              <input id="brandReceiveCop" placeholder="Ej: Bancolombia Ahorros Nro 123-456789-01, Titular: CazeExchange SAS" />
            </div>
            <div class="field">
              <label>Cuentas para recibir Bolívares (VES) [Modo Cliente]</label>
              <input id="brandReceiveVes" placeholder="Ej: Pago Móvil Banesco 0412-1234567 Cédula: V-12345678" />
            </div>
          </div>

          <div class="row" style="align-items:center; margin-top: 14px;">
            <button id="btnBrandSave" class="btn primary" type="button">Guardar branding</button>
            <button id="btnBrandReset" class="btn" type="button">Restablecer</button>
            <span id="brandMsg" class="hint" style="margin-left:auto"></span>
          </div>
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

        <section class="pane" data-tabs="vesToCop">
          <h2>Entradas (Remesa de VES a COP)</h2>
          <p class="hint">Calcula cuántos COP (pesos colombianos) recibe el beneficiario en base a la cantidad de VES (bolívares) o USD (dólares) que te entrega el cliente.</p>

          <div class="row formRow" style="margin-bottom:12px">
            <div class="field" style="grid-column: span 2;">
              <label>Moneda que entrega el cliente (VES ➔ COP)</label>
              <div class="segmented" role="tablist" aria-label="Moneda que entrega">
                <button id="vesCurrencyVes" class="segBtn active" type="button">Bolívares (VES)</button>
                <button id="vesCurrencyUsd" class="segBtn" type="button">Dólares (USD)</button>
              </div>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label id="labInVes">Monto que te entrega (VES)</label>
              <input id="inVes" inputmode="decimal" placeholder="Ej: 50000" />
            </div>

            <div class="field" id="vesUsdRateTypeField">
              <label>Tipo de tasa de cambio (VES → USD)</label>
              <select id="vesUsdRateType">
                <option value="usdtVesBuy" selected>Binance USDT/VES (Comprar - Recomendado)</option>
                <option value="usdtVesSell">Binance USDT/VES (Vender)</option>
                <option value="usdVesPar">Dólar Paralelo</option>
                <option value="usdVesOf">Dólar Oficial (BCV)</option>
                <option value="eurVes">Euro BCV / EURUSD</option>
              </select>
            </div>
          </div>

          <div class="row">
            <div class="field">
              <label>Tasa USDT/COP (Vender en CO)</label>
              <input id="vesUsdtCopBuy" inputmode="decimal" placeholder="Ej: 3279" />
            </div>

            <div class="field">
              <label>Tipo de ganancia</label>
              <select id="vesFeeType">
                <option value="pct">Porcentaje (%) sobre USDT</option>
                <option value="fixed">Fijo (USDT)</option>
              </select>
            </div>

            <div class="field">
              <label>Ganancia %</label>
              <input id="vesFeePct" inputmode="decimal" value="10" />
            </div>

            <div class="field">
              <label>Ganancia fija (USDT)</label>
              <input id="vesFeeFixed" inputmode="decimal" value="0" />
            </div>
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
                  <th style="width:50px;">ID</th>
                  <th>Suscriptor</th>
                  <th>Expiración</th>
                  <th>Última Actividad / Ubicación</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="adminUsersTbody"></tbody>
            </table>
          </div>

          <hr/>

          <h2 style="margin:0">Bitácora de Auditoría Global (SaaS Audit Trail)</h2>
          <p class="hint" style="margin-top:4px; margin-bottom:12px;">Seguimiento en tiempo real de todos los cálculos y cotizaciones realizadas por los suscriptores. Registro inalterable guardado en la base de datos segura.</p>

          <div class="row" style="margin-bottom: 12px; gap:8px; align-items: center;">
            <div class="field" style="max-width:100%;">
              <label>Buscar en la bitácora de auditoría (usuario, dirección, IP, dispositivo, etc.)</label>
              <input id="adminAuditSearch" placeholder="Escribe para buscar..." style="padding: 10px 14px;" />
            </div>
          </div>

          <div style="overflow:auto; max-height:450px; border:1px solid rgba(255,255,255,0.05); border-radius:12px; background:rgba(0,0,0,0.15);">
            <table class="table" style="font-size:12px;">
              <thead>
                <tr>
                  <th>Fecha/Hora</th>
                  <th>Suscriptor</th>
                  <th>Operación / Detalles</th>
                  <th>Entorno / Conexión</th>
                </tr>
              </thead>
              <tbody id="adminAuditTbody">
                <tr>
                  <td colspan="4" class="hint" style="text-align:center; padding:30px; color:var(--muted)">Cargando bitácora de auditoría global...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="pane" data-tabs="myRecords" style="display:none">
          <h2>Mis Operaciones Registradas</h2>
          <p class="hint">Lleva el control de tu caja diaria. Registra aquí las cotizaciones que cierres con éxito.</p>

          <div style="height:10px"></div>

          <div class="row" style="margin-bottom: 12px; gap:8px; align-items: center;">
            <div class="field">
              <label>Buscar operación registrada</label>
              <input id="myRecordsSearch" placeholder="Escribe para buscar..." style="padding: 8px 12px;" />
            </div>
            <div class="field" style="max-width:180px">
              <label>Filtro / Estado</label>
              <select id="myRecordsFilterMode" style="padding: 8px 12px;">
                <option value="all">Ver Todas</option>
                <option value="pendiente">Solo Pendientes 🟠</option>
                <option value="completada">Solo Completadas ✓</option>
                <option value="cancelada">Solo Canceladas ❌</option>
                <option value="cop_ves">Dirección: COP ➔ VES</option>
                <option value="ves_cop">Dirección: VES ➔ COP</option>
              </select>
            </div>
          </div>

          <div id="myRecordsList" class="audit-list">
            <div class="hint" style="text-align:center; padding:20px; color:var(--muted)">Aún no tienes operaciones registradas en tu caja hoy.</div>
          </div>
        </section>
      </div>

      <!-- RIGHT -->
      <div id="colRight" class="card">
        <section class="pane" data-tabs="quote">
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

        <section class="pane" data-tabs="quote">
          <h2>Mensaje WhatsApp (copiar/pegar)</h2>
        <textarea id="wa" readonly></textarea>

        <hr/>

        
        </section>

        <section class="pane" data-tabs="vesToCop">
          <h2>Resumen de envío a Colombia (VES → COP)</h2>
          <div class="badge mono" style="margin:-4px 0 10px 0">Sentido: Venezuela → Colombia</div>

          <div class="kpi">
            <div class="cap" id="capVesCopRate">Tasa inversa (COP por 1 VES)</div>
            <div id="kpiVesCopRate" class="big">—</div>
            <div class="cap mono" id="kpiVesCopNote">COP que recibe por cada 1 Bolívar entregado</div>
          </div>

          <div style="height:10px"></div>

          <div class="kpi">
            <div class="cap" id="capVesEntrega">Entrega en Venezuela (VES)</div>
            <div id="outVesEntrega" class="big">—</div>
            <div class="cap">Recibe en Colombia (beneficiario)</div>
            <div id="outVesRecibe" class="big">—</div>
          </div>

          <hr/>

          <div class="row">
            <div class="kpi">
              <div class="cap">Base en USD (USDT comprado)</div>
              <div id="outVesBaseUsdt" class="big">—</div>
              <div class="cap">Ganancia (USDT)</div>
              <div id="outVesFeeUsdt" class="big">—</div>
            </div>

            <div class="kpi">
              <div class="cap">USDT neto a enviar</div>
              <div id="outVesNetUsdt" class="big">—</div>
              <div class="cap">Ganancia estimada (COP)</div>
              <div id="outVesFeeCop" class="big">—</div>
            </div>
          </div>

          <hr/>

          <h2>Mensaje WhatsApp (copiar/pegar)</h2>
          <textarea id="vesWa" readonly style="min-height:160px;"></textarea>
          <div class="waActions no-export" style="display:flex; gap:10px; align-items:center; margin-top:8px">
            <button id="btnCopyVesWA" class="btn" type="button">Copiar</button>
            <button id="btnOpenVesWA" class="btn primary" type="button">Abrir WhatsApp</button>
            <button id="btnManualRegisterVes" class="btn success" type="button" style="background:#25d366; color:#000; font-weight:700; border:none; display:inline-flex; align-items:center; gap:4px">💾 Registrar</button>
            <span id="vesWaMsg" class="hint" style="margin-left:auto"></span>
          </div>

          <div style="height:15px"></div>
          <hr/>
          <h2>Cálculo inverso (opcional): “quiero que me llegue…”</h2>
          <p class="hint">Escribe el objetivo y te calcula cuánto debe entregar el cliente (VES o USD) considerando tu ganancia.</p>

          <div class="invTableWrap">
            <table class="invTable">
              <thead>
                <tr>
                  <th style="width:34%">Objetivo</th>
                  <th style="width:18%">Monto objetivo</th>
                  <th style="width:20%">Equiv. USD objetivo</th>
                  <th style="width:14%">Debe entregar (VES)</th>
                  <th style="width:14%">Debe entregar (USD)</th>
                </tr>
              </thead>
              <tbody>
                <tr id="row_invVesCop_cop">
                  <td><b>Recibir COP</b></td>
                  <td><input id="invVesCop_cop" inputmode="decimal" placeholder="Ej: 20000" /></td>
                  <td id="invVesCop_copEq">—</td>
                  <td id="invVesCop_copVes">—</td>
                  <td id="invVesCop_copUsd">—</td>
                </tr>
                <tr id="row_invVesCop_usd">
                  <td><b>Recibir USD equiv</b></td>
                  <td><input id="invVesCop_usd" inputmode="decimal" placeholder="Ej: 50" /></td>
                  <td id="invVesCop_usdEq">—</td>
                  <td id="invVesCop_usdVes">—</td>
                  <td id="invVesCop_usdUsd">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="pane" data-tabs="rates">
          <div class="posterHeader" style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;">
            <div>
              <h2 style="margin:0">Tabla para redes (exportable)</h2>
              <div class="hint">Genera una imagen tipo “flyer” con montos de referencia.</div>
            </div>
            <!-- Segmented Control to switch between flyers -->
            <div style="display:flex; gap:4px; background:rgba(255,255,255,0.04); padding:3px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); height:fit-content;">
              <button id="btnPosterTabCopVes" class="btn xs" style="border:none; padding:4px 10px; font-weight:700; cursor:pointer; border-radius:6px; font-size:11px; transition:all 0.2s;" type="button">COP ➔ VES</button>
              <button id="btnPosterTabVesCop" class="btn xs" style="border:none; padding:4px 10px; font-weight:700; cursor:pointer; border-radius:6px; font-size:11px; transition:all 0.2s;" type="button">VES ➔ COP</button>
            </div>
          </div>

          <div id="poster" class="poster">
            <div class="posterTop">
              <div id="posterBrand" class="posterBrand">CAZEEXCHANGE</div>
              <div id="posterTitle" class="posterTitle">Cotiza en segundos. Envía a Venezuela.</div>
              <div class="posterSub no-export" id="posterMeta">—</div>

              <div class="posterRate no-export">
                <div id="posterRateLabel" class="posterRateLabel">Tasa grande (COP por 1 VES)</div>
                <div id="posterRateValue" class="posterRateValue">—</div>
                <div id="posterRateNote" class="posterRateNote">—</div>
              </div>
            </div>

            <div class="posterBody">
              <div class="posterTableWrap">
                <table class="posterTable">
                  <thead>
                    <tr>
                      <th id="posterCol1">Entrega (COP)</th>
                      <th id="posterCol2">Recibe (VES)</th>
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

          <!-- Dedicated Export Button placed directly below the flyer! -->
          <div style="margin-top:15px; display:flex; justify-content:center;">
            <button id="btnExportPosterLocal" class="btn primary" style="width:100%; max-width:400px; font-weight:700; padding:12px; font-size:13px; border-radius:10px; background:var(--accent); color:#000; border:none; cursor:pointer; box-shadow:0 4px 15px rgba(255,160,0,0.3); display:inline-flex; align-items:center; justify-content:center; gap:8px;" type="button">
              📥 Exportar Imagen de Tabla de Redes
            </button>
          </div>
        </section>

        <section class="pane" data-tabs="myRecords" style="display:none">
          <h2>Resumen de mi Caja Diaria</h2>
          <p class="hint">Volumen de operaciones y ganancias acumuladas que has guardado hoy en este dispositivo.</p>
          
          <div style="height:10px"></div>

          <div class="history-kpi-grid">
            <div class="kpi" style="padding:10px;">
              <div class="cap">Cierres exitosos</div>
              <div id="myRecCount" class="big" style="font-size:20px; font-weight:700;">0</div>
            </div>
            <div class="kpi" style="padding:10px;">
              <div class="cap">Volumen COP</div>
              <div id="myRecVolCop" class="big" style="font-size:16px; font-weight:700; word-break: break-all;">—</div>
            </div>
            <div class="kpi" style="padding:10px;">
              <div class="cap">Mi Ganancia</div>
              <div id="myRecProfit" class="big" style="font-size:16px; font-weight:700; color:var(--ok); word-break: break-all;">—</div>
            </div>
          </div>

          <hr />

          <div class="row" style="gap:10px; margin-top:15px">
            <button id="btnMyRecExport" class="btn primary" type="button" style="flex:1">📥 Exportar Caja (CSV)</button>
            <button id="btnMyRecClear" class="btn" type="button" style="flex:1; color:var(--bad); border-color:rgba(255,90,106,0.15)">🧹 Limpiar Caja</button>
          </div>
        </section>
      </div>
    </div>
  </div> <!-- operatorView -->

  <!-- Client Mode View (A1 & A2) -->
  <div id="clientView" class="hidden" style="min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--text);">
    <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
      
      <!-- Brand Header -->
      <div class="header" style="margin-bottom: 24px; text-align: center; display: flex; flex-direction: column; gap: 8px; padding: 20px; border-radius: 20px; background: var(--glass); backdrop-filter: blur(12px);">
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
          <span style="font-size: 28px;">💱</span>
          <h1 id="clientBrandName" style="margin: 0; font-size: 24px; font-weight: 800; tracking: 0.5px; color: var(--accent);">CAZEEXCHANGE</h1>
        </div>
        <p style="margin: 0; font-size: 13px; color: var(--muted); font-weight: 500;">Calculadora de Envíos de Remesas Automatizados</p>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px;">
          <span class="pulse-dot"></span>
          <span style="font-size: 11px; font-weight: 600; color: var(--ok); text-transform: uppercase; letter-spacing: 0.5px;">Tasa en tiempo real</span>
        </div>
      </div>

      <!-- Step 1: Calculator -->
      <div id="clientStepCalculator" class="card" style="padding: 24px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.25);">
        <h2 style="font-size: 16px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; text-align: center;">Calcula tu Envío</h2>
        
        <!-- Direction Selector (COP->VES or VES->COP) -->
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
          <button id="btnClientDirCopVes" class="btn active" style="flex: 1; font-weight: 700; padding: 12px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 4px;" type="button">
            <span style="font-size: 18px;">🇨🇴 ➔ 🇻🇪</span>
            <span style="font-size: 11px;">COP a VES</span>
          </button>
          <button id="btnClientDirVesCop" class="btn" style="flex: 1; font-weight: 700; padding: 12px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; gap: 4px;" type="button">
            <span style="font-size: 18px;">🇻🇪 ➔ 🇨🇴</span>
            <span style="font-size: 11px;">VES a COP</span>
          </button>
        </div>

        <!-- Input Amount -->
        <div class="field" style="margin-bottom: 18px;">
          <label style="font-weight: 600; font-size: 13px;" id="lblClientSend">Tú envías (Pesos Colombianos)</label>
          <div style="position: relative;">
            <input id="clientInAmount" type="number" inputmode="decimal" placeholder="0.00" style="padding: 14px 60px 14px 16px; font-size: 18px; font-weight: 700; font-family: monospace; border-radius: 14px;" />
            <span id="clientInCurrencyBadge" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--accent); font-size: 14px;">COP</span>
          </div>
        </div>

        <!-- Rate Box -->
        <div style="background: rgba(255,255,255,0.02); border: 1px dashed var(--border); border-radius: 14px; padding: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 12px; color: var(--muted); font-weight: 500;">Tasa de cambio aplicada:</div>
          <div id="clientRateVal" style="font-weight: 700; color: var(--text); font-family: monospace; font-size: 14px;">—</div>
        </div>

        <!-- Output Amount -->
        <div class="field" style="margin-bottom: 24px;">
          <label style="font-weight: 600; font-size: 13px;" id="lblClientReceive">Tu beneficiario recibe (Bolívares Digitales)</label>
          <div style="position: relative;">
            <input id="clientOutAmount" type="number" inputmode="decimal" placeholder="0.00" style="padding: 14px 60px 14px 16px; font-size: 18px; font-weight: 700; font-family: monospace; border-radius: 14px;" />
            <span id="clientOutCurrencyBadge" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-weight: 800; color: var(--ok); font-size: 14px;">VES</span>
          </div>
        </div>

        <button id="btnClientNext" class="btn primary" style="width: 100%; padding: 14px; font-size: 16px; font-weight: 700; border-radius: 14px;" type="button">Siguiente: Datos de Envío ➔</button>
      </div>

      <!-- Step 2: Checkout -->
      <div id="clientStepCheckout" class="card hidden" style="padding: 24px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.25);">
        <h2 style="font-size: 16px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; text-align: center;">Datos del Envío</h2>
        
        <div style="background: rgba(var(--accent-rgb), 0.05); border: 1px solid rgba(var(--accent-rgb), 0.2); border-radius: 12px; padding: 12px; margin-bottom: 20px; text-align: center;">
          <div style="font-size: 11px; color: var(--muted);">Resumen de Cotización</div>
          <div style="font-size: 16px; font-weight: 800; margin-top: 4px;" id="clientCheckoutSummaryText">0 COP ➔ 0 VES</div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 14px; max-height: 380px; overflow-y: auto; padding-right: 4px; margin-bottom: 20px;">
          <!-- Sender info -->
          <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px;">
            <h3 style="margin: 0 0 10px 0; font-size: 13px; color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">1. Datos de quien envía</h3>
            <div class="row">
              <div class="field">
                <label>Tu Nombre Completo</label>
                <input id="checkoutSenderName" placeholder="Ej: Juan Pérez" />
              </div>
              <div class="field">
                <label>Tu WhatsApp / Teléfono</label>
                <input id="checkoutSenderPhone" inputmode="tel" placeholder="Ej: +57 300 1234567" />
              </div>
            </div>
          </div>

          <!-- Beneficiary info -->
          <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px;">
            <h3 style="margin: 0 0 10px 0; font-size: 13px; color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">2. Datos de quien recibe (Beneficiario)</h3>
            
            <div class="field" style="margin-bottom: 10px;">
              <label>Banco Destinatario</label>
              <select id="checkoutBeneBank" style="border-radius:10px;"></select>
            </div>

            <div class="row" style="margin-bottom: 10px;">
              <div class="field">
                <label>Tipo de Operación</label>
                <select id="checkoutBeneType" style="border-radius:10px;">
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                </select>
              </div>
              <div class="field">
                <label id="lblCheckoutBeneDoc">Documento (V / E / J / G)</label>
                <div style="display:flex; gap:6px;">
                  <select id="checkoutBeneDocType" style="max-width: 65px; padding:8px; border-radius:10px;">
                    <option value="V">V</option>
                    <option value="E">E</option>
                    <option value="J">J</option>
                    <option value="G">G</option>
                  </select>
                  <input id="checkoutBeneDoc" inputmode="numeric" placeholder="12345678" style="flex:1;" />
                </div>
              </div>
            </div>

            <div class="field" style="margin-bottom: 10px;">
              <label id="lblCheckoutBeneAccount">Número de Celular o Cuenta</label>
              <input id="checkoutBeneAccount" placeholder="Celular (Pago Móvil) o Cuenta de 20 dígitos" />
              <small class="hint" id="checkoutBeneAccountHint" style="font-size: 10px; color: var(--muted); margin-top:2px;">Pago móvil: Solo teléfono. Transferencia: 20 dígitos.</small>
            </div>

            <div class="field">
              <label>Nombre del Titular de la Cuenta</label>
              <input id="checkoutBeneName" placeholder="Ej: María Rodríguez" />
            </div>
          </div>

          <!-- Proof of payment dropzone -->
          <div>
            <h3 style="margin: 0 0 10px 0; font-size: 13px; color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">3. Comprobante de Transferencia (Cargar Pago)</h3>
            <p class="hint" style="margin: 0 0 10px 0; font-size:11px;">Transfiere a las cuentas autorizadas que verás abajo y adjunta una captura de pantalla del pago para su aprobación inmediata.</p>
            
            <div id="receiptDropzone">
              <span style="font-size: 24px; display: block; margin-bottom: 6px;">📸</span>
              <span style="font-size: 12px; font-weight: 600; color: var(--text);">Arrastra o haz clic para subir captura de pantalla</span>
              <span style="font-size: 10px; color: var(--muted); display: block; margin-top: 4px;">Formatos admitidos: PNG, JPG, JPEG</span>
              <input type="file" id="receiptFileInput" accept="image/*" style="display: none;" />
            </div>
            
            <div id="receiptFilePreview" style="text-align: center; margin-top: 10px;"></div>
          </div>

          <!-- Instructions accounts info (Interactive Receiver Details) -->
          <div style="background: rgba(255,255,255,0.02); border: 1px dashed var(--border); border-radius: 12px; padding: 14px; margin-top: 10px;">
            <h4 style="margin: 0 0 8px 0; font-size: 12px; color: var(--ok); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Cuentas de Recepción Autorizadas</h4>
            <div id="clientReceiverAccounts" style="font-size: 11px; line-height: 1.5; color: var(--text);">
              <!-- Cuentas inyectadas dinámicamente -->
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 10px;">
          <button id="btnClientBackToCalc" class="btn" style="flex: 1; padding: 12px; font-weight: 600;" type="button">⬅️ Volver</button>
          <button id="btnClientSubmit" class="btn success" style="flex: 2; padding: 12px; font-weight: 700; background: rgba(36,193,106,0.18); border-color: rgba(36,193,106,0.35); color: var(--ok);" type="button">Confirmar y Registrar Envío</button>
        </div>
      </div>

      <!-- Step 3: Success -->
      <div id="clientStepSuccess" class="card hidden" style="padding: 24px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); text-align: center;">
        <div style="width: 60px; height: 60px; background: rgba(36,193,106,0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
          <span style="font-size: 32px; color: var(--ok);">✓</span>
        </div>
        <h2 style="font-size: 20px; font-weight: 800; color: var(--text); margin-bottom: 8px;">¡Solicitud Registrada con Éxito!</h2>
        <p class="hint" style="margin-bottom: 20px; font-size: 13px;">Tu operación está siendo procesada bajo el ID de operación de abajo. Haz clic en el botón verde para contactar por WhatsApp y acelerar el cambio.</p>

        <!-- Dynamic Success Receipt Voucher Card -->
        <div id="clientSuccessTicket" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 14px; padding: 16px; text-align: left; margin-bottom: 24px; font-family: monospace; font-size: 12px; position: relative;">
          <div style="font-size: 14px; font-weight: 800; border-bottom: 1px dashed var(--border); padding-bottom: 8px; margin-bottom: 10px; color: var(--accent); display:flex; justify-content:space-between;">
            <span>DETALLE DEL ENVÍO</span>
            <span id="successTicketId">REG-123456</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div><strong>Remitente:</strong> <span id="successSender">Juan Pérez</span></div>
            <div><strong>WhatsApp:</strong> <span id="successPhone">+57 300 1234567</span></div>
            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 6px 0;" />
            <div><strong>Monto Enviado:</strong> <span id="successSendAmount" style="font-weight: 700; color: var(--ok);">—</span></div>
            <div><strong>Monto a Recibir:</strong> <span id="successReceiveAmount" style="font-weight: 700; color: var(--accent);">—</span></div>
            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 6px 0;" />
            <div><strong>Beneficiario:</strong> <span id="successBeneName">Maria Pérez</span></div>
            <div><strong>Banco:</strong> <span id="successBeneBank">Banesco</span></div>
            <div><strong>Cuenta/Celular:</strong> <span id="successBeneAccount">0134...</span></div>
            <div><strong>Documento:</strong> <span id="successBeneDoc">V-12345678</span></div>
            <div style="margin-top: 6px; font-size: 10px; color: var(--muted); text-align: center;" id="successTicketDate">Fecha: 05/07/2026, 17:20</div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btnClientWhatsappShare" class="btn primary" style="width: 100%; padding: 14px; font-weight: 700; background: #25d366; color: #000; border: none; font-size: 15px; display: inline-flex; align-items: center; justify-content: center; gap: 8px;" type="button">
            <span>🟢 Enviar Comprobante por WhatsApp</span>
          </button>
          <button id="btnClientNewQuote" class="btn" style="width: 100%; padding: 12px; font-weight: 600;" type="button">Realizar otra cotización</button>
        </div>
      </div>

      <!-- Footer action: Return to Admin / Operator -->
      <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.03);">
        <button id="btnExitClientMode" class="btn xs" style="border: none; background: transparent; color: var(--muted); font-size: 11px; cursor: pointer;" type="button">
          🔑 Volver a Modo Operador (Solo Administrador)
        </button>
      </div>

    </div>
  </div>

  <!-- Image Lightbox Modal -->
  <div id="imageLightboxModal" class="modal hidden" aria-hidden="true" style="overflow-y: auto;">
    <div class="modalCard" style="max-width: 500px; padding: 20px; text-align: center; position: relative;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <h3 style="margin:0; font-size:16px;">📸 Comprobante de Pago</h3>
        <button id="btnLightboxClose" class="btn xs" style="border:none; background:transparent; font-size:18px; cursor:pointer; color:var(--muted);">&times;</button>
      </div>
      <img id="lightboxImage" src="" style="width: 100%; max-height: 500px; object-fit: contain; border-radius: 8px; border: 1px solid var(--border);" />
    </div>
  </div>

  <!-- Auth Modal -->
  <div id="authModal" class="modal hidden" aria-hidden="true">
    <div class="modalCard">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <h2 style="margin:0">Iniciar sesión</h2>
        <span class="badge mono" id="authBrandBadge">CazeExchange</span>
      </div>
      <p class="hint">Inicia sesión con tus credenciales de CazeExchange corporativas para usar el sistema.</p>

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
      </div>

      <div id="loginMsg" class="hint" style="margin-top:10px"></div>
    </div>
  </div>

  <!-- Receipt Modal -->
  <div id="receiptModal" class="modal hidden" aria-hidden="true" style="overflow-y: auto;">
    <div class="modalCard" style="max-width: 420px; padding: 20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <h3 style="margin:0; font-size:16px;">🧾 Recibo de Transacción</h3>
        <button id="btnReceiptCloseTop" class="btn xs" style="border:none; background:transparent; font-size:18px; cursor:pointer; color:var(--muted);">&times;</button>
      </div>

      <!-- The Receipt Ticket to be exported as Image -->
      <div id="receiptTicket" style="background: var(--card-bg); border-radius: 12px; padding: 20px; border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 4px 20px rgba(0,0,0,0.15); margin-bottom: 20px; font-family: sans-serif; position: relative; overflow: hidden;">
        
        <!-- Watermark / Decorative background grid -->
        <div style="position:absolute; top:-20px; right:-20px; font-size:120px; opacity:0.02; pointer-events:none; transform: rotate(-15deg);">💱</div>

        <!-- Header -->
        <div style="text-align: center; border-bottom: 1px dashed rgba(255,255,255,0.12); padding-bottom: 15px; margin-bottom: 15px;">
          <div id="receiptBrandName" style="font-weight: 800; font-size: 20px; letter-spacing: 0.5px; color: var(--accent); margin-bottom: 4px;">CazeExchange</div>
          <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;">Voucher Digital de Remesas</div>
          <div id="receiptTxId" class="mono" style="font-size: 12px; background: rgba(255,255,255,0.03); display: inline-block; padding: 2px 8px; border-radius: 4px; margin-top: 8px; color: var(--text);">REG-XXXXXX</div>
        </div>

        <!-- Details -->
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Fecha</span>
            <span id="receiptDate" class="mono" style="font-size: 12px; font-weight: 600; color: var(--text);">—</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Operación</span>
            <span id="receiptDirection" class="badge" style="background: rgba(46,204,113,0.15); color: var(--ok); font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">COP ➔ VES</span>
          </div>

          <div style="border-top: 1px dashed rgba(255,255,255,0.08); margin: 6px 0;"></div>

          <!-- Input Amount -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; color: var(--muted);">Entregó (Monto In)</span>
            <span id="receiptInputAmt" style="font-size: 16px; font-weight: 700; color: var(--text);">—</span>
          </div>

          <!-- Output Amount -->
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; color: var(--muted);">Recibe (Monto Out)</span>
            <span id="receiptOutputAmt" style="font-size: 18px; font-weight: 800; color: var(--accent);">—</span>
          </div>
        </div>

        <!-- Decorative Barcode or Brand Seal -->
        <div style="border-top: 1px dashed rgba(255,255,255,0.12); padding-top: 15px; margin-top: 15px; text-align: center;">
          <div style="display: inline-flex; flex-direction: column; align-items: center; gap: 4px;">
            <!-- Simple simulated barcode using elegant lines -->
            <div style="display: flex; align-items: center; gap: 2px; height: 20px; opacity: 0.3;">
              <span style="width: 2px; height: 100%; background: var(--text);"></span>
              <span style="width: 1px; height: 100%; background: var(--text);"></span>
              <span style="width: 4px; height: 100%; background: var(--text);"></span>
              <span style="width: 2px; height: 100%; background: var(--text);"></span>
              <span style="width: 1px; height: 100%; background: var(--text);"></span>
              <span style="width: 3px; height: 100%; background: var(--text);"></span>
              <span style="width: 1px; height: 100%; background: var(--text);"></span>
              <span style="width: 4px; height: 100%; background: var(--text);"></span>
              <span style="width: 2px; height: 100%; background: var(--text);"></span>
              <span style="width: 1px; height: 100%; background: var(--text);"></span>
              <span style="width: 3px; height: 100%; background: var(--text);"></span>
              <span style="width: 2px; height: 100%; background: var(--text);"></span>
            </div>
            <div style="font-size: 9px; color: var(--muted); letter-spacing: 2px; font-family: monospace;">TRANS-OK-SECURE</div>
          </div>
        </div>

      </div>

      <!-- Action buttons -->
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="btnReceiptDownload" class="btn primary" type="button" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;">
          📸 Descargar Comprobante (Imagen)
        </button>
        <button id="btnReceiptWhatsapp" class="btn" type="button" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; border-color: rgba(46,204,113,0.3); color: var(--ok); background: rgba(46,204,113,0.05);">
          🟢 Compartir por WhatsApp
        </button>
        <button id="btnReceiptClose" class="btn" type="button" style="width: 100%;">
          Cerrar
        </button>
      </div>
      <div id="receiptMsg" class="hint" style="margin-top:10px; text-align:center;"></div>
    </div>
  </div>
`;


// ---------- auth + tabs init ----------
applyPhase2Layout();
setActiveTab("quote");
wireTabButtons();
wireVesCurrencyButtons();
wireWhatsappActions();

// branding init (preview inmediato)
applyBrandingToUI(state.branding);
wireBrandingUI();
hydrateBrandingUI();


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

    // Limpiar caché local para evitar fugas entre cuentas de usuario
    try {
      localStorage.removeItem("CAZE_USER_OPERATIONS");
    } catch {}

    // branding del usuario (server)
    if (me.branding) {
      state.branding = normalizeBranding(me.branding);
      saveBrandingLocal(state.branding);
    } else {
      state.branding = loadBrandingLocal();
    }
    applyBrandingToUI(state.branding);
    hydrateBrandingUI();

    setUserBadge();
    $("btnLogout").style.display = "";
    
    // update latest activity for connection mapping
    updateLatestActivityOnServer().catch(() => {});

    // admin tab visibility
    const isAdmin = state.user?.role === "admin";
    $("tabAdmin").style.display = isAdmin ? "" : "none";
    if ($("tabAdminMobile")) $("tabAdminMobile").style.display = isAdmin ? "" : "none";
    
    // Mis registros visible para cualquier suscriptor autenticado
    $("tabMyRecords").style.display = "";
    if ($("tabMyRecordsMobile")) $("tabMyRecordsMobile").style.display = "";

    if (isAdmin) loadAdminUsers().catch(() => {});
    closeAuthModal();
    updateAll();
    renderMyRecordsUI();
  } catch (e) {
    $("loginMsg").textContent = `Error: ${e.message || e}`;
  }
});

$("btnLogout")?.addEventListener("click", async () => {
  try { await apiFetch("/api/logout", { method: "POST" }); } catch {}
  state.user = null;
  state.demo = false;
  try {
    localStorage.removeItem("CAZE_USER_OPERATIONS");
  } catch {}
  state.branding = loadBrandingLocal();
  applyBrandingToUI(state.branding);
  hydrateBrandingUI();
  setUserBadge();
  $("btnLogout").style.display = "none";
  $("tabAdmin").style.display = "none";
  if ($("tabAdminMobile")) $("tabAdminMobile").style.display = "none";
  $("tabMyRecords").style.display = "none";
  if ($("tabMyRecordsMobile")) $("tabMyRecordsMobile").style.display = "none";
  openAuthModal("Sesión cerrada.");
  updateAll();
  renderMyRecordsUI();
});

function checkUrlBranding() {
  const params = new URLSearchParams(window.location.search);
  const brandParam = params.get("brand");
  if (brandParam) {
    const themeParam = params.get("theme") || "ocean";
    const accentParam = params.get("accent") || "#4ea1ff";
    
    const customBrand = normalizeBranding({
      brand_name: brandParam,
      theme: themeParam,
      accent: accentParam
    });
    
    state.branding = customBrand;
    saveBrandingLocal(customBrand);
    applyBrandingToUI(customBrand);
    
    // Ocultar elementos de administración si están presentes
    const btnLogout = $("btnLogout");
    if (btnLogout) btnLogout.style.display = "none";
  }
}

async function bootstrapAuth() {
  checkUrlBranding();
  try {
    const me = await apiFetch("/api/me", { method: "GET" });
    state.user = me.user;
    state.demo = false;
    applyServerSettingsToState(me.settings);

    // branding del usuario (server)
    if (me.branding) {
      state.branding = normalizeBranding(me.branding);
      saveBrandingLocal(state.branding);
    } else {
      state.branding = loadBrandingLocal();
    }
    applyBrandingToUI(state.branding);
    hydrateBrandingUI();

    setUserBadge();
    $("btnLogout").style.display = "";

    // update latest activity for connection mapping on boot
    updateLatestActivityOnServer().catch(() => {});

    // admin tab visibility
    const isAdmin = state.user?.role === "admin";
    $("tabAdmin").style.display = isAdmin ? "" : "none";
    if ($("tabAdminMobile")) $("tabAdminMobile").style.display = isAdmin ? "" : "none";
    
    // Mis registros visible para cualquier suscriptor autenticado
    $("tabMyRecords").style.display = "";
    if ($("tabMyRecordsMobile")) $("tabMyRecordsMobile").style.display = "";

    if (isAdmin) {
      loadAdminUsers().catch(() => {});
      renderAdminAuditUI().catch(() => {});
    }

    closeAuthModal();
  } catch {
    // no session: start block and show modal
    state.user = null;
    state.demo = false;
    try {
      localStorage.removeItem("CAZE_USER_OPERATIONS");
    } catch {}
    
    state.branding = loadBrandingLocal();
    applyBrandingToUI(state.branding);
    hydrateBrandingUI();
    
    setUserBadge();
    $("btnLogout").style.display = "none";
    $("tabAdmin").style.display = "none";
    if ($("tabAdminMobile")) $("tabAdminMobile").style.display = "none";
    $("tabMyRecords").style.display = "none";
    if ($("tabMyRecordsMobile")) $("tabMyRecordsMobile").style.display = "none";
    
    openAuthModal("");
    renderMyRecordsUI();
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

  const vesCopRows = [
    ["invVesCop_cop", "row_invVesCop_cop"],
    ["invVesCop_usd", "row_invVesCop_usd"]
  ];
  vesCopRows.forEach(([key, rid]) => {
    const tr = document.getElementById(rid);
    if (!tr) return;
    const on = state.invLast === key;
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
  waPrefix = `${getBrandName()} — Cotización remesa`,
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

function calcInverse(mainQuote) {
  const forwardCop = mainQuote?.cop;
  const forwardVes = mainQuote?.vesUsed;

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
  const invVesVal = parseNum($("invVes").value);
  const invVesInput = $("invVes");
  if (invVesInput) {
    invVesInput.placeholder = forwardVes ? fmt(forwardVes, 2) : "Ej: 30000";
  }
  const invVes = (invVesVal === 0 || invVesVal) ? invVesVal : (forwardVes || null);
  const rateForVes = usdViaEur || usdtVesSell || null;
  const r0 = inverseCopForTargetVes(invVes, rateForVes, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invVesEq", invVes ? `VES ${fmt(invVes, 2)}` : "—");
  setText("invVesCop", r0 ? money("COP", r0.cop, 0) : "—");
  setText("invVesUsd", r0 ? money("USD", r0.usd, 2) : "—");

  if (invVesVal && r0) {
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
  const invUsdBcvVal = parseNum($("invUsdBcv").value);
  const invUsdBcvInput = $("invUsdBcv");
  const fallbackUsdBcv = (forwardVes && usdBcv) ? (forwardVes / usdBcv) : null;
  if (invUsdBcvInput) {
    invUsdBcvInput.placeholder = fallbackUsdBcv ? fmt(fallbackUsdBcv, 2) : "Ej: 50";
  }
  const invUsdBcv = (invUsdBcvVal === 0 || invUsdBcvVal) ? invUsdBcvVal : (fallbackUsdBcv || null);
  const targetVesBcv = (invUsdBcv && usdBcv) ? invUsdBcv * usdBcv : null;
  const r1 = inverseCopForTargetVes(targetVesBcv, usdViaEur || usdtVesSell || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invUsdBcvEq", targetVesBcv ? `VES ${fmt(targetVesBcv, 2)}` : "—");
  setText("invUsdBcvCop", r1 ? money("COP", r1.cop, 0) : "—");
  setText("invUsdBcvUsd", r1 ? money("USD", r1.usd, 2) : "—");

  if (!primary.cop && invUsdBcvVal && targetVesBcv && r1) {
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
  const invUsdParVal = parseNum($("invUsdPar").value);
  const invUsdParInput = $("invUsdPar");
  const fallbackUsdPar = (forwardVes && usdPar) ? (forwardVes / usdPar) : null;
  if (invUsdParInput) {
    invUsdParInput.placeholder = fallbackUsdPar ? fmt(fallbackUsdPar, 2) : "Ej: 50";
  }
  const invUsdPar = (invUsdParVal === 0 || invUsdParVal) ? invUsdParVal : (fallbackUsdPar || null);
  const targetVesPar = (invUsdPar && usdPar) ? invUsdPar * usdPar : null;
  const r2 = inverseCopForTargetVes(targetVesPar, usdtVesSell || usdViaEur || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invUsdParEq", targetVesPar ? `VES ${fmt(targetVesPar, 2)}` : "—");
  setText("invUsdParCop", r2 ? money("COP", r2.cop, 0) : "—");
  setText("invUsdParUsd", r2 ? money("USD", r2.usd, 2) : "—");

  if (!primary.cop && invUsdParVal && targetVesPar && r2) {
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
  const invUsdEurVal = parseNum($("invUsdEur").value);
  const invUsdEurInput = $("invUsdEur");
  const fallbackUsdEur = (forwardVes && usdViaEur) ? (forwardVes / usdViaEur) : null;
  if (invUsdEurInput) {
    invUsdEurInput.placeholder = fallbackUsdEur ? fmt(fallbackUsdEur, 2) : "Ej: 50";
  }
  const invUsdEur = (invUsdEurVal === 0 || invUsdEurVal) ? invUsdEurVal : (fallbackUsdEur || null);
  const targetVesEur = (invUsdEur && usdViaEur) ? invUsdEur * usdViaEur : null;
  const r3 = inverseCopForTargetVes(targetVesEur, usdViaEur || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invUsdEurEq", targetVesEur ? `VES ${fmt(targetVesEur, 2)}` : "—");
  setText("invUsdEurCop", r3 ? money("COP", r3.cop, 0) : "—");
  setText("invUsdEurUsd", r3 ? money("USD", r3.usd, 2) : "—");

  if (!primary.cop && invUsdEurVal && targetVesEur && r3) {
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
  const invEurVal = parseNum($("invEur").value);
  const invEurInput = $("invEur");
  const fallbackEur = (forwardVes && eurVes) ? (forwardVes / eurVes) : null;
  if (invEurInput) {
    invEurInput.placeholder = fallbackEur ? fmt(fallbackEur, 2) : "Ej: 50";
  }
  const invEur = (invEurVal === 0 || invEurVal) ? invEurVal : (fallbackEur || null);
  const targetVesEurOnly = (invEur && eurVes) ? invEur * eurVes : null;
  const r4 = inverseCopForTargetVes(targetVesEurOnly, usdViaEur || usdtVesSell || null, usdtCopBuy, feeType, feePct, feeFixed);
  setText("invEurEq", targetVesEurOnly ? `VES ${fmt(targetVesEurOnly, 2)}` : "—");
  setText("invEurCop", r4 ? money("COP", r4.cop, 0) : "—");
  setText("invEurUsd", r4 ? money("USD", r4.usd, 2) : "—");

  if (!primary.cop && invEurVal && targetVesEurOnly && r4) {
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

function setVesToCopBlank() {
  setText("outVesEntrega", "—");
  setText("outVesRecibe", "—");
  setText("outVesBaseUsdt", "—");
  setText("outVesFeeUsdt", "—");
  setText("outVesNetUsdt", "—");
  setText("outVesFeeCop", "—");
  setText("kpiVesCopRate", "—");
  setText("kpiVesCopNote", "Completa datos para calcular");
  const waEl = $("vesWa");
  if (waEl) waEl.value = "";
}

function calcVesToCop() {
  const v = parseNum($("inVes")?.value);
  const isUsd = state.vesCurrency === "usd";
  
  const defaultUsdtCopSell = parseNum($("usdtCopSell")?.value);
  const customVesUsdtCopBuy = parseNum($("vesUsdtCopBuy")?.value);
  const vesUsdtCopBuyInput = $("vesUsdtCopBuy");
  if (vesUsdtCopBuyInput && defaultUsdtCopSell) {
    vesUsdtCopBuyInput.placeholder = String(fmt(defaultUsdtCopSell, 2));
  }
  const vesUsdtCopBuy = customVesUsdtCopBuy || defaultUsdtCopSell || null;

  const vesFeeType = $("vesFeeType")?.value;
  const vesFeePct = parseNum($("vesFeePct")?.value) / 100;
  const vesFeeFixed = parseNum($("vesFeeFixed")?.value);

  const usdBcv = parseNum($("usdVesOf")?.value);
  const usdPar = parseNum($("usdVesPar")?.value);
  const eurVes = parseNum($("eurVes")?.value);
  const eurUsd = parseNum($("eurUsd")?.value);
  const usdViaEur = (eurVes > 0 && eurUsd > 0) ? (eurVes / eurUsd) : null;
  const usdtVesSell = parseNum($("usdtVesSell")?.value);
  const usdtVesBuy = parseNum($("usdtVesBuy")?.value);

  // Determinar la tasa VES -> USD según la selección
  let rateVesPerUsd = null;
  let methodLabel = "—";
  if (isUsd) {
    rateVesPerUsd = 1.0;
    methodLabel = "Entrega en USD";
  } else {
    const rateType = $("vesUsdRateType")?.value;
    if (rateType === "usdtVesBuy") {
      rateVesPerUsd = usdtVesBuy;
      methodLabel = "Binance USDT/VES (Comprar)";
    } else if (rateType === "usdtVesSell") {
      rateVesPerUsd = usdtVesSell;
      methodLabel = "Binance USDT/VES (Vender)";
    } else if (rateType === "usdVesPar") {
      rateVesPerUsd = usdPar;
      methodLabel = "Paralelo";
    } else if (rateType === "usdVesOf") {
      rateVesPerUsd = usdBcv;
      methodLabel = "Oficial BCV";
    } else if (rateType === "eurVes") {
      rateVesPerUsd = usdViaEur;
      methodLabel = "Euro BCV / EURUSD";
    }
  }

  if (!v || !rateVesPerUsd || !vesUsdtCopBuy) {
    setVesToCopBlank();
    return;
  }

  // 1) Convierte los Bolívares que entrega el cliente a base USD (compramos USDT con VES)
  const baseUsdt = isUsd ? v : (v / rateVesPerUsd);

  // 2) Cobras ganancia en USD/USDT
  const feeUsdt = vesFeeType === "pct" ? (baseUsdt * vesFeePct) : vesFeeFixed;
  const netUsdt = Math.max(baseUsdt - feeUsdt, 0);

  // 3) Convierte los USD/USDT netos a COP (se entregan en Colombia)
  const copReceived = netUsdt * vesUsdtCopBuy;

  // 4) Tasa equivalente COP por 1 VES o 1 USD
  const copPerVes = copReceived / v;
  const feeCop = feeUsdt * vesUsdtCopBuy;

  // Pintar en el resumen de VES a COP
  setText("outVesEntrega", isUsd ? money("USD", v, 2) : money("VES", v, 2));
  setText("outVesRecibe", money("COP", copReceived, 0));
  setText("outVesBaseUsdt", money("USDT", baseUsdt, 2));
  setText("outVesFeeUsdt", money("USDT", feeUsdt, 2));
  setText("outVesNetUsdt", money("USDT", netUsdt, 2));
  setText("outVesFeeCop", money("COP", feeCop, 0));

  if (copPerVes > 0) {
    setText("kpiVesCopRate", `COP ${fmt(copPerVes, 6)}`);
    setText("kpiVesCopNote", isUsd ? `COP por 1 USD (monto neto)` : `COP por 1 VES (usando ${methodLabel})`);
  } else {
    setText("kpiVesCopRate", "—");
    setText("kpiVesCopNote", "Faltan tasas para calcular");
  }

  // Generar WhatsApp text
  const lines = [
    `*${getBrandName()}* — Cotización remesa (Venezuela ➔ Colombia)`,
    `══════════════════════`,
    isUsd ? `➔ *Entrega (Venezuela):* ${fmt(v, 2)} USD` : `➔ *Entrega (Venezuela):* ${fmt(v, 2)} VES`,
    `➔ *Recibe (Colombia):* ${fmt(copReceived, 0)} COP`,
    isUsd ? `Tasa equivalente: 1 USD = ${fmt(copPerVes, 6)} COP` : `Tasa equivalente: 1 VES = ${fmt(copPerVes, 6)} COP`,
    !isUsd ? `Tasa de referencia VES/USDT: ${fmt(rateVesPerUsd, 2)}` : null,
    `Tasa de referencia USDT/COP: ${fmt(vesUsdtCopBuy, 2)}`,
    `══════════════════════`,
    `Cotización generada automáticamente.`
  ].filter(Boolean);
  const msg = lines.join("\n");
  const waEl = $("vesWa");
  if (waEl) waEl.value = msg;
}

function calcVesCopInverse() {
  const copTargetVal = parseNum($("invVesCop_cop")?.value);
  const usdTargetVal = parseNum($("invVesCop_usd")?.value);

  const defaultUsdtCopSell = parseNum($("usdtCopSell")?.value);
  const customVesUsdtCopBuy = parseNum($("vesUsdtCopBuy")?.value);
  const vesUsdtCopBuy = customVesUsdtCopBuy || defaultUsdtCopSell || null;

  const vesFeeType = $("vesFeeType")?.value;
  const vesFeePct = parseNum($("vesFeePct")?.value) / 100;
  const vesFeeFixed = parseNum($("vesFeeFixed")?.value);

  const usdBcv = parseNum($("usdVesOf")?.value);
  const usdPar = parseNum($("usdVesPar")?.value);
  const eurVes = parseNum($("eurVes")?.value);
  const eurUsd = parseNum($("eurUsd")?.value);
  const usdViaEur = (eurVes > 0 && eurUsd > 0) ? (eurVes / eurUsd) : null;
  const usdtVesSell = parseNum($("usdtVesSell")?.value);
  const usdtVesBuy = parseNum($("usdtVesBuy")?.value);

  let rateVesPerUsd = null;
  const rateType = $("vesUsdRateType")?.value;
  if (rateType === "usdtVesBuy") {
    rateVesPerUsd = usdtVesBuy;
  } else if (rateType === "usdtVesSell") {
    rateVesPerUsd = usdtVesSell;
  } else if (rateType === "usdVesPar") {
    rateVesPerUsd = usdPar;
  } else if (rateType === "usdVesOf") {
    rateVesPerUsd = usdBcv;
  } else if (rateType === "eurVes") {
    rateVesPerUsd = usdViaEur;
  }

  // 1. Recibir COP
  if (copTargetVal > 0 && vesUsdtCopBuy && rateVesPerUsd) {
    const netUsdt = copTargetVal / vesUsdtCopBuy;
    let baseUsdt = 0;
    if (vesFeeType === "pct") {
      baseUsdt = netUsdt / (1 - vesFeePct);
    } else {
      baseUsdt = netUsdt + vesFeeFixed;
    }
    const reqVes = baseUsdt * rateVesPerUsd;
    const reqUsd = baseUsdt;

    setText("invVesCop_copEq", money("USDT", netUsdt, 2));
    setText("invVesCop_copVes", fmt(reqVes, 2));
    setText("invVesCop_copUsd", fmt(reqUsd, 2));
  } else {
    setText("invVesCop_copEq", "—");
    setText("invVesCop_copVes", "—");
    setText("invVesCop_copUsd", "—");
  }

  // 2. Recibir USD
  if (usdTargetVal > 0 && vesUsdtCopBuy && rateVesPerUsd) {
    const copTarget = usdTargetVal * vesUsdtCopBuy;
    const netUsdt = usdTargetVal;
    let baseUsdt = 0;
    if (vesFeeType === "pct") {
      baseUsdt = netUsdt / (1 - vesFeePct);
    } else {
      baseUsdt = netUsdt + vesFeeFixed;
    }
    const reqVes = baseUsdt * rateVesPerUsd;
    const reqUsd = baseUsdt;

    setText("invVesCop_usdEq", money("COP", copTarget, 0));
    setText("invVesCop_usdVes", fmt(reqVes, 2));
    setText("invVesCop_usdUsd", fmt(reqUsd, 2));
  } else {
    setText("invVesCop_usdEq", "—");
    setText("invVesCop_usdVes", "—");
    setText("invVesCop_usdUsd", "—");
  }
}

function wireVesWhatsappActions() {
  const btnCopy = document.getElementById('btnCopyVesWA');
  const btnOpen = document.getElementById('btnOpenVesWA');
  const wa = document.getElementById('vesWa');
  const msg = document.getElementById('vesWaMsg');

  if (btnCopy && wa) {
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(wa.value);
        if (msg) {
          msg.textContent = "¡Copiado!";
          msg.style.color = "var(--ok)";
          setTimeout(() => { msg.textContent = ""; }, 2500);
        }
      } catch {
        window.prompt("Copia y pega este mensaje:", wa.value);
      }
    });
  }

  if (btnOpen && wa) {
    btnOpen.addEventListener('click', () => {
      const txt = encodeURIComponent(wa.value);
      window.open(`https://api.whatsapp.com/send?text=${txt}`, '_blank');
    });
  }
}

function renderPoster(activeQuote) {
  const tbody = $("posterRows");
  if (!tbody) return;

  const isCopVes = state.activePosterTab === "cop_ves";

  // Update tabs buttons UI inside rates poster
  const btnCopVes = $("btnPosterTabCopVes");
  const btnVesCop = $("btnPosterTabVesCop");
  if (btnCopVes && btnVesCop) {
    if (isCopVes) {
      btnCopVes.style.background = "var(--accent)";
      btnCopVes.style.color = "#000";
      btnVesCop.style.background = "transparent";
      btnVesCop.style.color = "var(--text)";
    } else {
      btnVesCop.style.background = "var(--accent)";
      btnVesCop.style.color = "#000";
      btnCopVes.style.background = "transparent";
      btnCopVes.style.color = "var(--text)";
    }
  }

  // Update title & headers
  setText("posterTitle", isCopVes ? "Cotiza en segundos. Envía a Venezuela." : "Cotiza en segundos. Envía a Colombia.");
  const col1 = $("posterCol1");
  const col2 = $("posterCol2");
  if (col1) col1.textContent = isCopVes ? "Entrega (COP)" : "Entrega (VES)";
  if (col2) col2.textContent = isCopVes ? "Recibe (VES)" : "Recibe (COP)";

  if (isCopVes) {
    const amounts = [20000, 50000, 100000, 200000, 350000, 750000, 1000000];
    const usdtCopBuy = parseNum($("usdtCopBuy").value);
    const usdtVesSell = parseNum($("usdtVesSell").value);
    const feeType = $("feeType").value;
    const feePct = parseNum($("feePct").value) / 100;
    const feeFixed = parseNum($("feeFixed").value);
    const usdViaEur = usdVesViaEur();

    const rateSource = (activeQuote && activeQuote.copPerVes) ? activeQuote : null;
    if (rateSource && rateSource.copPerVes) {
      setText("posterRateValue", `COP ${fmt(rateSource.copPerVes, 6)}`);
      setText("posterRateNote", "COP por 1 VES");
    } else {
      setText("posterRateValue", "—");
      setText("posterRateNote", "Completa USDT/COP + tasas");
    }

    tbody.innerHTML = amounts.map((cop) => {
      if (!usdtCopBuy) return `<tr><td><b>${money("COP", cop, 0)}</b></td><td>—</td></tr>`;

      const baseUsdt = cop / usdtCopBuy;
      const feeUsdt = feeType === "pct" ? baseUsdt * feePct : feeFixed;
      const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
      const ves = usdViaEur ? netUsdt * usdViaEur : (usdtVesSell ? netUsdt * usdtVesSell : null);

      return `
        <tr>
          <td><b>${money("COP", cop, 0)}</b></td>
          <td><b>${ves ? money("VES", ves, 2) : "—"}</b></td>
        </tr>
      `;
    }).join("");

  } else {
    const amounts = [1000, 5000, 10000, 20000, 30000, 40000, 50000];
    const defaultUsdtCopSell = parseNum($("usdtCopSell")?.value);
    const customVesUsdtCopBuy = parseNum($("vesUsdtCopBuy")?.value);
    const vesUsdtCopBuy = customVesUsdtCopBuy || defaultUsdtCopSell || null;

    const vesFeeType = $("vesFeeType")?.value;
    const vesFeePct = parseNum($("vesFeePct")?.value) / 100;
    const vesFeeFixed = parseNum($("vesFeeFixed")?.value);

    const usdBcv = parseNum($("usdVesOf")?.value);
    const usdPar = parseNum($("usdVesPar")?.value);
    const eurVes = parseNum($("eurVes")?.value);
    const eurUsd = parseNum($("eurUsd")?.value);
    const usdViaEur = (eurVes > 0 && eurUsd > 0) ? (eurVes / eurUsd) : null;
    const usdtVesSell = parseNum($("usdtVesSell")?.value);
    const usdtVesBuy = parseNum($("usdtVesBuy")?.value);

    let rateVesPerUsd = null;
    const rateType = $("vesUsdRateType")?.value;
    if (rateType === "usdtVesBuy") {
      rateVesPerUsd = usdtVesBuy;
    } else if (rateType === "usdtVesSell") {
      rateVesPerUsd = usdtVesSell;
    } else if (rateType === "usdVesPar") {
      rateVesPerUsd = usdPar;
    } else if (rateType === "usdVesOf") {
      rateVesPerUsd = usdBcv;
    } else if (rateType === "eurVes") {
      rateVesPerUsd = usdViaEur;
    }

    if (rateVesPerUsd && vesUsdtCopBuy) {
      const rate = (1 / rateVesPerUsd) * (1 - (vesFeeType === "pct" ? vesFeePct : 0)) * vesUsdtCopBuy;
      setText("posterRateValue", `COP ${fmt(rate, 6)}`);
      setText("posterRateNote", "COP por 1 VES");
    } else {
      setText("posterRateValue", "—");
      setText("posterRateNote", "Completa tasas VES ➔ COP");
    }

    tbody.innerHTML = amounts.map((ves) => {
      if (!rateVesPerUsd || !vesUsdtCopBuy) return `<tr><td><b>${money("VES", ves, 2)}</b></td><td>—</td></tr>`;

      const baseUsdt = ves / rateVesPerUsd;
      const feeUsdt = vesFeeType === "pct" ? baseUsdt * vesFeePct : vesFeeFixed;
      const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
      const cop = netUsdt * vesUsdtCopBuy;

      return `
        <tr>
          <td><b>${money("VES", ves, 0)}</b></td>
          <td><b>${cop ? money("COP", cop, 0) : "—"}</b></td>
        </tr>
      `;
    }).join("");
  }
}

async function exportPoster() {
  const poster = $('poster');
  if (!poster) return;

  // IMPORTANT: the poster lives inside the Rates tab.
  // If the user is on another tab (eg. Quote), the poster is hidden (display:none).
  // html2canvas will then render a 0x0 canvas and Chrome downloads a 0B file.
  const prevTab = document.querySelector('.tabBtn.active')?.dataset?.tab || 'quote';
  const needSwitch = prevTab !== 'rates';

  try {
    if (needSwitch) {
      setActiveTab('rates');
      // Wait 2 frames so layout/styling settles before capture
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    // Ensure the poster is up-to-date before capture
    try {
      recalcAll();
    } catch (e) {
      // non-fatal
    }

    const rect = poster.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      if ($('status')) $('status').textContent = 'Export: abre la pestaña Tasas y Ajustes';
      return;
    }

    const html2canvas = await getHtml2Canvas();
    document.body.classList.add('exporting');

    let canvas;
    try {
      canvas = await html2canvas(poster, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
    } finally {
      document.body.classList.remove('exporting');
    }

    const filename = `${brandSlug()}_tabla_${new Date().toISOString().slice(0, 10)}.png`;

    // Prefer Blob download (more reliable than huge data URLs)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const a = document.createElement('a');
    a.download = filename;

    if (blob) {
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    }

    // Fallback
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 50) {
      if ($('status')) $('status').textContent = 'Export: fallo (canvas vacio)';
      return;
    }
    a.href = dataUrl;
    a.click();
  } finally {
    if (needSwitch) setActiveTab(prevTab);
  }
}

async function updateRates() {
  const status = $("status");
  const rb = $("ratesBadge");
  const adj = state.adj || { ...DEFAULT_ADJ };

  if (status) status.textContent = "Actualizando…";
  if (rb) {
    rb.textContent = "Tasas: …";
    rb.classList.remove("ok", "warn", "bad");
    rb.title = "";
  }

  const applyBadge = (data) => {
    if (!rb || !data) return;

    // quality: primary | approx | missing
    const q = data.quality
      || (data.missing && data.missing.length ? "missing" : "primary")
      || "approx";

    const text = q === "primary" ? "Tasas: OK" : (q === "missing" ? "Tasas: faltan" : "Tasas: aprox");
    rb.textContent = text;

    rb.classList.toggle("ok", q === "primary");
    rb.classList.toggle("warn", q === "approx");
    rb.classList.toggle("bad", q === "missing");

    // Tooltip detallado (si viene)
    const src = data.sources_detail || data.sourcesDetail || null;
    if (src && typeof src === "object") {
      const lines = [];
      lines.push(`BCV: ${src.bcv || "?"}`);
      lines.push(`Paralelo: ${src.parallel || "?"}`);
      lines.push(`USDT/COP: ${src.usdt_cop || "?"}`);
      lines.push(`USDT/VES: ${src.usdt_ves || "?"}`);
      if (Array.isArray(data.fallback_rates) && data.fallback_rates.length) {
        lines.push(`Fallback: ${data.fallback_rates.join(", ")}`);
      }
      if (Array.isArray(data.missing) && data.missing.length) {
        lines.push(`Faltan: ${data.missing.join(", ")}`);
      }
      if (Array.isArray(data.warnings) && data.warnings.length) {
        lines.push(`Notas: ${data.warnings.slice(0, 3).join(" | ")}`);
      }
      rb.title = lines.join("\n");
      return;
    }

    // Legacy tooltip
    if (data.missing && data.missing.length) rb.title = `Faltan: ${data.missing.join(", ")}`;
    else rb.title = String(data.sources || "");
  };

  // Endpoint propio (Pages Functions)
  const copNow = parseNum($("inCop")?.value);
  const ratesPath = Number.isFinite(copNow) && copNow > 0
    ? `/api/rates?cop=${encodeURIComponent(String(copNow))}`
    : "/api/rates";
  const ratesUrl = `${API_BASE}${ratesPath}`;

  const serverRates = await safeJson(ratesUrl);
  if (serverRates && serverRates.ok) {
    // Tasas base
    if (Number.isFinite(serverRates.usdVesBcv)) setValue("usdVesOf", applyPct(serverRates.usdVesBcv, adj.bcvPct), 2);
    if (Number.isFinite(serverRates.usdVesParallel)) setValue("usdVesPar", applyPct(serverRates.usdVesParallel, adj.parallelPct), 2);
    if (Number.isFinite(serverRates.eurVesBcv)) setValue("eurVes", serverRates.eurVesBcv, 2);
    if (Number.isFinite(serverRates.eurUsd)) setValue("eurUsd", serverRates.eurUsd, 6);

    // P2P (USDT/COP y USDT/VES) con ajustes
    const usdtCop = applyPct((serverRates.usdtCopBuy ?? serverRates.usdCop ?? null), adj.usdtCopPct);
    const usdtVes = applyPct((serverRates.usdtVesSell ?? serverRates.usdVesParallel ?? null), adj.usdtVesPct);
    if (Number.isFinite(usdtCop)) setValue("usdtCopBuy", usdtCop, 2);
    if (Number.isFinite(usdtVes)) setValue("usdtVesSell", usdtVes, 2);

    const usdtVesBuyVal = applyPct((serverRates.usdtVesBuy ?? serverRates.usdVesParallel ?? null), adj.usdtVesBuyPct ?? 1.5);
    const usdtCopSellVal = applyPct((serverRates.usdtCopSell ?? serverRates.usdCop ?? null), adj.usdtCopSellPct ?? -1.5);
    if (Number.isFinite(usdtVesBuyVal)) setValue("usdtVesBuy", usdtVesBuyVal, 2);
    if (Number.isFinite(usdtCopSellVal)) setValue("usdtCopSell", usdtCopSellVal, 2);

    state.lastRateMeta = {
      ok: true,
      sources: serverRates.sources || "API",
      ts: serverRates.ts || new Date().toISOString(),
      quality: serverRates.quality || null,
    };

    applyBadge(serverRates);
    if (status) status.textContent = "Listo";
    recalcAll();
    return;
  }

  // Fallback legacy (puede fallar por CORS en dev): no rompe la app.
  try {
    const usdOf = await safeJson("https://ve.dolarapi.com/v1/dolares/oficial");
    const usdPar = await safeJson("https://ve.dolarapi.com/v1/dolares/paralelo");
    const fx = await safeJson("https://open.er-api.com/v6/latest/EUR");
    const usdFx = await safeJson("https://open.er-api.com/v6/latest/USD");

    const ofVal = usdOf?.promedio ?? usdOf?.venta ?? usdOf?.compra ?? null;
    const parVal = usdPar?.promedio ?? usdPar?.venta ?? usdPar?.compra ?? null;
    const eurUsd = fx?.rates?.USD ?? null;
    const usdCop = usdFx?.rates?.COP ?? null;

    if (ofVal) setInput("usdVesOf", applyPct(Number(ofVal), adj.bcvPct), 2);
    if (parVal) setInput("usdVesPar", applyPct(Number(parVal), adj.parallelPct), 2);
    if (eurUsd) setInput("eurUsd", Number(eurUsd), 6);

    // Aproximaciones para USDT
    if (usdCop) setInput("usdtCopBuy", applyPct(Number(usdCop), adj.usdtCopPct), 2);
    if (parVal) setInput("usdtVesSell", applyPct(Number(parVal), adj.usdtVesPct), 2);
    if (parVal) setInput("usdtVesBuy", applyPct(Number(parVal), adj.usdtVesBuyPct ?? 1.5), 2);
    if (usdCop) setInput("usdtCopSell", applyPct(Number(usdCop), adj.usdtCopSellPct ?? -1.5), 2);

    applyBadge({
      ok: true,
      quality: "approx",
      fallback_rates: ["usdt_cop", "usdt_ves", "usdt_ves_buy", "usdt_cop_sell"],
      sources_detail: {
        bcv: "DolarAPI (fallback)",
        parallel: "DolarAPI (fallback)",
        usdt_cop: "Aprox: USD/COP",
        usdt_ves: "Aprox: USD/VES paralelo",
        usdt_ves_buy: "Aprox: USD/VES paralelo (Comprar)",
        usdt_cop_sell: "Aprox: USD/COP (Vender)",
      },
    });

    if (status) status.textContent = "Listo (fallback)";
  } catch (e) {
    if (status) status.textContent = "No se pudo actualizar automáticamente. Puedes editar tasas manual.";
    applyBadge({ ok: true, quality: "approx", warnings: [String(e?.message || e)] });
  }

  recalcAll();
}


function recalcAll() {
  readRatesFromInputs();

  const main = calcMain({ paint: state.quoteMode === "cop" });
  const primaryInv = calcInverse(main);
  const active = getActiveQuote(main, primaryInv);

  calcVesToCop();
  calcVesCopInverse();

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
        waPrefix: `${getBrandName()} — Cotización remesa (objetivo)`,
      });
    } else {
      setSummaryBlank("Escribe un objetivo en la tabla inversa");
    }
  }

  renderPoster(active);
  triggerAutoLog();
}

// ---------- events ----------

// Compat: algunos handlers antiguos llaman updateAll()
function updateAll() {
  recalcAll();
}

// En algunos entornos (o si alguien cambia el HTML) estos botones pueden no existir.
// Evitamos que la app se caiga por un null.addEventListener().


// ---------- admin UI ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
}

function daysLeft(expires_at) {
  if (!expires_at) return "∞";
  const t = Date.parse(expires_at);
  if (!Number.isFinite(t)) return "?";
  const diff = t - Date.now();
  const d = Math.ceil(diff / (1000*60*60*24));
  return d < 0 ? "Expirado" : `${d}d`;
}


async function loadAdminUsers() {
  if (state.user?.role !== "admin") return;
  
  let data = { users: [] };
  try {
    data = await apiFetch("/api/admin/users", { method: "GET" }) || { users: [] };
  } catch (e) {
    console.error("No se pudieron cargar usuarios admin:", e);
  }

  // Fetch audits to match subscribers with their latest connection info and online status
  let audits = [];
  try {
    audits = await loadHistory(data.users || []);
  } catch (e) {
    console.warn("No se pudo cargar el historial de auditoría para mapear conexiones:", e);
  }

  // Map user email (trimmed lowercase) to their latest activity
  const activityMap = {};
  
  // First, map latest active times from lastActiveAt field in branding
  const usersList = data.users || [];
  usersList.forEach((u) => {
    let brandObj = null;
    if (u.branding) {
      if (typeof u.branding === "string") {
        try { brandObj = JSON.parse(u.branding); } catch {}
      } else if (typeof u.branding === "object") {
        brandObj = u.branding;
      }
    }
    const emailKey = String(u.email).trim().toLowerCase();
    if (brandObj && brandObj.lastActiveAt) {
      activityMap[emailKey] = {
        timestamp: brandObj.lastActiveAt,
        sec_timezone: brandObj.lastActiveTz || "Desconocida",
        sec_ua: brandObj.lastActiveUa || "Navegador Web"
      };
    }
  });

  // Second, override if they have a newer registered operation in audits
  if (Array.isArray(audits)) {
    audits.forEach((item) => {
      if (!item || !item.user) return;
      const emailKey = String(item.user).trim().toLowerCase();
      const itemTime = item.timestamp ? new Date(item.timestamp).getTime() : 0;
      const existingTime = activityMap[emailKey] ? new Date(activityMap[emailKey].timestamp).getTime() : 0;
      if (itemTime > existingTime) {
        activityMap[emailKey] = {
          timestamp: item.timestamp,
          sec_timezone: item.sec_timezone || "Desconocida",
          sec_ua: item.sec_ua || "Navegador Web"
        };
      }
    });
  }

  const tbody = $("adminUsersTbody");
  if (!tbody) return;
  const users = data.users || [];
  
  tbody.innerHTML = users
    .map((u) => {
      const exp = u.expires_at || "";
      const active = Number(u.is_active) === 1;
      const emailKey = String(u.email).trim().toLowerCase();
      const latestAudit = activityMap[emailKey];

      // Expiración string
      const left = daysLeft(exp);
      let expColor = "var(--text)";
      if (left === "Expirado") expColor = "var(--bad)";
      else if (left === "∞") expColor = "var(--ok)";
      else if (parseInt(left) <= 5) expColor = "var(--accent)";

      // Connection Info
      let connectionInfoHtml = `<span style="color:var(--muted)">Sin actividad registrada</span>`;
      let isOnline = false;

      if (latestAudit) {
        const auditTime = new Date(latestAudit.timestamp).getTime();
        const diffMs = Date.now() - auditTime;
        
        // 15 minutes threshold for Online status
        if (diffMs < 15 * 60 * 1000) {
          isOnline = true;
        }

        const formattedTime = new Date(latestAudit.timestamp).toLocaleString("es-ES", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
        });

        // Parse country and device
        const tz = latestAudit.sec_timezone || "Desconocida";
        const browser = latestAudit.sec_ua || "Web Browser";
        
        connectionInfoHtml = `
          <div style="font-size:12px; font-weight: 600;">${formattedTime}</div>
          <div style="font-size:10px; color:var(--muted); margin-top:2px;" class="mono">
            🌍 ${escapeHtml(tz)} <br/>
            📱 ${escapeHtml(browser)}
          </div>
        `;
      }

      // Render Connection Status Badge
      let statusBadgeHtml = "";
      if (!active) {
        statusBadgeHtml = `<span class="badge" style="background: rgba(255,90,106,0.15); color: var(--bad); font-size:11px;">● Desactivado</span>`;
      } else if (left === "Expirado") {
        statusBadgeHtml = `<span class="badge" style="background: rgba(255,160,0,0.15); color: #ffa000; font-size:11px;">● Expirado</span>`;
      } else if (isOnline) {
        statusBadgeHtml = `
          <span class="badge" style="background: rgba(46,204,113,0.15); color: var(--ok); font-size:11px; display:inline-flex; align-items:center; gap:4px;">
            <span class="pulse-dot" style="width:7px; height:7px; background:var(--ok); margin:0;"></span> En línea
          </span>`;
      } else {
        // Active but offline
        statusBadgeHtml = `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--muted); font-size:11px;">● Offline</span>`;
      }

      // Compact email, plan and role display
      const roleBadge = u.role === "admin" 
        ? `<span class="badge" style="background:rgba(230,126,34,0.2); color:#e67e22; font-size:9px; padding:2px 4px; border-radius:4px; margin-left:4px;">Admin</span>`
        : "";
      const planBadge = `<span class="badge" style="background:rgba(78,161,255,0.15); color:var(--accent); font-size:9px; padding:2px 4px; border-radius:4px; margin-left:4px; text-transform:uppercase;">${escapeHtml(u.plan || "free")}</span>`;

      return `<tr>
        <td class="mono" style="font-size:11px; color:var(--muted)">${u.id}</td>
        <td>
          <div style="font-weight:600; font-size:13px;">${escapeHtml(u.email)}</div>
          <div style="margin-top:4px; display:flex; gap:2px;">
            ${planBadge} ${roleBadge}
          </div>
        </td>
        <td class="mono" style="font-size:12px;">
          <div style="color:${expColor}; font-weight:700;">${daysLeft(exp)}</div>
          <div style="font-size:10px; color:var(--muted); margin-top:2px;">${exp ? exp.split("T")[0] : "Ilimitada"}</div>
        </td>
        <td>${connectionInfoHtml}</td>
        <td>${statusBadgeHtml}</td>
        <td>
          <div style="display:flex; flex-direction:column; gap:4px; max-width:110px;">
            <button class="btn xs" data-action="reset" data-id="${u.id}" style="padding: 4px 8px; font-size:11px;">Reset clave</button>
            <button class="btn xs" data-action="toggle" data-id="${u.id}" data-active="${active ? "1":"0"}" style="padding: 4px 8px; font-size:11px;">
              ${active ? "Desactivar" : "Activar"}
            </button>
            <button class="btn xs secondary" data-action="delete" data-id="${u.id}" style="padding: 4px 8px; font-size:11px; color:var(--bad); border-color:rgba(255,90,106,0.15);">Eliminar</button>
          </div>
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

  if (!email) {
    $("adminResult").textContent = "Falta el email.";
    return;
  }

  $("adminResult").textContent = "Creando...";
  try {
    const r = await apiFetch("/api/admin/create-user", {
      method: "POST",
      body: JSON.stringify({ email, role, plan, expires_at, password: password || undefined, is_active }),
    });

    const temp = r.temp_password ? ` Temp password: ${r.temp_password}` : "";
    $("adminResult").textContent = `OK: ${r.user.email}.${temp}`;

    // Copiar mensaje listo para WhatsApp
    if (r.temp_password) {
      const msg = `✅ Acceso ${getBrandName()}
Email: ${r.user.email}
Clave: ${r.temp_password}
Expira: ${r.user.expires_at || "Sin expiración"}
Link: https://cazeexchange.pages.dev

Escríbeme por aquí si necesitas ayuda.`;

      try {
        await navigator.clipboard.writeText(msg);
        $("adminResult").textContent += " | Copiado ✅";
      } catch {
        $("adminResult").textContent += " | No se pudo copiar (clipboard bloqueado).";
        window.prompt("Copia y pega este mensaje en WhatsApp:", msg);
      }
    }

    if ($("adminEmail")) $("adminEmail").value = "";
    if ($("adminPassword")) $("adminPassword").value = "";
    await loadAdminUsers();
  } catch (e) {
    $("adminResult").textContent = `Error: ${e.message || e}`;
  }
}
$("btnUpdate")?.addEventListener("click", updateRates);
$("btnExportPosterLocal")?.addEventListener("click", exportPoster);
$("btnPosterTabCopVes")?.addEventListener("click", () => {
  state.activePosterTab = "cop_ves";
  recalcAll();
});
$("btnPosterTabVesCop")?.addEventListener("click", () => {
  state.activePosterTab = "ves_cop";
  recalcAll();
});
$("btnAdminCreate")?.addEventListener("click", adminCreateUser);
$("btnAdminReload")?.addEventListener("click", loadAdminUsers);

// ajustes (%)
["adjBcv","adjPar","adjUsdtCop","adjUsdtVes","adjUsdtVesBuy","adjUsdtCopSell"].forEach((id) => {
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
  "usdtCopBuy","usdtVesSell","usdtVesBuy","usdtCopSell","adjBcv","adjPar","adjUsdtCop","adjUsdtVes","adjUsdtVesBuy","adjUsdtCopSell",
  "invVes","invUsdBcv","invUsdPar","invUsdEur","invEur","invVesCop_cop","invVesCop_usd",
  "inVes","vesUsdRateType","vesUsdtCopBuy","vesFeeType","vesFeePct","vesFeeFixed"
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
// auto al abrir
applyQuoteModeUI();
wireVesWhatsappActions();


// ---------- Nuevos Ajustes Profesionales ----------

// PWA & Service Worker
function setupPWAEvents() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js")
        .then(reg => {
          console.log("CazeExchange Service Worker registrado con éxito.");
        })
        .catch(err => {
          console.warn("Fallo de registro de SW CazeExchange: ", err);
        });
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    const installBtn = $("btnPWAInstall");
    if (installBtn) {
      installBtn.style.display = "inline-flex";
    }
  });

  $("btnPWAInstall")?.addEventListener("click", async () => {
    const promptEvent = state.deferredInstallPrompt;
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    console.log(`User prompt outcome: ${outcome}`);
    state.deferredInstallPrompt = null;
    const installBtn = $("btnPWAInstall");
    if (installBtn) installBtn.style.display = "none";
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    const installBtn = $("btnPWAInstall");
    if (installBtn) installBtn.style.display = "none";
  });
}

// Live Rates Auto updates
function setupLiveRates() {
  const chkLive = $("chkLiveRates");
  const liveBadge = $("liveBadge");
  const liveTimerText = $("liveTimerText");

  if (!chkLive) return;

  const saved = localStorage.getItem("CAZE_LIVE_RATES");
  if (saved === "false") {
    state.liveRatesEnabled = false;
    chkLive.checked = false;
  } else {
    state.liveRatesEnabled = true;
    chkLive.checked = true;
  }

  chkLive.addEventListener("change", (e) => {
    state.liveRatesEnabled = e.target.checked;
    localStorage.setItem("CAZE_LIVE_RATES", String(state.liveRatesEnabled));
    if (state.liveRatesEnabled) {
      state.liveRatesTimeLeft = 30;
      if (liveBadge) liveBadge.style.display = "inline-flex";
    } else {
      if (liveBadge) liveBadge.style.display = "none";
    }
  });

  if (state.liveRatesInterval) clearInterval(state.liveRatesInterval);
  
  if (state.liveRatesEnabled && liveBadge) {
    liveBadge.style.display = "inline-flex";
  }

  state.liveRatesInterval = setInterval(() => {
    if (!state.liveRatesEnabled) {
      if (liveBadge) liveBadge.style.display = "none";
      return;
    }

    if (liveBadge && liveBadge.style.display === "none") {
      liveBadge.style.display = "inline-flex";
    }

    state.liveRatesTimeLeft--;
    if (liveTimerText) {
      liveTimerText.textContent = `En vivo: ${state.liveRatesTimeLeft}s`;
    }

    if (state.liveRatesTimeLeft <= 0) {
      state.liveRatesTimeLeft = 30;
      silentUpdateRates();
    }
  }, 1000);

  // Heartbeat para mantener el estado "En línea" de los suscriptores activos
  setInterval(() => {
    if (state.user) {
      updateLatestActivityOnServer().catch(() => {});
    }
  }, 3 * 60 * 1000); // 3 minutos
}

async function silentUpdateRates() {
  const status = $("status");
  if (status) status.textContent = "Sincronizando...";

  try {
    const copNow = parseNum($("inCop")?.value);
    const ratesPath = Number.isFinite(copNow) && copNow > 0
      ? `/api/rates?cop=${encodeURIComponent(String(copNow))}`
      : "/api/rates";

    const serverRates = await apiFetch(ratesPath);
    const adj = state.adj || {};

    if (Number.isFinite(serverRates.usdVesBcv)) setValue("usdVesOf", applyPct(serverRates.usdVesBcv, adj.bcvPct), 2);
    if (Number.isFinite(serverRates.usdVesParallel)) setValue("usdVesPar", applyPct(serverRates.usdVesParallel, adj.parallelPct), 2);
    if (Number.isFinite(serverRates.eurVesBcv)) setValue("eurVes", serverRates.eurVesBcv, 2);
    if (Number.isFinite(serverRates.eurUsd)) setValue("eurUsd", serverRates.eurUsd, 6);

    const usdtCop = serverRates.usdtCopBuy ?? serverRates.usdCop ?? null;
    const usdtVes = serverRates.usdtVesSell ?? serverRates.usdVesParallel ?? null;

    if (Number.isFinite(usdtCop)) setValue("usdtCopBuy", usdtCop, 2);
    if (Number.isFinite(usdtVes)) setValue("usdtVesSell", usdtVes, 2);

    const usdtVesBuyVal = applyPct((serverRates.usdtVesBuy ?? serverRates.usdVesParallel ?? null), adj.usdtVesBuyPct ?? 1.5);
    const usdtCopSellVal = applyPct((serverRates.usdtCopSell ?? serverRates.usdCop ?? null), adj.usdtCopSellPct ?? -1.5);
    if (Number.isFinite(usdtVesBuyVal)) setValue("usdtVesBuy", usdtVesBuyVal, 2);
    if (Number.isFinite(usdtCopSellVal)) setValue("usdtCopSell", usdtCopSellVal, 2);

    const d = new Date();
    state.updatedAt = d;
    updateRatesBadge(d);

    if (status) status.textContent = "Listo";
  } catch (e) {
    if (status) status.textContent = "Reintentando...";
  }

  recalcAll();
}

// Historial y Auditoría
function getCleanUserAgent() {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android Device";
  if (/ipad|iphone|ipod/i.test(ua)) return "iOS Device";
  if (/chrome|crios/i.test(ua)) return "Chrome Browser";
  if (/safari/i.test(ua)) return "Safari Browser";
  if (/firefox|fxios/i.test(ua)) return "Firefox Browser";
  return "Navegador Web";
}

async function loadHistory(preloadedUsers = null) {
  if (state.user?.role !== "admin") {
    try {
      const raw = localStorage.getItem("CAZE_QUOTES_HISTORY");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  try {
    let users = preloadedUsers;
    if (!users) {
      const data = await apiFetch("/api/admin/users", { method: "GET" });
      users = data?.users || [];
    }
    let audits = [];
    users.forEach(u => {
      let brandObj = null;
      if (u.branding) {
        if (typeof u.branding === "string") {
          try {
            brandObj = JSON.parse(u.branding);
          } catch {}
        } else if (typeof u.branding === "object") {
          brandObj = u.branding;
        }
      }
      if (brandObj && Array.isArray(brandObj.operations)) {
        brandObj.operations.forEach(op => {
          const enrichedOp = { ...op };
          enrichedOp.user = u.email;
          audits.push(enrichedOp);
        });
      }
    });

    audits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return audits;
  } catch (e) {
    console.warn("No se pudo cargar el historial unificado de auditoría:", e);
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem("CAZE_QUOTES_HISTORY", JSON.stringify(history));
  } catch {}
}

async function addHistoryEntry(entry) {
  const history = await loadHistory();
  history.unshift(entry);
  if (history.length > 500) {
    history.pop();
  }
  saveHistory(history);
  await renderHistoryUI();
}

let lastLoggedHash = "";
let autoLogTimer = null;

function triggerAutoLog() {
  if (autoLogTimer) clearTimeout(autoLogTimer);
  autoLogTimer = setTimeout(() => {
    saveActiveQuoteToHistory();
  }, 1200);
}

function saveActiveQuoteToHistory() {
  const activeTab = document.querySelector(".tabBtn.active")?.dataset.tab;
  if (activeTab !== "quote" && activeTab !== "vesToCop") return;

  const userEmail = state.user?.email || "Invitado";
  const now = new Date();

  if (activeTab === "quote") {
    const inCopVal = parseNum($("inCop")?.value);
    if (!inCopVal || inCopVal <= 0) return;

    const main = calcMain({ paint: false });
    if (!main) return;
    const primaryInv = calcInverse(main);
    const active = getActiveQuote(main, primaryInv);
    if (!active || !active.cop || active.cop <= 0) return;

    const hash = `cop_ves_${active.cop}_${active.vesUsed}_${active.feeUsdt}_${userEmail}`;
    if (hash === lastLoggedHash) return;
    lastLoggedHash = hash;

    const entry = {
      id: "QT-" + Math.floor(100000 + Math.random() * 900000),
      timestamp: now.toISOString(),
      user: userEmail,
      direction: "cop_ves",
      directionLabel: "COP ➔ VES",
      inputAmount: active.cop,
      inputCurrency: "COP",
      outputAmount: active.vesUsed,
      outputCurrency: "VES",
      profit: active.feeUsdt,
      profitCurrency: "USDT",
      rates: `BCV: ${parseNum($("usdVesOf")?.value)} | Paralelo: ${parseNum($("usdVesPar")?.value)} | USDT/COP Buy: ${parseNum($("usdtCopBuy")?.value)} | USDT/VES Sell: ${parseNum($("usdtVesSell")?.value)}`,
      sec_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Caracas",
      sec_lang: navigator.language || "es-ES",
      sec_online: navigator.onLine ? "Online" : "Offline",
      sec_ua: getCleanUserAgent()
    };

    addHistoryEntry(entry);
  } else if (activeTab === "vesToCop") {
    const inVesVal = parseNum($("inVes")?.value);
    if (!inVesVal || inVesVal <= 0) return;

    const isUsd = state.vesCurrency === "usd";
    const defaultUsdtCopSell = parseNum($("usdtCopSell")?.value);
    const customVesUsdtCopBuy = parseNum($("vesUsdtCopBuy")?.value);
    const vesUsdtCopBuy = customVesUsdtCopBuy || defaultUsdtCopSell || null;
    
    let rateVesPerUsd = null;
    if (isUsd) {
      rateVesPerUsd = 1.0;
    } else {
      const rateType = $("vesUsdRateType")?.value;
      if (rateType === "usdtVesBuy") {
        rateVesPerUsd = parseNum($("usdtVesBuy")?.value);
      } else if (rateType === "usdtVesSell") {
        rateVesPerUsd = parseNum($("usdtVesSell")?.value);
      } else if (rateType === "usdVesPar") {
        rateVesPerUsd = parseNum($("usdVesPar")?.value);
      } else if (rateType === "usdVesOf") {
        rateVesPerUsd = parseNum($("usdVesOf")?.value);
      } else if (rateType === "eurVes") {
        const eurVes = parseNum($("eurVes")?.value);
        const eurUsd = parseNum($("eurUsd")?.value);
        rateVesPerUsd = (eurVes > 0 && eurUsd > 0) ? (eurVes / eurUsd) : null;
      }
    }

    if (!rateVesPerUsd || !vesUsdtCopBuy) return;

    const baseUsdt = isUsd ? inVesVal : (inVesVal / rateVesPerUsd);
    const vesFeeType = $("vesFeeType")?.value;
    const vesFeePct = parseNum($("vesFeePct")?.value) / 100;
    const vesFeeFixed = parseNum($("vesFeeFixed")?.value);
    const feeUsdt = vesFeeType === "pct" ? (baseUsdt * vesFeePct) : vesFeeFixed;
    const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
    const copReceived = netUsdt * vesUsdtCopBuy;

    const hash = `ves_cop_${inVesVal}_${copReceived}_${feeUsdt}_${userEmail}`;
    if (hash === lastLoggedHash) return;
    lastLoggedHash = hash;

    const entry = {
      id: "QT-" + Math.floor(100000 + Math.random() * 900000),
      timestamp: now.toISOString(),
      user: userEmail,
      direction: "ves_cop",
      directionLabel: isUsd ? "USD ➔ COP" : "VES ➔ COP",
      inputAmount: inVesVal,
      inputCurrency: isUsd ? "USD" : "VES",
      outputAmount: copReceived,
      outputCurrency: "COP",
      profit: feeUsdt,
      profitCurrency: "USDT",
      rates: `USDT/COP Sell: ${vesUsdtCopBuy} | USDT/VES: ${rateVesPerUsd}`,
      sec_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Caracas",
      sec_lang: navigator.language || "es-ES",
      sec_online: navigator.onLine ? "Online" : "Offline",
      sec_ua: getCleanUserAgent()
    };

    addHistoryEntry(entry);
  }
}

async function renderAdminAuditUI() {
  const tbody = $("adminAuditTbody");
  if (!tbody) return;

  const audits = await loadHistory();
  const searchVal = ($("adminAuditSearch")?.value || "").trim().toLowerCase();

  const filtered = audits.filter(item => {
    if (!searchVal) return true;
    
    const userStr = String(item.user || "").toLowerCase();
    const idStr = String(item.id || "").toLowerCase();
    const dirStr = String(item.directionLabel || "").toLowerCase();
    const ratesStr = String(item.rates || "").toLowerCase();
    const uaStr = String(item.sec_ua || "").toLowerCase();
    const tzStr = String(item.sec_timezone || "").toLowerCase();
    const inputAmt = String(item.inputAmount || "").toLowerCase();
    const outputAmt = String(item.outputAmount || "").toLowerCase();

    return userStr.includes(searchVal) || 
           idStr.includes(searchVal) || 
           dirStr.includes(searchVal) || 
           ratesStr.includes(searchVal) || 
           uaStr.includes(searchVal) || 
           tzStr.includes(searchVal) ||
           inputAmt.includes(searchVal) ||
           outputAmt.includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="hint" style="text-align:center; padding:30px; color:var(--muted)">No se encontraron registros de auditoría que coincidan con la búsqueda.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const formattedDate = new Date(item.timestamp).toLocaleString("es-ES", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
    });

    const isCopVes = item.direction === "cop_ves";
    const directionBadge = isCopVes
      ? `<span class="badge" style="background:rgba(46,204,113,0.15); color:var(--ok); font-size:10px; padding:2px 6px; border-radius:4px;">COP ➔ VES</span>`
      : `<span class="badge" style="background:rgba(78,161,255,0.15); color:var(--accent); font-size:10px; padding:2px 6px; border-radius:4px;">VES ➔ COP</span>`;

    const inputVal = isCopVes 
      ? money("COP", item.inputAmount, 0) 
      : (item.inputCurrency === "USD" ? money("USD", item.inputAmount, 2) : money("VES", item.inputAmount, 2));

    const outputVal = money(item.outputCurrency, item.outputAmount, isCopVes ? 2 : 0);
    const profitVal = money("USDT", item.profit, 2);

    return `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
        <td class="mono" style="white-space:nowrap; vertical-align:top; font-size:11px; padding:12px 8px;">${formattedDate}</td>
        <td style="vertical-align:top; padding:12px 8px;">
          <div style="font-weight:700; font-size:13px; color:var(--text); word-break:break-all;">${escapeHtml(item.user)}</div>
          <div style="font-size:10px; color:var(--muted); margin-top:2px;" class="mono">ID: ${item.id}</div>
        </td>
        <td style="vertical-align:top; padding:12px 8px;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            ${directionBadge}
            <span style="font-size:11px; color:var(--ok); font-weight:700;">+${profitVal} ganancia</span>
          </div>
          <div style="font-size:12px; line-height:1.4;">
            Entregó: <span style="font-weight:600; color:var(--text);">${inputVal}</span> ➔ Recibió: <span style="font-weight:600; color:var(--accent);">${outputVal}</span>
          </div>
          <div style="font-size:10px; color:var(--muted); margin-top:4px;" class="mono">
            Tasas: ${escapeHtml(item.rates || "N/A")}
          </div>
        </td>
        <td style="vertical-align:top; padding:12px 8px; font-size:11px; color:var(--muted);">
          <div class="mono" style="margin-bottom:2px; color:var(--text);">🌍 ${escapeHtml(item.sec_timezone || "Desconocida")}</div>
          <div style="font-size:10px; line-height:1.3;">📱 ${escapeHtml(item.sec_ua || "Dispositivo desconocido")}</div>
          <div style="font-size:9px; color:var(--muted); margin-top:2px;">Conexión Segura Cloudflare TLS (Audit IP)</div>
        </td>
      </tr>
    `;
  }).join("");
}

async function renderHistoryUI() {
  if (state.user?.role === "admin") {
    await renderAdminAuditUI();
  }
}

function wireHistoryTabEvents() {
  $("adminAuditSearch")?.addEventListener("input", renderAdminAuditUI);
}

// ---------- NUEVAS FUNCIONES DE COMPROBANTES Y ACTIVIDAD ----------

async function updateLatestActivityOnServer() {
  if (!state.user) return;
  if (!state.branding) {
    state.branding = { ...DEFAULT_BRANDING };
  }
  state.branding.lastActiveAt = new Date().toISOString();
  state.branding.lastActiveTz = (typeof Intl !== "undefined" && Intl.DateTimeFormat) 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : "Desconocida";
  state.branding.lastActiveUa = getCleanUserAgent();
  
  await saveBrandingLocal(state.branding);
}

function showReceiptModal(entry) {
  const modal = $("receiptModal");
  if (!modal) return;

  const brandName = getBrandName();
  const txId = entry.id;
  const formattedDate = new Date(entry.timestamp).toLocaleString("es-ES", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const isCopVes = entry.direction === "cop_ves";
  const inputVal = isCopVes 
    ? money("COP", entry.inputAmount, 0) 
    : (entry.inputCurrency === "USD" ? money("USD", entry.inputAmount, 2) : money("VES", entry.inputAmount, 2));

  const outputVal = money(entry.outputCurrency, entry.outputAmount, isCopVes ? 2 : 0);

  // Set text contents
  const brandNameEl = $("receiptBrandName");
  if (brandNameEl) brandNameEl.textContent = brandName;

  const txIdEl = $("receiptTxId");
  if (txIdEl) txIdEl.textContent = txId;

  const dateEl = $("receiptDate");
  if (dateEl) dateEl.textContent = formattedDate;

  const directionEl = $("receiptDirection");
  if (directionEl) {
    directionEl.textContent = entry.directionLabel;
    directionEl.style.background = isCopVes ? "rgba(46,204,113,0.15)" : "rgba(78,161,255,0.15)";
    directionEl.style.color = isCopVes ? "var(--ok)" : "var(--accent)";
  }

  const inputAmtEl = $("receiptInputAmt");
  if (inputAmtEl) inputAmtEl.textContent = inputVal;

  const outputAmtEl = $("receiptOutputAmt");
  if (outputAmtEl) outputAmtEl.textContent = outputVal;

  const ratesEl = $("receiptRates");
  if (ratesEl) ratesEl.innerHTML = entry.rates.replace(" | ", "<br/>");

  const msgEl = $("receiptMsg");
  if (msgEl) msgEl.textContent = "";

  // Show modal
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  // Wire Download Button
  const btnDownload = $("btnReceiptDownload");
  if (btnDownload) {
    btnDownload.onclick = async () => {
      if (msgEl) msgEl.textContent = "Generando comprobante...";
      try {
        const html2canvas = await getHtml2Canvas();
        const ticket = $("receiptTicket");
        const canvas = await html2canvas(ticket, {
          backgroundColor: "#0f172a",
          scale: 2.5, // Crisp high-res export
          useCORS: true
        });
        canvas.toBlob((blob) => {
          if (!blob) throw new Error("No blob generated");
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `comprobante_${txId}.png`;
          a.click();
          URL.revokeObjectURL(url);
          if (msgEl) msgEl.textContent = "Comprobante descargado ✅";
        }, "image/png");
      } catch (e) {
        console.error(e);
        if (msgEl) msgEl.textContent = "Error al generar imagen.";
      }
    };
  }

  // Wire WhatsApp Button
  const btnWhatsapp = $("btnReceiptWhatsapp");
  if (btnWhatsapp) {
    btnWhatsapp.onclick = () => {
      const text = `*COMPROBANTE DE TRANSACCIÓN* 🧾\n` +
                   `*${brandName}*\n\n` +
                   `*ID:* ${txId}\n` +
                   `*Fecha:* ${formattedDate}\n` +
                   `*Operación:* ${entry.directionLabel}\n` +
                   `*Monto Entregado:* ${inputVal}\n` +
                   `*Monto Recibido:* ${outputVal}\n\n` +
                   `¡Gracias por confiar en nosotros! ✨`;

      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank");
    };
  }

  // Wire Close Button
  const btnClose = $("btnReceiptClose");
  if (btnClose) {
    btnClose.onclick = () => {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    };
  }
  const btnCloseTop = $("btnReceiptCloseTop");
  if (btnCloseTop) {
    btnCloseTop.onclick = () => {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    };
  }
}

// ---------- NUEVAS FUNCIONES DE 'MIS REGISTROS' (CAJA DIARIA DEL SUSCRIPTOR) ----------

function loadMyRecords() {
  if (state.user) {
    if (state.branding && Array.isArray(state.branding.operations)) {
      return state.branding.operations;
    }
    return [];
  }
  try {
    const raw = localStorage.getItem("CAZE_USER_OPERATIONS");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveMyRecords(records) {
  try {
    localStorage.setItem("CAZE_USER_OPERATIONS", JSON.stringify(records));
  } catch {}
  if (state.user) {
    if (!state.branding) {
      state.branding = { ...DEFAULT_BRANDING };
    }
    state.branding.operations = records;
    saveBrandingLocal(state.branding);

    // Sincronizar con el servidor en tiempo real para que aparezca en la auditoría global
    try {
      await apiFetch("/api/branding", {
        method: "POST",
        body: JSON.stringify(state.branding),
      });
    } catch (e) {
      console.warn("No se pudo sincronizar operaciones con el servidor:", e);
    }
  }
}

function addMyRecordEntry(entry) {
  // Enrich entry with security headers for audit trail
  entry.sec_ua = getCleanUserAgent();
  entry.sec_timezone = (typeof Intl !== "undefined" && Intl.DateTimeFormat) 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : "Desconocida";

  const records = loadMyRecords();
  records.unshift(entry);
  saveMyRecords(records);
  renderMyRecordsUI();
}

function deleteMyRecord(id) {
  if (confirm("¿Seguro que deseas eliminar esta operación de tu registro de caja?")) {
    const records = loadMyRecords();
    const updated = records.filter(r => r.id !== id);
    saveMyRecords(updated);
    renderMyRecordsUI();
  }
}

function viewMyRecordReceipt(id) {
  const records = loadMyRecords();
  const entry = records.find(r => r.id === id);
  if (entry) {
    showReceiptModal(entry);
  }
}

window.deleteMyRecord = deleteMyRecord;
window.viewMyRecordReceipt = viewMyRecordReceipt;

function clearMyRecords() {
  if (confirm("¿Estás seguro de que deseas limpiar todas las operaciones guardadas hoy en tu caja? Esta acción no afectará la auditoría del administrador.")) {
    saveMyRecords([]);
    renderMyRecordsUI();
  }
}

function renderMyRecordsUI() {
  const listEl = $("myRecordsList");
  if (!listEl) return;

  const records = loadMyRecords();
  const searchVal = ($("myRecordsSearch")?.value || "").trim().toLowerCase();
  const filterMode = $("myRecordsFilterMode")?.value || "all";

  const filtered = records.filter(item => {
    const status = item.status || "completada";
    if (filterMode === "pendiente" && status !== "pendiente") return false;
    if (filterMode === "completada" && status !== "completada") return false;
    if (filterMode === "cancelada" && status !== "cancelada") return false;

    if (filterMode === "cop_ves" && item.direction !== "cop_ves") return false;
    if (filterMode === "ves_cop" && item.direction !== "ves_cop") return false;

    if (searchVal) {
      const amtInStr = `${item.inputAmount} ${item.inputCurrency}`.toLowerCase();
      const amtOutStr = `${item.outputAmount} ${item.outputCurrency}`.toLowerCase();
      const idStr = String(item.id).toLowerCase();
      const sender = String(item.senderName || "").toLowerCase();
      const bene = String(item.beneficiaryName || "").toLowerCase();
      const bank = String(item.beneficiaryBank || "").toLowerCase();
      return idStr.includes(searchVal) || 
             amtInStr.includes(searchVal) || 
             amtOutStr.includes(searchVal) ||
             sender.includes(searchVal) ||
             bene.includes(searchVal) ||
             bank.includes(searchVal);
    }
    return true;
  });

  const count = records.length;
  let totalVolCop = 0;
  let totalProfitUsdt = 0;

  records.forEach(item => {
    // Only completed records count towards calculated totals
    if (item.status && item.status !== "completada") return;

    if (item.inputCurrency === "COP") {
      totalVolCop += item.inputAmount;
    } else if (item.outputCurrency === "COP") {
      totalVolCop += item.outputAmount;
    }
    
    if (item.profitCurrency === "USDT") {
      totalProfitUsdt += item.profit;
    }
  });

  setText("myRecCount", String(count));
  setText("myRecVolCop", totalVolCop > 0 ? money("COP", totalVolCop, 0) : "—");
  setText("myRecProfit", totalProfitUsdt > 0 ? money("USDT", totalProfitUsdt, 2) : "—");

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="hint" style="text-align:center; padding:30px; color:var(--muted)">No se encontraron registros de caja con los filtros actuales.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    const formattedDate = new Date(item.timestamp).toLocaleString("es-ES", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    });

    const isCopVes = item.direction === "cop_ves";
    const status = item.status || "completada";
    
    let tagHtml = "";
    let cardClass = "audit-card";
    if (status === "pendiente") {
      tagHtml = `<span class="badge-pending">PENDIENTE 🟠</span>`;
      cardClass = "audit-card pending";
    } else if (status === "cancelada") {
      tagHtml = `<span class="badge-cancelled">CANCELADA ❌</span>`;
    } else {
      tagHtml = `<span class="badge-completed">COMPLETADA ✓</span>`;
    }

    const directionBadge = `<span class="audit-tag ${isCopVes ? 'in' : 'out'}">${item.directionLabel}</span>`;

    let actionButtonsHtml = "";
    if (status === "pendiente") {
      actionButtonsHtml = `
        <button class="btn xs success" onclick="approvePendingRecord('${item.id}')" style="padding: 4px 10px; font-size:11px; border-radius:6px; background:rgba(36,193,106,0.15); color:var(--ok); border:none; cursor:pointer; font-weight:700;">✅ Completar</button>
        <button class="btn xs" onclick="rejectPendingRecord('${item.id}')" style="padding: 4px 10px; font-size:11px; border-radius:6px; background:rgba(255,90,106,0.1); color:var(--bad); border:none; cursor:pointer; font-weight:700;">❌ Cancelar</button>
      `;
    } else {
      actionButtonsHtml = `
        <button class="btn xs" onclick="viewMyRecordReceipt('${item.id}')" style="padding: 2px 8px; font-size:11px; border-radius:6px; background:rgba(78,161,255,0.12); color:var(--accent); border:none; cursor:pointer; font-weight:600;">🧾 Recibo</button>
        <button class="btn xs" onclick="deleteMyRecord('${item.id}')" style="padding: 2px 8px; font-size:11px; border-radius:6px; background:rgba(255,90,106,0.1); color:var(--bad); border:none; cursor:pointer;">Eliminar</button>
      `;
    }

    let viewReceiptBtn = "";
    if (item.receiptImage) {
      viewReceiptBtn = `
        <button class="btn xs" onclick="showImageLightbox('${item.id}')" style="padding: 2px 8px; font-size:11px; border-radius:6px; background:rgba(255,255,255,0.06); color:var(--text); border:1px solid var(--border); cursor:pointer; font-weight:600;">📸 Ver Pago</button>
      `;
    }

    let detailsHtml = "";
    if (item.senderName || item.beneficiaryName) {
      detailsHtml = `
        <div style="margin-top: 10px; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); font-size: 11px; display: flex; flex-direction: column; gap: 6px;">
          ${item.senderName ? `<div><span style="color:var(--muted);">Remitente:</span> <strong>${escapeHtml(item.senderName)}</strong> ${item.senderPhone ? `(<a href="https://wa.me/${item.senderPhone.replace(/[^0-9]/g, '')}" target="_blank" style="color:var(--ok);">${escapeHtml(item.senderPhone)}</a>)` : ''}</div>` : ''}
          ${item.beneficiaryName ? `
            <div>
              <span style="color:var(--muted);">Beneficiario:</span> <strong>${escapeHtml(item.beneficiaryName)}</strong> 
              <br/>
              <span style="color:var(--muted);">Banco:</span> ${escapeHtml(item.beneficiaryBank)} | 
              <span style="color:var(--muted);">Tipo:</span> ${escapeHtml(item.beneficiaryType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia')} | 
              <span style="color:var(--muted);">Doc:</span> ${escapeHtml(item.beneficiaryDocType)}-${escapeHtml(item.beneficiaryDoc)}
              <br/>
              <span style="color:var(--muted);">Cuenta/Celular:</span> <span class="mono" style="font-weight:700; color:var(--accent);">${escapeHtml(item.beneficiaryAccount)}</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <div class="${cardClass}">
        <div class="audit-card-header" style="align-items:center; gap: 8px; flex-wrap:wrap;">
          ${directionBadge}
          ${tagHtml}
          <span class="mono" style="font-size:11px; color:var(--muted);">${formattedDate}</span>
          <div style="margin-left:auto; display:flex; gap:6px; align-items:center;">
            ${viewReceiptBtn}
            ${actionButtonsHtml}
          </div>
        </div>
        <div class="audit-card-body" style="grid-template-columns: repeat(3, 1fr); margin-top:8px;">
          <div>
            <div style="font-size:10px; color:var(--muted);">Entrega</div>
            <div style="font-weight:700;">${isCopVes ? money("COP", item.inputAmount, 0) : (item.inputCurrency === "USD" ? money("USD", item.inputAmount, 2) : money("VES", item.inputAmount, 2))}</div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--muted);">Recibe</div>
            <div style="font-weight:700; color:var(--accent);">${money(item.outputCurrency, item.outputAmount, isCopVes ? 2 : 0)}</div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--muted);">Ganancia</div>
            <div style="font-weight:700; color:var(--ok);">${money("USDT", item.profit, 2)}</div>
          </div>
        </div>
        ${detailsHtml}
        <div style="margin-top:6px; font-size:10px; color:var(--muted); font-family:monospace; border-top:1px solid rgba(255,255,255,0.02); padding-top:4px;">
          ID: ${item.id} | Tasas: ${item.rates}
        </div>
      </div>
    `;
  }).join("");
}

function approvePendingRecord(id) {
  if (confirm(`¿Estás seguro de completar esta transacción ${id}? Se cambiará su estado a Completada y se abrirá el comprobante.`)) {
    const records = loadMyRecords();
    const entry = records.find(r => r.id === id);
    if (entry) {
      entry.status = "completada";
      saveMyRecords(records);
      renderMyRecordsUI();
      showReceiptModal(entry);
    }
  }
}

function rejectPendingRecord(id) {
  if (confirm(`¿Seguro que deseas rechazar/cancelar la transacción ${id}? Se guardará como Cancelada.`)) {
    const records = loadMyRecords();
    const entry = records.find(r => r.id === id);
    if (entry) {
      entry.status = "cancelada";
      saveMyRecords(records);
      renderMyRecordsUI();
    }
  }
}

function showImageLightbox(id) {
  const records = loadMyRecords();
  const entry = records.find(r => r.id === id);
  if (entry && entry.receiptImage) {
    const modal = $("imageLightboxModal");
    const img = $("lightboxImage");
    if (modal && img) {
      img.src = entry.receiptImage;
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
    }
  }
}

window.approvePendingRecord = approvePendingRecord;
window.rejectPendingRecord = rejectPendingRecord;
window.showImageLightbox = showImageLightbox;

function exportMyRecordsCSV() {
  const records = loadMyRecords();
  if (records.length === 0) {
    alert("No hay registros en tu caja para exportar.");
    return;
  }

  const headers = ["ID", "Fecha", "Direccion", "Monto Entrada", "Moneda Entrada", "Monto Salida", "Moneda Salida", "Ganancia (USDT)", "Estado", "Tasas Aplicadas"];
  const rows = [headers];

  records.forEach(item => {
    rows.push([
      item.id,
      item.timestamp,
      item.directionLabel,
      item.inputAmount,
      item.inputCurrency,
      item.outputAmount,
      item.outputCurrency,
      item.profit,
      item.status || "completada",
      `"${item.rates.replace(/"/g, '""')}"`
    ]);
  });

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `mi_caja_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function registerCurrentQuote() {
  const inCopVal = parseNum($("inCop")?.value);
  const msgEl = $("waMsg");
  if (!inCopVal || inCopVal <= 0) {
    if (msgEl) {
      msgEl.textContent = "Faltan datos de cálculo";
      msgEl.style.color = "var(--bad)";
    }
    return;
  }

  const main = calcMain({ paint: false });
  if (!main) return;
  const primaryInv = calcInverse(main);
  const active = getActiveQuote(main, primaryInv);
  if (!active || !active.cop || active.cop <= 0) {
    if (msgEl) {
      msgEl.textContent = "Completa los datos primero";
      msgEl.style.color = "var(--bad)";
    }
    return;
  }

  const entry = {
    id: "REG-" + Math.floor(100000 + Math.random() * 900000),
    timestamp: new Date().toISOString(),
    direction: "cop_ves",
    directionLabel: "COP ➔ VES",
    inputAmount: active.cop,
    inputCurrency: "COP",
    outputAmount: active.vesUsed,
    outputCurrency: "VES",
    profit: active.feeUsdt,
    profitCurrency: "USDT",
    status: "completada",
    rates: `USDT/COP: ${parseNum($("usdtCopBuy")?.value)} | USDT/VES: ${parseNum($("usdtVesSell")?.value)}`
  };

  addMyRecordEntry(entry);

  if (msgEl) {
    msgEl.textContent = "✓ ¡Operación registrada!";
    msgEl.style.color = "var(--ok)";
    setTimeout(() => { msgEl.textContent = ""; }, 2000);
  }
}

function registerCurrentVesToCop() {
  const inVesVal = parseNum($("inVes")?.value);
  const msgEl = $("vesWaMsg");
  if (!inVesVal || inVesVal <= 0) {
    if (msgEl) {
      msgEl.textContent = "Faltan datos de cálculo";
      msgEl.style.color = "var(--bad)";
    }
    return;
  }

  const isUsd = state.vesCurrency === "usd";
  const defaultUsdtCopSell = parseNum($("usdtCopSell")?.value);
  const customVesUsdtCopBuy = parseNum($("vesUsdtCopBuy")?.value);
  const vesUsdtCopBuy = customVesUsdtCopBuy || defaultUsdtCopSell || null;
  
  let rateVesPerUsd = null;
  if (isUsd) {
    rateVesPerUsd = 1.0;
  } else {
    const rateType = $("vesUsdRateType")?.value;
    if (rateType === "usdtVesBuy") {
      rateVesPerUsd = parseNum($("usdtVesBuy")?.value);
    } else if (rateType === "usdtVesSell") {
      rateVesPerUsd = parseNum($("usdtVesSell")?.value);
    } else if (rateType === "usdVesPar") {
      rateVesPerUsd = parseNum($("usdVesPar")?.value);
    } else if (rateType === "usdVesOf") {
      rateVesPerUsd = parseNum($("usdVesOf")?.value);
    } else if (rateType === "eurVes") {
      const eurVes = parseNum($("eurVes")?.value);
      const eurUsd = parseNum($("eurUsd")?.value);
      rateVesPerUsd = (eurVes > 0 && eurUsd > 0) ? (eurVes / eurUsd) : null;
    }
  }

  if (!rateVesPerUsd || !vesUsdtCopBuy) {
    if (msgEl) {
      msgEl.textContent = "Tasas incompletas";
      msgEl.style.color = "var(--bad)";
    }
    return;
  }

  const baseUsdt = isUsd ? inVesVal : (inVesVal / rateVesPerUsd);
  const vesFeeType = $("vesFeeType")?.value;
  const vesFeePct = parseNum($("vesFeePct")?.value) / 100;
  const vesFeeFixed = parseNum($("vesFeeFixed")?.value);
  const feeUsdt = vesFeeType === "pct" ? (baseUsdt * vesFeePct) : vesFeeFixed;
  const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
  const copReceived = netUsdt * vesUsdtCopBuy;

  const entry = {
    id: "REG-" + Math.floor(100000 + Math.random() * 900000),
    timestamp: new Date().toISOString(),
    direction: "ves_cop",
    directionLabel: isUsd ? "USD ➔ COP" : "VES ➔ COP",
    inputAmount: inVesVal,
    inputCurrency: isUsd ? "USD" : "VES",
    outputAmount: copReceived,
    outputCurrency: "COP",
    profit: feeUsdt,
    profitCurrency: "USDT",
    status: "completada",
    rates: `USDT/COP: ${vesUsdtCopBuy} | USDT/VES: ${rateVesPerUsd}`
  };

  addMyRecordEntry(entry);

  if (msgEl) {
    msgEl.textContent = "✓ ¡Operación registrada!";
    msgEl.style.color = "var(--ok)";
    setTimeout(() => { msgEl.textContent = ""; }, 2000);
  }
}

function wireMyRecordsTabEvents() {
  $("myRecordsSearch")?.addEventListener("input", renderMyRecordsUI);
  $("myRecordsFilterMode")?.addEventListener("change", renderMyRecordsUI);
  $("btnMyRecExport")?.addEventListener("click", exportMyRecordsCSV);
  $("btnMyRecClear")?.addEventListener("click", clearMyRecords);

  $("colRight")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "btnManualRegister") {
      registerCurrentQuote();
    }
  });

  $("btnManualRegisterVes")?.addEventListener("click", registerCurrentVesToCop);
}

// ---------- A1 & A2 CLIENT MODE MODULE ----------
const VENEZUELAN_BANKS = [
  "Banesco Banco Universal",
  "Banco de Venezuela",
  "Mercantil Banco",
  "BBVA Provincial",
  "Banco Nacional de Crédito (BNC)",
  "Bancamiga",
  "Banco Occidental de Descuento (BOD)",
  "Banco Exterior",
  "Banco Plaza",
  "Banco Sofitasa",
  "Bancrecer",
  "100% Banco",
  "DelSur",
  "Mi Banco",
  "Banplus"
];

const COLOMBIAN_BANKS = [
  "Bancolombia",
  "Nequi",
  "Daviplata",
  "Banco Davivienda",
  "Banco de Bogotá",
  "BBVA Colombia",
  "Banco de Occidente",
  "Banco Popular",
  "Banco AV Villas",
  "Banco Caja Social",
  "Banco GNB Sudameris",
  "Banco Falabella",
  "Banco Pichincha",
  "Scotiabank Colpatria",
  "Lulo Bank",
  "RappiPay"
];

// Active state for Client mode
state.activeClientDir = "cop_ves"; // default
state.uploadedReceiptBase64 = null;

function calcClientModeAmounts(isInputTriggered) {
  const isCopVes = state.activeClientDir === "cop_ves";
  const inEl = $("clientInAmount");
  const outEl = $("clientOutAmount");
  if (!inEl || !outEl) return;

  const usdtCopBuy = parseNum($("usdtCopBuy")?.value) || 0;
  const usdtVesSell = parseNum($("usdtVesSell")?.value) || 0;
  
  if (isCopVes) {
    const feeType = $("feeType")?.value || "pct";
    const feePct = parseNum($("feePct")?.value) / 100 || 0;
    const feeFixed = parseNum($("feeFixed")?.value) || 0;
    
    const usdViaEur = usdVesViaEur();
    const rateVesPerUsdt = (usdViaEur && usdViaEur > 0) ? usdViaEur : usdtVesSell;
    
    if (isInputTriggered) {
      const cop = parseNum(inEl.value);
      if (!cop || !usdtCopBuy || !rateVesPerUsdt) {
        outEl.value = "";
        $("clientRateVal").textContent = "—";
        return;
      }
      const baseUsdt = cop / usdtCopBuy;
      const feeUsdt = feeType === "pct" ? (baseUsdt * feePct) : feeFixed;
      const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
      const vesUsed = netUsdt * rateVesPerUsdt;
      outEl.value = Number.isFinite(vesUsed) ? vesUsed.toFixed(2) : "";
      
      const effectiveRate = vesUsed > 0 ? (cop / vesUsed) : 0;
      $("clientRateVal").textContent = effectiveRate > 0 ? `1 VES = ${effectiveRate.toFixed(2)} COP` : "—";
    } else {
      const targetVes = parseNum(outEl.value);
      if (!targetVes || !rateVesPerUsdt || !usdtCopBuy) {
        inEl.value = "";
        $("clientRateVal").textContent = "—";
        return;
      }
      const res = inverseCopForTargetVes(targetVes, rateVesPerUsdt, usdtCopBuy, feeType, feePct, feeFixed);
      if (res && res.cop) {
        inEl.value = res.cop.toFixed(0);
        const effectiveRate = targetVes > 0 ? (res.cop / targetVes) : 0;
        $("clientRateVal").textContent = effectiveRate > 0 ? `1 VES = ${effectiveRate.toFixed(2)} COP` : "—";
      } else {
        inEl.value = "";
      }
    }
  } else {
    const isUsd = state.vesCurrency === "usd";
    const defaultUsdtCopSell = parseNum($("usdtCopSell")?.value) || 0;
    const customVesUsdtCopBuy = parseNum($("vesUsdtCopBuy")?.value) || 0;
    const vesUsdtCopBuy = customVesUsdtCopBuy || defaultUsdtCopSell || 0;
    
    const vesFeeType = $("vesFeeType")?.value || "pct";
    const vesFeePct = parseNum($("vesFeePct")?.value) / 100 || 0;
    const vesFeeFixed = parseNum($("vesFeeFixed")?.value) || 0;
    
    let rateVesPerUsd = null;
    if (isUsd) {
      rateVesPerUsd = 1.0;
    } else {
      const rateType = $("vesUsdRateType")?.value || "usdtVesBuy";
      if (rateType === "usdtVesBuy") {
        rateVesPerUsd = parseNum($("usdtVesBuy")?.value) || 0;
      } else if (rateType === "usdtVesSell") {
        rateVesPerUsd = parseNum($("usdtVesSell")?.value) || 0;
      } else if (rateType === "usdVesPar") {
        rateVesPerUsd = parseNum($("usdVesPar")?.value) || 0;
      } else if (rateType === "usdVesOf") {
        rateVesPerUsd = parseNum($("usdVesOf")?.value) || 0;
      } else if (rateType === "eurVes") {
        const eurVes = parseNum($("eurVes")?.value) || 0;
        const eurUsd = parseNum($("eurUsd")?.value) || 0;
        rateVesPerUsd = (eurVes > 0 && eurUsd > 0) ? (eurVes / eurUsd) : 0;
      }
    }
    
    if (isInputTriggered) {
      const v = parseNum(inEl.value);
      if (!v || !rateVesPerUsd || !vesUsdtCopBuy) {
        outEl.value = "";
        $("clientRateVal").textContent = "—";
        return;
      }
      const baseUsdt = isUsd ? v : (v / rateVesPerUsd);
      const feeUsdt = vesFeeType === "pct" ? (baseUsdt * vesFeePct) : vesFeeFixed;
      const netUsdt = Math.max(baseUsdt - feeUsdt, 0);
      const copReceived = netUsdt * vesUsdtCopBuy;
      outEl.value = Number.isFinite(copReceived) ? copReceived.toFixed(0) : "";
      
      const effectiveRate = v > 0 ? (copReceived / v) : 0;
      $("clientRateVal").textContent = effectiveRate > 0 ? `1 ${isUsd ? 'USD' : 'VES'} = ${effectiveRate.toFixed(2)} COP` : "—";
    } else {
      const targetCop = parseNum(outEl.value);
      if (!targetCop || !vesUsdtCopBuy || !rateVesPerUsd) {
        inEl.value = "";
        $("clientRateVal").textContent = "—";
        return;
      }
      
      const netUsdtRequired = targetCop / vesUsdtCopBuy;
      let baseUsdtRequired = null;
      if (vesFeeType === "pct") {
        const k = 1 - vesFeePct;
        baseUsdtRequired = k > 0 ? (netUsdtRequired / k) : null;
      } else {
        baseUsdtRequired = netUsdtRequired + vesFeeFixed;
      }
      
      if (baseUsdtRequired && baseUsdtRequired > 0) {
        const vesRequired = isUsd ? baseUsdtRequired : (baseUsdtRequired * rateVesPerUsd);
        inEl.value = vesRequired.toFixed(2);
        const effectiveRate = vesRequired > 0 ? (targetCop / vesRequired) : 0;
        $("clientRateVal").textContent = effectiveRate > 0 ? `1 ${isUsd ? 'USD' : 'VES'} = ${effectiveRate.toFixed(2)} COP` : "—";
      } else {
        inEl.value = "";
      }
    }
  }
}

function updateClientModeUI() {
  const brand = getBranding();
  
  // Set branding title
  const brandNameText = brand.brand_name || "CAZEEXCHANGE";
  setText("clientBrandName", brandNameText);

  // Configure views based on step
  const steps = ["Calculator", "Checkout", "Success"];
  steps.forEach(s => {
    const el = $("clientStep" + s);
    if (el) {
      if (state.clientStep === s.toLowerCase()) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    }
  });

  // Calculate & Refresh amounts
  calcClientModeAmounts(true);

  // Hydrate Bank dropdowns and Labels depending on Direction
  const isCopVes = state.activeClientDir === "cop_ves";
  const inBadge = $("clientInCurrencyBadge");
  const outBadge = $("clientOutCurrencyBadge");
  const sendLbl = $("lblClientSend");
  const receiveLbl = $("lblClientReceive");

  if (isCopVes) {
    if (inBadge) inBadge.textContent = "COP";
    if (outBadge) outBadge.textContent = "VES";
    if (sendLbl) sendLbl.textContent = "Tú envías (Pesos Colombianos)";
    if (receiveLbl) receiveLbl.textContent = "Tu beneficiario recibe (Bolívares Digitales)";
  } else {
    const isUsd = state.vesCurrency === "usd";
    if (inBadge) inBadge.textContent = isUsd ? "USD" : "VES";
    if (outBadge) outBadge.textContent = "COP";
    if (sendLbl) sendLbl.textContent = isUsd ? "Tú envías (Dólares USD)" : "Tú envías (Bolívares Digitales)";
    if (receiveLbl) receiveLbl.textContent = "Tu beneficiario recibe (Pesos Colombianos)";
  }
}

function handleReceiptUpload(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Por favor, sube solo archivos de imagen (PNG, JPG, JPEG).");
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    state.uploadedReceiptBase64 = e.target.result;
    const previewEl = $("receiptFilePreview");
    if (previewEl) {
      previewEl.innerHTML = `
        <div style="display:inline-block; position:relative; margin-top:10px;">
          <img src="${state.uploadedReceiptBase64}" style="max-width:140px; max-height:100px; border-radius:8px; border:1px solid var(--border);" />
          <button id="btnRemoveReceipt" class="btn xs" style="position:absolute; top:-5px; right:-5px; border-radius:50%; width:20px; height:20px; padding:0; line-height:1; background:var(--bad); color:#fff; border:none; cursor:pointer;" type="button">&times;</button>
        </div>
      `;
      $("btnRemoveReceipt")?.addEventListener("click", () => {
        state.uploadedReceiptBase64 = null;
        previewEl.innerHTML = "";
      });
    }
  };
  reader.readAsDataURL(file);
}

function wireClientModeEvents() {
  // Toggle buttons
  $("btnToggleClientMode")?.addEventListener("click", () => {
    $("operatorView")?.classList.add("hidden");
    $("clientView")?.classList.remove("hidden");
    state.clientMode = true;
    state.clientStep = "calculator";
    updateClientModeUI();
  });

  $("btnExitClientMode")?.addEventListener("click", () => {
    $("clientView")?.classList.add("hidden");
    $("operatorView")?.classList.remove("remove-glass"); // just remove class safely
    $("operatorView")?.classList.remove("hidden");
    state.clientMode = false;
  });

  // Lightbox Close
  $("btnLightboxClose")?.addEventListener("click", () => {
    const modal = $("imageLightboxModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  });

  // Directions
  $("btnClientDirCopVes")?.addEventListener("click", () => {
    $("btnClientDirCopVes")?.classList.add("active");
    $("btnClientDirVesCop")?.classList.remove("active");
    state.activeClientDir = "cop_ves";
    updateClientModeUI();
  });

  $("btnClientDirVesCop")?.addEventListener("click", () => {
    $("btnClientDirVesCop")?.classList.add("active");
    $("btnClientDirCopVes")?.classList.remove("active");
    state.activeClientDir = "ves_cop";
    updateClientModeUI();
  });

  // Live input changes
  $("clientInAmount")?.addEventListener("input", () => calcClientModeAmounts(true));
  $("clientOutAmount")?.addEventListener("input", () => calcClientModeAmounts(false));

  // Step 1 ➔ Step 2 (Next)
  $("btnClientNext")?.addEventListener("click", () => {
    const inVal = parseNum($("clientInAmount")?.value);
    const outVal = parseNum($("clientOutAmount")?.value);
    if (!inVal || inVal <= 0 || !outVal || outVal <= 0) {
      alert("Por favor, ingresa un monto válido antes de continuar.");
      return;
    }

    // Go to step 2
    state.clientStep = "checkout";
    updateClientModeUI();

    // Hydrate checkout summary
    const isCopVes = state.activeClientDir === "cop_ves";
    const isUsd = state.vesCurrency === "usd";
    const inCur = isCopVes ? "COP" : (isUsd ? "USD" : "VES");
    const outCur = isCopVes ? "VES" : "COP";
    setText("clientCheckoutSummaryText", `${fmt(inVal, isCopVes ? 0 : 2)} ${inCur} ➔ ${fmt(outVal, isCopVes ? 2 : 0)} ${outCur}`);

    // Populate receiver details instructions depending on direction
    const brand = getBranding();
    const accountsEl = $("clientReceiverAccounts");
    if (accountsEl) {
      if (isCopVes) {
        // We receive COP
        accountsEl.innerHTML = brand.receive_cop 
          ? escapeHtml(brand.receive_cop).replace(/\n/g, "<br/>") 
          : "<strong>Bancolombia Ahorros Nro 123-456789-01</strong><br/>Titular: CazeExchange SAS";
      } else {
        // We receive VES
        accountsEl.innerHTML = brand.receive_ves 
          ? escapeHtml(brand.receive_ves).replace(/\n/g, "<br/>") 
          : "<strong>Pago Móvil Banesco (0412-1234567)</strong><br/>Cédula: V-12345678";
      }
    }

    // Populate recipient banks dynamically based on receiving side
    const selectBank = $("checkoutBeneBank");
    if (selectBank) {
      selectBank.innerHTML = "";
      const activeBanks = isCopVes ? VENEZUELAN_BANKS : COLOMBIAN_BANKS;
      activeBanks.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        selectBank.appendChild(opt);
      });
    }

    // Adapt document labels if receiving in COP
    const beneDocLabel = $("lblCheckoutBeneDoc");
    const docTypeSelect = $("checkoutBeneDocType");
    const accountLabel = $("lblCheckoutBeneAccount");
    const accountHint = $("checkoutBeneAccountHint");

    if (isCopVes) {
      // Destination Venezuela: standard Cedula and Account/Pago Movil details
      if (beneDocLabel) beneDocLabel.textContent = "Documento Beneficiario (Cédula / RIF)";
      if (docTypeSelect) docTypeSelect.style.display = "inline-block";
      if (accountLabel) accountLabel.textContent = "Número de Celular (Pago Móvil) o Cuenta Bancaria (20 dígitos)";
      if (accountHint) accountHint.textContent = "Pago Móvil: Solo Nro de Celular. Transferencia: Cuenta Completa de 20 dígitos.";
    } else {
      // Destination Colombia: standard CC/NIT/Nequi/Daviplata details
      if (beneDocLabel) beneDocLabel.textContent = "Tipo y Nro Documento Beneficiario (CC / NIT / CE)";
      if (docTypeSelect) docTypeSelect.style.display = "none"; // free text document is simpler for Colombian bank CC input
      if (accountLabel) accountLabel.textContent = "Número de Cuenta o Celular (Nequi / Daviplata)";
      if (accountHint) accountHint.textContent = "Escribe el número de celular o número de cuenta de ahorros/corriente.";
    }
  });

  // Step 2 ➔ Step 1 (Back)
  $("btnClientBackToCalc")?.addEventListener("click", () => {
    state.clientStep = "calculator";
    updateClientModeUI();
  });

  // File Input and Drag-and-Drop Dropzone Setup
  const dropzone = $("receiptDropzone");
  const fileInput = $("receiptFileInput");

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleReceiptUpload(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleReceiptUpload(e.target.files[0]);
      }
    });
  }

  // Registering transaction from client view (Submit Step 2)
  $("btnClientSubmit")?.addEventListener("click", () => {
    const senderName = $("checkoutSenderName")?.value.trim();
    const senderPhone = $("checkoutSenderPhone")?.value.trim();
    const beneBank = $("checkoutBeneBank")?.value;
    const beneType = $("checkoutBeneType")?.value;
    const beneDocType = $("checkoutBeneDocType")?.value;
    const beneDoc = $("checkoutBeneDoc")?.value.trim();
    const beneAccount = $("checkoutBeneAccount")?.value.trim();
    const beneName = $("checkoutBeneName")?.value.trim();

    if (!senderName || !senderPhone || !beneName || !beneAccount) {
      alert("Por favor, completa los campos obligatorios del beneficiario y remitente.");
      return;
    }

    if (state.activeClientDir === "cop_ves" && beneAccount.length !== 10 && beneAccount.length !== 20) {
      // Validation for Venezuela accounts
      if (beneType === "pago_movil" && beneAccount.length !== 10) {
        alert("Para Pago Móvil en Venezuela, el número de celular debe ser de 10 dígitos (ej: 4121234567).");
        return;
      }
      if (beneType === "transferencia" && beneAccount.length !== 20) {
        alert("Para Transferencia Bancaria en Venezuela, la cuenta de banco debe constar de 20 dígitos.");
        return;
      }
    }

    // Read details from calculator
    const inVal = parseNum($("clientInAmount")?.value);
    const outVal = parseNum($("clientOutAmount")?.value);
    const isCopVes = state.activeClientDir === "cop_ves";
    const isUsd = state.vesCurrency === "usd";
    const inCur = isCopVes ? "COP" : (isUsd ? "USD" : "VES");
    const outCur = isCopVes ? "VES" : "COP";

    // Generate simulated profit & rates
    let profit = 0;
    let ratesAppliedStr = "";
    if (isCopVes) {
      const main = calcMain({ paint: false });
      profit = main ? main.feeUsdt : 0;
      ratesAppliedStr = `USDT/COP: ${parseNum($("usdtCopBuy")?.value)} | USDT/VES: ${parseNum($("usdtVesSell")?.value)}`;
    } else {
      const defaultUsdtCopSell = parseNum($("usdtCopSell")?.value) || 0;
      const customVesUsdtCopBuy = parseNum($("vesUsdtCopBuy")?.value) || 0;
      const vesUsdtCopBuy = customVesUsdtCopBuy || defaultUsdtCopSell || 0;
      
      let rateVesPerUsd = 1.0;
      if (!isUsd) {
        const rateType = $("vesUsdRateType")?.value || "usdtVesBuy";
        rateVesPerUsd = parseNum($(rateType)?.value) || parseNum($("usdtVesBuy")?.value) || 0;
      }
      const baseUsdt = isUsd ? inVal : (inVal / rateVesPerUsd);
      const vesFeeType = $("vesFeeType")?.value || "pct";
      const vesFeePct = parseNum($("vesFeePct")?.value) / 100 || 0;
      const vesFeeFixed = parseNum($("vesFeeFixed")?.value) || 0;
      profit = vesFeeType === "pct" ? (baseUsdt * vesFeePct) : vesFeeFixed;
      ratesAppliedStr = `USDT/COP: ${vesUsdtCopBuy} | USDT/VES: ${rateVesPerUsd}`;
    }

    // Build the beautiful complete record object
    const ticketId = "REG-" + Math.floor(100000 + Math.random() * 900000);
    const entry = {
      id: ticketId,
      timestamp: new Date().toISOString(),
      direction: state.activeClientDir,
      directionLabel: isCopVes ? "COP ➔ VES" : (isUsd ? "USD ➔ COP" : "VES ➔ COP"),
      inputAmount: inVal,
      inputCurrency: inCur,
      outputAmount: outVal,
      outputCurrency: outCur,
      profit: profit,
      profitCurrency: "USDT",
      status: "pendiente", // ALWAYS PENDING FOR MODERATION
      rates: ratesAppliedStr,
      
      // Extended Client details
      senderName,
      senderPhone,
      beneficiaryBank: beneBank,
      beneficiaryType: beneType,
      beneficiaryDocType: isCopVes ? beneDocType : "CC",
      beneficiaryDoc,
      beneficiaryAccount: beneAccount,
      beneficiaryName: beneName,
      receiptImage: state.uploadedReceiptBase64
    };

    // Store in local storage & sync to server!
    addMyRecordEntry(entry);
    renderMyRecordsUI();

    // Fill Step 3: Success tickets
    setText("successTicketId", entry.id);
    setText("successSender", entry.senderName);
    setText("successPhone", entry.senderPhone);
    setText("successSendAmount", `${fmt(entry.inputAmount, isCopVes ? 0 : 2)} ${entry.inputCurrency}`);
    setText("successReceiveAmount", `${fmt(entry.outputAmount, isCopVes ? 2 : 0)} ${entry.outputCurrency}`);
    setText("successBeneName", entry.beneficiaryName);
    setText("successBeneBank", entry.beneficiaryBank);
    setText("successBeneAccount", entry.beneficiaryAccount);
    setText("successBeneDoc", isCopVes ? `${entry.beneficiaryDocType}-${entry.beneficiaryDoc}` : entry.beneficiaryDoc);
    setText("successTicketDate", `Fecha: ${new Date(entry.timestamp).toLocaleString("es-ES")}`);

    // Go to Success
    state.clientStep = "success";
    updateClientModeUI();
  });

  // Share via WhatsApp
  $("btnClientWhatsappShare")?.addEventListener("click", () => {
    const isCopVes = state.activeClientDir === "cop_ves";
    const isUsd = state.vesCurrency === "usd";
    const inCur = isCopVes ? "COP" : (isUsd ? "USD" : "VES");
    const outCur = isCopVes ? "VES" : "COP";

    const ticketId = $("successTicketId")?.textContent || "";
    const sender = $("successSender")?.textContent || "";
    const phone = $("successPhone")?.textContent || "";
    const sendAmt = $("successSendAmount")?.textContent || "";
    const recAmt = $("successReceiveAmount")?.textContent || "";
    const bene = $("successBeneName")?.textContent || "";
    const bank = $("successBeneBank")?.textContent || "";
    const acc = $("successBeneAccount")?.textContent || "";
    const doc = $("successBeneDoc")?.textContent || "";

    const brand = getBranding();
    const brandName = brand.brand_name || "CAZEEXCHANGE";

    // Format professional structured WhatsApp message
    const msg = `🔔 *NUEVA SOLICITUD DE REMESA - ${brandName}* 🔔\n` +
                `----------------------------------------\n` +
                `*ID de Operación:* \`${ticketId}\`\n` +
                `*Estado:* 🟠 Pendiente por Aprobación\n\n` +
                `👤 *Remitente:* ${sender}\n` +
                `📞 *Teléfono:* ${phone}\n\n` +
                `💸 *Monto Transferido:* ${sendAmt}\n` +
                `📥 *Monto a Recibir:* ${recAmt}\n\n` +
                `🏦 *Detalles Destinatario:*\n` +
                `• *Nombre:* ${bene}\n` +
                `• *Documento:* ${doc}\n` +
                `• *Banco:* ${bank}\n` +
                `• *Nro Cuenta/Celular:* ${acc}\n` +
                `----------------------------------------\n` +
                `📱 _He cargado mi comprobante de pago en el sistema. Quedo atento a la confirmación de la transferencia._`;

    const encodedText = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, "_blank");
  });

  // Reset & New quote
  $("btnClientNewQuote")?.addEventListener("click", () => {
    // Clear calculator inputs
    const inEl = $("clientInAmount");
    const outEl = $("clientOutAmount");
    if (inEl) inEl.value = "";
    if (outEl) outEl.value = "";
    
    // Clear receipt
    state.uploadedReceiptBase64 = null;
    const previewEl = $("receiptFilePreview");
    if (previewEl) previewEl.innerHTML = "";
    
    // Go to Step 1
    state.clientStep = "calculator";
    updateClientModeUI();
  });
}

// Bootstrap Auth + Professional Setup
bootstrapAuth().finally(() => {
  hydrateAdjUI();
  updateRates();
  
  // Setup PWA
  setupPWAEvents();

  // Setup Live Rates Interval
  setupLiveRates();

  // Setup Audit logs UI
  wireHistoryTabEvents();
  renderHistoryUI();

  // Setup My Records UI
  wireMyRecordsTabEvents();
  renderMyRecordsUI();

  // Setup A1 & A2 Client Mode
  wireClientModeEvents();
});

