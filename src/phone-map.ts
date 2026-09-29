/**
 * PhoneMap — el mapa del mockup, con el mismo material que ve el pasajero.
 *
 * El fondo es un mosaico real de Barranquilla en CARTO Voyager, el mismo
 * estilo que carga map_widget.dart, y encima va la polilínea verde de la
 * ruta activa con los waypoints reales de rutas.json. Los generó
 * scripts/gen_mapa_landing.py, así que fondo y trazado comparten el
 * encuadre Web Mercator: la ruta cae sobre las calles que le tocan.
 *
 * La cámara no se mueve —reencuadrar en cada ruta hacía un salto de zoom
 * feo—, pero mira de cerca, no a la ciudad entera. Es lo que hace la app:
 * camera_fit.dart dejó de enmarcar el recorrido completo porque «elegir
 * ruta echaba la cámara fuera de la ciudad y a un zoom donde no se
 * distingue nada», y ahora encuadra lo que está vivo con un lado mínimo
 * de 0,0225° —unos 2,5 km—. Aquí el encuadre es fijo pero de ese orden:
 * a la escala de antes el pin y sus buses caían a doce píxeles uno de
 * otro y se veían como una mancha.
 *
 * Todo vive en el espacio de usuario del SVG: el pin y los buses son
 * elementos SVG, no divs colocados en porcentajes. Antes se convertía de
 * coordenadas SVG a píxeles de pantalla con getScreenCTM(), y como esa
 * matriz cambia al hacer scroll, los marcadores se iban a la deriva.
 */

import { encajeDe } from './encaje';
import { YV_RUTAS } from './data/rutas-landing';
import type { MapaBase, Punto, RutaLanding } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';

/**
 * Tamaño de los marcadores en puntos de la pantalla del iPhone, la de
 * 402 de ancho que el mockup reproduce a escala. En píxeles fijos el bus
 * salía bien en el teléfono de la solución y pequeño en el del hero, que
 * es más grande; en puntos mide lo mismo que en la app en los dos.
 *
 * Los dos números son la cuenta que hace MapLibre, no un tanteo. Los
 * dibujos de map_markers.dart entran al mapa a 3 píxeles por punto —la
 * escala de la pantalla del iPhone— y el `iconSize` de map_widget.dart los
 * agranda con el zoom: el pin de 1,0 a zoom 11 a 1,6 a zoom 15, el bus
 * suelto de 1,1 a 1,5. Al 12,54 del mosaico (ZOOM_GL en gen_mapa_landing.py)
 * eso da 1,231 y 1,254:
 *   pin: 76 px de dibujo hasta la punta / 3 × 1,231 = 31,2 puntos;
 *   bus: 60 px de cápsula / 3 × 1,254 = 25,1 puntos.
 * En el simulador, con la C16 viva, la cabeza del pin mide 21,3 puntos
 * —52 px / 3 × 1,231—. Antes iban a 48 y 30, más de vez y media lo de la
 * app: tapaban las calles y el mockup se veía tosco al lado del teléfono
 * de verdad. Después el bus fue a 16,3 y a 19,6, lo que daban los
 * `iconSize` de entonces (0,7 a 1,0 y 0,84 a 1,2); al lado del pin se
 * perdía y costaba encontrarlo antes de tocarlo, así que la app lo subió y
 * el mockup lo sigue.
 */
const ANCHO_PANTALLA_PT = 402;
const BUS_PT = 25.1;
const PIN_PT = 31.2;

/** Alto del dibujo original de cada marcador, en unidades del SVG. */
const BUS_ALTO = 60;
const PIN_ALTO = 76;

/**
 * Radio del halo del bus elegido: los `circleRadius: 24` de su capa más
 * los 2,4 de `circleStrokeWidth`, que MapLibre pinta por fuera del radio.
 * El halo vive dentro del grupo del bus, escalado a BUS_PT, así que se
 * pasa a unidades de la cápsula: 26,4 × 60 / 25,1 ≈ 63. Antes daba 81: en
 * la app el halo se quedó en 24 cuando el bus suelto creció, así que medido
 * contra la cápsula ahora es más chico, aunque en la pantalla mida lo mismo.
 */
