/**
 * El motor del scrollytelling.
 *
 * Una «pista» es un bloque alto —varias pantallas— con una escena pegada
 * dentro. Mientras la pista cruza la ventana la escena se queda quieta y
 * lo que cambia es lo que hay dentro de ella: el reloj corre, los pasos se
 * acercan, el visor pasa de una pieza a otra. Todo eso necesita el mismo
 * dato, un número de 0 a 1 que diga cuánto se ha recorrido de la pista.
 *
 * Aquí no hay animaciones: sólo la medida. Cada módulo decide qué hace con
 * ella. La medición va enganchada a `requestAnimationFrame`, así que por
 * mucho que el navegador dispare eventos de scroll sólo se lee el layout
 * una vez por cuadro.
 */

export const limitar = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Suaviza los extremos: arranca y frena en vez de ir a tirones. */
export const suavizar = (t: number): number => {
  const x = limitar(t);
  return x * x * (3 - 2 * x);
};

/** Regla de tres recortada: dónde cae `v` entre `a` y `b`. */
export const entre = (v: number, a: number, b: number): number =>
  b === a ? 0 : limitar((v - a) / (b - a));

/** Reparte 0..1 en `n` tramos iguales; devuelve cuál y cuánto lleva. */
export function tramo(p: number, n: number): { indice: number; dentro: number } {
  const escala = limitar(p) * n;
  const indice = Math.min(n - 1, Math.floor(escala));
  return { indice, dentro: limitar(escala - indice) };
}

export const sinMovimiento = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** El alto real de la escena pegada; si no hay, se supone una ventana. */
const altoEscena = (pista: HTMLElement): number => {
  const escena = pista.firstElementChild as HTMLElement | null;
  return escena?.offsetHeight || window.innerHeight;
};

/**
 * Sigue el avance de una pista y avisa cuando cambia.
 *
 * El recorrido útil no es el alto de la pista: la escena va pegada arriba
 * y ocupa lo suyo, así que el viaje empieza cuando el techo de la pista
 * llega al de la ventana y termina cuando el suelo de la escena alcanza el
 * de la pista. Se mide la escena en vez de dar por hecho que mide una
 * ventana justa, que en pantallas bajas no es verdad.
 */
export function seguirPista(
  pista: HTMLElement,
  alAvanzar: (p: number) => void
): () => void {
  let pedido = 0;
  let ultimo = Number.NaN;

  const medir = (): void => {
    pedido = 0;
    const caja = pista.getBoundingClientRect();
    const recorrido = caja.height - altoEscena(pista);
    const p = recorrido <= 0 ? 0 : limitar(-caja.top / recorrido);
    // Medio milésimo de avance no mueve un píxel en pantalla; no vale la
    // pena repintar por él.
    if (Math.abs(p - ultimo) < 0.0005) return;
    ultimo = p;
    alAvanzar(p);
  };

  const pedir = (): void => {
    if (pedido) return;
    pedido = requestAnimationFrame(medir);
  };

  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir);
  medir();

  return () => {
    if (pedido) cancelAnimationFrame(pedido);
    window.removeEventListener('scroll', pedir);
    window.removeEventListener('resize', pedir);
  };
}

/** El scroll que deja la pista en el avance `p`. Lo usa el riel del visor. */
export function scrollDePista(pista: HTMLElement, p: number): number {
  const caja = pista.getBoundingClientRect();
  const arriba = caja.top + window.scrollY;
  const recorrido = Math.max(0, caja.height - altoEscena(pista));
  return arriba + recorrido * limitar(p);
}
