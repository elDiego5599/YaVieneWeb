/**
 * Deriva del hero — el trío de teléfonos baja un poco al hacer scroll,
 * como si se quedara atrás mientras la copia sube. Es lo que le da peso
 * a la primera pantalla: sin esto, copia y escena se mueven pegadas y el
 * hero se lee plano.
 *
 * Sólo `transform` con píxeles enteros (capa del compositor, sin
 * re-layout), como mucho 56 px y únicamente mientras el hero se ve: fuera
 * de pantalla no se trabaja. Con `prefers-reduced-motion` no se enciende.
 */
const FACTOR = 0.07;
const TOPE = 56;

export function encenderDerivaHero(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const panel = document.querySelector<HTMLElement>('.hero-panel');
  const escena = panel?.querySelector<HTMLElement>('.hero-scene');
  if (!panel || !escena) return;

  let turno = 0;
  const medir = (): void => {
    turno = 0;
    const caja = panel.getBoundingClientRect();
    // Fuera de la ventana: se suelta la variable y no se toca nada más.
    if (caja.bottom <= 0 || caja.top >= window.innerHeight) {
      escena.style.setProperty('--hero-deriva', '0');
      return;
    }
    const bajado = Math.min(Math.max(-caja.top, 0) * FACTOR, TOPE);
    escena.style.setProperty('--hero-deriva', `${Math.round(bajado)}`);
  };
  const alDesplazar = (): void => {
    if (turno !== 0) return;
    turno = window.requestAnimationFrame(medir);
  };
  window.addEventListener('scroll', alDesplazar, { passive: true });
  medir();
}