const HALO_R = ((24 + 2.4) * BUS_ALTO) / BUS_PT;

/**
 * Radio "cerca de ti" que la app pinta alrededor del punto de espera:
 * `nearbyRadiusMeters` de nearby_buses_provider.dart. No es el radio del
 * aviso (ese es de 1 km, en proximity_alerts_provider.dart).
 */
const RADIO_CERCA_M = 2000;

/**
 * Encuadre de la cámara sobre el mapa, en fracciones del mismo.
 *
 * Es el mapa entero, porque el mapa ya es la pantalla: la captura mide
 * 402 x 875 puntos —el iPhone que reproduce el mockup— al zoom de la vista
 * del pin en la app (ZOOM_GL en gen_mapa_landing.py dice de dónde sale),
 * y va centrada en un tramo norte de la C16. Son unos 5,2 km de ancho a
 * ~6,5 m por unidad: el radio de 2 km mide lo mismo que en el teléfono y
 * entra entero, y el pin y sus buses se separan lo mismo que allá.
 *
 * Antes era una ventana de 560 x 1188 dentro de un mosaico z13 raster de
 * toda la red, y de ahí salían sus dos defectos: de cerca las calles se
 * emborronaban y el rótulo «BARRANQUILLA», dibujado para ese zoom, cruzaba
 * la pantalla en letras enormes. El render vectorial pinta rótulos y
 * edificios al tamaño que les da la app.
 */
const CAMARA = { x: 0, y: 0, w: 1, h: 1 };

const nuevo = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
  document.createElementNS(SVG_NS, tag);

/**
 * Cada teléfono lleva sus propios degradados, con un sufijo que no se
 * repite. Con los mismos id en los cinco mapas de la página, `url(#pinGrad)`
 * resolvía al primero del documento, que es el del teléfono lateral del
 * hero; en móvil ese teléfono va con `display: none`, y un degradado que
 * vive dentro de algo oculto no pinta: el pin salía como un disco blanco y
 * los buses como un contorno vacío.
 */
let instancias = 0;

export class PhoneMap {
  readonly rutas: RutaLanding[] = YV_RUTAS.rutas;
  readonly mapa: MapaBase = YV_RUTAS.mapa;
  activeRoute: RutaLanding;

  readonly #svg: SVGSVGElement;
  readonly #host: HTMLElement;
  readonly #lienzo: { w: number; h: number };
  readonly #camara: { x: number; y: number; w: number; h: number };

  readonly #casingEl: SVGPathElement;
  readonly #activeEl: SVGPathElement;
  readonly #terminalsEl: SVGGElement;
  readonly #radioEl: SVGCircleElement;
  readonly #markersEl: SVGGElement;
  readonly #pinNode: SVGGElement;
  readonly #busNodes: SVGGElement[] = [];
  readonly #sufijo: string;

  #largo = 0;
  #unitsPerPx = 1;
  #busScale = 1;
  #pinScale = 1;
  /** Radio de las terminales, ya en unidades del mosaico. */
  #terminalR = 7;
  #pinT: number | null = null;
  #busTs: number[] = [];

