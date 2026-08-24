"# CazeExchange" 


## SaaS (Cloudflare Pages + Functions + D1)

### Bindings requeridos
- D1: **DB** (D1 database)

### Migraciones (D1)
1) Crea la DB en Cloudflare y aplica la migración `migrations/0001_init.sql`.

Ejemplo con wrangler (local o remote):
- Local (recomendado para dev):
  - `wrangler d1 create cazeexchange`
  - `wrangler d1 migrations apply cazeexchange --local`

- Remote:
  - `wrangler d1 migrations apply cazeexchange`

> Nota: en Cloudflare Pages también debes configurar el binding D1 `DB` en el Dashboard.

### Endpoints
- `POST /api/bootstrap` (solo 1 vez, cuando DB está vacía)
- `POST /api/login`
- `POST /api/logout`
- `GET  /api/me`
- `GET  /api/settings`
- `PUT  /api/settings`
- `GET  /api/admin/users` (admin)
- `POST /api/admin/create-user` (admin)
- `POST /api/admin/update-user` (admin)
- `POST /api/admin/renew-user` (admin, acumula dÃ­as al plan)
- `POST /api/admin/reset-password` (admin)
- `POST /api/register` (solicitud pÃºblica; no crea una cuenta automÃ¡ticamente)

### Solicitudes de acceso por correo
La portada pÃºblica guarda cada solicitud en D1. Para recibir ademÃ¡s una notificaciÃ³n por correo:

1) Aplica tambiÃ©n la migraciÃ³n `migrations/0003_registration_requests.sql` a la base remota.
2) Activa **Cloudflare Email Sending** con un dominio remitente verificado en Cloudflare.
3) En los bindings de Pages agrega el binding de Email con el nombre `EMAIL`.
4) En las variables de producciÃ³n configura `REGISTRATION_NOTIFY_EMAIL` (tu correo receptor) y `NOTIFICATION_FROM_EMAIL` (el remitente verificado).

Si el correo no estÃ¡ configurado, la solicitud se guarda igualmente y el visitante recibe confirmaciÃ³n. Antes de abrir el registro a campaÃ±as pagadas, aÃ±ade Turnstile al formulario para frenar envÃ­os automatizados.

### Desarrollo local (recomendado)
Para probar **cookies/sesiones** localmente, usa Pages Dev (sirve estáticos + Functions + D1):
1) `npm install`
2) `npm run build`
3) `wrangler pages dev ./dist --d1=DB --local`

Luego abre el URL que te muestre wrangler.

### Modo demo
Si no hay sesión, la app abre el modal de login y permite **Demo** (sin exportar imagen).
