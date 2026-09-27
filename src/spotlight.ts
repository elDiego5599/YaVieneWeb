/**
 * Foco de las fichas — el wash verde que sigue al puntero sobre cada
 * ficha de ruta (puerto a vanilla del Spotlight Card de 21st: el original
 * es React, aquí no hay React que portar, sólo la idea).
 *
 * Cada ficha lleva un `::before` con un radial apagado (`--spot-op: 0`);
 * aquí se escriben `--spot-x/--spot-y` con la posición del puntero dentro
 * de la ficha y se enciende. Es decoración pura: no cambia el estado
 * elegido (que sigue mandando por `aria-pressed`) ni recibe puntero.
 *
 * Delegado en `document` porque las fichas las pinta `rutas.ts` después
 * de cargar: atar un listener por ficha obligaría a re-enganchar en cada
 * pintado. Un solo `pointermove` con un turno de rAF para las escrituras.
 * Sólo con puntero fino y sin `prefers-reduced-motion`: en táctil no hay
 * "encima" que seguir.
 */
const SELECTOR = '.ruta-ficha';

export function encenderFocoFichas(): void {
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let turno = 0;
  let pendiente: { ficha: HTMLElement; x: number; y: number } | null = null;

  const pintar = (): void => {
    turno = 0;
    if (!pendiente) return;
    const { ficha, x, y } = pendiente;
    pendiente = null;
    const caja = ficha.getBoundingClientRect();
    ficha.style.setProperty('--spot-x', `${Math.round(x - caja.left)}px`);
    ficha.style.setProperty('--spot-y', `${Math.round(y - caja.top)}px`);
    ficha.style.setProperty('--spot-op', '1');
  };

  document.addEventListener(
    'pointermove',
    (evento) => {
      const ficha = (evento.target as HTMLElement).closest<HTMLElement>(SELECTOR);
      if (!ficha) return;
      pendiente = { ficha, x: evento.clientX, y: evento.clientY };
      if (turno === 0) turno = window.requestAnimationFrame(pintar);
    },
    { passive: true }
  );

  // Al salir de la ficha el wash se apaga con su fundido; sin esto se
  // quedaría encendido donde el puntero la abandonó.
  document.addEventListener('pointerout', (evento) => {
    const ficha = (evento.target as HTMLElement).closest<HTMLElement>(SELECTOR);
    const sale = evento.relatedTarget as Node | null;
    if (ficha && (!sale || !ficha.contains(sale))) {
      ficha.style.setProperty('--spot-op', '0');
    }
  });
}
