import { cifraViva, metrica } from './cifra-viva';
import { encajeDe } from './encaje';
import type { PhoneMap } from './phone-map';
import { sinMovimiento } from './scrolly';
import { EMPRESA, VACIO_SELECT, carrilEmpresas, carrilRutas } from './selector';
import type { RutaLanding } from './types';

/**
 * El teléfono de cada momento de la solución, moviéndose solo.
 *
 * Los mockups de la sección no son fotos: cada uno repite en bucle el
 * gesto del que habla su texto —marcar el punto, elegir la ruta, armar el
 * aviso—. El guion no inventa nada: las pantallas son las mismas del hero
 * y cada frase sale de la app (`location_status_chip`,
 * `route_selector_sheet`, `eta_bottom_sheet`, `bus_notification_service`).
 *
 * Sólo corre el que se está viendo. `paso-foco.ts` avisa cuál es el paso
 * activo y aquí se enciende ése y se apagan los demás, así la sección no
 * mantiene tres bucles y tres `requestAnimationFrame` a la vez.
 */

/** La C16, la misma ruta que enseñan el hero y el selector. */
const RUTA = 'R-106';

/*
  Lo que el guion del segundo momento elige en el selector es la misma
  empresa y la misma ruta que el HTML trae ya escritas: esa es la foto
  final del momento —la que se queda si no llega el JavaScript— y el guion
  la vacía al empezar el bucle para volver a llenarla a cada toque. Los
  textos no se copian aquí: la empresa sale de `selector.ts` y la ruta, de
  rutas.json, que son los mismos que dibujan las dos listas.
*/

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
  readonly #raiz: HTMLElement;
  readonly #pantalla: HTMLElement;
  readonly #mapa: PhoneMap;
  readonly #guion: number;

  readonly #relojes: number[] = [];
  #cuadro = 0;
  #viva = false;
  #quieta = false;

  /** Punto de espera, en avance sobre el recorrido. */
  #pinT = 0;
  /** Posición de cada bus sobre el recorrido. */
  #buses: number[] = [];
  #ultimo = 0;
  #avisoPuesto = false;
  #refresco = 0;

  /** La ruta que el guion elige, tal como la trae rutas.json. */
  readonly #ruta: RutaLanding;
  /** El envoltorio cuyo alto se anima al cambiar de vista; sólo el 2º lo tiene. */
  readonly #vistasEl: HTMLElement | null;
  readonly #vistas: HTMLElement[];
  /** Lo que mide la tarjeta del selector: las listas se dibujan con ella. */
  #altoTarjeta = 0;

  constructor(paso: HTMLElement, mapa: PhoneMap, guion: number) {
    const pantalla = paso.querySelector<HTMLElement>('.phone-screen');
    if (!pantalla) throw new Error('PasoDemo: el momento no trae teléfono');

    this.#raiz = paso;
    this.#pantalla = pantalla;
    this.#mapa = mapa;
    this.#guion = guion;
    this.#ruta = mapa.rutas.find((r) => r.id === RUTA) ?? mapa.rutas[0];

    this.#vistasEl = this.#el('views');
    this.#vistas = Array.from(paso.querySelectorAll<HTMLElement>('.sheet-view'));
    // Las dos listas del selector se escriben una sola vez, con los mismos
    // datos que las del hero: nunca están copiadas en el HTML.
    this.#el('company-list')?.replaceChildren(carrilEmpresas());
    this.#el('route-list')?.replaceChildren(carrilRutas(mapa.rutas));

    this.#mapa.setRoute(RUTA);
    this.#mapa.showRoute(true);
    this.#pinT = this.#mapa.tVisible(MIRA_X, MIRA_Y);
    this.#mapa.setPin(this.#pinT);
    this.#mapa.showPin(false);
    this.#mapa.showBuses(false);

    // Sin animaciones no hay guion: el teléfono se queda en la foto final
    // de su momento —el aviso puesto, la hoja arriba, la notificación en
    // pantalla—, que es lo que ya trae el HTML. Sólo se le enciende el
    // mapa, porque eso no se mueve.
    if (sinMovimiento()) {
      this.#quieta = true;
      this.#mapa.showPin(true);
      this.#colocarBuses([850, 1750]);
      this.#mapa.showBuses(true);
      return;
    }

    // A partir de aquí manda el guion: sin esta clase el teléfono se queda
    // en esa misma foto, que es lo que se ve si el JavaScript no llega.
    this.#raiz.classList.add('es-guion');
    this.#reposo();
  }

  /** Enciende el bucle de este momento y apaga el de los demás. */
  activar(encendido: boolean): void {
    if (this.#quieta || encendido === this.#viva) return;
    this.#viva = encendido;
    if (encendido) {
      this.#ciclo();
      return;
    }
    this.#parar();
    this.#reposo();
  }

  destroy(): void {
    this.#viva = false;
    this.#parar();
    this.#mapa.destroy();
  }

  /* ---------- Andamio ---------- */

  /*
    Se busca en el momento entero y no sólo en la pantalla: el aviso del
    tercero ya no se dibuja dentro del teléfono, sino flotando al lado.
  */
  #el(nombre: string): HTMLElement | null {
    return this.#raiz.querySelector<HTMLElement>(`[data-el="${nombre}"]`);
  }

  #texto(nombre: string, valor: string): void {
    const nodo = this.#el(nombre);
    if (nodo) nodo.textContent = valor;
  }

  #prender(nombre: string, encendido: boolean): void {
    this.#el(nombre)?.classList.toggle('is-on', encendido);
  }

  /**
   * Deja visible el ícono que toca de un grupo que se intercambia.
   *
   * Se escribe el atributo y no la propiedad: los íconos son SVG, y
   * `hidden` es propiedad de `HTMLElement`, no de `SVGElement`. Puesta
   * como propiedad se quedaba en una marca suelta del objeto que no
   * llegaba al documento, y en pantalla mandaba el atributo del HTML —el
   * de la foto final—, así que el aviso enseñaba el visto desde el primer
   * cuadro y el chip del primer momento nunca pasaba de la diana al pin.
   */
  #icono(grupo: string, cual: string): void {
    for (const nodo of this.#pantalla.querySelectorAll<HTMLElement>(`[data-grupo="${grupo}"]`)) {
      nodo.toggleAttribute('hidden', nodo.dataset.icono !== cual);
    }
  }

  #a(ms: number, hacer: () => void): void {
    this.#relojes.push(
      window.setTimeout(() => {
        if (this.#viva) hacer();
      }, ms)
    );
  }

  /** Detiene sólo los buses; el resto del guion sigue su calendario. */
  #pararBuses(): void {
    if (this.#cuadro) cancelAnimationFrame(this.#cuadro);
    this.#cuadro = 0;
  }

  /**
   * Corta el guion entero. Ojo: se lleva por delante los avisos que aún
   * no han sonado, así que dentro de un guion hay que parar los buses con
   * `pararBuses()` — si no, el paso que apaga el mapa se llevaría también
   * al que vuelve a empezar el bucle.
   */
  #parar(): void {
    for (const reloj of this.#relojes) window.clearTimeout(reloj);
    this.#relojes.length = 0;
    this.#pararBuses();
  }

  /* ---------- El dedo ---------- */

  #toqueEn(x: number, y: number): void {
    const nodo = this.#el('toque');
    if (!nodo) return;
    nodo.style.left = `${x}px`;
    nodo.style.top = `${y}px`;
    // El mismo dedo sobre el mapa y sobre la hoja. La versión en tinta que
    // llevaba la hoja se veía como una mancha; el porqué del aspecto que
    // quedó está en `.phone-toque`.
    // Reiniciar la animación pide un reflujo entre quitar y poner la clase.
    nodo.classList.remove('is-on');
    void nodo.offsetWidth;
    nodo.classList.add('is-on');
  }

  /*
    Los rectángulos llegan en píxeles de pantalla y `left`/`top` se
    escriben en los del elemento. Mientras la escena quepa en la ventana
    son los mismos; cuando no cabe va encogida, y entre unos y otros hay
    el factor que dice `--encaje`. Sin dividir, el dedo cae fuera del
    botón que dice estar tocando.

    Recibe el nombre de una pieza del mockup o el nodo pelado, porque hay
    cosas que se tocan y no llevan `data-el`: los buses del mapa los dibuja
    phone-map.ts y se piden por índice.
  */
  #toqueSobre(cual: string | Element | null): void {
    const objetivo = typeof cual === 'string' ? this.#el(cual) : cual;
    if (!objetivo) return;
    const caja = objetivo.getBoundingClientRect();
    const marco = this.#pantalla.getBoundingClientRect();
    const k = encajeDe(this.#pantalla);
    this.#toqueEn(
      (caja.left - marco.left + caja.width / 2) / k,
      (caja.top - marco.top + caja.height / 2) / k
    );
    objetivo.classList.add('is-pulsado');
    this.#a(240, () => objetivo.classList.remove('is-pulsado'));
  }

  #toqueEnMapa(fx: number, fy: number): void {
    const marco = this.#pantalla.getBoundingClientRect();
    const k = encajeDe(this.#pantalla);
    this.#toqueEn((marco.width * fx) / k, (marco.height * fy) / k);
  }

  /* ---------- Los buses ---------- */

  /**
   * Los coloca a tantos metros por detrás del punto de espera.
   *
   * Las distancias no son decorativas: a la escala de la cámara —22 m por
   * píxel— dos buses a menos de 900 m uno del otro se solapan y se ven
   * como una sola mancha, y uno a menos de 600 m del pin se mete debajo
   * de la gota. Por eso salen lejos y llegan; y todos por dentro de los
   * 2 km de `nearbyRadiusMeters`, que es lo que el chip llama «cerca».
   */
  #colocarBuses(detras: number[]): void {
    const largo = this.#mapa.metrosDeRuta;
    this.#buses = detras.map((m) => (this.#pinT - (largo ? m / largo : 0) + 1) % 1);
    this.#mapa.setBuses(this.#buses);
  }

  #moverBuses(alAvanzar?: (metros: number) => void): void {
    this.#ultimo = performance.now();
    const paso = (ahora: number): void => {
      if (!this.#viva) return;
      // Con la pestaña de fondo el salto entre cuadros se dispara; el tope
      // evita que los buses se teletransporten al volver.
      const dt = Math.min(0.05, (ahora - this.#ultimo) / 1000);
      this.#ultimo = ahora;

      const largo = this.#mapa.metrosDeRuta;
      if (largo > 0) {
        this.#buses = this.#buses.map(
          (t, i) => (t + (METROS_POR_SEGUNDO * (0.85 + i * 0.22) * dt) / largo) % 1
        );
        this.#mapa.setBuses(this.#buses);
        if (alAvanzar && this.#buses.length > 0) {
          alAvanzar(((this.#pinT - this.#buses[0]! + 1) % 1) * largo);
        }
      }
      this.#cuadro = requestAnimationFrame(paso);
    };
    this.#cuadro = requestAnimationFrame(paso);
  }

  /* ---------- Reposo: la foto con la que arranca cada bucle ---------- */

  #reposo(): void {
    // El punto de espera y la cabecera sólo empiezan vacíos en el primer
    // momento, que es el que los pone. En los otros dos ya están puestos
    // y se quedan entre vuelta y vuelta: apagarlos dejaba en el hueco del
    // bucle un mapa pelado con una línea verde, que no es ninguna pantalla
    // de la app.
    this.#mapa.showPin(this.#guion !== 1);
    this.#mapa.showBuses(false);
    this.#prender('chip', this.#guion !== 1);
    this.#prender('scrim', false);
    this.#prender('sheet', false);
    this.#prender('notif', false);
    this.#avisoPuesto = false;

    if (this.#guion === 1) {
      this.#icono('chip', 'gps');
      this.#texto('chip-text', 'Localizando tu ubicación…');
      const accion = this.#el('chip-action');
      if (accion) accion.hidden = true;
      // La pista viene escrita en la foto del HTML y se queda de la vuelta
      // anterior: sin esconderla, el chip pediría arrastrar un punto que
      // todavía está localizando. El guion la destapa a los 2,4 s.
      const pista = this.#el('chip-sub');
      if (pista) pista.hidden = true;
    }

    if (this.#guion === 2) {
      // Todavía no hay ruta elegida, así que el mapa no tiene ninguna que
      // dibujar: el recorrido entra cuando el guion lo elige, no antes.
      this.#mapa.showRoute(false);
      this.#cabecera(false);
      this.#setSelector(0);
      this.#mostrarVista('selector');
      this.#desplazarLista('company-list', null);
      this.#desplazarLista('route-list', null);
    }

    if (this.#guion === 3) {
      this.#mapa.setBusElegido(null);
      this.#setAviso(false);
      this.#setMetros(1250);
      const detalle = this.#el('eta-sub');
      if (detalle) detalle.hidden = true;
    }
  }

  /**
   * El selector, según cuántas de sus dos casillas están llenas: ninguna,
   * la empresa, o las dos.
   *
   * Es el `isActive` de _SelectorTile —ficha apagada contra ficha
   * encendida— y con él el riel de al lado, que dice en cuál de los dos
   * pasos se está. Sin esto las dos fichas salían llenas desde el primer
   * cuadro y el dedo tocaba encima de algo que ya estaba hecho: se veía el
   * gesto, pero no el paso.
   */
  #setSelector(hechos: 0 | 1 | 2): void {
    const empresaHecha = hechos >= 1;
    const rutaHecha = hechos === 2;

    // El tramo que une los dos nodos son dos mitades, una en cada escalón:
    // la de abajo del primero y la de arriba del segundo. Se pintan de
    // verde a la vez, en cuanto la empresa está elegida.
    const mitades = [
      this.#el('paso-empresa')?.querySelectorAll<HTMLElement>('.escalon-linea')[1],
      this.#el('paso-ruta')?.querySelectorAll<HTMLElement>('.escalon-linea')[0],
    ];
    for (const mitad of mitades) {
      mitad?.classList.add('is-visible');
      mitad?.classList.toggle('is-hecho', empresaHecha);
    }

    const nodoEmpresa = this.#el('paso-empresa')?.querySelector('.escalon-nodo');
    nodoEmpresa?.classList.toggle('is-hecho', empresaHecha);
    nodoEmpresa?.classList.toggle('is-actual', !empresaHecha);

    const nodoRuta = this.#el('paso-ruta')?.querySelector('.escalon-nodo');
    nodoRuta?.classList.toggle('is-hecho', rutaHecha);
    nodoRuta?.classList.toggle('is-actual', empresaHecha && !rutaHecha);

    this.#el('sel-empresa')?.classList.toggle('is-activa', empresaHecha);
    this.#texto('sel-empresa-title', empresaHecha ? EMPRESA.nombre : VACIO_SELECT.empresa.titulo);
    this.#texto('sel-empresa-sub', empresaHecha ? EMPRESA.sub : VACIO_SELECT.empresa.sub);

    this.#el('sel-ruta')?.classList.toggle('is-activa', rutaHecha);
    this.#texto('sel-ruta-title', rutaHecha ? this.#ruta.nombre : VACIO_SELECT.ruta.titulo);
    this.#texto(
      'sel-ruta-sub',
      rutaHecha ? `${this.#ruta.terminalA} ↔ ${this.#ruta.terminalB}` : VACIO_SELECT.ruta.sub
    );

    // El botón de abajo nunca está muerto: dice qué falta, y sólo se pone
    // verde cuando ya no falta nada.
    let rotulo = 'Elegir empresa';
    if (rutaHecha) rotulo = 'Ver buses en vivo';
    else if (empresaHecha) rotulo = 'Elegir ruta';
    this.#el('launch')?.classList.toggle('is-lista', rutaHecha);
    this.#texto('launch', rotulo);
  }

  /**
   * La cabecera del segundo momento: la píldora y el chip antes y después
   * de elegir ruta. Es `_rutaActiva` de search_pill_bar.dart —con ruta,
   * «Ruta activa» encima del nombre y el botón de la derecha para
   * limpiar— y `_manualPill` de location_status_chip.dart, que sin ruta
   * sólo nombra el punto y con ella cuenta los buses que hay cerca.
   */
  #cabecera(conRuta: boolean): void {
    this.#el('topbar')?.classList.remove('esta-apartada');
    this.#el('pill-etiqueta')?.toggleAttribute('hidden', !conRuta);
    this.#texto('pill-title', conRuta ? this.#ruta.nombre : '¿Qué bus esperas?');
    this.#el('pill-sub')?.toggleAttribute('hidden', conRuta);
    this.#el('pill-der')?.classList.toggle('es-cerrar', conRuta);
    this.#texto('chip-text', conRuta ? '2 buses cerca de tu punto' : 'Tu punto de espera');
  }

  /* ---------- Las vistas del selector ---------- */

  /**
   * Cambia de vista dentro de la hoja. Son las tres de la app —la tarjeta
   * con los dos pasos y las dos listas—, y entrar en una lista es lo que
   * pasa de verdad al tocar un hueco: el hueco no se llena solo.
   */
  #mostrarVista(vista: string): void {
    if (!this.#vistasEl) return;
    for (const v of this.#vistas) v.classList.toggle('active', v.dataset.view === vista);
    this.#ajustarAlto();
  }

  /**
   * El alto de la hoja, animado: el AnimatedSize del selector.
   *
   * Dentro del selector no cambia. route_selector_sheet.dart mide la
   * tarjeta principal una sola vez —`_cardHeight`— y dibuja las dos listas
   * con esa misma altura, así que el diálogo se queda quieto mientras se
   * entra y se sale de ellas; sin eso la hoja daba un brinco en cada paso
   * y el mockup se sentía armado a cortes.
   */
  #ajustarAlto(): void {
    if (!this.#vistasEl) return;
    const activa = this.#vistas.find((v) => v.classList.contains('active'));
    if (!activa) return;
    if (activa.dataset.view === 'selector') this.#altoTarjeta = activa.offsetHeight;
    const alto = this.#altoTarjeta > 0 ? this.#altoTarjeta : activa.offsetHeight;
    this.#vistasEl.style.height = `${alto}px`;
  }

  /**
   * Desplaza una lista hasta dejar una fila a la vista, y marca con qué
   * bordes se desvanece —arriba si queda algo por encima, abajo si queda
   * algo por debajo—. Lo que se mueve es el carril de filas y no la
   * ventana, que es como se mueve una lista de verdad.
   *
   * Hace falta porque la C16 es la última de las seis y en la ventana de
   * la tarjeta no cabe: sin esto el dedo iría a tocar una fila que está
   * fuera de la pantalla.
   */
  #desplazarLista(nombre: string, fila: HTMLElement | null): void {
    const lista = this.#el(nombre);
    const carril = lista?.querySelector<HTMLElement>('.sheet-lista-inner');
    if (!lista || !carril) return;

    // Escondida no hay nada que medir —la ventana da cero—: se deja al
    // principio, que es como la encuentra el bucle siguiente.
    const ventana = lista.clientHeight;
    if (ventana === 0) {
      carril.style.transform = 'translateY(0)';
      lista.classList.remove('hay-arriba', 'hay-abajo');
      return;
    }

    const tope = Math.min(0, ventana - carril.scrollHeight);
    const centrada = fila ? -(fila.offsetTop + fila.offsetHeight / 2 - ventana / 2) : 0;
    const y = Math.max(tope, Math.min(0, centrada));
    carril.style.transform = `translateY(${y}px)`;
    lista.classList.toggle('hay-arriba', y < -1);
    lista.classList.toggle('hay-abajo', y > tope + 1);
  }

  #ciclo(): void {
    this.#parar();
    this.#reposo();
    if (this.#guion === 1) this.#guionPunto();
    else if (this.#guion === 2) this.#guionRuta();
    else if (this.#guion === 3) this.#guionAviso();
  }

  /* ---------- 1. Fija tu punto de espera ---------- */

  #guionPunto(): void {
    this.#a(700, () => this.#toqueEnMapa(MIRA_X, MIRA_Y));
    this.#a(1020, () => {
      this.#mapa.showPin(true);
      this.#prender('chip', true);
    });
    this.#a(2400, () => {
      // location_status_chip.dart: de "localizando" a la ubicación puesta.
      this.#icono('chip', 'pin');
      this.#texto('chip-text', '2 buses cerca de tu punto');
      const pista = this.#el('chip-sub');
      if (pista) {
        pista.textContent = 'Arrástralo para moverlo';
        pista.hidden = false;
      }
      const accion = this.#el('chip-action');
      if (accion) {
        accion.hidden = false;
        accion.classList.add('app-chip-action--suave');
      }
      this.#colocarBuses([850, 1750]);
      this.#mapa.showBuses(true);
      this.#moverBuses();
    });
    this.#a(6600, () => {
      this.#pararBuses();
      this.#prender('chip', false);
      this.#mapa.showPin(false);
      this.#mapa.showBuses(false);
    });
    this.#a(7600, () => this.#ciclo());
  }

  /* ---------- 2. Elige tu ruta ---------- */

  /**
   * Los dos pasos del selector, dados de uno en uno y con sus listas.
   *
   * El hueco no se llena solo: tocar «Empresa» entra en la lista de
   * empresas y tocar «Ruta» entra en la de rutas, que es lo que hace la
   * app. Se elige una fila y la hoja vuelve a la tarjeta con ese paso ya
   * resuelto —la ficha encendida con el nombre dentro, el nodo del riel
   * marcado, la línea llegando al paso siguiente y el botón de abajo con
   * otro recado—.
   *
   * El orden es siempre el mismo: primero el dedo, y 240 ms después lo que
   * el dedo consigue. Ese cuarto de segundo es todo el asunto: es lo que
   * hace que la pantalla se lea como respuesta a un toque y no como una
   * diapositiva que venía detrás.
   *
   * La C16 es la última de las seis rutas, así que antes de tocarla la
   * lista se desplaza hasta ella: primero se ve la lista entera, después
   * se busca, y sólo entonces cae el dedo.
   *
   * El recorrido no está dibujado hasta el final. Mientras se elige, el
   * mapa sólo tiene el punto de espera; la línea de la C16 y sus buses
   * entran al pulsar «Ver buses en vivo», que es de lo que trata el botón.
   */
  #guionRuta(): void {
    // En la app el selector se abre tocando la píldora, y al abrirse la
    // cabecera se aparta hacia arriba (cabecera_flotante.dart).
    this.#a(260, () => this.#toqueSobre('pill'));
    this.#a(500, () => {
      this.#el('topbar')?.classList.add('esta-apartada');
      this.#prender('scrim', true);
      this.#prender('sheet', true);
    });

    this.#a(1600, () => this.#toqueSobre('sel-empresa'));
    this.#a(1840, () => {
      this.#mostrarVista('companies');
      this.#desplazarLista('company-list', null);
    });

    this.#a(3100, () => this.#toqueSobre('tile-empresa'));
    this.#a(3340, () => {
      this.#mostrarVista('selector');
      this.#setSelector(1);
    });

    this.#a(4600, () => this.#toqueSobre('sel-ruta'));
    this.#a(4840, () => {
      this.#mostrarVista('routes');
      this.#desplazarLista('route-list', null);
    });
    this.#a(5400, () => this.#desplazarLista('route-list', this.#filaDeRuta()));

    this.#a(6600, () => this.#toqueSobre(this.#filaDeRuta()));
    this.#a(6840, () => {
      this.#mostrarVista('selector');
      this.#setSelector(2);
    });

    this.#a(8100, () => this.#toqueSobre('launch'));
    this.#a(8360, () => {
      this.#prender('scrim', false);
      this.#prender('sheet', false);
      this.#cabecera(true);
      this.#mapa.showRoute(true);
      this.#colocarBuses([800, 1700]);
      this.#mapa.showBuses(true);
      this.#moverBuses();
    });

    // El bucle vuelve a empezar sin ruta, y en la app la ruta se quita con
    // la X de la píldora (search_pill_bar.dart, `_rutaActiva`): se toca y
    // la cabecera vuelve a «¿Qué bus esperas?» a la vez que se van la
    // línea y los buses. Quitarlos sin tocarla dejaba la píldora
    // anunciando la C16 sobre un mapa sin ella.
    this.#a(13360, () => this.#toqueSobre('pill-der'));
    this.#a(13600, () => {
      this.#pararBuses();
      this.#mapa.showBuses(false);
      this.#mapa.showRoute(false);
      this.#cabecera(false);
    });
    this.#a(14500, () => this.#ciclo());
  }

  /** La fila de la C16 en la lista de rutas: la que el dedo va a tocar. */
  #filaDeRuta(): HTMLElement | null {
    return this.#raiz.querySelector<HTMLElement>(`[data-ruta="${RUTA}"]`);
  }

  /* ---------- 3. Te avisamos ---------- */

  /**
   * El aviso, con sus pasos a la vista: se toca el bus, sale su hoja, se
   * arma el aviso y el aviso suena solo cuando toca.
   *
   * Empezaba con la hoja ya arriba y el dedo tocando el botón al segundo,
   * y de ahí no se movía nada más: nueve segundos de un número bajando.
   * Faltaba lo primero que se hace en la app —tocar un bus del mapa para
   * que la hoja le siga el rastro, `empty-pick-bus`—, y con ello el motivo
   * por el que la hoja habla de ese bus y no de otro.
   *
   * El resto lo lleva la distancia, no el reloj: la tarjeta del aviso sale
   * cuando el bus cruza el kilómetro de `proximity_alerts_provider.dart`,
   * unos segundos después de armarlo, para que no parezca disparada por el
   * dedo. Sale a 1250 m justo para que ese cruce caiga dentro del bucle.
   */
  #guionAviso(): void {
    this.#a(500, () => {
      this.#colocarBuses([1250]);
      this.#mapa.showBuses(true);
      this.#moverBuses((metros) => this.#alAcercarse(metros));
    });

    this.#a(1500, () => this.#toqueSobre(this.#mapa.nodoBus(0)));
    this.#a(1740, () => {
      this.#mapa.setBusElegido(0);
      this.#prender('sheet', true);
    });

    this.#a(3100, () => this.#toqueSobre('alert-btn'));
    this.#a(3340, () => {
      this.#setAviso(true);
      const detalle = this.#el('eta-sub');
      if (detalle) detalle.hidden = false;
    });

    this.#a(12200, () => {
      this.#pararBuses();
      this.#prender('notif', false);
      this.#prender('sheet', false);
      this.#mapa.setBusElegido(null);
      this.#mapa.showBuses(false);
    });
    this.#a(13100, () => this.#ciclo());
  }

  /**
   * El número no se refresca a 60 fps: la app lo hace una vez por segundo
   * y redondeado a la decena, porque al metro los dígitos cambian tan
   * rápido que no se leen.
   */
  #alAcercarse(metros: number): void {
    const ahora = performance.now();
    if (ahora - this.#refresco < 420) return;
    this.#refresco = ahora;
    this.#setMetros(metros);

    // La tarjeta no cambia de texto: dice el título de la notificación de
    // la app, «Tu bus está cerca de ti», y el metraje vive en la hoja
    // del teléfono, debajo.
    this.#prender('notif', this.#avisoPuesto && metros <= RADIO_AVISO_M);
  }

  #redondear(metros: number): number {
    return metros < 100 ? Math.max(10, Math.round(metros)) : Math.round(metros / 10) * 10;
  }

  #setMetros(metros: number): void {
    const m = this.#redondear(metros);
    // _metricParts(): bajo el kilómetro en metros, por encima en kilómetros.
    const [valor, unidad] = metrica(m);
    const cifra = this.#el('eta-value');
    if (cifra) cifraViva(cifra, valor, m);
    this.#texto('eta-unit', unidad);

    // _urgencyColor() de eta_bottom_sheet.dart: coral bajo los 300 metros,
    // ámbar dentro del kilómetro, verde más allá. Y el color va en los dos
    // sitios, la barra y el número —en la app `stripColor` pinta ambos—,
    // porque el número es el dato; teñir solo la barra dejaba el aviso a
    // medias, con la raya verde encima de un número ámbar.
    const cerca = m < RADIO_AVISO_M;
    const muyCerca = m < 300;
    this.#el('eta-bar')?.classList.toggle('eta-strip--cerca', cerca && !muyCerca);
    this.#el('eta-bar')?.classList.toggle('eta-strip--muy-cerca', muyCerca);
    this.#el('eta-value')?.classList.toggle('eta-number--cerca', cerca && !muyCerca);
    this.#el('eta-value')?.classList.toggle('eta-number--muy-cerca', muyCerca);
  }

  #setAviso(puesto: boolean): void {
    this.#avisoPuesto = puesto;
    this.#el('alert-btn')?.classList.toggle('active', puesto);
    this.#texto('alert-label', puesto ? 'Aviso activado' : 'Avisarme cuando esté cerca');
    this.#icono('aviso', puesto ? 'visto' : 'campana');
  }
}
