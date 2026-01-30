// Branding helpers (server-side)

export const DEFAULT_BRANDING = {
  theme: "ocean",
  accent: "#4ea1ff",
  brand_name: "CAZEEXCHANGE",
};

function isHexColor(s) {
  return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s.trim());
}

export function normalizeBranding(input) {
  const b = (input && typeof input === "object") ? input : {};
  const theme = String(b.theme || DEFAULT_BRANDING.theme);
  const accentRaw = String(b.accent || DEFAULT_BRANDING.accent).trim();
  const accent = isHexColor(accentRaw) ? accentRaw : DEFAULT_BRANDING.accent;

  let brand_name = String(b.brand_name || DEFAULT_BRANDING.brand_name).trim();
  if (!brand_name) brand_name = DEFAULT_BRANDING.brand_name;
  if (brand_name.length > 32) brand_name = brand_name.slice(0, 32);

  return { theme, accent, brand_name };
}

export function parseBrandJson(s) {
  if (!s) return null;
  try {
    const obj = JSON.parse(String(s));
    return normalizeBranding(obj);
  } catch {
    return null;
  }
}
