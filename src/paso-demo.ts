import type { PhoneMap } from './phone-map';
import { sinMovimiento } from './scrolly';

/**
 * El teléfono de cada momento de la solución, moviéndose solo.
 *
 * Los mockups de la sección no son fotos: cada uno repite en bucle el
 * gesto del que habla su texto —marcar el punto, elegir la ruta, armar el
 * aviso, quedarse sin señal—. El guion no inventa nada: las pantallas son
 * las mismas del hero y cada frase sale de la app (`location_status_chip`,
 * `route_selector_sheet`, `eta_bottom_sheet`, `bus_notification_service`).
 *
 * Sólo corre el que se está viendo. `pasos.ts` avisa cuál es el momento
 * activo y aquí se enciende ése y se apagan los demás, así la sección no
 * mantiene cuatro bucles y cuatro `requestAnimationFrame` a la vez.
 */

/** La C16, la misma ruta que enseñan el hero y el selector. */
const RUTA = 'R-106';

/**
 * El reloj del guion corre más rápido que el de la calle. Un bus real
 * avanza a unos 12 m/s, y a esa velocidad los seiscientos metros del
 * tercer momento tardarían casi un minuto: nadie se queda tanto rato
 * mirando un mockup. Se acorta el tiempo, nunca las distancias — los
 * metros que salen en pantalla son los que mide el recorrido de verdad.
 */
const METROS_POR_SEGUNDO = 58;

/** Radio del aviso de proximity_alerts_provider.dart. */
const RADIO_AVISO_M = 1000;

/** Centro de la franja de pantalla que no tapan la píldora ni la hoja. */
const MIRA_X = 0.5;
const MIRA_Y = 0.44;

export class PasoDemo {
  private readonly pantalla: HTMLElement;
  private readonly capa: SVGSVGElement | null;
  private readonly mapa: PhoneMap;
  private readonly guion: number;

  private readonly relojes: number[] = [];
  private cuadro = 0;
  private viva = false;
  private quieta = false;

  /** Punto de espera, en avance sobre el recorrido. */
  private pinT = 0;
  /** Posición de cada bus sobre el recorrido. */
  private buses: number[] = [];
  private ultimo = 0;
  private avisoPuesto = false;
  private refresco = 0;

  constructor(paso: HTMLElement, mapa: PhoneMap, guion: number) {
    const pantalla = paso.querySelector<HTMLElement>('.phone-screen');
    if (!pantalla) throw new Error('PasoDemo: el momento no trae teléfono');

    this.pantalla = pantalla;
    this.capa = paso.querySelector<SVGSVGElement>('.routes-svg-layer');
    this.mapa = mapa;
    this.guion = guion;

    this.mapa.setRoute(RUTA);
    this.mapa.showRoute(true);
    this.pinT = this.mapa.tVisible(MIRA_X, MIRA_Y);
    this.mapa.setPin(this.pinT);
    this.mapa.showPin(false);
    this.mapa.showBuses(false);

    // Sin animaciones no hay guion: el teléfono se queda en la foto final
    // de su momento —el aviso puesto, la hoja arriba, la notificación en
    // pantalla—, que es lo que ya trae el HTML. Sólo se le enciende el
    // mapa, porque eso no se mueve.
    if (sinMovimiento()) {
      this.quieta = true;
      this.mapa.showPin(true);
      this.colocarBuses(this.guion === 4 ? [1600] : [380, 820]);
      this.mapa.showBuses(true);
      this.mudo(this.guion === 4);
      return;
    }

    // A partir de aquí manda el guion: sin esta clase el teléfono se queda
    // en esa misma foto, que es lo que se ve si el JavaScript no llega.
    this.pantalla.classList.add('es-guion');
    this.reposo();
  }

  /** Enciende el bucle de este momento y apaga el de los demás. */
  activar(encendido: boolean): void {
    if (this.quieta || encendido === this.viva) return;
    this.viva = encendido;
    if (encendido) {
      this.ciclo();
      return;
    }
    this.parar();
    this.reposo();
  }

  destroy(): void {
    this.viva = false;
    this.parar();
    this.mapa.destroy();
  }

  /* ---------- Andamio ---------- */

  private el(nombre: string): HTMLElement | null {
    return this.pantalla.querySelector<HTMLElement>(`[data-el="${nombre}"]`);
  }

  private texto(nombre: string, valor: string): void {
    const nodo = this.el(nombre);
    if (nodo) nodo.textContent = valor;
  }

  private prender(nombre: string, encendido: boolean): void {
    this.el(nombre)?.classList.toggle('is-on', encendido);
  }

  /** Deja visible el ícono que toca de un grupo que se intercambia. */
  private icono(grupo: string, cual: string): void {
    for (const nodo of this.pantalla.querySelectorAll<HTMLElement>(`[data-grupo="${grupo}"]`)) {
      nodo.hidden = nodo.dataset.icono !== cual;
    }
  }

