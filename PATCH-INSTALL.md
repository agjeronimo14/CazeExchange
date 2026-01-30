# CazeExchange — PATCH Branding Completo (por usuario)

DB remoto: **cazeexchange_db**  
Binding en Pages Functions: **DB**

## Qué incluye

1) **Branding por usuario** (editable)
- `brand_name` (alias que sale en la imagen exportada y en el header)
- `accent` (color principal)
- `theme` (tema predefinido)

2) **Endpoint nuevo**
- `GET /api/branding` (devuelve branding del usuario)
- `POST /api/branding` (guarda branding del usuario)

3) **/api/me** ahora devuelve también `branding` (si existe la columna en D1). Si no, usa defaults y **no rompe prod**.

4) **Status PRO de tasas**
- `/api/rates` incluye:
  - `quality: primary | approx | missing`
  - `fallback_rates: []`
  - `sources_detail: { bcv, parallel, usdt_cop, usdt_ves }`
- En UI se muestra badge **“Tasas: OK / aprox / faltan”** + tooltip.

---

## 1) Copiar/pegar archivos (patch)

Este ZIP trae **SOLO archivos nuevos/modificados**.

1. Ve a la raíz del proyecto (donde están `src/`, `functions/`, `migrations/`).
2. Copia y **sobrescribe** respetando la estructura de carpetas.

Archivos incluidos:
- `src/main.js`
- `src/style.css`
- `functions/api/rates.js`
- `functions/api/me.js`
- `functions/api/branding.js` (nuevo)
- `functions/_lib/branding.js` (nuevo)
- `functions/_lib/http.js`
- `migrations/0002_branding.sql` (nuevo)

---

## 2) Migración D1 (OBLIGATORIA para guardar branding)

Esta migración agrega la columna `brand_json` a `user_settings`.

Desde la raíz del proyecto:

```bash
npx wrangler d1 migrations apply cazeexchange_db --remote
```

> Si ya aplicaste esta migración antes, Wrangler la va a marcar como aplicada (no se repite).

---

## 3) Deploy

### Si usas Git + Cloudflare Pages
```bash
git checkout -b patch/branding
# (copia/pega archivos)
git add -A
git commit -m "PRO: branding por usuario + status tasas"
git push -u origin patch/branding
```
Luego haces merge a tu branch de producción (según tu flujo).

### Verificación rápida en producción
- Abre el sitio y haz login.
- En **Tasas → Branding**, cambia `Nombre de marca` y guarda.
- Exporta imagen: debe salir tu marca en el banner.

---

## 4) Notas importantes

- En **modo demo** puedes **previsualizar** cambios de branding, pero **NO guarda en server**.
- Si al guardar branding te aparece error `Branding not ready (apply D1 migration)`, aplica la migración del paso 2.
- El badge de tasas usa `quality` y `sources_detail` si existen; si no, cae a modo legacy.

---

## 5) Rollback

Si algo sale mal:
```bash
git reset --hard <commit_anterior>
# y redeploy desde Pages
```

