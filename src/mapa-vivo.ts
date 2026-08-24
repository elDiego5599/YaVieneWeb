/**
 * MapaVivo — la app, jugable, en la propia página.
 *
 * Hasta aquí la landing enseña teléfonos: se miran. Esta sección se toca.
 * Es el mismo material de la app —el mosaico de Barranquilla en CARTO
 * Voyager, las seis polilíneas reales de Sobusa, el radio de aviso de un
 * kilómetro— pero a tamaño de escritorio y con el mando en la mano del que
 * visita: elige ruta, marca dónde espera y ve el aviso saltar.
 *
 * Lo único simulado son los buses. Las rutas, los kilómetros, las
 * distancias y el texto del aviso salen del repositorio; el bus de esta
 * página avanza a un ritmo fijo porque aquí no hay un conductor con la app
 * abierta. La sección lo dice con todas las letras encima del mapa: no hay
 * nada que aparentar.
 *
 * Todo vive en el espacio de usuario del SVG —pin, buses y radio son
 * elementos SVG, no divs en porcentajes—, así que el mapa se puede
 * redimensionar sin que los marcadores se vayan a la deriva.
 */

import { YV_RUTAS } from './data/rutas-landing';
import { sinMovimiento } from './scrolly';
import type { Punto, RutaLanding } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';

/** El radio del aviso automático: `proximity_alerts_provider.dart`. */
const RADIO_AVISO_M = 1000;

/** Los dos buses del piloto, con el identificador que ya llevan en la app. */
const BUSES = ['B-042', 'B-055'];

/** Dónde nacen, por detrás del punto de espera y sobre la ruta, en metros. */
const SALIDA_M = [1850, 4300];

/**
 * Ritmo del bus simulado, en metros por segundo. No sale de ningún dato:
 * es el que deja ver el aviso entrar y salir sin que haya que esperar el
 * viaje entero. Por eso la sección avisa de que el bus va simulado.
 *
 * Va despacio a propósito: lo que se está enseñando es cómo el bus se
 * acerca, entra al kilómetro y dispara el aviso, y eso hay que poder
 * seguirlo con la vista sin volver a mirar.
 */
const RITMO_M_S = 110;

/** Tamaño en pantalla de los marcadores, a cualquier tamaño de mapa. */
const BUS_PX = 30;
const PIN_PX = 44;
const BUS_ALTO = 60;
const PIN_ALTO = 76;

/** Muestras para encontrar el punto de la ruta más cercano a un toque. */
const MUESTRAS = 420;

const nuevo = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
  document.createElementNS(SVG_NS, tag);

/** Redondeo de la lectura pública: cambia de cien en cien metros. */
const redondear = (m: number): number =>
  Math.max(100, Math.round(m / 100) * 100);

