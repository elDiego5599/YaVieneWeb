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
import './css/movimiento.css';
import './css/accesibilidad.css';

import { marcarAnimable } from './animable';
import { ContactForm } from './contact-form';
import { encajarEscena } from './encaje';
import { MapaVivo } from './mapa-vivo';
import { NavIsland } from './nav-island';
import { PasoDemo } from './paso-demo';
import { Pasos } from './pasos';
import { PhoneMap } from './phone-map';
import { PhoneSimulator } from './phone-simulator';
import { ProblemWeather } from './problem-weather';
import { Reloj } from './reloj';
import { pintarCifras } from './rutas';
import { dormirLoQueNoSeVe } from './reposo';
import { saltosDeMenu } from './salto';
import { encenderCifras } from './cifras';
import { encenderTeletipo } from './teletipo';
import { encenderParadas } from './paradas';
import { encenderEntradas } from './entradas';
import { partirTitulares } from './titulares';
import { encenderScrollSuave } from './scroll-suave';
import { entrarEscena, ScrollEffects } from './scroll-effects';
import { sinMovimiento } from './scrolly';

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

  /*
    Las cinco entradas. El orden importa: primero se parten los titulares
    en líneas, porque `entradas.ts` puede necesitar dar la salida a esas
    líneas, y una línea que todavía no existe no recibe nada.
  */
  partirTitulares();
  encenderEntradas();
  encenderCifras();

  // El teletipo del hero: las seis rutas pasando por la franja de abajo.
  encenderTeletipo();

  // En qué parada va el lector: el nodo del margen y el letrero de la isla.
  encenderParadas();

  // Apariciones al entrar en pantalla: ya está puesto todo lo que mira.
  new ScrollEffects();
  // La escena del hero, que entra sola al cargar.
  entrarEscena();

  // Y lo contrario: lo que está fuera de pantalla deja de animarse. Es lo
  // primero que se enciende porque sólo mira secciones, no depende de que
  // ninguna otra pieza haya montado lo suyo. Ver reposo.ts.
  dormirLoQueNoSeVe();

  // Los enlaces internos cruzan por encima de las dos pistas; sin esto la
  // travesía reproduce sus historias a toda velocidad. Ver salto.ts.
  saltosDeMenu();

  const isla = document.querySelector<HTMLElement>('.nav-island');
  const botonIsla = isla?.querySelector<HTMLButtonElement>('.nav-island-toggle');
  if (isla && botonIsla) new NavIsland(isla, botonIsla);

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

  const form = document.querySelector<HTMLFormElement>('#contact-form');
  if (form) new ContactForm(form);

  const problema = document.querySelector<HTMLElement>('#problema');
  if (problema) new ProblemWeather(problema);

  /*
    Las dos secciones que se recorren en vez de leerse de un golpe. Cada
    una mide su propia pista; si la suya no está en la página, se salta.

    Antes de nada, que quepan: una escena pegada más alta que la ventana
    deja fuera lo de abajo y no hay forma de llegar a ello, ni bajando ni
    subiendo. Con las animaciones desactivadas no hay escena pegada que
    valga —el contenido se lee de arriba abajo—, así que ahí no aplica.

    La franja del problema queda fuera por lo mismo: su escena no se pega
    ni mide una ventana, así que lo que sobre por abajo se alcanza bajando
    como en cualquier otra sección. Encogerla sólo le quitaría tamaño a la
    letra sin arreglar nada.
  */
  if (!sinMovimiento()) {
    const escenas = document.querySelectorAll<HTMLElement>('.pista:not(.pista--franja) > .escena');
    for (const escena of escenas) encajarEscena(escena);
  }

  const pistaReloj = document.querySelector<HTMLElement>('[data-reloj-pista]');
  if (pistaReloj) new Reloj(pistaReloj);

  /*
    La solución: los tres textos van en una cinta y los tres teléfonos
    están apilados en el mismo sitio, uno por momento. Los mapas son el
    mismo mosaico y las mismas seis polilíneas del hero, uno por teléfono,
    porque cada guion mueve su bus a su ritmo.

    `Pasos` avisa qué teléfono está a la vista y sólo ése se anima: así la
    sección nunca tiene más de un bucle corriendo, y la demo se ve entera
    antes de dar paso a la siguiente. Con -1 se apagan todos, que es lo
    que pasa cuando la sección se sale de pantalla.
  */
  const pistaPasos = document.querySelector<HTMLElement>('[data-pasos-pista]');
  if (pistaPasos) {
    const demos = new Map<number, PasoDemo>();

    for (const toma of pistaPasos.querySelectorAll<HTMLElement>('[data-toma]')) {
      const numero = Number(toma.dataset.demo);
      const capa = toma.querySelector<SVGSVGElement>('.routes-svg-layer');
      const lienzo = toma.querySelector<HTMLElement>('.phone-map');
      if (!capa || !lienzo || !Number.isFinite(numero)) continue;

      demos.set(numero - 1, new PasoDemo(toma, new PhoneMap(capa, lienzo), numero));
    }

    new Pasos(pistaPasos, (indice) => {
      for (const [i, demo] of demos) demo.activar(i === indice);
    });
  }
};

/*
  Lo primero de todo, antes de esperar a que el documento esté listo: la
  marca que permite que algo empiece escondido. Sin ella la página se ve
  entera, que es como tiene que verse si este archivo nunca llega. El
  porqué largo está en animable.ts.
*/
marcarAnimable();

// El scroll suave se enciende al final, cuando ya no queda nada por
// colocar. El porqué está en scroll-suave.ts y en base.css.
encenderScrollSuave();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar, { once: true });
} else {
  arrancar();
}
