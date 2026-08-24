/**
 * PhoneSimulator — la demo del teléfono, en bucle y sin interacción.
 *
 * El mockup es una vitrina: se reproduce sola y vuelve a empezar. La única
 * entrada es el tiempo, así que siempre se ve como debe verse.
 *
 * El guion recorre los mismos estados que la app de verdad, en el mismo
 * orden y con los mismos textos:
 *
 *   locating           → location_status_chip.dart
 *   empty-no-position  → eta_bottom_sheet.dart
 *   manual + pin       → location_status_chip.dart
 *   empty-no-route     → eta_bottom_sheet.dart
 *   selector           → search_pill_bar.dart
 *   manual-near + ETA  → eta_bottom_sheet.dart
 *
 * Nada de lo que muestra está inventado: las rutas y sus kilómetros salen
 * de rutas.json (vía PhoneMap) y el radio de aviso es el de
 * proximity_alerts_provider.dart.
 */

import type { PhoneMap } from './phone-map';
import type { RutaLanding } from './types';

interface EstadoBus {
  /**
   * Los dos buses demo del repo. bus_labels.dart los nombra por su id:
   * "los buses demo (B-042, B-055) ya llevan su placa/interno como id".
   */
  placa: string;
  /** Metros por detrás del punto de espera donde nace. */
  nace: number;
  /** Multiplicador de velocidad, para que no vayan en bloque. */
  ritmo: number;
  /** Posición sobre el recorrido, de 0 a 1. */
  t: number;
}

/** Estados del chip de ubicación, calcados de location_status_chip.dart. */
const CHIPS = {
  locating: { icono: 'gps', texto: 'Localizando tu ubicación…', accion: '', tinte: 'verde' },
  manual: { icono: 'pin', texto: 'Con tu ubicación', accion: 'Quitar', tinte: 'verde' },
  cerca: { icono: 'pin', texto: 'Con tu ubicación: 2 buses cerca', accion: 'Quitar', tinte: 'verde' }
} as const;

/** Estados vacíos de la hoja, calcados de eta_bottom_sheet.dart. */
const VACIOS = {
  sinPunto: {
    icono: 'toque',
    titulo: 'Toca el mapa para indicar dónde estás',
    sub: 'Pon tu punto de espera; después podrás mover el pin si hace falta'
  },
  sinRuta: {
    icono: 'ruta',
    titulo: 'Escoge empresa y ruta',
    sub: 'Para ver los buses, toca la barra de arriba y elige la empresa y su ruta'
  }
} as const;

type ClaveChip = keyof typeof CHIPS;
type ClaveVacio = keyof typeof VACIOS;

export class PhoneSimulator {
  private readonly map: PhoneMap;
  private readonly raiz: HTMLElement;
  private readonly sheetEl: HTMLElement;
  private readonly vistas: HTMLElement[];
  /** El envoltorio cuyo alto se anima al cambiar de vista. */
  private readonly vistasEl: HTMLElement;

  /**
   * Las dos tarjetas que flotan junto al teléfono. También las escribe el
   * guion: si se quedaran fijas dirían una ruta y una distancia que no son
   * las que se ven en la pantalla.
   */
  private readonly escena: HTMLElement | null;

  /** Las seis rutas de Sobusa, tal como las trae rutas.json. */
  private readonly rutas: RutaLanding[];

  /**
   * Punto de espera. No es un valor fijo: cada ruta cruza la ciudad por
   * otro lado, así que se busca el tramo que cae en el centro de lo que
   * se ve del mapa. Los buses llegan por detrás, que es como se acerca un
   * bus de verdad a una parada.
   */
  private pinT = 0.5;

  /**
   * Centro de la franja despejada del mapa, en fracciones de la pantalla:
   * por encima queda la píldora con su chip y por debajo la hoja.
   */
  private readonly miraX = 0.5;
  private readonly miraY = 0.44;

  /** proximity_alerts_provider.dart: el aviso salta a 1 km. */
  private readonly radioAvisoM = 1000;

  /**
   * Ritmo del bus simulado, en metros por segundo. No es una medida: es el
   * que deja contar la historia entera —el bus se acerca, entra al
   * kilómetro, dispara el aviso— dentro de un bucle que se mira de pie y
   * sin querer. A 12 m/s, que era el ritmo real de un bus en corredor, el
   * número de la hoja tardaba treinta segundos en bajar de 1,1 a 1,0 km:
   * la pantalla parecía congelada. Es el mismo criterio que ya siguen la
   * demo de los momentos y el mapa de "pruébalo aquí".
   */
  private readonly metrosPorSegundo = 46;

