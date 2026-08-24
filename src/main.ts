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

import './css/variables.css';
import './css/base.css';
import './css/layout.css';
import './css/components.css';
import './css/phone-simulator.css';
import './css/animations.css';

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
import { ScrollEffects } from './scroll-effects';
import { sinMovimiento } from './scrolly';

const arrancar = (): void => {
  // Apariciones al entrar en pantalla: no depende de nada más.
  new ScrollEffects();

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

  // El mapa jugable: la única parte de la página que se toca.
  const tablero = document.querySelector<HTMLElement>('[data-mapa-vivo]');
  if (tablero) new MapaVivo(tablero);

  /*
    Las dos secciones que se recorren en vez de leerse de un golpe. Cada
    una mide su propia pista; si la suya no está en la página, se salta.

    Antes de nada, que quepan: una escena pegada más alta que la ventana
    deja fuera lo de abajo y no hay forma de llegar a ello, ni bajando ni
    subiendo. Con las animaciones desactivadas no hay escena pegada que
    valga —el contenido se lee de arriba abajo—, así que ahí no aplica.
  */
  if (!sinMovimiento()) {
    for (const escena of document.querySelectorAll<HTMLElement>('.escena')) {
      encajarEscena(escena);
    }
  }

  const pistaReloj = document.querySelector<HTMLElement>('[data-reloj-pista]');
  if (pistaReloj) new Reloj(pistaReloj);

  /*
    La solución: tres momentos sobre una cinta, cada uno con su propio
    teléfono. Los mapas son el mismo mosaico y las mismas seis polilíneas
    del hero, uno por momento, porque cada guion mueve su bus a su ritmo.

    `Pasos` avisa cuál está quieto en el centro y sólo ése se anima: así
    la sección nunca tiene más de un bucle corriendo, y la animación se
    ve entera antes de dar paso a la siguiente.
  */
  const pistaPasos = document.querySelector<HTMLElement>('[data-pasos-pista]');
  if (pistaPasos) {
    const demos = new Map<number, PasoDemo>();

    for (const paso of pistaPasos.querySelectorAll<HTMLElement>('[data-paso]')) {
      const numero = Number(paso.dataset.demo);
      const capa = paso.querySelector<SVGSVGElement>('.routes-svg-layer');
      const lienzo = paso.querySelector<HTMLElement>('.phone-map');
      if (!capa || !lienzo || !Number.isFinite(numero)) continue;

      demos.set(numero - 1, new PasoDemo(paso, new PhoneMap(capa, lienzo), numero));
    }

    // Los teléfonos primero: `Pasos` mide en cuanto se construye, y si la
    // página se refresca ya parada dentro de un momento ése es el único
    // aviso que va a dar. Tienen que estar todos listos para recibirlo.
    new Pasos(pistaPasos, (indice) => {
      for (const [i, demo] of demos) demo.activar(i === indice);
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar, { once: true });
} else {
  arrancar();
}
