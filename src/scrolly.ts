/**
 * Lo único que queda del motor de scrollytelling: preguntar si el sistema
 * pide no animar.
 *
 * Aquí vivía la medición de las pistas —un número de 0 a 1 con cuánto se
 * había recorrido de cada bloque alto, dosificado para que un tirón de
 * rueda no pasara la historia entera en cuatro cuadros—. Ya no la usa
 * nadie: «Cómo funciona» pasó a tres columnas y `paso-foco.ts` sólo
 * necesita saber cuál de los tres manda, que lo saca de la pista él
 * mismo; y la sección del reloj, que era la otra clienta, ya no existe.
 *
 * Se queda esta función porque la preguntan cuatro módulos y el sitio
 * natural para ella sigue siendo éste.
 */

export const sinMovimiento = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
