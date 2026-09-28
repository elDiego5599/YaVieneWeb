/**
 * El rebote de iOS al final de la página.
 *
 * Estirar la página más allá del final descubre el lienzo, y el lienzo
 * toma el blanco del body. Arriba está bien, la portada empieza en blanco;
 * abajo el pie termina verde azulado y la franja blanca parecía la página
 * rota. Mientras el pie está a la vista, el lienzo toma su `--rebote`.
 *
 * Un observador y no un `scroll`: solo despierta al entrar y salir el pie.
 * El body sigue pintando su blanco sobre todo el documento, así que esto
 * solo se ve en el estiramiento.
 */
export function reboteDelPie(): void {
  const pie = document.querySelector<HTMLElement>('.site-footer');
  const color = pie ? getComputedStyle(pie).getPropertyValue('--rebote').trim() : '';
  if (!pie || !color || !('IntersectionObserver' in window)) return;
  const lienzo = document.documentElement.style;
  new IntersectionObserver(([visto]) => {
    lienzo.backgroundColor = visto.isIntersecting ? color : '';
  }).observe(pie);
}
