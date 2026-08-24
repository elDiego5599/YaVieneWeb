/**
 * PhoneMap — el mapa del mockup, con el mismo material que ve el pasajero.
 *
 * El fondo es un mosaico real de Barranquilla en CARTO Voyager, el mismo
 * estilo que carga map_widget.dart, y encima va la polilínea azul de la
 * ruta activa con los waypoints reales de rutas.json. Los generó
 * scripts/gen_mapa_landing.py, así que fondo y trazado comparten el
 * encuadre Web Mercator: la ruta cae sobre las calles que le tocan.
 *
 * La cámara no se mueve. Antes reencuadraba sobre la ruta elegida y el
 * salto de zoom se veía mal; ahora enseña la ciudad entera y quieta, que
 * es como arranca la app (`zoom: 11.0` en map_widget.dart) y deja ver los
 * buses de lejos avanzando por su recorrido.
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
 * Tamaño en píxeles de pantalla de los marcadores, a cualquier tamaño de
 * teléfono. Se ven pequeños a propósito: la cámara enseña la ciudad
 * entera y un bus tiene que parecer un bus en una ciudad, no una chincheta.
 */
const BUS_PX = 19;
const PIN_PX = 28;

/** Alto del dibujo original de cada marcador, en unidades del SVG. */
const BUS_ALTO = 60;
const PIN_ALTO = 76;

/**
 * Radio "cerca de ti" que la app pinta alrededor del punto de espera:
 * `nearbyRadiusMeters` de nearby_buses_provider.dart. No es el radio del
 * aviso (ese es de 1 km, en proximity_alerts_provider.dart).
 */
const RADIO_CERCA_M = 2000;

/**
 * Encuadre de la cámara sobre el mosaico, en fracciones del mismo.
 *
 * No es un acercamiento: la ventana mide 934 x 1982, exactamente lo que
 * ya cabía en la pantalla del teléfono —la proporción es la misma, 72 a
 * 152,8—, así que el mapa se ve al mismo tamaño de siempre. Lo único que
 * cambia es dónde mira: corrida hasta el borde derecho y pegada arriba,
 * que es donde están el norte de la ciudad, la Vía 40 y Uninorte. Antes
 * el recorte iba centrado y se comía trozos de las seis rutas por el
 * este; así, ninguna baja del 78 % de su trazo a la vista.
 */
const CAMARA = { x: 350 / 1284, y: 0, w: 934 / 1284, h: 1 };

const nuevo = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
  document.createElementNS(SVG_NS, tag);

export class PhoneMap {
  readonly rutas: RutaLanding[] = YV_RUTAS.rutas;
  readonly mapa: MapaBase = YV_RUTAS.mapa;
  activeRoute: RutaLanding;

  private readonly svg: SVGSVGElement;
  private readonly host: HTMLElement;
  private readonly lienzo: { w: number; h: number };
  private readonly camara: { x: number; y: number; w: number; h: number };

  private readonly casingEl: SVGPathElement;
  private readonly activeEl: SVGPathElement;
  private readonly terminalsEl: SVGGElement;
  private readonly radioEl: SVGCircleElement;
  private readonly markersEl: SVGGElement;
  private readonly pinNode: SVGGElement;
  private readonly busNodes: SVGGElement[] = [];

  private largo = 0;
  private unitsPerPx = 1;
  private busScale = 1;
  private pinScale = 1;
  private pinT: number | null = null;
  private busTs: number[] = [];

  private readonly onResize = (): void => this.medir();

