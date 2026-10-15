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

import { AvisoLanzamiento } from './aviso-lanzamiento';
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
  const avisoForm = document.querySelector<HTMLFormElement>('#aviso-lanzamiento');
  const avisoAbrir = document.querySelector<HTMLButtonElement>('[data-aviso-abrir]');
  if (avisoForm && avisoAbrir) new AvisoLanzamiento(avisoForm, avisoAbrir);

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
  let mostrarToque: (() => void) | undefined;
  let toqueAnimTimer = 0;
  if (svgCf && lienzoCf) {
    // Zoom 1 muestra el mosaico completo, el límite de PhoneMap, para abrir la vista hasta el máximo.
    const mapaCf = new PhoneMap(svgCf, lienzoCf, { zoom: 1 });
    mapaCf.setRoute('R-106');
    // 55 % / 36 % centra el pin; las distancias 1,8 y 4,4 km incluyen ambos buses con margen.
    const pin = mapaCf.tVisible(0.55, 0.36, [1800, 4400]);
    mapaCf.setPin(pin);
    mapaCf.setBuses([pin - 1800 / mapaCf.metrosDeRuta, pin - 3600 / mapaCf.metrosDeRuta]);
    mapaCf.showRoute(true);
    mapaCf.showPin(true);
    mapaCf.showBuses(true);
    const distancia = document.querySelector<HTMLElement>('.cf-mapa-distancia .eta-number');
    const tarjeta = document.querySelector<HTMLElement>('.cf-mapa-hoja');
    let toque: SVGCircleElement | null = null;
    mostrarToque = (): void => {
      const bus = mapaCf.nodoBus(0);
      if (!bus) return;
      toque?.remove();
      toque = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      toque.setAttribute('class', 'cf-tap');
      toque.setAttribute('cx', '0');
      toque.setAttribute('cy', '0');
      // 40 en las unidades del bus son ~14 px a 1440: el ancho de una yema.
      toque.setAttribute('r', '40');
      toque.setAttribute('aria-hidden', 'true');
      bus.appendChild(toque);
      if (toqueAnimTimer) window.clearTimeout(toqueAnimTimer);
      // 650 ms coincide con el pulso CSS y revela la tarjeta al terminar.
      toqueAnimTimer = window.setTimeout(() => {
        toque?.remove();
        toque = null;
        tarjeta?.classList.remove('cf-distancia-espera');
      }, 650);
    };
    llevarBus = (metros: number): void => {
      // Conserva los 1,8 km entre buses mientras los dos avanzan por la C16.
      mapaCf.setBuses([pin - metros / mapaCf.metrosDeRuta, pin - (metros + 1800) / mapaCf.metrosDeRuta]);
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
  let llegadaFrame = 0;
  let toqueTimer = 0;
  let cicloTimer = 0;
  let secuenciaTimer = 0;
  let pasoActual = 'ruta';
  let demoVisible = true;
  const ruedaAviso = demo?.querySelector<HTMLElement>('.cf-aviso-composicion');
  const guardarAviso = demo?.querySelector<HTMLElement>('.cf-guardar');
  const notificacionAviso = demo?.querySelector<HTMLElement>('.cf-aviso-notificacion');
  const limpiarSecuencia = (): void => {
    if (llegadaFrame) cancelAnimationFrame(llegadaFrame);
    if (toqueTimer) window.clearTimeout(toqueTimer);
    if (cicloTimer) window.clearTimeout(cicloTimer);
    if (secuenciaTimer) window.clearTimeout(secuenciaTimer);
    if (toqueAnimTimer) window.clearTimeout(toqueAnimTimer);
    llegadaFrame = 0;
    toqueTimer = 0;
    cicloTimer = 0;
    secuenciaTimer = 0;
    toqueAnimTimer = 0;
    document.querySelector('.cf-tap')?.remove();
    document.querySelector('.cf-mapa-hoja')?.classList.remove('cf-distancia-espera');
    ruedaAviso?.classList.remove('cf-aviso-rodando');
    guardarAviso?.classList.remove('cf-guardando');
    ruedaAviso?.classList.remove('cf-aviso-guardado');
    notificacionAviso?.classList.remove('cf-notificacion-visible');
  };
  /** El aviso ya guardado: la confirmación y la notificación a la vista. */
  const avisoListo = (): void => {
    ruedaAviso?.classList.add('cf-aviso-guardado');
    notificacionAviso?.classList.add('cf-notificacion-visible');
  };
  const iniciarCiclo = (): void => {
    limpiarSecuencia();
    if (!demoVisible) return;
    const ciclo = (): void => {
      if (sinMovimiento()) {
        llevarBus?.(1800); // 1,8 km es la llegada final que enseña la escena.
        avisoListo();
        return;
      }
      // «Elige tu ruta» se queda quieta: no repite su entrada (dueño, 2026-10-12).
      if (pasoActual === 'bus') {
        animarLlegada();
      } else if (pasoActual === 'aviso') {
        ruedaAviso?.classList.remove('cf-aviso-rodando', 'cf-aviso-guardado');
        guardarAviso?.classList.remove('cf-guardando');
        notificacionAviso?.classList.remove('cf-notificacion-visible');
        void ruedaAviso?.offsetWidth;
        ruedaAviso?.classList.add('cf-aviso-rodando');
        secuenciaTimer = window.setTimeout(() => {
          guardarAviso?.classList.add('cf-guardando');
          // «Aviso activado» sale con el toque de «Guardar» (dueño, 2026-10-12).
          ruedaAviso?.classList.add('cf-aviso-guardado');
          // 2 s: el aviso llega un rato después de guardarlo, no encima
          // (dueño, 2026-10-12); 950 + 2000 ms caben en los 5 s del paso.
          secuenciaTimer = window.setTimeout(() => {
            notificacionAviso?.classList.add('cf-notificacion-visible');
          }, 2000);
          // 950 ms deja terminar el giro de la rueda antes de guardar.
        }, 950);
      }
      // Cada paso dura lo que su pestaña (5 s): la secuencia (≤ 2,4 s) se
      // ve entera y se queda quieta un rato antes de repetirse, y con el
      // carrusel parado sigue repitiéndose sin quedar estática.
      cicloTimer = window.setTimeout(ciclo, 5000);
    };
    ciclo();
  };
  const animarLlegada = (): void => {
    if (!llevarBus) return;
    if (llegadaFrame) cancelAnimationFrame(llegadaFrame);
    if (toqueTimer) window.clearTimeout(toqueTimer);
    document.querySelector('.cf-mapa-hoja')?.classList.add('cf-distancia-espera');
    const desde = 2600;
    const hasta = 1800;
    if (sinMovimiento()) {
      llevarBus(hasta);
      document.querySelector('.cf-mapa-hoja')?.classList.remove('cf-distancia-espera');
      return;
    }
    const inicio = performance.now();
    const actualizar = (ahora: number): void => {
      const progreso = Math.min(1, (ahora - inicio) / 1600);
      const suavizado = 1 - (1 - progreso) ** 3;
      llevarBus(desde - (desde - hasta) * suavizado);
      if (progreso < 1) llegadaFrame = requestAnimationFrame(actualizar);
      // 100 ms deja terminar el fundido de la escena antes de mostrar el dedo.
      else if (mostrarToque) toqueTimer = window.setTimeout(mostrarToque, 100);
    };
    llevarBus(desde);
    llegadaFrame = requestAnimationFrame(actualizar);
  };
  if (demo && 'IntersectionObserver' in window) {
    const visibilidad = new IntersectionObserver(([entrada]) => {
      demoVisible = entrada.isIntersecting;
      if (demoVisible) iniciarCiclo();
      else limpiarSecuencia();
    });
    visibilidad.observe(demo);
  }
  if (demo) {
    const movimientoReducido = sinMovimiento();
    if (movimientoReducido) avisoListo();
    else iniciarCiclo();
    new Pasos(demo, { intervalo: 5000, alCambiar: paso => {
      pasoActual = paso;
      iniciarCiclo();
      if (movimientoReducido) {
        llevarBus?.(1800); // La tarjeta de bus queda en su distancia final.
        avisoListo();
      }
    } });
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
