/**
 * arrastrable — agarrar un elemento y llevarlo con el puntero.
 *
 * Es sólo el gesto, sin saber qué se arrastra: el que lo usa recibe el
 * evento de cada momento y decide qué mover.
 *
 * - Al apoyar (`pointerdown`) avisa en el acto: el feedback no espera a que
 *   haya movimiento ni a que se suelte.
 * - Captura el puntero, así el seguimiento no se pierde si el dedo o el
 *   ratón se salen del elemento (el pin mide 44 px y el dedo es rápido).
 * - Hasta pasar el umbral (10 px, como el resto de gestos) no es un
 *   arrastre sino un toque con temblor. Pasado, lo es hasta que se suelte,
 *   aunque se vuelva cerca del origen.
 * - Sólo el puntero primario con el botón principal: un segundo dedo o el
 *   botón derecho no lo arrastran.
 */

export interface OpcionesArrastre {
  /** Umbral en píxeles de pantalla antes de comprometerse con el arrastre. */
  umbral?: number;
  /** Al apoyar, antes de saber si será toque o arrastre. */
  alAgarrar(evento: PointerEvent): void;
  /** En cada movimiento, ya comprometido. */
  alMover(evento: PointerEvent): void;
  /** Al levantar; `arrastro` dice si hubo arrastre o fue un toque. */
  alSoltar(evento: PointerEvent, arrastro: boolean): void;
  /** El navegador se llevó el gesto (p. ej. para desplazar la página). */
  alCancelar(evento: PointerEvent): void;
}

export function arrastrable(el: Element, o: OpcionesArrastre): void {
  const umbral = o.umbral ?? 10;
  let id: number | null = null;
  let x0 = 0;
  let y0 = 0;
  let comprometido = false;

  const suyo = (e: PointerEvent): boolean => id !== null && e.pointerId === id;

  el.addEventListener('pointerdown', ev => {
    const e = ev as PointerEvent;
    if (id !== null || e.button !== 0 || !e.isPrimary) return;
    id = e.pointerId;
    x0 = e.clientX;
    y0 = e.clientY;
    comprometido = false;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Puntero que ya se fue: el gesto sigue sin captura.
    }
    o.alAgarrar(e);
  });

  el.addEventListener('pointermove', ev => {
    const e = ev as PointerEvent;
    if (!suyo(e)) return;
    if (!comprometido && Math.hypot(e.clientX - x0, e.clientY - y0) >= umbral) comprometido = true;
    if (comprometido) o.alMover(e);
  });

  el.addEventListener('pointerup', ev => {
    const e = ev as PointerEvent;
    if (!suyo(e)) return;
    id = null;
    o.alSoltar(e, comprometido);
  });

  el.addEventListener('pointercancel', ev => {
    const e = ev as PointerEvent;
    if (!suyo(e)) return;
    id = null;
    o.alCancelar(e);
  });
}