  private a(ms: number, hacer: () => void): void {
    this.relojes.push(
      window.setTimeout(() => {
        if (this.viva) hacer();
      }, ms)
    );
  }

  /** Detiene sólo los buses; el resto del guion sigue su calendario. */
  private pararBuses(): void {
    if (this.cuadro) cancelAnimationFrame(this.cuadro);
    this.cuadro = 0;
  }

  /**
   * Corta el guion entero. Ojo: se lleva por delante los avisos que aún
   * no han sonado, así que dentro de un guion hay que parar los buses con
   * `pararBuses()` — si no, el paso que apaga el mapa se llevaría también
   * al que vuelve a empezar el bucle.
   */
  private parar(): void {
    for (const reloj of this.relojes) window.clearTimeout(reloj);
    this.relojes.length = 0;
    this.pararBuses();
  }

  /* ---------- El dedo ---------- */

  private toqueEn(x: number, y: number): void {
    const nodo = this.el('toque');
    if (!nodo) return;
    nodo.style.left = `${x}px`;
    nodo.style.top = `${y}px`;
    // Reiniciar la animación pide un reflujo entre quitar y poner la clase.
    nodo.classList.remove('is-on');
    void nodo.offsetWidth;
    nodo.classList.add('is-on');
  }

  private toqueSobre(nombre: string): void {
    const objetivo = this.el(nombre);
    if (!objetivo) return;
    const caja = objetivo.getBoundingClientRect();
    const marco = this.pantalla.getBoundingClientRect();
    this.toqueEn(caja.left - marco.left + caja.width / 2, caja.top - marco.top + caja.height / 2);
    objetivo.classList.add('is-pulsado');
    this.a(240, () => objetivo.classList.remove('is-pulsado'));
  }

  private toqueEnMapa(fx: number, fy: number): void {
    const marco = this.pantalla.getBoundingClientRect();
    this.toqueEn(marco.width * fx, marco.height * fy);
  }

  /* ---------- Los buses ---------- */

  /** Los coloca a tantos metros por detrás del punto de espera. */
  private colocarBuses(detras: number[]): void {
    const largo = this.mapa.metrosDeRuta;
    this.buses = detras.map((m) => (this.pinT - (largo ? m / largo : 0) + 1) % 1);
    this.mapa.setBuses(this.buses);
  }

  private moverBuses(alAvanzar?: (metros: number) => void): void {
    this.ultimo = performance.now();
    const paso = (ahora: number): void => {
      if (!this.viva) return;
      // Con la pestaña de fondo el salto entre cuadros se dispara; el tope
      // evita que los buses se teletransporten al volver.
      const dt = Math.min(0.05, (ahora - this.ultimo) / 1000);
      this.ultimo = ahora;

      const largo = this.mapa.metrosDeRuta;
      if (largo > 0) {
        this.buses = this.buses.map(
          (t, i) => (t + (METROS_POR_SEGUNDO * (0.85 + i * 0.22) * dt) / largo) % 1
        );
        this.mapa.setBuses(this.buses);
        if (alAvanzar && this.buses.length > 0) {
          alAvanzar(((this.pinT - this.buses[0]! + 1) % 1) * largo);
        }
      }
      this.cuadro = requestAnimationFrame(paso);
    };
    this.cuadro = requestAnimationFrame(paso);
  }

  private mudo(callado: boolean): void {
    this.capa?.classList.toggle('es-mudo', callado);
  }

  /* ---------- Reposo: la foto con la que arranca cada bucle ---------- */

  private reposo(): void {
    this.mapa.showPin(false);
    this.mapa.showBuses(false);
    this.mudo(false);
    this.prender('chip', false);
    this.prender('scrim', false);
    this.prender('sheet', false);
    this.prender('notif', false);
    this.avisoPuesto = false;

    if (this.guion === 1) {
      this.icono('chip', 'gps');
      this.texto('chip-text', 'Localizando tu ubicación…');
      const accion = this.el('chip-action');
      if (accion) accion.hidden = true;
    }

    if (this.guion === 3) {
      this.setAviso(false);
      this.setMetros(1150);
      const detalle = this.el('eta-sub');
      if (detalle) detalle.hidden = true;
    }
  }

  private ciclo(): void {
    this.parar();
    this.reposo();
    if (this.guion === 1) this.guionPunto();
    else if (this.guion === 2) this.guionRuta();
    else if (this.guion === 3) this.guionAviso();
    else if (this.guion === 4) this.guionMudo();
  }

  /* ---------- 1. Fija tu punto de espera ---------- */