/** Lectura de distancia de la app: metros hasta el kilómetro, después km. */
const legible = (m: number): string =>
  m < 1000 ? `${redondear(m)} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;

interface Bus {
  placa: string;
  nodo: SVGGElement;
  /** Posición sobre el recorrido, de 0 a 1. */
  t: number;
  /** Metros que le faltan para el punto de espera, en línea recta. */
  metros: number;
}

export class MapaVivo {
  private readonly raiz: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly lienzo: HTMLElement;
  private readonly lista: HTMLElement;
  private readonly aviso: HTMLElement;
  private readonly avisoTitulo: HTMLElement;
  private readonly avisoCuerpo: HTMLElement;
  private readonly lectura: HTMLElement;
  private readonly lecturaBus: HTMLElement;
  private readonly lecturaMetros: HTMLElement;
  private readonly lecturaPie: HTMLElement;

  private readonly casing: SVGPathElement;
  private readonly activa: SVGPathElement;
  private readonly terminales: SVGGElement;
  private readonly radio: SVGCircleElement;
  private readonly pin: SVGGElement;
  private readonly buses: Bus[] = [];

  private ruta: RutaLanding;
  private largo = 0;
  private unidadesPorPx = 1;
  private pinPunto: Punto = { x: 0, y: 0 };
  /** El punto del recorrido más cercano al pin: desde ahí llegan los buses. */
  private pinT = 0;
  /** Lo que separa el punto de espera del recorrido, en metros. */
  private aparte = 0;
  private avisado = false;
  private cuadro = 0;
  private ultimo = 0;
  private vigia: IntersectionObserver | null = null;

  private readonly alRedimensionar = (): void => this.medir();

  constructor(raiz: HTMLElement) {
    this.raiz = raiz;
    this.svg = req<SVGSVGElement>(raiz, '[data-mapa-svg]');
    this.lienzo = req<HTMLElement>(raiz, '[data-mapa-lienzo]');
    this.lista = req<HTMLElement>(raiz, '[data-mapa-rutas]');
    this.aviso = req<HTMLElement>(raiz, '[data-mapa-aviso]');
    this.avisoTitulo = req<HTMLElement>(raiz, '[data-mapa-aviso-titulo]');
    this.avisoCuerpo = req<HTMLElement>(raiz, '[data-mapa-aviso-cuerpo]');
    this.lectura = req<HTMLElement>(raiz, '[data-mapa-lectura]');
    this.lecturaBus = req<HTMLElement>(raiz, '[data-mapa-bus]');
    this.lecturaMetros = req<HTMLElement>(raiz, '[data-mapa-metros]');
    this.lecturaPie = req<HTMLElement>(raiz, '[data-mapa-lectura-pie]');

    // La C16 Calle 72 Uninorte es la que abre el resto de la página.
    this.ruta = YV_RUTAS.rutas.find(r => r.id === 'R-106') ?? YV_RUTAS.rutas[0];

    const [vx, vy, w, h] = YV_RUTAS.viewBox;
    this.svg.replaceChildren();
    this.svg.setAttribute('viewBox', `${vx} ${vy} ${w} ${h}`);
    // La ciudad entera y sin recortar: las seis rutas van de Granabastos al
    // norte, y cualquier recorte se come una terminal.
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const defs = nuevo('defs');
    defs.innerHTML = `
      <linearGradient id="mvBus" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#EF978E"/>
        <stop offset="100%" stop-color="#E86A5E"/>
      </linearGradient>
      <clipPath id="mvBusClip">
        <rect x="-16" y="-30" width="32" height="60" rx="16"/>
      </clipPath>
      <linearGradient id="mvPin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4ADE80"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>`;
    this.svg.appendChild(defs);

    const img = nuevo('image');
    img.setAttribute('href', YV_RUTAS.mapa.src);
    img.setAttributeNS(XLINK, 'xlink:href', YV_RUTAS.mapa.src);
    img.setAttribute('x', String(vx));
    img.setAttribute('y', String(vy));
    img.setAttribute('width', String(w));
    img.setAttribute('height', String(h));
    this.svg.appendChild(img);

    this.radio = nuevo('circle');
    this.radio.setAttribute('class', 'mv-radio');
    this.svg.appendChild(this.radio);

    this.casing = nuevo('path');
    this.casing.setAttribute('class', 'mv-casing');
    this.svg.appendChild(this.casing);

    this.activa = nuevo('path');
    this.activa.setAttribute('class', 'mv-activa');
    this.svg.appendChild(this.activa);

    this.terminales = nuevo('g');
    this.terminales.setAttribute('class', 'mv-terminales');
    this.svg.appendChild(this.terminales);

    this.pin = MapaVivo.hacerPin();
    this.svg.appendChild(this.pin);

    // Los buses van encima del pin: el pin es una marca fija y lo que hay
    // que ver moverse es el bus.
    for (const placa of BUSES) {
      const nodo = MapaVivo.hacerBus();
      this.svg.appendChild(nodo);
      this.buses.push({ placa, nodo, t: 0, metros: Infinity });
    }

    this.pintarLista();
    this.setRuta(this.ruta.id);
    this.medir();

    this.svg.addEventListener('pointerdown', e => this.alTocar(e));
    window.addEventListener('resize', this.alRedimensionar, { passive: true });

    // Sin animaciones el mapa se queda como una foto: ruta, punto y buses
    // en su sitio, que es lo que la sección tiene que decir.
    if (sinMovimiento()) {
      this.dibujarBuses();
      this.actualizarLectura();
      return;
    }

    this.vigia = new IntersectionObserver(
      ([entrada]) => this.correr(entrada?.isIntersecting ?? false),
      { threshold: 0.12 }
    );
    this.vigia.observe(raiz);
  }

  destroy(): void {
    window.removeEventListener('resize', this.alRedimensionar);
    this.vigia?.disconnect();
    this.vigia = null;
    if (this.cuadro) cancelAnimationFrame(this.cuadro);
    this.cuadro = 0;
  }

  /* ---------- Piezas ---------- */

  private static hacerBus(): SVGGElement {
    const g = nuevo('g');
    g.setAttribute('class', 'mv-bus');
    g.innerHTML = `
      <rect x="-16" y="-30" width="32" height="60" rx="16" fill="url(#mvBus)"/>
      <ellipse cx="0" cy="-15.6" rx="11.5" ry="7.8" fill="#FFFFFF" opacity="0.3"
               clip-path="url(#mvBusClip)"/>
      <rect x="-16" y="-30" width="32" height="60" rx="16" fill="none"
            stroke="#FFFFFF" stroke-width="2.6" stroke-opacity="0.92"/>`;
    return g;
  }

  private static hacerPin(): SVGGElement {
    const g = nuevo('g');
    g.setAttribute('class', 'mv-pin');
    g.innerHTML = `
      <g transform="translate(-40 -76)">
        <path d="M40 76 Q10 48 14 30 A26 26 0 1 1 66 30 Q70 48 40 76 Z" fill="url(#mvPin)"/>
        <circle cx="40" cy="30" r="12.5" fill="#FFFFFF"/>
        <circle cx="40" cy="30" r="8.5" fill="#047857"/>
      </g>`;
    return g;
  }

  /** El riel de rutas: las seis de rutas.json, con sus terminales y su largo. */
  private pintarLista(): void {
    const marco = document.createDocumentFragment();
    for (const ruta of YV_RUTAS.rutas) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'mv-ruta';
      boton.dataset.ruta = ruta.id;
      boton.setAttribute('aria-pressed', String(ruta.id === this.ruta.id));
      boton.innerHTML =
        `<span class="mv-ruta-nombre">${ruta.nombre}</span>` +
        `<span class="mv-ruta-datos">${ruta.terminalA} → ${ruta.terminalB}</span>` +
        `<span class="mv-ruta-km">${String(ruta.km).replace('.', ',')} km</span>`;
      boton.addEventListener('click', () => this.setRuta(ruta.id));
      marco.appendChild(boton);
    }
    this.lista.replaceChildren(marco);
  }

  /* ---------- Escala ---------- */

  private medir(): void {
    const caja = this.lienzo.getBoundingClientRect();
    const [, , w, h] = YV_RUTAS.viewBox;
    if (caja.width > 0 && caja.height > 0) {
      // Con `meet` manda el lado que menos aumento admite.
      this.unidadesPorPx = Math.max(w / caja.width, h / caja.height);
    }
    this.pin.setAttribute('data-escala', String((PIN_PX * this.unidadesPorPx) / PIN_ALTO));
    this.dibujarPin();
    this.dibujarBuses();
    this.dibujarTerminales();
  }

  /** Metros que mide una unidad del mosaico, deducido del kilometraje real. */
  private get metrosPorUnidad(): number {
    return this.largo > 0 ? (this.ruta.km * 1000) / this.largo : 0;
  }

  private punto(t: number): Punto {
    const acotado = t < 0 ? 0 : t > 1 ? 1 : t;
    return this.activa.getPointAtLength(acotado * this.largo);
  }

  private rumbo(t: number): number {
    const paso = Math.min(0.004, 12 / Math.max(1, this.largo));
    const a = this.punto(t);
    const b = this.punto(Math.min(1, t + paso));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return 0;
    return (Math.atan2(dx, -dy) * 180) / Math.PI;
  }

  /* ---------- Ruta y punto de espera ---------- */

  private setRuta(id: string): void {
    const ruta = YV_RUTAS.rutas.find(r => r.id === id);
    if (!ruta) return;
    this.ruta = ruta;

    this.casing.setAttribute('d', ruta.d);
    this.activa.setAttribute('d', ruta.d);
    this.largo = this.activa.getTotalLength();

    for (const boton of this.lista.querySelectorAll<HTMLElement>('[data-ruta]')) {
      boton.setAttribute('aria-pressed', String(boton.dataset.ruta === id));
    }

    this.dibujarTerminales();
    // Al cambiar de ruta el punto de espera se queda donde estaba, pero su
    // referencia sobre el recorrido cambia: hay que rehacerla.
    const primera = this.pinPunto.x === 0 && this.pinPunto.y === 0;
    this.ponerPin(primera ? this.punto(this.tCentral()) : this.pinPunto);
  }

  private dibujarTerminales(): void {
    this.terminales.replaceChildren();
    for (const [x, y] of this.ruta.extremos) {
      const c = nuevo('circle');
      c.setAttribute('cx', String(x));
      c.setAttribute('cy', String(y));
      c.setAttribute('r', (7 * this.unidadesPorPx).toFixed(1));
      this.terminales.appendChild(c);
    }
  }

  /** El toque del visitante, pasado del espacio de la pantalla al del SVG. */
  private alTocar(evento: PointerEvent): void {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(evento.clientX, evento.clientY).matrixTransform(ctm.inverse());
    this.ponerPin({ x: p.x, y: p.y });
    this.raiz.classList.add('es-tocado');
  }

  private ponerPin(destino: Punto): void {
    this.pinPunto = destino;
    this.pinT = this.tMasCercano(destino);
    const cerca = this.punto(this.pinT);
    this.aparte =
      Math.hypot(cerca.x - destino.x, cerca.y - destino.y) * this.metrosPorUnidad;
    this.avisado = false;
    this.aviso.classList.remove('is-on');
    this.dibujarPin();
    this.reponerBuses();
    this.actualizarLectura();
  }

  /**
   * El punto del recorrido más cercano al centro del mapa. Es donde nace
   * el pin la primera vez: puesto en un extremo se pega al borde de la
   * tarjeta y no se entiende que se puede mover.
   */
  private tCentral(): number {
    const [vx, vy, w, h] = YV_RUTAS.viewBox;
    return this.tMasCercano({ x: vx + w / 2, y: vy + h / 2 });
  }

  /** El punto del recorrido que queda más cerca del punto de espera. */
  private tMasCercano(p: Punto): number {
    let mejor = 0;
    let minimo = Infinity;
    for (let i = 0; i <= MUESTRAS; i += 1) {
      const t = i / MUESTRAS;
      const q = this.punto(t);
      const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (d < minimo) {
        minimo = d;
        mejor = t;
      }
    }
    return mejor;
  }

  private dibujarPin(): void {
    const escala = (PIN_PX * this.unidadesPorPx) / PIN_ALTO;
    this.pin.setAttribute(
      'transform',
      `translate(${this.pinPunto.x.toFixed(1)} ${this.pinPunto.y.toFixed(1)}) scale(${escala.toFixed(4)})`
    );
    const mpu = this.metrosPorUnidad;
    if (!mpu) return;
    this.radio.setAttribute('cx', this.pinPunto.x.toFixed(1));
    this.radio.setAttribute('cy', this.pinPunto.y.toFixed(1));
    this.radio.setAttribute('r', (RADIO_AVISO_M / mpu).toFixed(1));
  }

  /** Los buses vuelven a nacer por detrás del punto, sobre el recorrido. */
  private reponerBuses(): void {
    const metros = this.ruta.km * 1000;
    this.buses.forEach((bus, i) => {
      const atras = (SALIDA_M[i] ?? 2000) / metros;
      bus.t = (this.pinT - atras + 1) % 1;
    });
    this.dibujarBuses();
  }

  private dibujarBuses(): void {
    if (!this.largo) return;
    const escala = (BUS_PX * this.unidadesPorPx) / BUS_ALTO;
    const mpu = this.metrosPorUnidad;
    for (const bus of this.buses) {
      const p = this.punto(bus.t);
      bus.nodo.setAttribute(
        'transform',
        `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${this.rumbo(bus.t).toFixed(1)}) scale(${escala.toFixed(4)})`
      );
      const dx = p.x - this.pinPunto.x;
      const dy = p.y - this.pinPunto.y;
      bus.metros = Math.sqrt(dx * dx + dy * dy) * mpu;
    }
  }

  /* ---------- Movimiento ---------- */

  private correr(encendido: boolean): void {
    if (encendido === Boolean(this.cuadro)) return;
    if (!encendido) {
      cancelAnimationFrame(this.cuadro);
      this.cuadro = 0;
      return;
    }
    this.ultimo = performance.now();
    const paso = (ahora: number): void => {
      const dt = Math.min(0.1, (ahora - this.ultimo) / 1000);
      this.ultimo = ahora;
      this.avanzar(dt);
      this.cuadro = requestAnimationFrame(paso);
    };
    this.cuadro = requestAnimationFrame(paso);
  }

  private avanzar(dt: number): void {
    const metros = this.ruta.km * 1000;
    if (!metros) return;
    const salto = (RITMO_M_S * dt) / metros;

    let vuelta = false;
    for (const bus of this.buses) {
      bus.t += salto;
      if (bus.t > 1) {
        bus.t -= 1;
        vuelta = true;
      }
    }
    this.dibujarBuses();

    // Cuando el último ya dejó atrás el punto de espera, los dos vuelven a
    // nacer: la escena se repite sola sin que nadie tenga que tocar nada.
    const lejos = this.buses.every(b => b.metros > RADIO_AVISO_M * 2.4);
    const pasados = this.buses.every(b => this.pasoDeLargo(b));
    if (vuelta || (lejos && pasados)) {
      this.reponerBuses();
      this.avisado = false;
      this.aviso.classList.remove('is-on');
    }

    this.actualizarLectura();
  }

  /** Verdadero si el bus ya cruzó el punto de espera en su recorrido. */
  private pasoDeLargo(bus: Bus): boolean {
    const delta = (bus.t - this.pinT + 1) % 1;
    return delta > 0 && delta < 0.5;
  }

  private actualizarLectura(): void {
    const cerca = this.buses.reduce((a, b) => (b.metros < a.metros ? b : a));
    this.lecturaBus.textContent = `${this.ruta.nombre} - ${cerca.placa}`;
    this.lecturaMetros.textContent = legible(cerca.metros);
    const dentro = cerca.metros <= RADIO_AVISO_M;
    this.lectura.classList.toggle('es-cerca', dentro);

    // Si el recorrido ni siquiera roza el kilómetro del punto marcado, el
    // aviso no va a saltar nunca: más vale decirlo que dejar al que mira
    // esperando un número que no va a bajar.
    const fuera = this.aparte > RADIO_AVISO_M;
    this.lectura.classList.toggle('es-fuera', fuera);
    this.lecturaPie.textContent = fuera
      ? `esta ruta no pasa a menos de ${legible(this.aparte)} de tu punto`
      : 'en línea recta hasta tu punto';

    if (dentro && !this.avisado) {
      this.avisado = true;
      // Las mismas dos líneas que arma bus_notification_service.dart.
      this.avisoTitulo.textContent = `${this.ruta.nombre} - ${cerca.placa} está cerca de ti`;
      this.avisoCuerpo.textContent = `Está a ${redondear(cerca.metros)} m de tu ubicación`;
      this.aviso.classList.add('is-on');
    }
  }
}

function req<T extends Element>(raiz: ParentNode, sel: string): T {
  const el = raiz.querySelector<T>(sel);
  if (!el) throw new Error(`MapaVivo: falta ${sel}`);
  return el;
}
