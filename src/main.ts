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

import { ContactForm } from './contact-form';
import { encajarEscena } from './encaje';
import { MapaVivo } from './mapa-vivo';
import { NavIsland } from './nav-island';
import { PasoDemo } from './paso-demo';
import { PasoFoco } from './paso-foco';
import { PhoneMap } from './phone-map';
import { PhoneSimulator } from './phone-simulator';
import { Problema } from './problema';
import { pintarCifras } from './rutas';
import { dormirLoQueNoSeVe } from './reposo';
import { saltosDeMenu } from './salto';
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

  /*
    Qué resuelve: la sección de dos caras. Va aquí y no antes porque el
    HTML ya trae puesta la cara del problema —lo que se ve sin
    JavaScript—, así que nada de lo de arriba depende de ella.
  */
  const problema = document.querySelector<HTMLElement>('[data-problema]');
  if (problema) new Problema(problema);

  const form = document.querySelector<HTMLFormElement>('#contact-form');
  if (form) new ContactForm(form);

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

  /*
    Cómo funciona: tres columnas, cada una con su teléfono, y el scroll
    decidiendo cuál de las tres se está contando. Los mapas son el mismo
    mosaico y las mismas seis polilíneas del hero, uno por aparato, porque
    cada guion mueve su bus a su ritmo.

    El paso en primer plano crece y corre su bucle; los otros dos esperan
    a tamaño normal y quietos. Así nunca hay más de un `requestAnimationFrame`
    de mapa vivo, y la sección se lee como lo que cuenta: un paso, luego el
    siguiente, luego el último.
  */
  const columnasPasos = document.querySelector<HTMLElement>('[data-pasos-columnas]');
  if (columnasPasos) {
    const demos: PasoDemo[] = [];
    const columnas: HTMLElement[] = [];

    for (const columna of columnasPasos.querySelectorAll<HTMLElement>('[data-paso-columna]')) {
      const toma = columna.querySelector<HTMLElement>('[data-toma]');
      const capa = columna.querySelector<SVGSVGElement>('.routes-svg-layer');
      const lienzo = columna.querySelector<HTMLElement>('.phone-map');
      const numero = Number(toma?.dataset.demo);
      if (!toma || !capa || !lienzo || !Number.isFinite(numero)) continue;

      columnas.push(columna);
      demos.push(new PasoDemo(toma, new PhoneMap(capa, lienzo), numero));
    }

    const pista = columnasPasos.closest<HTMLElement>('.pista');
    const marcas = [
      ...document.querySelectorAll<HTMLElement>('[data-paso-marca]'),
    ];
    const botones = [
      ...document.querySelectorAll<HTMLButtonElement>('[data-paso-boton]'),
    ];

    /*
      Los botones llevan al mismo sitio que el scroll: bajan la pista
      hasta el tramo del paso y el PasoFoco hace el resto, así que el
      resaltado del botón y el del teléfono salen del mismo número.
    */
    const irAPaso = (indice: number): void => {
      if (!pista) return;
      const caja = pista.getBoundingClientRect();
      const recorrido = Math.max(0, caja.height - window.innerHeight);
      const y =
        caja.top + window.scrollY +
        (recorrido <= 0 ? 0 : (recorrido * (indice + 0.5)) / columnas.length);
      window.scrollTo({ top: y, behavior: sinMovimiento() ? 'auto' : 'smooth' });
    };
    botones.forEach((boton, i) => {
      boton.addEventListener('click', () => irAPaso(i));
    });

    if (pista && columnas.length > 0) {
      // La lista lateral: el paso que manda se agranda y enseña su
      // texto (CSS, con `is-activa`), y la línea verde la mueve el
      // recorrido crudo, que no va a golpes como el paso discreto.
      const lista = document.querySelector<HTMLElement>('[data-pasos-lista]');
      new PasoFoco({
        pista,
        pase: columnasPasos,
        columnas,
        marcas,
        alCambiar: (indice) => {
          demos.forEach((demo, i) => demo.activar(i === indice));
          botones.forEach((boton, i) => boton.classList.toggle('is-activa', i === indice));
        },
        alAvanzar: (avance) => {
          lista?.style.setProperty('--avance-lista', String(avance));
        },
      });
    }
  }
};

// El scroll suave se enciende al final, cuando ya no queda nada por
// colocar. El porqué está en scroll-suave.ts y en base.css.
encenderScrollSuave();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar, { once: true });
} else {
  arrancar();
}