  private guionPunto(): void {
    this.a(700, () => this.toqueEnMapa(MIRA_X, MIRA_Y));
    this.a(1020, () => {
      this.mapa.showPin(true);
      this.prender('chip', true);
    });
    this.a(2400, () => {
      // location_status_chip.dart: de "localizando" a la ubicación puesta.
      this.icono('chip', 'pin');
      this.texto('chip-text', 'Con tu ubicación: 2 buses cerca');
      const accion = this.el('chip-action');
      if (accion) accion.hidden = false;
      this.colocarBuses([380, 820]);
      this.mapa.showBuses(true);
      this.moverBuses();
    });
    this.a(6600, () => {
      this.pararBuses();
      this.prender('chip', false);
      this.mapa.showPin(false);
      this.mapa.showBuses(false);
    });
    this.a(7600, () => this.ciclo());
  }

  /* ---------- 2. Elige tu ruta ---------- */

  private guionRuta(): void {
    this.mapa.showPin(true);
    this.a(600, () => {
      this.prender('scrim', true);
      this.prender('sheet', true);
    });
    this.a(1900, () => this.toqueSobre('sel-empresa'));
    this.a(3200, () => this.toqueSobre('sel-ruta'));
    this.a(4600, () => this.toqueSobre('launch'));
    this.a(5200, () => {
      this.prender('scrim', false);
      this.prender('sheet', false);
      this.colocarBuses([320, 980]);
      this.mapa.showBuses(true);
      this.moverBuses();
    });
    this.a(8400, () => {
      this.pararBuses();
      this.mapa.showBuses(false);
      this.mapa.showPin(false);
    });
    this.a(9200, () => this.ciclo());
  }

  /* ---------- 3. Te avisamos ---------- */

  private guionAviso(): void {
    this.mapa.showPin(true);
    this.prender('sheet', true);
    this.colocarBuses([1150]);
    this.mapa.showBuses(true);
    this.moverBuses((metros) => this.alAcercarse(metros));

    this.a(900, () => this.toqueSobre('alert-btn'));
    this.a(1240, () => {
      this.setAviso(true);
      const detalle = this.el('eta-sub');
      if (detalle) detalle.hidden = false;
    });
    this.a(10400, () => {
      this.pararBuses();
      this.prender('notif', false);
      this.prender('sheet', false);
      this.mapa.showBuses(false);
      this.mapa.showPin(false);
    });
    this.a(11300, () => this.ciclo());
  }

  /**
   * El número no se refresca a 60 fps: la app lo hace una vez por segundo
   * y redondeado a la decena, porque al metro los dígitos cambian tan
   * rápido que no se leen.
   */
  private alAcercarse(metros: number): void {
    const ahora = performance.now();
    if (ahora - this.refresco < 420) return;
    this.refresco = ahora;
    this.setMetros(metros);

    const dentro = this.avisoPuesto && metros <= RADIO_AVISO_M;
    if (dentro) {
      // bus_notification_service.dart, palabra por palabra.
      this.texto('notif-body', `Está a ${this.redondear(metros)} m de tu ubicación`);
    }
    this.prender('notif', dentro);
  }

  private redondear(metros: number): number {
    return metros < 100 ? Math.max(10, Math.round(metros)) : Math.round(metros / 10) * 10;
  }

  private setMetros(metros: number): void {
    const m = this.redondear(metros);
    // _metricParts(): bajo el kilómetro en metros, por encima en kilómetros.
    this.texto('eta-value', m < 1000 ? String(m) : (m / 1000).toFixed(1));
    this.texto('eta-unit', m < 1000 ? 'm de ti' : 'km de ti');
    // colorUrgencia(): dentro del kilómetro la barra pasa a ámbar.
    this.el('eta-bar')?.classList.toggle('eta-strip--cerca', m <= RADIO_AVISO_M);
  }

  private setAviso(puesto: boolean): void {
    this.avisoPuesto = puesto;
    this.el('alert-btn')?.classList.toggle('active', puesto);
    this.texto('alert-label', puesto ? 'AVISO ACTIVADO' : 'AVISARME CUANDO ESTÉ CERCA');
    this.icono('aviso', puesto ? 'visto' : 'campana');
  }

  /* ---------- 4. Cuando el bus se calla ---------- */

  private guionMudo(): void {
    this.mapa.showPin(true);
    this.colocarBuses([1600]);
    this.mapa.showBuses(true);
    this.moverBuses();

    this.a(2600, () => {
      // Deja de reportar: se queda donde estaba y se apaga a gris.
      this.pararBuses();
      this.mudo(true);
    });
    this.a(3100, () => this.prender('sheet', true));
    this.a(7600, () => {
      this.prender('sheet', false);
      this.mapa.showBuses(false);
      this.mapa.showPin(false);
    });
    this.a(8500, () => this.ciclo());
  }
}