  /**
   * A qué distancia por detrás del punto de espera nace cada uno. El
   * primero nace donde nace para que cruce el kilómetro un segundo y pico
   * después de que el guion arme el aviso: primero se pulsa el botón y
   * después llega la notificación, que es el orden que tiene en la app.
   */
  private readonly buses: EstadoBus[] = [
    { placa: 'B-042', nace: 1350, ritmo: 1, t: 0 },
    { placa: 'B-055', nace: 2250, ritmo: 0.78, t: 0 }
  ];

  /**
   * Ruta con la que abre el bucle. C16 Calle 72 Uninorte es la que cruza el
   * centro de lo que se ve del mapa, así que de entrada se lee entera y con
   * el punto de espera bien puesto; de ahí en adelante el ciclo sigue con
   * las demás en orden.
   */
  private static readonly RUTA_INICIAL = 'R-106';

  private indiceRuta = 0;
  private avisoActivo = false;
  /** Cierre del ciclo en curso: nada nuevo debe volver a asomarse. */
  private cerrando = false;
  private rutaActual: RutaLanding;
  private relojes: number[] = [];
  private animId: number | null = null;
  private etaId: number | null = null;

  constructor(map: PhoneMap, raiz: HTMLElement) {
    this.map = map;
    this.raiz = raiz;
    this.sheetEl = this.pedir('sheet');
    this.vistasEl = this.pedir('views');
    this.vistas = Array.from(raiz.querySelectorAll<HTMLElement>('.sheet-view'));
    this.escena = raiz.closest<HTMLElement>('.hero-scene');
    this.rutas = map.rutas;
    const arranque = this.rutas.findIndex(r => r.id === PhoneSimulator.RUTA_INICIAL);
    this.indiceRuta = arranque === -1 ? 0 : arranque;
    this.rutaActual = this.rutas[this.indiceRuta];
    this.pintarRutas();
    this.play();
  }

  /**
   * La lista de rutas se arma con los datos, no a mano en el HTML: nombre y
   * "terminalA ↔ terminalB", igual que _routeSubtitle() del selector.
   */
  private pintarRutas(): void {
    const lista = this.el('route-list');
    if (!lista) return;
    // Las filas cuelgan de un carril propio: lo que se desplaza es el
    // carril, no la ventana, que es como se mueve una lista de verdad.
    const carril = document.createElement('div');
    carril.className = 'sheet-lista-inner';
    carril.append(
      ...this.rutas.map(ruta => {
        const fila = document.createElement('div');
        fila.className = 'app-tile';
        fila.dataset.ruta = ruta.id;
        fila.innerHTML = `
          <span class="app-tile-icon app-tile-icon--ruta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 17h4a4 4 0 0 0 4-4V9a4 4 0 0 1 4-4h4" />
              <path d="M18 2l3 3l-3 3" />
              <circle cx="5" cy="17" r="2" />
            </svg>
          </span>
          <span class="app-tile-body">
            <span class="app-tile-title"></span>
            <span class="app-tile-sub"></span>
          </span>
          <span class="app-tile-chevron" aria-hidden="true">›</span>`;
        fila.querySelector('.app-tile-title')!.textContent = ruta.nombre;
        fila.querySelector('.app-tile-sub')!.textContent =
          `${ruta.terminalA} ↔ ${ruta.terminalB}`;
        return fila;
      })
    );
    lista.replaceChildren(carril);
  }

  /**
   * Deja a la vista la fila de la ruta que se va a elegir. Si ya se ve, no
   * se mueve nada: una lista que se desplaza sin necesidad se nota falsa.
   */
  private desplazarLista(): void {
    const lista = this.el('route-list');
    const carril = lista?.querySelector<HTMLElement>('.sheet-lista-inner');
    const fila = carril?.querySelector<HTMLElement>(
      `[data-ruta="${this.rutaActual.id}"]`
    );
    if (!lista || !carril || !fila) return;

    // El alto de la ventana es el de la lista; el desborde es lo que hay
    // que subir para que la fila termine dentro, con su margen debajo.
    const ventana = lista.clientHeight;
    const fin = fila.offsetTop + fila.offsetHeight;
    const sobra = fin - ventana;
    if (sobra <= 0) return;
    const tope = carril.offsetHeight - ventana;
    const empuje = Math.min(sobra, Math.max(0, tope));
    this.a(560, () => {
      carril.style.transform = `translateY(${-empuje}px)`;
    });
  }