  constructor(svg: SVGSVGElement, host: HTMLElement) {
    this.svg = svg;
    this.host = host;

    const [vx, vy, w, h] = YV_RUTAS.viewBox;
    this.camara = {
      x: vx + w * CAMARA.x,
      y: vy + h * CAMARA.y,
      w: w * CAMARA.w,
      h: h * CAMARA.h,
    };
    this.lienzo = { w: this.camara.w, h: this.camara.h };
    this.activeRoute = this.rutas[0];

    this.svg.replaceChildren();
    // Encuadre fijo sobre el norte de la ciudad. `slice` lo escala hasta
    // cubrir la pantalla del teléfono y recorta lo que sobre, sin deformar
    // nada. La imagen sigue entrando entera: lo que la recorta es esto.
    this.svg.setAttribute('viewBox',
      `${this.camara.x} ${this.camara.y} ${this.camara.w} ${this.camara.h}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');

    const defs = nuevo('defs');
    defs.innerHTML = `
      <linearGradient id="busBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#EF978E"/>
        <stop offset="100%" stop-color="#E86A5E"/>
      </linearGradient>
      <clipPath id="busClip">
        <rect x="-16" y="-30" width="32" height="60" rx="16"/>
      </clipPath>
      <linearGradient id="pinGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4ADE80"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>`;
    this.svg.appendChild(defs);

    const img = nuevo('image');
    img.setAttribute('href', this.mapa.src);
    // href basta en navegadores actuales; xlink:href es el respaldo.
    img.setAttributeNS(XLINK, 'xlink:href', this.mapa.src);
    img.setAttribute('x', String(vx));
    img.setAttribute('y', String(vy));
    img.setAttribute('width', String(w));
    img.setAttribute('height', String(h));
    this.svg.appendChild(img);

    // Radio "cerca de ti": debajo de la ruta, como en la app, donde la
    // capa de relleno va antes que la polilínea.
    this.radioEl = nuevo('circle');
    this.radioEl.setAttribute('class', 'map-radio');
    this.svg.appendChild(this.radioEl);

    // Ruta activa: orla blanca abajo, azul encima — las dos capas que
    // apila map_widget.dart sobre MapLibre.
    this.casingEl = nuevo('path');
    this.casingEl.setAttribute('class', 'map-route-casing');
    this.svg.appendChild(this.casingEl);

    this.activeEl = nuevo('path');
    this.activeEl.setAttribute('class', 'map-route-active');
    this.svg.appendChild(this.activeEl);

    this.terminalsEl = nuevo('g');
    this.terminalsEl.setAttribute('class', 'map-terminals');
    this.svg.appendChild(this.terminalsEl);

    this.markersEl = nuevo('g');
    this.markersEl.setAttribute('class', 'map-markers');
    this.svg.appendChild(this.markersEl);

    this.pinNode = PhoneMap.makePin();
    this.markersEl.appendChild(this.pinNode);

    this.setRoute(this.activeRoute.id);
    this.medir();
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
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
  private caja(): { width: number; height: number } {
    const rect = this.host.getBoundingClientRect();
    const k = encajeDe(this.host);
    return { width: rect.width / k, height: rect.height / k };
  }

  /**
   * Cuántas unidades del mosaico ocupa un píxel de pantalla. Con
   * `slice` el SVG se escala por el lado que más aumento necesita, así
   * que manda el menor de los dos cocientes.
   */
  private medir(): void {
    const rect = this.caja();
    if (rect.width > 0 && rect.height > 0) {
      this.unitsPerPx = Math.min(this.lienzo.w / rect.width, this.lienzo.h / rect.height);
    }
    this.busScale = (BUS_PX * this.unitsPerPx) / BUS_ALTO;
    this.pinScale = (PIN_PX * this.unitsPerPx) / PIN_ALTO;
    this.drawPin();
    this.drawBuses();
  }

  /* ---------- Marcadores ---------- */

  /** Cápsula roja: la misma geometría que createFlatTransitMarker(). */
  private static makeBus(): SVGGElement {
    const g = nuevo('g');
    g.setAttribute('class', 'map-bus');
    g.innerHTML = `
      <g class="map-bus-art">
        <rect x="-16" y="-30" width="32" height="60" rx="16" fill="url(#busBody)"/>
        <ellipse cx="0" cy="-15.6" rx="11.5" ry="7.8" fill="#FFFFFF" opacity="0.3"
                 clip-path="url(#busClip)"/>
        <rect x="-16" y="-30" width="32" height="60" rx="16" fill="none"
              stroke="#FFFFFF" stroke-width="2.6" stroke-opacity="0.92"/>
      </g>`;
    return g;
  }

  /** Gota verde de assets/icons/pin.svg, anclada en la punta. */
  private static makePin(): SVGGElement {
    const g = nuevo('g');
    g.setAttribute('class', 'map-pin');
    g.innerHTML = `
      <g class="map-pin-art" transform="translate(-40 -76)">
        <path d="M40 76 Q10 48 14 30 A26 26 0 1 1 66 30 Q70 48 40 76 Z" fill="url(#pinGrad)"/>
        <circle cx="40" cy="30" r="12.5" fill="#FFFFFF"/>
        <circle cx="40" cy="30" r="8.5" fill="#047857"/>
      </g>`;
    return g;
  }

  /* ---------- Ruta activa ---------- */

  setRoute(routeId: string): void {
    const route = this.rutas.find(r => r.id === routeId);
    if (!route) return;
    this.activeRoute = route;

    this.casingEl.setAttribute('d', route.d);
    this.activeEl.setAttribute('d', route.d);
    this.largo = this.activeEl.getTotalLength();

    this.terminalsEl.replaceChildren();
    for (const [x, y] of route.extremos) {
      const c = nuevo('circle');
      c.setAttribute('cx', String(x));
      c.setAttribute('cy', String(y));
      // `circleRadius: 7` de map_widget.dart son 7 píxeles de pantalla, no
      // 7 unidades del mosaico: hay que pasarlos a la escala del lienzo o
      // las terminales salen tres veces más chicas de lo que deben.
      c.setAttribute('r', (7 * this.unitsPerPx).toFixed(1));
      this.terminalsEl.appendChild(c);
    }

    this.drawRadio();
    this.drawPin();
    this.drawBuses();
  }

  /** Longitud del recorrido activo, en metros. */
  get metrosDeRuta(): number {
    return this.activeRoute.km * 1000;
  }

  /**
   * Escala del mosaico, deducida de los propios datos: la ruta mide
   * `km` kilómetros y `largo` unidades de SVG. Salen ~9,6 m por unidad,
   * que es lo que toca a z13 en la latitud de Barranquilla.
   */
  private get metrosPorUnidad(): number {
    return this.largo > 0 ? this.metrosDeRuta / this.largo : 0;
  }

  /** Punto en unidades del SVG. t: 0 = terminal A, 1 = terminal B. */
  pointAt(t: number): Punto | null {
    if (!this.largo) return null;
    const clamped = Math.max(0, Math.min(1, t));
    return this.activeEl.getPointAtLength(clamped * this.largo);
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
    const rect = this.caja();
    if (!this.largo || rect.width === 0 || rect.height === 0) return 0.5;

    // De fracción de pantalla a unidades del mosaico. Con `slice` el
    // contenido queda centrado en la cámara, así que el desvío es simétrico
    // respecto al centro del recorte —no del mosaico entero.
    const cx = (fx - 0.5) * rect.width * this.unitsPerPx + this.camara.x + this.camara.w / 2;
    const cy = (fy - 0.5) * rect.height * this.unitsPerPx + this.camara.y + this.camara.h / 2;

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
    if (!this.largo) return 0;
    const step = Math.min(0.004, 12 / this.largo);
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
    this.pinT = t;
    this.drawPin();
    this.drawRadio();
  }

  private drawPin(): void {
    if (this.pinT === null) return;
    const p = this.pointAt(this.pinT);
    if (!p) return;
    this.pinNode.setAttribute('transform', `translate(${p.x} ${p.y}) scale(${this.pinScale})`);
  }

  private drawRadio(): void {
    if (this.pinT === null || !this.metrosPorUnidad) return;
    const p = this.pointAt(this.pinT);
    if (!p) return;
    this.radioEl.setAttribute('cx', String(p.x));
    this.radioEl.setAttribute('cy', String(p.y));
    this.radioEl.setAttribute('r', (RADIO_CERCA_M / this.metrosPorUnidad).toFixed(1));
  }

  /** Coloca tantos buses como valores de t reciba, orientados a su rumbo. */
  setBuses(ts: number[]): void {
    this.busTs = ts;
    while (this.busNodes.length < ts.length) {
      const node = PhoneMap.makeBus();
      // Encima del pin. El pin es del usuario, pero es un punto quieto y
      // el bus es la noticia: debajo, el disco del pin se lo comía justo
      // en el momento en que hay que verlo llegar.
      this.markersEl.appendChild(node);
      this.busNodes.push(node);
    }
    this.busNodes.forEach((node, i) => {
      node.style.display = i < ts.length ? '' : 'none';
    });
    this.drawBuses();
  }

  private drawBuses(): void {
    this.busTs.forEach((t, i) => {
      const node = this.busNodes[i];
      if (!node) return;
      const p = this.pointAt(t);
      if (!p) return;
      const deg = this.headingAt(t);
      node.setAttribute(
        'transform',
        `translate(${p.x} ${p.y}) rotate(${deg.toFixed(1)}) scale(${this.busScale})`
      );
    });
  }

  showPin(on: boolean): void {
    this.pinNode.classList.toggle('is-on', on);
    this.radioEl.classList.toggle('is-on', on);
  }

  showBuses(on: boolean): void {
    for (const n of this.busNodes) n.classList.toggle('is-on', on);
  }

  showRoute(on: boolean): void {
    this.casingEl.classList.toggle('is-on', on);
    this.activeEl.classList.toggle('is-on', on);
    this.terminalsEl.classList.toggle('is-on', on);
  }
}
