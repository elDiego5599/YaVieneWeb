/**
 * Arranque de la landing.
 *
 * Los estilos se importan aquí y no con <link> en el HTML: así el
 * empaquetador los junta, los versiona y avisa si un archivo desaparece,
 * en vez de que la página se cargue sin la mitad de su CSS.
 *
 * Cada módulo recibe los elementos que necesita ya resueltos. Si alguno
 * falta, esto lo detecta y se salta esa pieza; ninguna clase se construye
 * a medias con referencias nulas por dentro.
 */

import './css/fonts.css';
import './css/variables.css';
import './css/base.css';
import './css/layout.css';
import './css/components.css';
import './css/phone-simulator.css';
import './css/animations.css';
import './css/accesibilidad.css';

import { MapaVivo } from './mapa-vivo';
import { NavIsland } from './nav-island';
import { PhoneMap } from './phone-map';
import { PhoneSimulator } from './phone-simulator';
import { Problema } from './problema';
import { pintarCifras } from './rutas';
import { reboteDelPie } from './rebote';
import { dormirLoQueNoSeVe } from './reposo';
import { encenderScrollSuave } from './scroll-suave';
import { entrarEscena, ScrollEffects } from './scroll-effects';

const arrancar = (): void => {
  /*
    Lo que se pinta con `.reveal` va antes que el observador, sin
    excepción: `ScrollEffects` recoge los nodos una sola vez, al
    construirse, y lo que nazca después entra ya visible —la sección
    aparecería de golpe en vez de escalonada—.

    Son dos: las tres cifras de la cabecera y las seis fichas de ruta,
    que las pinta el mapa porque es él quien sabe cuál está elegida.
  */
  const cifras = document.querySelector<HTMLElement>('[data-rutas-cifras]');
  if (cifras) pintarCifras(cifras);

  // El mapa jugable: la única parte de la página que se toca.
  const mapa = document.querySelector<HTMLElement>('[data-mapa-vivo]');
  if (mapa) new MapaVivo(mapa);

  // Apariciones al entrar en pantalla: ya está puesto todo lo que mira.
  new ScrollEffects();
  // La escena del hero, que entra sola al cargar.
  entrarEscena();

  // Y lo contrario: lo que está fuera de pantalla deja de animarse. Es lo
  // primero que se enciende porque sólo mira secciones, no depende de que
  // ninguna otra pieza haya montado lo suyo. Ver reposo.ts.
  dormirLoQueNoSeVe();

  const isla = document.querySelector<HTMLElement>('.nav-island');
  const botonIsla = isla?.querySelector<HTMLButtonElement>('.nav-island-toggle');
  if (isla && botonIsla) new NavIsland(isla, botonIsla);
  reboteDelPie();

  const svg = document.querySelector<SVGSVGElement>('#phone-routes');
  const lienzo = document.querySelector<HTMLElement>('#phone-map');
  const pantalla = document.querySelector<HTMLElement>('#phone');
  if (svg && lienzo && pantalla) {
    new PhoneSimulator(new PhoneMap(svg, lienzo), pantalla);
  }

  /*
    El teléfono de la izquierda enseña el selector de ruta abierto, y detrás
    del velo va el mapa: el mismo mosaico y la misma polilínea que el
    central, no un fondo pintado. No hay simulador aquí — es una foto fija —,
    así que basta con el mapa colocado en la ruta que dice la tarjeta de
    encima, la C16, y el pin en un punto que caiga en la mitad de arriba de
    la pantalla, que es lo único que el velo deja ver.
  */
  const svgLado = document.querySelector<SVGSVGElement>('#phone-routes-lado');
  const lienzoLado = document.querySelector<HTMLElement>('#phone-map-lado');
  if (svgLado && lienzoLado) {
    const mapaLado = new PhoneMap(svgLado, lienzoLado);
    mapaLado.setRoute('R-106');
    mapaLado.setPin(mapaLado.tVisible(0.5, 0.2));
    mapaLado.showRoute(true);
    mapaLado.showPin(true);
  }

  /*
    Qué resuelve: la sección de dos caras. Va aquí y no antes porque el
    HTML ya trae puesta la cara del problema —lo que se ve sin
    JavaScript—, así que nada de lo de arriba depende de ella.
  */
  const problema = document.querySelector<HTMLElement>('[data-problema]');
  if (problema) new Problema(problema);
};

// El scroll suave se enciende al final, cuando ya no queda nada por
// colocar. El porqué está en scroll-suave.ts y en base.css.
encenderScrollSuave();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar, { once: true });
} else {
  arrancar();
}