  /**
   * Devuelve el carril de rutas a su tope, y sin animarlo: esto pasa entre
   * ciclo y ciclo, con la app disuelta, y una lista rebobinándose a la vista
   * delataría el truco.
   */
  private reiniciarLista(): void {
    const carril = this.el('route-list')?.querySelector<HTMLElement>('.sheet-lista-inner');
    if (!carril) return;
    carril.style.transition = 'none';
    carril.style.transform = 'translateY(0)';
    void carril.offsetHeight;
    carril.style.transition = '';
  }

  /**
   * El alto de la hoja, animado. Es el AnimatedSize del selector: sin él
   * la hoja cambia de tamaño de golpe en cada paso y el mockup se siente
   * armado a cortes en vez de manejado por alguien.
   */
  private ajustarAlto(): void {
    const activa = this.vistas.find(v => v.classList.contains('active'));
    if (!activa) return;
    this.vistasEl.style.height = `${activa.offsetHeight}px`;
  }

  /**
   * Escalón "peek" de eta_bottom_sheet.dart: la hoja se recoge y deja ver
   * más mapa. En la app se llega arrastrando el asa; aquí lo hace el guion
   * a mitad del tramo en vivo, cuando lo interesante es el bus y no el
   * texto.
   */
  private setPeek(puesto: boolean): void {
    this.sheetEl.classList.toggle('is-peek', puesto);
    this.ajustarAlto();
  }

  /* ---------- Utilidades ---------- */

  private el(nombre: string): HTMLElement | null {
    return this.raiz.querySelector<HTMLElement>(`[data-el="${nombre}"]`);
  }

  private pedir(nombre: string): HTMLElement {
    const nodo = this.el(nombre);
    if (!nodo) throw new Error(`Falta [data-el="${nombre}"] en el mockup`);
    return nodo;
  }

  private texto(nombre: string, valor: string): void {
    const nodo = this.el(nombre);
    if (nodo) nodo.textContent = valor;
  }

  private escenaTexto(nombre: string, valor: string): void {
    const nodo = this.escena?.querySelector<HTMLElement>(`[data-escena="${nombre}"]`);
    if (nodo) nodo.textContent = valor;
  }

  private mostrarVista(vista: string): void {
    for (const v of this.vistas) v.classList.toggle('active', v.dataset.view === vista);
    this.ajustarAlto();
  }

  private a(ms: number, fn: () => void): void {
    this.relojes.push(window.setTimeout(fn, ms));
  }

  /* ---------- El dedo ---------- */

  /**
   * Coloca el punto del dedo y lanza la onda. Las coordenadas van en
   * fracciones de la pantalla, no en píxeles: la razón entre dos cajas no
   * cambia aunque la escena se esté dibujando encogida, así que no hay que
   * saber en qué escala está el teléfono para acertar el sitio.
   */
  private toqueEn(fx: number, fy: number, sobreClaro = false): void {
    const nodo = this.el('toque');
    if (!nodo) return;
    nodo.style.left = `${fx * 100}%`;
    nodo.style.top = `${fy * 100}%`;
    nodo.classList.toggle('phone-toque--tinta', sobreClaro);
    // Reiniciar la animación pide un reflujo entre quitar y poner la clase.
    nodo.classList.remove('is-on');
    void nodo.offsetWidth;
    nodo.classList.add('is-on');
  }

  /**
   * Toca un elemento del mockup: la onda encima y, debajo, el hundido del
   * InkWell. Es lo que hace que la vista siguiente se lea como respuesta a
   * un dedo y no como la diapositiva que venía a continuación.
   */
  private toqueSobre(nodo: HTMLElement | null | undefined): void {
    if (!nodo) return;
    const caja = nodo.getBoundingClientRect();
    const marco = this.raiz.getBoundingClientRect();
    if (marco.width === 0 || marco.height === 0) return;
    this.toqueEn(
      (caja.left - marco.left + caja.width / 2) / marco.width,
      (caja.top - marco.top + caja.height / 2) / marco.height,
      nodo.closest('.phone-sheet') !== null
    );
    nodo.classList.add('is-pulsado');
    this.a(240, () => nodo.classList.remove('is-pulsado'));
  }

