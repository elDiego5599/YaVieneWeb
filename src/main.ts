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

import { Pasos } from './como-funciona';
import { NavIsland } from './nav-island';
import { PhoneMap } from './phone-map';
import { PhoneSimulator } from './phone-simulator';
import { Problema } from './problema';
import { reboteDelPie } from './rebote';
import { dormirLoQueNoSeVe } from './reposo';
import { encenderScrollSuave } from './scroll-suave';
import { entrarEscena, ScrollEffects } from './scroll-effects';
import { sinMovimiento } from './scrolly';

const arrancar = (): void => {
  // Apariciones al entrar en pantalla: ya está puesto todo lo que mira.
  new ScrollEffects();
  // La escena del hero, que entra sola al cargar.
  entrarEscena();

  // El video del iPhone (experimento): sin `autoplay` en el marcado para
  // que con movimiento reducido no arranque ni un cuadro y quede el póster.
  // `play()` rechaza si el navegador no deja (ahorro de datos): se queda
  // el póster, que es el mismo estado.
  const video = document.querySelector<HTMLVideoElement>('[data-hero-video]');
  if (video && !sinMovimiento()) video.play().catch(() => {});

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
    «Cómo funciona»: el teléfono tiene su propio mapa quieto para el
    selector. La composición del bus comparte la ruta C16 con otro mapa,
    encuadrado a nivel de calle para mostrar el pin y el bus a 1,8 km.
  */
  const svgCf = document.querySelector<SVGSVGElement>('#cf-mapa-rutas');
  const lienzoCf = document.querySelector<HTMLElement>('#cf-mapa');
  const svgCfTel = document.querySelector<SVGSVGElement>('#cf-mapa-tel-rutas');
  const lienzoCfTel = document.querySelector<HTMLElement>('#cf-mapa-tel');
  let llevarBus: ((metros: number) => void) | undefined;
  if (svgCf && lienzoCf) {
    const mapaCf = new PhoneMap(svgCf, lienzoCf, { zoom: 2.1 });
    mapaCf.setRoute('R-106');
    const pin = mapaCf.tVisible(0.55, 0.36, [1800]);
    mapaCf.setPin(pin);
    mapaCf.setBuses([pin - 1800 / mapaCf.metrosDeRuta]);
    mapaCf.showRoute(true);
    mapaCf.showPin(true);
    mapaCf.showBuses(true);
    const distancia = document.querySelector<HTMLElement>('.cf-mapa-distancia .eta-number');
    llevarBus = (metros: number): void => {
      mapaCf.setBuses([pin - metros / mapaCf.metrosDeRuta]);
      if (distancia) distancia.textContent = (metros / 1000).toFixed(1).replace('.', ',');
    };
  }
  if (svgCfTel && lienzoCfTel) {
    const mapaCfTel = new PhoneMap(svgCfTel, lienzoCfTel);
    mapaCfTel.setRoute('R-106');
    mapaCfTel.setPin(mapaCfTel.tVisible(0.5, 0.2));
    mapaCfTel.showRoute(true);
    mapaCfTel.showPin(true);
  }
  const demo = document.querySelector<HTMLElement>('.cf-demo');
  const animarLlegada = (): void => {
    if (!llevarBus) return;
    const desde = 2600;
    const hasta = 1800;
    if (sinMovimiento()) {
      llevarBus(hasta);
      return;
    }
    const inicio = performance.now();
    const actualizar = (ahora: number): void => {
      const progreso = Math.min(1, (ahora - inicio) / 1600);
      const suavizado = 1 - (1 - progreso) ** 3;
      llevarBus(desde - (desde - hasta) * suavizado);
      if (progreso < 1) requestAnimationFrame(actualizar);
    };
    llevarBus(desde);
    requestAnimationFrame(actualizar);
  };
  if (demo) new Pasos(demo, { intervalo: 5000, alCambiar: paso => {
    if (paso === 'bus') animarLlegada();
  } });

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
