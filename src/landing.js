import "./landing.css";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char]));

function openApp({ login = false } = {}) {
  window.location.hash = "app";
  window.dispatchEvent(new CustomEvent("caze:open-app", { detail: { login } }));
}

export function mountLanding(mount) {
  if (!mount) return;

  mount.innerHTML = `
    <main class="landing">
      <header class="landingNav">
        <a class="landingBrand" href="#inicio" aria-label="CazeExchange, inicio">
          <span class="landingMark" aria-hidden="true">C</span>
          <span>CAZE<span>EXCHANGE</span></span>
        </a>
        <div class="landingNavActions">
          <button class="landingTextButton" type="button" data-action="login">Ingresar</button>
          <button class="landingButton landingButtonSmall" type="button" data-action="register">Solicitar acceso</button>
        </div>
      </header>

      <section id="inicio" class="landingHero">
        <div class="landingHeroCopy">
          <p class="landingEyebrow"><span></span> Cotización operativa COP ↔ VES</p>
          <h1>Cotiza en segundos.<br /><em>Responde con confianza.</em></h1>
          <p class="landingLead">CazeExchange ayuda a operadores a calcular remesas, aplicar su margen y enviar una cotización clara por WhatsApp sin hojas de cálculo ni cálculos manuales.</p>
          <div class="landingCtas">
            <button class="landingButton" type="button" data-action="register">Probar CazeExchange <span aria-hidden="true">→</span></button>
            <button class="landingSecondaryButton" type="button" data-action="login">Ya tengo acceso</button>
          </div>
          <p class="landingReassurance">Acceso controlado · Tasas visibles · Diseñado para móvil</p>
        </div>

        <div class="landingPreview" aria-label="Vista previa de una cotización">
          <div class="landingPreviewTop">
            <span class="landingPreviewBrand">CAZEEXCHANGE</span>
            <span class="landingLive"><i></i> Actualizado ahora</span>
          </div>
          <div class="landingPreviewDirection">COP <span>→</span> VES</div>
          <div class="landingPreviewAmounts">
            <div><small>El cliente entrega</small><strong>1.000.000 <span>COP</span></strong></div>
            <div class="landingPreviewArrow">→</div>
            <div><small>El beneficiario recibe</small><strong>281.55 <span>VES</span></strong></div>
          </div>
          <div class="landingPreviewRate"><span>Tasa aplicada</span><b>COP 3.552 / USDT</b></div>
          <button type="button" class="landingWhatsAppPreview"><span aria-hidden="true">⌁</span> Enviar cotización por WhatsApp</button>
        </div>
      </section>

      <section class="landingSection landingValueSection">
        <div class="landingSectionIntro">
          <p class="landingEyebrow"><span></span> Hecho para el momento de vender</p>
          <h2>Menos pasos entre la pregunta y tu respuesta.</h2>
        </div>
        <div class="landingFeatures">
          <article>
            <span class="landingFeatureIcon">01</span>
            <h3>Cotización inmediata</h3>
            <p>Ingresa el monto o el objetivo del cliente. El sistema calcula el otro valor y tu margen automáticamente.</p>
          </article>
          <article>
            <span class="landingFeatureIcon">02</span>
            <h3>Tasas bajo control</h3>
            <p>Consulta la hora y calidad de la tasa. Ajusta tu margen sin perder claridad sobre el valor mostrado.</p>
          </article>
          <article>
            <span class="landingFeatureIcon">03</span>
            <h3>WhatsApp listo</h3>
            <p>Comparte una respuesta profesional y consistente sin copiar números, recálculos ni mensajes incompletos.</p>
          </article>
        </div>
      </section>

      <section class="landingFlow">
        <div>
          <p class="landingEyebrow"><span></span> Así funciona</p>
          <h2>Tu flujo diario,<br />más simple.</h2>
        </div>
        <ol>
          <li><span>1</span><div><b>Actualiza las tasas</b><p>Conoce su calidad antes de cotizar.</p></div></li>
          <li><span>2</span><div><b>Calcula el envío</b><p>Por monto entregado o por objetivo de recepción.</p></div></li>
          <li><span>3</span><div><b>Comparte y confirma</b><p>Envía la cotización lista por WhatsApp.</p></div></li>
        </ol>
      </section>

      <section class="landingRoadmap">
        <div>
          <p class="landingEyebrow"><span></span> Evolución continua</p>
          <h2>Construido alrededor de lo que realmente usan los operadores.</h2>
        </div>
        <div class="landingRoadmapList">
          <span>Historial automático de cotizaciones</span>
          <span>Enlaces personalizados para clientes</span>
          <span>Equipos, permisos y reportes Pro</span>
          <span>Solicitudes de acceso y activación rápida</span>
        </div>
      </section>

      <footer class="landingFooter">
        <span>© ${new Date().getFullYear()} CazeExchange</span>
        <button class="landingTextButton" type="button" data-action="login">Acceso de clientes</button>
      </footer>
    </main>

    <div class="landingModal hidden" id="registrationModal" role="dialog" aria-modal="true" aria-labelledby="registrationTitle">
      <div class="landingModalCard">
        <button class="landingModalClose" type="button" data-action="close-register" aria-label="Cerrar">×</button>
        <p class="landingEyebrow"><span></span> Solicitar acceso</p>
        <h2 id="registrationTitle">Prueba CazeExchange</h2>
        <p>Cuéntanos quién eres. Te contactaremos para activar tu cuenta de prueba.</p>
        <form id="registrationForm" class="landingForm">
          <label>Nombre y apellido<input name="full_name" required maxlength="80" autocomplete="name" placeholder="Tu nombre" /></label>
          <label>WhatsApp<input name="whatsapp" required maxlength="25" inputmode="tel" autocomplete="tel" placeholder="+57 300 000 0000" /></label>
          <label>Correo <small>(opcional)</small><input name="email" maxlength="120" inputmode="email" autocomplete="email" placeholder="tu@correo.com" /></label>
          <label>Negocio <small>(opcional)</small><input name="business_name" maxlength="100" placeholder="Nombre de tu negocio" /></label>
          <label class="landingFormFull">¿Qué necesitas cotizar?<textarea name="message" maxlength="500" placeholder="Cuéntanos brevemente cómo trabajas hoy."></textarea></label>
          <input class="landingHoneypot" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <button class="landingButton" type="submit">Enviar solicitud <span aria-hidden="true">→</span></button>
          <p id="registrationMessage" class="landingFormMessage" aria-live="polite"></p>
        </form>
      </div>
    </div>
  `;

  const modal = mount.querySelector("#registrationModal");
  const message = mount.querySelector("#registrationMessage");
  const form = mount.querySelector("#registrationForm");

  const showRegistration = () => {
    modal?.classList.remove("hidden");
    modal?.querySelector('input[name="full_name"]')?.focus();
  };
  const closeRegistration = () => {
    modal?.classList.add("hidden");
    if (message) message.textContent = "";
  };

  mount.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "login") openApp({ login: true });
      if (action === "register") showRegistration();
      if (action === "close-register") closeRegistration();
    });
  });

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeRegistration();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    if (message) message.textContent = "Enviando solicitud…";

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "No se pudo enviar la solicitud");
      form.reset();
      if (message) message.textContent = "¡Solicitud recibida! Te contactaremos pronto por WhatsApp o correo.";
    } catch (error) {
      if (message) message.textContent = `Error: ${escapeHtml(error?.message || "Intenta nuevamente")}`;
    }
  });
}