  /** La fila de la ruta que el guion está a punto de elegir. */
  private filaDeRuta(): HTMLElement | null {
    return (
      this.el('route-list')?.querySelector<HTMLElement>(
        `[data-ruta="${this.rutaActual.id}"]`
      ) ?? null
    );
  }

  /* ---------- Superficies de la app ---------- */

  /** Píldora de búsqueda: los dos textos de search_pill_bar.dart. */
  private setPildora(ruta: RutaLanding | null): void {
    this.texto('pill-title', ruta ? ruta.nombre : '¿Qué bus esperas?');
    this.texto('pill-sub', ruta ? 'Ruta activa • Toca para cambiar' : 'Toca para buscar tu ruta');
    const punto = this.el('pill-dot');
    if (punto) punto.classList.toggle('is-on', ruta !== null);
    this.el('pill-sub')?.classList.toggle('is-activa', ruta !== null);
    if (ruta) this.escenaTexto('route-name', ruta.nombre);
    this.escena?.querySelector('[data-escena="route"]')?.classList.toggle('is-on', ruta !== null);
  }

  private setChip(clave: ClaveChip): void {
    const chip = CHIPS[clave];
    this.texto('chip-text', chip.texto);
    const accion = this.el('chip-action');
    if (accion) {
      accion.textContent = chip.accion;
      accion.hidden = chip.accion === '';
    }
    for (const nodo of this.raiz.querySelectorAll<HTMLElement>('[data-icono]')) {
      if (nodo.dataset.grupo === 'chip') {
        nodo.hidden = nodo.dataset.icono !== chip.icono;
      }
    }
  }

  private setVacio(clave: ClaveVacio): void {
    const v = VACIOS[clave];
    this.texto('empty-title', v.titulo);
    this.texto('empty-sub', v.sub);
    for (const nodo of this.raiz.querySelectorAll<HTMLElement>('[data-icono]')) {
      if (nodo.dataset.grupo === 'vacio') {
        nodo.hidden = nodo.dataset.icono !== v.icono;
      }
    }
    this.mostrarVista('empty');
  }

  /* ---------- Guion ---------- */

