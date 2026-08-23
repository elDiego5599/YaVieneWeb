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
import { NavIsland } from './nav-island';
import { PhoneMap } from './phone-map';
import { PhoneSimulator } from './phone-simulator';
import { Pasos } from './pasos';
import { ProblemWeather } from './problem-weather';
import { Reloj } from './reloj';
import { ScrollEffects } from './scroll-effects';
import { Visor } from './visor';

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

  /*
    Las tres secciones que se recorren en vez de leerse de un golpe. Cada
    una mide su propia pista; si la suya no está en la página, se salta.
  */
  const pistaReloj = document.querySelector<HTMLElement>('[data-reloj-pista]');
  if (pistaReloj) new Reloj(pistaReloj);

  const pistaPasos = document.querySelector<HTMLElement>('[data-pasos-pista]');
  if (pistaPasos) new Pasos(pistaPasos);

  /*
    El visor lleva su propio mapa: el mismo mosaico y las mismas seis
    polilíneas del teléfono, en un marco vertical, para que la pieza de las
    rutas enseñe la que se toca en la lista de al lado.
  */
  const pistaVisor = document.querySelector<HTMLElement>('[data-visor-pista]');
  if (pistaVisor) {
    const svgVisor = document.querySelector<SVGSVGElement>('#visor-rutas');
    const lienzoVisor = document.querySelector<HTMLElement>('#visor-mapa');
    const mapaVisor = svgVisor && lienzoVisor ? new PhoneMap(svgVisor, lienzoVisor) : null;
    new Visor(pistaVisor, mapaVisor);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar, { once: true });
} else {
  arrancar();
}
