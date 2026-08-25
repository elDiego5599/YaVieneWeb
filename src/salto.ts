import { congelarPistas } from './scrolly';

/**
 * Saltos del menú sin que las historias se reproduzcan por el camino.
 *
 * Dos de las secciones de la página no se leen: se recorren. «El problema»
 * mide tres ventanas y media y «Cómo funciona» algo más de tres, cada una
 * con su escena pegada arriba, y lo que enseñan depende exactamente de
 * dónde esté el scroll. Un enlace de la píldora manda al navegador a
 * cruzar ese trecho en medio segundo, así que en medio segundo pasaba la
 * historia entera —el reloj dando la vuelta, los tres momentos cruzando—
 * y se llegaba al destino con las transiciones a mitad de camino.
 *
 * El viaje no se toca: el scroll suave sigue siendo el del navegador, que
 * es el que respeta los ajustes de movimiento del sistema y el que sabe
 * frenar si el usuario mete la rueda. Lo que se hace es congelar las
 * pistas mientras dura y soltarlas al llegar; entonces cada una se mide
 * una vez y aparece ya en su sitio.
 *
 * Se congela en cualquier salto interno, no sólo en los que caen dentro de
 * una pista: «Probar el mapa» termina en una sección normal, pero para
 * llegar hay que pasar por encima de las dos.
 *
 * Cuándo ha llegado no lo dice ningún evento que se pueda dar por hecho
 * —`scrollend` es demasiado nuevo para confiar en él—, así que se mira la
 * posición: tres cuadros sin moverse es que el viaje acabó.
 */

/** Cuadros seguidos en el mismo sitio que dan el viaje por terminado. */
const QUIETOS = 3;

/**
 * Nadie llega antes de esto. El scroll suave tarda un par de cuadros en
 * arrancar, y sin este suelo los tres primeros cuadros quietos —los de
 * antes de moverse— darían el viaje por hecho nada más empezar.
 */
const MINIMO_MS = 150;

/**
 * Y nadie tarda más. Es el seguro de último recurso: un viaje del hero al
 * final de la página tarda kilómetro y medio de scroll, algo más de un
 * segundo y medio en esta máquina, y en una lenta puede tardar más. Las
 * pistas no se pueden quedar congeladas por un caso raro.
 */
const TOPE_MS = 3000;

/**
 * Y si el usuario retoma el mando, se suelta en el acto: el viaje ya no es
 * del navegador, y congelar lo que alguien está recorriendo a mano es
 * exactamente el fallo que esto venía a arreglar. Son las tres maneras de
 * mover la página que no pasan por un enlace.
 */
const INTERRUMPEN = ['wheel', 'touchstart', 'keydown'] as const;

/**
 * Llama a `soltar` cuando la página deja de moverse.
 *
 * Lo usan los dos sitios que mandan la página a otro lado por su cuenta:
 * los enlaces del menú, aquí abajo, y el riel de la solución, que salta al
 * tramo del momento que se toque. En los dos casos hace falta lo mismo,
 * saber cuándo terminó el viaje para volver a soltar las pistas.
 */
export const alLlegar = (soltar: () => void): void => {
  let previo = window.scrollY;
  let quietos = 0;
  let vivo = true;
  const arranque = performance.now();

  const terminar = (): void => {
    // Una vez y no más: el vigía y la interrupción pueden llegar los dos, y
    // un soltar de más pisaría el siguiente salto si ya hubiera empezado.
    if (!vivo) return;
    vivo = false;
    for (const tipo of INTERRUMPEN) window.removeEventListener(tipo, terminar);
    soltar();
  };

  const mirar = (ahora: number): void => {
    const y = window.scrollY;
    quietos = y === previo ? quietos + 1 : 0;
    previo = y;

    const viaje = ahora - arranque;
    if ((quietos >= QUIETOS && viaje > MINIMO_MS) || viaje > TOPE_MS) {
      terminar();
      return;
    }
    requestAnimationFrame(mirar);
  };

  // Los vigilantes entran en el cuadro siguiente, no en este: activar el
  // enlace con Enter deja un keydown todavía en el aire, y engancharse
  // ahora mismo sería soltar por el mismo teclazo que pidió el salto.
  requestAnimationFrame(now => {
    if (!vivo) return;
    for (const tipo of INTERRUMPEN) {
      window.addEventListener(tipo, terminar, { passive: true });
    }
    mirar(now);
  });
};

/** El destino del enlace, si es un ancla de esta misma página y existe. */
const destino = (enlace: HTMLAnchorElement): HTMLElement | null => {
  const id = enlace.getAttribute('href')?.slice(1) ?? '';
  if (!id) return null;
  // Por id y no por selector: un ancla puede traer cualquier cosa detrás
  // de la almohadilla y querySelector revienta con lo que no sea válido.
  return document.getElementById(decodeURIComponent(id));
};

export function saltosDeMenu(): void {
  document.addEventListener('click', evento => {
    // Con una tecla de por medio el clic es «abrir en otra pestaña», y con
    // otro botón es el menú contextual: ninguno mueve esta página.
    if (evento.defaultPrevented || evento.button !== 0) return;
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;

    const objetivo = evento.target;
    if (!(objetivo instanceof Element)) return;
    const enlace = objetivo.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!enlace || !destino(enlace)) return;

    congelarPistas(true);
    alLlegar(() => congelarPistas(false));
  });
}