  /**
   * Un ciclo completo: localizar, fijar el punto, elegir empresa y ruta,
   * ver los buses en vivo y activar el aviso. Al terminar se repite con la
   * siguiente ruta, así el mapa recorre las seis de Sobusa.
   */
  private play(): void {
    this.pararBuses();
    for (const id of this.relojes) clearTimeout(id);
    this.relojes = [];
    this.cerrando = false;

    this.rutaActual = this.rutas[this.indiceRuta % this.rutas.length];
    this.indiceRuta += 1;

    // La ruta primero: el punto de espera se elige sobre ella, buscando el
    // tramo que quede centrado en la parte visible del mapa.
    this.map.setRoute(this.rutaActual.id);
    this.pinT = this.map.tVisible(
      this.miraX,
      this.miraY,
      this.buses.map(b => b.nace)
    );
    this.map.setPin(this.pinT);
    this.map.showRoute(false);
    this.map.showPin(false);
    this.map.showBuses(false);

    this.setPildora(null);
    this.setChip('locating');
    this.setPeek(false);
    this.setVacio('sinPunto');
    this.sheetEl.classList.remove('hidden-sheet');
    this.reiniciarFichas();
    this.reiniciarLista();
    this.escena?.querySelector('[data-escena="notif"]')?.classList.remove('is-on');

    // La app vuelve a entrar. El velo se levanta en el cuadro siguiente, no
    // en éste: si se quitara aquí el navegador ya habría medido la hoja
    // —`ajustarAlto()` lee `offsetHeight`— y se perdería el desvanecido.
    requestAnimationFrame(() => this.raiz.classList.remove('is-cerrando'));

    // El pasajero toca el mapa y ahí queda el punto de espera con su radio
    // "cerca de ti". El toque va antes que el pin —240 ms antes— porque es
    // lo que lo provoca: al revés se leería como que el pin apareció solo.
    this.a(1300, () => this.toqueEn(this.miraX, this.miraY));
    this.a(1540, () => {
      this.setChip('manual');
      this.map.showPin(true);
      this.setVacio('sinRuta');
    });

    // El pasajero toca la barra: empresa y después ruta. Cada vista va
    // precedida de su toque, con el mismo cuarto de segundo de por medio.
    this.a(3100, () => this.toqueSobre(this.el('pill')));
    this.a(3340, () => this.mostrarVista('companies'));

    this.a(4500, () => this.toqueSobre(this.el('tile-empresa')));
    this.a(4740, () => {
      this.mostrarVista('routes');
      this.desplazarLista();
    });

    // La lista termina de acomodarse en 560 ms; el dedo llega después, ya
    // con la fila quieta y a la vista.
    this.a(6100, () => this.toqueSobre(this.filaDeRuta()));

    // Ruta elegida: aparece el trazado, la píldora cambia y entran los buses.
    this.a(6360, () => {
      this.map.showRoute(true);
      this.setPildora(this.rutaActual);
      this.enVivo();
    });

    // Con los buses ya rodando la hoja se recoge un escalón y deja ver el
    // mapa entero, que es lo interesante mientras el número baja.
    this.a(9200, () => this.setPeek(true));

    // El pasajero arma el aviso. La hoja vuelve entera justo después, y
    // para entonces el primer bus está cruzando el kilómetro: el botón se
    // pulsa, la hoja sube y la notificación sale, en ese orden.
    this.a(12100, () => this.toqueSobre(this.el('alert-btn')));
    this.a(12360, () => {
      this.setAviso(true);
      // El detalle sólo aparece con el aviso puesto, igual que en la app:
      // mientras hay distancia y no hay aviso, la hoja no dice nada.
      this.avisoActivo = true;
      this.setDetalle('Puedes cambiar de aplicación; no cierres Ya Viene del todo');
    });
    this.a(14200, () => this.setPeek(false));

    // El ciclo no corta: primero se recoge lo que sobra —el aviso flotante,
    // el detalle— y después la app se disuelve. Cuando vuelve a entrar ya
    // está recolocada, así que no se ve nada saltar.
    this.a(21400, () => {
      this.cerrando = true;
      this.escena?.querySelector('[data-escena="notif"]')?.classList.remove('is-on');
      this.setDetalle('');
      // Los buses se van primero, uno con el otro, y el trazado detrás:
      // cada capa se apaga con la transición que ya tenía.
      this.map.showBuses(false);
    });
    this.a(22000, () => {
      this.map.showRoute(false);
      this.map.showPin(false);
      this.raiz.classList.add('is-cerrando');
    });
    this.a(23000, () => this.play());
  }

  /**
   * La tarjeta flotante repite, palabra por palabra, la notificación que
   * manda bus_notification_service.dart: título "<ruta> - <placa> está cerca
   * de ti" y cuerpo "Está a N m de tu ubicación". Y aparece cuando aparecería
   * de verdad: con el aviso armado y el bus ya dentro del kilómetro.
   */
  private notificacion(placa: string, metros: number): void {
    const dentro = !this.cerrando && this.avisoActivo && metros <= this.radioAvisoM;
    const tarjeta = this.escena?.querySelector('[data-escena="notif"]');
    if (dentro) {
      this.escenaTexto('notif-title', `${this.rutaActual.nombre} - ${placa} está cerca de ti`);
      this.escenaTexto('notif-body', `Está a ${metros} m de tu ubicación`);
    }
    tarjeta?.classList.toggle('is-on', dentro);
  }

  /** Línea de detalle de la hoja; vacía se esconde, como en la app. */
  private setDetalle(texto: string): void {
    const nodo = this.el('eta-sub');
    if (!nodo) return;
    nodo.textContent = texto;
    nodo.hidden = texto === '';
    this.ajustarAlto();
  }

  /**
   * Botón de aviso. El texto vive en su propio nodo para no borrar el
   * ícono, que cambia de campana a visto bueno igual que en la app.
   */
  private setAviso(puesto: boolean): void {
    this.avisoActivo = puesto;
    this.el('alert-btn')?.classList.toggle('active', puesto);
    this.texto('alert-label', puesto ? 'AVISO ACTIVADO' : 'AVISARME CUANDO ESTÉ CERCA');
    for (const nodo of this.raiz.querySelectorAll<HTMLElement>('[data-grupo="aviso"]')) {
      nodo.hidden = nodo.dataset.icono !== (puesto ? 'visto' : 'campana');
    }
  }