  /**
   * El `resize` pide la medida para el cuadro y no la hace en el acto: en
   * el móvil la barra de direcciones lo dispara a cada tirón del scroll, y
   * son cinco mapas en la portada. Varios avisos seguidos se quedan en una
   * sola lectura, que cae antes de pintar (e2e/resize-agrupado.spec.ts).
   */
  #medida = 0;
  readonly #onResize = (): void => {
    if (this.#medida) return;
    this.#medida = requestAnimationFrame(() => {
      this.#medida = 0;
      this.#medir();
    });
  };

  constructor(svg: SVGSVGElement, host: HTMLElement) {
    this.#svg = svg;
    this.#host = host;
    this.#sufijo = String(++instancias);

    const [vx, vy, w, h] = YV_RUTAS.viewBox;
    this.#camara = {
      x: vx + w * CAMARA.x,
      y: vy + h * CAMARA.y,
      w: w * CAMARA.w,
      h: h * CAMARA.h,
    };
    this.#lienzo = { w: this.#camara.w, h: this.#camara.h };
    this.activeRoute = this.rutas[0];

    this.#svg.replaceChildren();
    // Encuadre fijo sobre el tronco de las rutas. `slice` lo escala hasta
    // cubrir la pantalla del teléfono y recorta lo que sobre, sin deformar
    // nada. La imagen sigue entrando entera: lo que la recorta es esto.
    this.#svg.setAttribute('viewBox',
      `${this.#camara.x} ${this.#camara.y} ${this.#camara.w} ${this.#camara.h}`);
    this.#svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');

    const s = this.#sufijo;
    const defs = nuevo('defs');
    defs.innerHTML = `
      <linearGradient id="busBody-${s}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#EF978E"/>
        <stop offset="100%" stop-color="#E86A5E"/>
      </linearGradient>
      <clipPath id="busClip-${s}">
        <rect x="-16" y="-30" width="32" height="60" rx="16"/>
      </clipPath>
      <radialGradient id="busHalo-${s}">
        <stop offset="0" stop-color="#FFC72C" stop-opacity="0.97"/>
        <stop offset="0.25" stop-color="#FFCA36" stop-opacity="0.99"/>
        <stop offset="0.4" stop-color="#FFD660" stop-opacity="1"/>
        <stop offset="0.55" stop-color="#FFE48F" stop-opacity="0.84"/>
        <stop offset="0.7" stop-color="#FFEEB1" stop-opacity="0.52"/>
        <stop offset="0.85" stop-color="#FFF3C3" stop-opacity="0.16"/>
        <stop offset="1" stop-color="#FFF3C4" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="pinGrad-${s}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4ADE80"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>
      <linearGradient id="pinOjo-${s}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#065F46"/>
        <stop offset="100%" stop-color="#00A859"/>
      </linearGradient>`;
    this.#svg.appendChild(defs);

    const img = nuevo('image');
    img.setAttribute('href', this.mapa.src);
    // href basta en navegadores actuales; xlink:href es el respaldo.
    img.setAttributeNS(XLINK, 'xlink:href', this.mapa.src);
    img.setAttribute('x', String(vx));
    img.setAttribute('y', String(vy));
    img.setAttribute('width', String(w));
    img.setAttribute('height', String(h));
    this.#svg.appendChild(img);

    // Radio "cerca de ti": debajo de la ruta, como en la app, donde la
    // capa de relleno va antes que la polilínea.
    this.#radioEl = nuevo('circle');
    this.#radioEl.setAttribute('class', 'map-radio');
    this.#svg.appendChild(this.#radioEl);

    // Ruta activa: la orla blanca y encima la línea verde, las dos capas
    // que map_widget.dart le pone a la ruta (estilo_ruta.dart) y las
    // mismas del mapa de «El producto».
    this.#casingEl = nuevo('path');
    this.#casingEl.setAttribute('class', 'map-route-casing');
    this.#svg.appendChild(this.#casingEl);

    this.#activeEl = nuevo('path');
    this.#activeEl.setAttribute('class', 'map-route-active');
    this.#svg.appendChild(this.#activeEl);

    this.#terminalsEl = nuevo('g');
    this.#terminalsEl.setAttribute('class', 'map-terminals');
    this.#svg.appendChild(this.#terminalsEl);

    this.#markersEl = nuevo('g');
    this.#markersEl.setAttribute('class', 'map-markers');
    this.#svg.appendChild(this.#markersEl);

    this.#pinNode = PhoneMap.#makePin(this.#sufijo);
    this.#markersEl.appendChild(this.#pinNode);

    this.setRoute(this.activeRoute.id);
    this.#medir();
    window.addEventListener('resize', this.#onResize, { passive: true });
  }

  destroy(): void {
    window.removeEventListener('resize', this.#onResize);
    cancelAnimationFrame(this.#medida);
    this.#medida = 0;
  }

  /* ---------- Escala ---------- */

  /**
   * Lo que mide el mapa en píxeles propios, no en los de la pantalla.
   *
   * Los dos son lo mismo salvo cuando la escena va encogida para caber
   * en la ventana; entonces el rectángulo viene ya reducido y hay que
   * deshacerlo, o el bus y el pin —que se dibujan en píxeles del
   * teléfono— saldrían del tamaño que tendrían sin encoger.
   */
  #caja(): { width: number; height: number } {
    const rect = this.#host.getBoundingClientRect();
    const k = encajeDe(this.#host);
    return { width: rect.width / k, height: rect.height / k };
  }

  /**
   * Cuántas unidades del mosaico ocupa un píxel de pantalla. Con
   * `slice` el SVG se escala por el lado que más aumento necesita, así
   * que manda el menor de los dos cocientes.
   */
  #medir(): void {
    const rect = this.#caja();
    if (rect.width > 0 && rect.height > 0) {
      this.#unitsPerPx = Math.min(this.#lienzo.w / rect.width, this.#lienzo.h / rect.height);
    }
    const pt = rect.width / ANCHO_PANTALLA_PT;
    this.#busScale = (BUS_PT * pt * this.#unitsPerPx) / BUS_ALTO;
    this.#pinScale = (PIN_PT * pt * this.#unitsPerPx) / PIN_ALTO;
    this.#terminalR = 7 * pt * this.#unitsPerPx;
    this.#drawTerminales();
    this.#drawPin();
    this.#drawBuses();
  }

  /** Las terminales también se miden aquí, y no sólo al elegir ruta: si
   *  no, al cambiar el ancho de la ventana se quedaban con el radio del
   *  tamaño anterior. */
  #drawTerminales(): void {
    const r = this.#terminalR.toFixed(1);
    for (const c of Array.from(this.#terminalsEl.children)) {
      c.setAttribute('r', r);
    }
  }

  /* ---------- Marcadores ---------- */

  /**
   * Cápsula roja: la misma geometría que createFlatTransitMarker(). Va
   * dentro de un halo que sólo se ve cuando el bus está elegido: es la
   * capa 'bus-selected-halo-layer' de map_widget.dart, con su dorado y su
   * filo claro.
   *
   * El halo es un degradado y no un disco con borde porque así lo pinta
   * MapLibre: con `circleBlur: 0.75` la opacidad cae, en una curva
   * smoothstep, desde un cuarto del radio hasta el borde, y el color pasa
   * del dorado del relleno al crema del filo por el camino. Las paradas de
   * `busHalo` son esa cuenta con los valores en reposo —relleno 0,55, filo
   * 0,9— llevada a 1 en el punto más opaco, que cae en el 0,4; cuánto se
   * ve el conjunto lo pone el latido del CSS. El latido de la app también
   * mueve el desenfoque, de 0,5 a 0,95; aquí se queda en el 0,75 de
   * reposo. Antes era un círculo liso con un trazo, porque un filtro de
   * desenfoque por bus cuesta demasiado; un degradado no cuesta nada, y al
   * tamaño de la app un disco duro de 22 puntos parecía una moneda pegada
   * al bus.
   */
  static #makeBus(s: string): SVGGElement {
    const g = nuevo('g');
    g.setAttribute('class', 'map-bus');
    g.innerHTML = `
      <circle class="map-bus-halo" r="${HALO_R.toFixed(1)}" fill="url(#busHalo-${s})"/>
      <g class="map-bus-art">
        <rect x="-16" y="-30" width="32" height="60" rx="16" fill="url(#busBody-${s})"/>
        <ellipse cx="0" cy="-15.6" rx="11.5" ry="7.8" fill="#FFFFFF" opacity="0.3"
                 clip-path="url(#busClip-${s})"/>
        <rect x="-16" y="-30" width="32" height="60" rx="16" fill="none"
              stroke="#FFFFFF" stroke-width="2.6" stroke-opacity="0.92"/>
      </g>`;
    return g;
  }

  /**
   * Gota verde del punto de espera, anclada en la punta: los mismos trazos
   * que createPinMarker(), en el mismo orden. El brillo largo de arriba, el
   * disco blanco, el ojo con su degradado en diagonal y la chispita
   * descentrada no son adorno: sin ellos el pin se ve como una calcomanía
   * plana y el de la app no lo es.
   */
  static #makePin(s: string): SVGGElement {
    const g = nuevo('g');
    g.setAttribute('class', 'map-pin');
    g.innerHTML = `
      <g class="map-pin-art" transform="translate(-40 -76)">
        <path d="M40 76 Q10 48 14 30 A26 26 0 1 1 66 30 Q70 48 40 76 Z" fill="url(#pinGrad-${s})"/>
        <ellipse cx="40" cy="14" rx="12" ry="4.5" fill="#FFFFFF" opacity="0.2"/>
        <circle cx="40" cy="30" r="12.5" fill="#FFFFFF"/>
        <circle cx="40" cy="30" r="8.5" fill="url(#pinOjo-${s})"/>
        <circle cx="37.5" cy="27" r="2.2" fill="#FFFFFF" opacity="0.85"/>
      </g>`;
    return g;
  }

  /* ---------- Ruta activa ---------- */

  setRoute(routeId: string): void {
    const route = this.rutas.find(r => r.id === routeId);
    if (!route) return;
    this.activeRoute = route;

    this.#casingEl.setAttribute('d', route.d);
    this.#activeEl.setAttribute('d', route.d);
    this.#largo = this.#activeEl.getTotalLength();

    this.#terminalsEl.replaceChildren();
    for (const [x, y] of route.extremos) {
      const c = nuevo('circle');
      c.setAttribute('cx', String(x));
      c.setAttribute('cy', String(y));
      // `circleRadius: 7` de map_widget.dart son 7 puntos de la pantalla
      // del teléfono, no 7 unidades del mosaico ni 7 píxeles de la
      // ventana: se pasan a la escala del lienzo en `medir()`, igual que
      // el bus y el pin, para que midan lo mismo en el teléfono grande
      // del hero y en los chicos de la solución.
      c.setAttribute('r', this.#terminalR.toFixed(1));
      this.#terminalsEl.appendChild(c);
    }

    this.#drawRadio();
    this.#drawPin();
    this.#drawBuses();
  }

  /**
   * Longitud del recorrido activo, en metros, medida sobre el trazo que
   * se dibuja. Así el pin, los buses, el radio y la cifra de la hoja usan
   * la misma regla: 1 km en la hoja es 1 km sobre el mapa.
   */
  get metrosDeRuta(): number {
    return this.#largo * this.#metrosPorUnidad;
  }

  /**
   * Escala del mosaico: la calcula gen_mapa_landing.py con el zoom y la
   * latitud del render, no con los datos de la ruta. Antes salía de
   * dividir `km` entre el largo del trazo, y el `km` declarado no es el
   * del recorrido —la C16 dice 62,6 y su polilínea mide 59,7—, así que
   * el radio de 2 km salía un 5 % más chico que el de la app.
   */
  get #metrosPorUnidad(): number {
    return YV_RUTAS.metrosPorUnidad;
  }

  /** Punto en unidades del SVG. t: 0 = terminal A, 1 = terminal B. */
  pointAt(t: number): Punto | null {
    if (!this.#largo) return null;
    const clamped = Math.max(0, Math.min(1, t));
    return this.#activeEl.getPointAtLength(clamped * this.#largo);
  }

  /**
   * El punto del recorrido que deja la escena centrada en la parte del
   * mapa que de verdad se ve.
   *
   * La pantalla no está despejada entera: arriba tapan la píldora y el
   * chip, y abajo la hoja de distancia. `fx` y `fy` son el centro de esa
   * franja libre, en fracciones del alto y el ancho del teléfono, y
   * `atras` son los metros a los que nacen los buses por detrás del pin.
   * Se devuelve el `t` que deja al pin y a sus buses lo más cerca posible
   * de ese centro, midiendo por el peor de todos: así no entra uno y se
   * queda el otro fuera de cuadro.
   */
  tVisible(fx: number, fy: number, atras: number[] = [], muestras = 360): number {
    const rect = this.#caja();
    if (!this.#largo || rect.width === 0 || rect.height === 0) return 0.5;

    // De fracción de pantalla a unidades del mosaico. Con `slice` el
    // contenido queda centrado en la cámara, así que el desvío es simétrico
    // respecto al centro del recorte —no del mosaico entero.
    const cx = (fx - 0.5) * rect.width * this.#unitsPerPx + this.#camara.x + this.#camara.w / 2;
    const cy = (fy - 0.5) * rect.height * this.#unitsPerPx + this.#camara.y + this.#camara.h / 2;

    const metros = this.metrosDeRuta;
    const saltos = metros > 0 ? atras.map(m => m / metros) : [];

    let mejor = 0;
    let peorMinimo = Infinity;
    for (let i = 0; i < muestras; i += 1) {
      const t = i / muestras;
      let peor = 0;
      for (const salto of [0, ...saltos]) {
        const p = this.pointAt((t - salto + 1) % 1);
        if (!p) continue;
        peor = Math.max(peor, (p.x - cx) ** 2 + (p.y - cy) ** 2);
      }
      if (peor < peorMinimo) {
        peorMinimo = peor;
        mejor = t;
      }
    }
    return mejor;
  }

  /** Rumbo en grados, midiendo un tramo corto hacia adelante. */
  headingAt(t: number): number {
    if (!this.#largo) return 0;
    const step = Math.min(0.004, 12 / this.#largo);
    const a = this.pointAt(t);
    const b = this.pointAt(Math.min(1, t + step)) ?? a;
    if (!a || !b) return 0;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return 0;
    // La cápsula apunta hacia -y en reposo.
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  }

  /* ---------- Colocación ---------- */

  setPin(t: number): void {
    this.#pinT = t;
    this.#drawPin();
    this.#drawRadio();
  }

  #drawPin(): void {
    if (this.#pinT === null) return;
    const p = this.pointAt(this.#pinT);
    if (!p) return;
    this.#pinNode.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${this.#pinScale})`);
  }

  #drawRadio(): void {
    if (this.#pinT === null || !this.#metrosPorUnidad) return;
    const p = this.pointAt(this.#pinT);
    if (!p) return;
    this.#radioEl.setAttribute('cx', String(p.x));
    this.#radioEl.setAttribute('cy', String(p.y));
    this.#radioEl.setAttribute('r', (RADIO_CERCA_M / this.#metrosPorUnidad).toFixed(1));
  }

  /** Coloca tantos buses como valores de t reciba, orientados a su rumbo. */
  setBuses(ts: number[]): void {
    this.#busTs = ts;
    while (this.#busNodes.length < ts.length) {
      const node = PhoneMap.#makeBus(this.#sufijo);
      // Encima del pin. El pin es del usuario, pero es un punto quieto y
      // el bus es la noticia: debajo, el disco del pin se lo comía justo
      // en el momento en que hay que verlo llegar.
      this.#markersEl.appendChild(node);
      this.#busNodes.push(node);
    }
    this.#busNodes.forEach((node, i) => {
      node.style.display = i < ts.length ? '' : 'none';
    });
    this.#drawBuses();
  }

  #drawBuses(): void {
    this.#busTs.forEach((t, i) => {
      const node = this.#busNodes[i];
      if (!node) return;
      const p = this.pointAt(t);
      if (!p) return;
      const deg = this.headingAt(t);
      node.setAttribute(
        'transform',
        `translate(${p.x} ${p.y}) rotate(${deg.toFixed(1)}) scale(${this.#busScale})`
      );
    });
  }

  showPin(on: boolean): void {
    this.#pinNode.classList.toggle('is-on', on);
    this.#radioEl.classList.toggle('is-on', on);
  }

  showBuses(on: boolean): void {
    for (const n of this.#busNodes) n.classList.toggle('is-on', on);
  }

  /**
   * El bus al que la hoja le sigue el rastro. `null` los deja a todos sin
   * marcar, que es como están mientras nadie ha tocado ninguno.
   */
  setBusElegido(indice: number | null): void {
    this.#busNodes.forEach((n, i) => n.classList.toggle('is-elegida', i === indice));
  }

  /** El nodo de un bus, para que el guion pueda poner el dedo encima. */
  nodoBus(indice: number): SVGGElement | null {
    return this.#busNodes[indice] ?? null;
  }

  showRoute(on: boolean): void {
    this.#casingEl.classList.toggle('is-on', on);
    this.#activeEl.classList.toggle('is-on', on);
    this.#terminalsEl.classList.toggle('is-on', on);
  }
}
