/**
 * Las cinco entradas: numerar las series y dar la salida donde haga falta.
 *
 * Casi todo el trabajo lo hace movimiento.css con líneas de tiempo
 * nativas, que corren en el compositor y no pasan por aquí. Este archivo
 * hace las dos cosas que el CSS no puede hacer solo.
 *
 * Una: numerar. El escalonado del `relevo` sale de `--i`, y una hoja de
 * estilos no sabe contar hermanos —`nth-child` sirve para elegir, no para
 * devolver un número—. Se puede escribir a mano en el HTML, y donde la
 * serie es fija así está; donde la pinta el guion, se numera aquí.
 *
 * Dos: el respaldo. Safari todavía no trae `animation-timeline`, así que
 * ahí las entradas se quedarían en su estado de partida para siempre —es
 * decir, invisibles—. Cuando eso pasa, un IntersectionObserver pone
 * `.entrada-viva` y las mismas cejas corren como animación normal. En un
 * navegador con líneas de tiempo nativas este observador ni se crea.
 */

/** ¿Sabe el navegador atar una animación al scroll? */
export const hayLineasNativas = (): boolean =>
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline', 'view()');

/** Escribir el turno de cada pieza de una serie. */
const numerar = (raiz: ParentNode): void => {
  for (const serie of raiz.querySelectorAll<HTMLElement>('.entra-relevo')) {
    let i = 0;
    for (const pieza of serie.children) {
      if (!(pieza instanceof HTMLElement)) continue;
      if (pieza.style.getPropertyValue('--i') === '') {
        pieza.style.setProperty('--i', String(i));
      }
      i += 1;
    }
  }
};

export function encenderEntradas(raiz: ParentNode = document): void {
  numerar(raiz);

  if (hayLineasNativas()) return;

  const piezas = Array.from(
    raiz.querySelectorAll<HTMLElement>('.entra-corte, .entra-ficha, .entra-traza, .entra-relevo')
  );
  if (piezas.length === 0) return;

  // Sin movimiento no hay salida que dar: el CSS ya las deja puestas.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  if (!('IntersectionObserver' in window)) {
    for (const pieza of piezas) pieza.classList.add('entrada-viva');
    return;
  }

  const ojo = new IntersectionObserver(
    (entradas, observador) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        observador.unobserve(entrada.target);
        entrada.target.classList.add('entrada-viva');
      }
    },
    /*
      El mismo criterio que tenía la aparición de antes: basta con que
      asome por encima del último décimo de pantalla. Un umbral por
      fracción del elemento deja fuera para siempre a lo que es más alto
      que la ventana, que con los titulares grandes del rediseño pasa.
    */
    { threshold: 0, rootMargin: '0px 0px -10% 0px' }
  );

  for (const pieza of piezas) ojo.observe(pieza);
}
