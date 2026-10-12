/**
 * Lo único que queda del motor de scrollytelling: preguntar si el sistema
 * pide no animar.
 *
 * Aquí vivía la medición de las pistas —un número de 0 a 1 con cuánto se
 * había recorrido de cada bloque alto—. Ya no la usa nadie.
 *
 * Se queda esta función porque la preguntan dos módulos y el sitio
 * natural para ella sigue siendo éste.
 */

export const sinMovimiento = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
