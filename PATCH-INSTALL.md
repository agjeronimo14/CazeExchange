# CazeExchange PATCH - Export 0B fix

This patch fixes **0-byte exported PNG files** when the user clicks **Exportar imagen** while not being on the **Resumen** tab.

## Why it happened
The export element (`#poster`) lives inside the **Resumen** tab. When the user is on another tab (e.g. **Tasas** / Branding), that section is `display:none`, so `html2canvas()` renders a **0x0 canvas**, and Chrome saves a **0B** file.

## What this patch does
- Temporarily switches to the **Resumen** tab during export
- Waits for layout to paint
- Exports using `canvas.toBlob()` (more reliable than huge data URLs)
- Restores the previous tab after export

## Install
1) Copy/replace this file in your project:
- `src/main.js`

2) No D1 migration needed.

3) Deploy as usual.