  private reiniciarFichas(): void {
    this.setAviso(false);
    for (const ficha of this.raiz.querySelectorAll<HTMLElement>('[data-ruta]')) {
      ficha.classList.toggle('is-activa', ficha.dataset.ruta === this.rutaActual.id);
    }
  }

  private enVivo(): void {
    this.mostrarVista('eta');
    this.setChip('cerca');
    this.setDetalle('Buscando la posición del bus…');
    this.colocarBuses();
    this.map.showBuses(true);
    this.arrancarBuses();
  }

  /* ---------- Distancia (espeja _metricParts/_urgencyColor) ---------- */

  private partesMetrica(metros: number): [string, string] {
    if (metros < 1000) return [Math.round(metros).toString(), 'm de ti'];
    return [(metros / 1000).toFixed(1), 'km de ti'];
  }

  private colorUrgencia(metros: number): string {
    if (metros < 300) return 'var(--coral)';
    if (metros < this.radioAvisoM) return 'var(--warn)';
    return 'var(--green)';
  }

  /** El bus que la hoja sigue: el más próximo por delante del pin. */
  private masCercano(): { bus: EstadoBus; metros: number } | null {
    const largo = this.map.metrosDeRuta;
    if (!largo) return null;
    let elegido: EstadoBus | null = null;
    let cerca = Infinity;
    for (const b of this.buses) {
      // Distancia sobre el recorrido, no en línea recta: el bus tiene que
      // pasar por la vía, no cruzar por encima de las manzanas.
      const metros = ((this.pinT - b.t + 1) % 1) * largo;
      if (metros < cerca) {
        cerca = metros;
        elegido = b;
      }
    }
    return elegido ? { bus: elegido, metros: cerca } : null;
  }

  /**
   * Refresca el número una vez por segundo y redondeado a la decena. A 60
   * fps y al metro, los dígitos cambiaban tan rápido que no se leían.
   */
  private actualizarEta(): void {
    const cerca = this.masCercano();
    if (cerca === null) return;

    const crudo = cerca.metros;
    const metros = crudo < 100 ? Math.max(10, Math.round(crudo)) : Math.round(crudo / 10) * 10;
    const [valor, unidad] = this.partesMetrica(metros);

    // bus_labels.dart: routePlateLabel() arma "ruta - placa".
    this.texto('eta-route', `${this.rutaActual.nombre} - ${cerca.bus.placa}`);

    // Con distancia en pantalla y sin aviso puesto, la app no muestra
    // detalle: el número ya lo dice todo.
    if (!this.avisoActivo) this.setDetalle('');

    this.texto('eta-value', valor);
    this.texto('eta-unit', unidad);
    this.notificacion(cerca.bus.placa, metros);
    const barra = this.el('eta-bar');
    if (barra) barra.style.background = this.colorUrgencia(metros);
  }

  /* ---------- Movimiento sobre la ruta real ---------- */

  private colocarBuses(): void {
    const largo = this.map.metrosDeRuta;
    if (!largo) return;
    for (const b of this.buses) b.t = (this.pinT - b.nace / largo + 1) % 1;
    this.empujarBuses();
  }

  private empujarBuses(): void {
    this.map.setBuses(this.buses.map(b => b.t));
  }

  private pasoBuses(dt: number): void {
    const largo = this.map.metrosDeRuta;
    if (!largo) return;
    for (const b of this.buses) {
      b.t = (b.t + (this.metrosPorSegundo * b.ritmo * dt) / largo) % 1;
      // Si ya pasó de largo el punto de espera, vuelve a su arranque:
      // siempre hay uno acercándose, como en una ruta con varios buses.
      if ((this.pinT - b.t + 1) % 1 > 0.5) b.t = (this.pinT - b.nace / largo + 1) % 1;
    }
    this.empujarBuses();
  }

  private arrancarBuses(): void {
    this.actualizarEta();
    this.etaId ??= window.setInterval(() => this.actualizarEta(), 1000);
    if (this.animId !== null) return;

    let previo: number | null = null;
    const bucle = (ahora: number): void => {
      const dt = previo === null ? 0 : Math.min(0.1, (ahora - previo) / 1000);
      previo = ahora;
      this.pasoBuses(dt);
      this.animId = requestAnimationFrame(bucle);
    };
    this.animId = requestAnimationFrame(bucle);
  }

  private pararBuses(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.etaId !== null) {
      clearInterval(this.etaId);
      this.etaId = null;
    }
  }
}
