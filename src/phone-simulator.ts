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
 *   selector vacío     → route_selector_sheet.dart
 *   lista de empresas  → route_selector_sheet.dart
 *   lista de rutas     → route_selector_sheet.dart
 *   selector completo  → route_selector_sheet.dart
 *   manual-near + ETA  → eta_bottom_sheet.dart
 *
 * El selector no es un cartel: se abre vacío y se llena a golpe de dedo,
 * y la ruta que entra en el hueco es la que el guion acaba de elegir de la
 * lista —una distinta en cada vuelta, las seis de Sobusa por turno—, no
 * una escrita a mano en el HTML.
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
  },
  /*
    Con ruta puesta y buses en el mapa, la hoja todavía no dice ninguna
    distancia: primero hay que decirle a cuál. Es el estado
    'empty-pick-bus' de eta_bottom_sheet.dart, y la landing se lo saltaba
    —enseñaba el número del más cercano sin que nadie hubiera elegido
    nada, que es justo lo que la app no hace—.
  */
  elegirBus: {
    icono: 'toque',
    titulo: 'Toca un bus en el mapa',
    sub: 'Selecciona un bus para darle seguimiento'
  }
} as const;

/**
 * Los dos huecos del selector sin nada elegido. Los textos son los que
 * pone route_selector_sheet.dart cuando `selectedCompany` o
 * `selectedRoute` vienen nulos.
 */
const VACIO_SELECT = {
  empresa: { titulo: 'Empresa', sub: 'Con cuál viajas' },
  ruta: { titulo: 'Ruta', sub: 'Cuál esperas' }
} as const;

/**
 * La empresa de la prueba. No sale de rutas.json —ahí sólo están las
 * rutas— sino de que las seis son de Sobusa, que es lo que dicen la app y
 * la propia landing. El subtítulo es el literal del selector.
 */
const EMPRESA = { nombre: 'Sobusa', sub: 'Empresa de transporte masivo' } as const;

/**
 * Las empresas que enseña la lista. Sobusa es la del piloto y es siempre la
 * que se elige; las otras tres son las que mueven Barranquilla, y están
 * porque una lista de una sola fila no es una lista —el paso de elegir
 * empresa no se entendería—. Van en orden alfabético, sin trato de favor.
 *
 * Cada insignia lleva los colores de su empresa, no un color de relleno:
 * el verde y rojo de Sobusa, el verde y amarillo de Coolitoral, el azul de
 * Sodis y el navy de Transmetro. Son los tokens de la casa, sin colores
 * nuevos. El rojo sale de --error porque es el único rojo pleno que hay en
 * variables.css; aquí no significa error, es la tinta de la marca.
 */
const EMPRESAS = [
  { nombre: 'Coolitoral', fondo: 'var(--green)', tinta: 'var(--amber)' },
  { nombre: 'Sobusa', fondo: 'var(--green)', tinta: 'var(--error)' },
  { nombre: 'Sodis', fondo: 'var(--electric-blue)', tinta: '#FFFFFF' },
  { nombre: 'Transmetro', fondo: 'var(--navy)', tinta: '#FFFFFF' }
] as const;

const CONECTORES = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y']);

/**
 * _companyInitials(): la primera palabra y la siguiente que no sea un
 * conector; si sólo hay una, sus dos primeras letras.
 */
function inicialesEmpresa(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(p => p.length > 0);
  if (palabras.length === 0) return '?';
  const claves = palabras.filter(p => !CONECTORES.has(p.toLowerCase()));
  if (claves.length === 0) return palabras[0][0].toUpperCase();
  if (claves.length === 1) return claves[0].slice(0, 2).toUpperCase();
  return (claves[0][0] + claves[1][0]).toUpperCase();
}

type ClaveChip = keyof typeof CHIPS;
type ClaveVacio = keyof typeof VACIOS;
type ClaveSelect = keyof typeof VACIO_SELECT;

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
  /**
   * El bus al que la hoja le sigue el rastro, por su sitio en `buses`.
   * Mientras es `null` la hoja está en 'Toca un bus en el mapa'. Una vez
   * elegido no cambia aunque otro se ponga más cerca: la app sigue al que
   * tocaste, no al más próximo.
   */
  private busElegido: number | null = null;

  /*
    Dónde nace cada bus manda sobre todo el tramo final del guion: a 46 m/s,
    cada metro de más son 22 ms de demo. El primero arrancaba 1350 m detrás
    del punto de espera y llegaba al kilómetro —el radio del aviso— a los
    17,3 s, cuando el dedo acababa de armarlo; la notificación salía casi
    encima del toque y parecía que el aviso sólo se puede poner cuando el
    bus ya lo tienes ahí. Con 1450 el kilómetro cae a los 19,4 s: el dedo
    arma a 1,3 km y quedan cinco segundos y medio de espera con el número
    bajando, que es justo lo que hay que enseñar.
  */
  private readonly buses: EstadoBus[] = [
    { placa: 'B-042', nace: 1450, ritmo: 1, t: 0 },
    { placa: 'B-055', nace: 2250, ritmo: 0.78, t: 0 }
  ];

  /**
   * Ruta con la que abre el bucle. C16 Calle 72 Uninorte es la que cruza el
   * centro de lo que se ve del mapa, así que de entrada se lee entera y con
   * el punto de espera bien puesto; de ahí en adelante el ciclo sigue con
   * las demás en orden.
   */
  private static readonly RUTA_INICIAL = 'R-106';

  /** Las vistas que la app dibuja como diálogo y no como hoja. */
  private static readonly VISTAS_SELECTOR = new Set(['selector', 'companies', 'routes']);

  /** Fracción de la ventana que se come el desvanecido de abajo. */
  private static readonly RESGUARDO = 0.18;

  private indiceRuta = 0;
  private avisoActivo = false;
  /** Lo que mide la tarjeta del selector; las listas se dibujan con ella. */
  private altoTarjeta = 0;
  /** Cierre del ciclo en curso: nada nuevo debe volver a asomarse. */
  private cerrando = false;
  private rutaActual: RutaLanding;
  private relojes: number[] = [];
  private animId: number | null = null;
  private etaId: number | null = null;
  /** El guion quiere los buses rodando. Otra cosa es que alguien los mire. */
  private busesEnMarcha = false;
  /** El teléfono está a la vista, aunque sea de refilón. */
  private visible = true;

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
    this.pintarEmpresas();
    this.vigilarVisibilidad();
    this.play();
  }

  /**
   * El guion no para nunca: recorre las seis rutas y vuelve a empezar. Eso
   * está bien mientras el teléfono se vea, pero abajo del todo hay un
   * carrusel de logos y el bucle de los buses le quitaba cuadros aunque el
   * teléfono estuviera muy arriba, fuera de la pantalla. De ahí que la cinta
   * fuera bien a ratos y a ratos se atascara. Fuera de vista se apaga el
   * bucle —solo el bucle: los relojes del guion siguen, para que al volver
   * la escena esté donde tocaba y no congelada donde se quedó.
   */
  private vigilarVisibilidad(): void {
    if (typeof IntersectionObserver !== 'function') return;
    new IntersectionObserver(
      entradas => {
        for (const entrada of entradas) {
          this.visible = entrada.isIntersecting;
          if (this.visible) {
            if (this.busesEnMarcha) this.iniciarAnimacion();
          } else {
            this.detenerAnimacion();
          }
        }
      },
      // Un margen para que arranque justo antes de asomarse y nadie
      // alcance a ver el primer cuadro quieto.
      { rootMargin: '120px' },
    ).observe(this.raiz);
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
   * La lista de empresas, también con los datos y no a mano: la insignia
   * lleva las iniciales y el color que le sacaría el selector a cada
   * nombre. El id que alimenta ese color es el nombre en minúsculas, que
   * es como está el de Sobusa.
   */
  private pintarEmpresas(): void {
    const lista = this.el('company-list');
    if (!lista) return;
    const carril = document.createElement('div');
    carril.className = 'sheet-lista-inner';
    carril.append(
      ...EMPRESAS.map(empresa => {
        const fila = document.createElement('div');
        fila.className = 'app-tile';
        // El dedo del guion siempre busca la misma: la del piloto.
        if (empresa.nombre === EMPRESA.nombre) fila.dataset.el = 'tile-empresa';
        fila.innerHTML = `
          <span class="app-tile-icon app-tile-icon--empresa"></span>
          <span class="app-tile-body">
            <span class="app-tile-title"></span>
          </span>
          <span class="app-tile-chevron" aria-hidden="true">›</span>`;
        const insignia = fila.querySelector<HTMLElement>('.app-tile-icon')!;
        insignia.textContent = inicialesEmpresa(empresa.nombre);
        insignia.style.background = empresa.fondo;
        insignia.style.color = empresa.tinta;
        fila.querySelector('.app-tile-title')!.textContent = empresa.nombre;
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
    // que subir para que la fila termine dentro. Y no basta con que entre:
    // el desvanecido de abajo se come el último trozo de la ventana, así
    // que la fila tiene que terminar por encima de él o el dedo acabaría
    // tocando una fila medio borrada. Si para eso hay que llegar al final
    // del carril, mejor: allí ya no hay desvanecido que la tape.
    const ventana = lista.clientHeight;
    const tope = Math.max(0, carril.offsetHeight - ventana);
    const fin = fila.offsetTop + fila.offsetHeight;
    const empuje = Math.min(tope, Math.max(0, fin - ventana * (1 - PhoneSimulator.RESGUARDO)));
    this.marcarBordes(lista, empuje, tope);
    if (empuje === 0) return;
    this.a(560, () => {
      carril.style.transform = `translateY(${-empuje}px)`;
    });
  }

  /**
   * Los dos desvanecidos de la ventana, cada uno por el lado por el que la
   * lista sigue de verdad. Es lo que hace la sombra de desplazamiento de
   * cualquier lista: aparece cuando hay algo escondido y no antes.
   */
  private marcarBordes(lista: HTMLElement, empuje: number, tope: number): void {
    lista.classList.toggle('hay-arriba', empuje > 0.5);
    lista.classList.toggle('hay-abajo', tope - empuje > 0.5);
  }

  /**
   * Devuelve el carril de rutas a su tope, y sin animarlo: esto pasa entre
   * ciclo y ciclo, con la app disuelta, y una lista rebobinándose a la vista
   * delataría el truco.
   */
  private reiniciarLista(): void {
    const lista = this.el('route-list');
    const carril = lista?.querySelector<HTMLElement>('.sheet-lista-inner');
    if (!lista || !carril) return;
    carril.style.transition = 'none';
    carril.style.transform = 'translateY(0)';
    void carril.offsetHeight;
    carril.style.transition = '';
    // Arriba del todo: no hay nada escondido por encima, y sí por debajo.
    lista.classList.remove('hay-arriba');
    lista.classList.add('hay-abajo');
  }

  /**
   * El alto de la hoja, animado. Es el AnimatedSize del selector: sin él
   * la hoja cambia de tamaño de golpe en cada paso y el mockup se siente
   * armado a cortes en vez de manejado por alguien.
   *
   * Dentro del selector no cambia: route_selector_sheet.dart mide la
   * tarjeta principal una sola vez —`_cardHeight`— y dibuja las dos listas
   * con esa misma altura, así que el diálogo se queda quieto mientras se
   * entra y se sale de ellas. Aquí igual: se guarda lo que midió la vista
   * del selector, que es siempre la primera que se abre, y las listas la
   * heredan.
   */
  private ajustarAlto(): void {
    const activa = this.vistas.find(v => v.classList.contains('active'));
    if (!activa) return;
    const vista = activa.dataset.view ?? '';
    if (vista === 'selector') this.altoTarjeta = activa.offsetHeight;
    const alto =
      PhoneSimulator.VISTAS_SELECTOR.has(vista) && this.altoTarjeta > 0
        ? this.altoTarjeta
        : activa.offsetHeight;
    this.vistasEl.style.height = `${alto}px`;
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

  /**
   * Cambia de vista y, con ella, de superficie. Las tres vistas del
   * selector no son contenido dentro de la hoja de distancia: en la app
   * son un diálogo encima del mapa, con su Material blanco y su velo. Por
   * eso el vestido y el velo se deciden aquí y no repartidos por el guion
   * —una sola línea que decidir, y nunca se quedan puestos de más.
   */
  private mostrarVista(vista: string): void {
    for (const v of this.vistas) v.classList.toggle('active', v.dataset.view === vista);
    const enSelector = PhoneSimulator.VISTAS_SELECTOR.has(vista);
    this.sheetEl.classList.toggle('es-selector', enSelector);
    this.el('scrim')?.classList.toggle('is-on', enSelector);
    this.ajustarAlto();
  }

  /**
   * Los dos huecos del selector y el botón de abajo. Vacío el hueco va
   * apagado y sin subtítulo; puesto se enciende. El botón espera a la
   * ruta: hasta que la haya es el disabled del ElevatedButton, con su
   * texto y su gris.
   */
  private setSelector(empresa: boolean, ruta: RutaLanding | null): void {
    this.setSelect('empresa', empresa ? EMPRESA.nombre : null, EMPRESA.sub, !empresa);
    this.setSelect(
      'ruta',
      ruta ? ruta.nombre : null,
      ruta ? `${ruta.terminalA} ↔ ${ruta.terminalB}` : '',
      empresa && ruta === null
    );
    const boton = this.el('launch');
    if (!boton) return;
    // El botón nunca está muerto: dice el paso que falta y, cuando ya no
    // falta ninguno, se pone verde y promete lo que va a pasar.
    boton.textContent = ruta
      ? 'Ver buses en vivo'
      : empresa
        ? 'Elegir ruta'
        : 'Elegir empresa';
    boton.classList.toggle('is-lista', ruta !== null);
  }

  /**
   * Un peldaño del selector: la ficha que se toca y, a su izquierda, el
   * nodo del riel —hueco, con punto verde si es el que toca ahora, o
   * relleno con su palomita cuando ya está resuelto—.
   */
  private setSelect(
    cual: ClaveSelect,
    titulo: string | null,
    sub: string,
    actual: boolean
  ): void {
    const hecho = titulo !== null;
    const vacio = VACIO_SELECT[cual];
    this.el(`sel-${cual}`)?.classList.toggle('is-activa', hecho);
    this.texto(`sel-${cual}-title`, titulo ?? vacio.titulo);
    this.texto(`sel-${cual}-sub`, hecho ? sub : vacio.sub);
    const paso = this.el(`paso-${cual}`);
    if (!paso) return;
    const nodo = paso.querySelector('.escalon-nodo');
    nodo?.classList.toggle('is-hecho', hecho);
    nodo?.classList.toggle('is-actual', actual);
    for (const linea of paso.querySelectorAll('.escalon-linea.is-visible')) {
      linea.classList.toggle('is-hecho', hecho);
    }
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
  private toqueSobre(nodo: Element | null | undefined): void {
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
    this.el('pill-der')?.classList.toggle('es-cerrar', ruta !== null);
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
    this.setVacio('sinPunto');
    this.setSelector(false, null);
    this.busElegido = null;
    this.map.setBusElegido(null);
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

    // El pasajero toca la barra y se abre el selector, vacío: dos huecos
    // apagados y un botón que todavía no deja pasar. Cada vista va
    // precedida de su toque, con el mismo cuarto de segundo de por medio.
    this.a(3100, () => this.toqueSobre(this.el('pill')));
    this.a(3340, () => this.mostrarVista('selector'));

    // Primero la empresa, que es el orden que impone la app: con el hueco
    // de empresa vacío, tocar el de ruta no abre nada.
    this.a(4300, () => this.toqueSobre(this.el('sel-empresa')));
    this.a(4540, () => this.mostrarVista('companies'));
    this.a(5400, () => this.toqueSobre(this.el('tile-empresa')));
    this.a(5640, () => {
      this.mostrarVista('selector');
      this.setSelector(true, null);
    });

    // Y ahora sí la ruta. La lista se abre por la fila que toca —cada
    // vuelta elige una distinta de las seis— y termina de acomodarse en
    // 560 ms; el dedo llega después, ya con la fila quieta y a la vista.
    this.a(6500, () => this.toqueSobre(this.el('sel-ruta')));
    this.a(6740, () => {
      this.mostrarVista('routes');
      this.desplazarLista();
    });
    this.a(8100, () => this.toqueSobre(this.filaDeRuta()));

    // La ruta elegida vuelve al selector y se ve entrar en su hueco: se
    // enciende el ícono, aparecen las dos terminales debajo y el botón de
    // abajo deja de estar deshabilitado. Ése es el remate del selector, y
    // por eso el dedo espera a que se lea antes de pulsarlo.
    this.a(8340, () => {
      this.mostrarVista('selector');
      this.setSelector(true, this.rutaActual);
    });
    this.a(9400, () => this.toqueSobre(this.el('launch')));

    // "Ver buses en vivo": se va el diálogo, aparece el trazado, la píldora
    // cambia y entran los buses.
    this.a(9660, () => {
      this.map.showRoute(true);
      this.setPildora(this.rutaActual);
      this.enVivo();
    });

    // Y aquí va el paso que faltaba: la hoja no dice ninguna distancia
    // hasta que alguien elige un bus. El dedo va al que viene por delante
    // —que es el que elegiría cualquiera— y sólo entonces sale el número.
    // El toque se calcula en el momento, no antes: el bus se está moviendo
    // y su sitio en pantalla no es el mismo que hace un segundo.
    this.a(11400, () => {
      const cerca = this.masCercano();
      if (cerca !== null) this.toqueSobre(this.map.nodoBus(cerca));
    });
    this.a(11640, () => {
      const cerca = this.masCercano();
      if (cerca !== null) this.seguirBus(cerca);
    });

    // El pasajero arma el aviso, y lo arma sobre la tarjeta completa: la
    // franja de color, "ruta - placa" y el número, todo a la vista. Antes
    // aquí la hoja se recogía a su escalón "peek" para enseñar más mapa, y
    // el momento importante —la franja pasando a ámbar, la notificación
    // saliendo— ocurría en una tarjeta que ya no decía a qué bus se refería.
    //
    // El cuándo también dice algo. El aviso se arma a 1,3 km, con el bus
    // todavía lejos y la franja verde: así se ve que esto se deja puesto
    // de antemano y el teléfono avisa solo. Iba a los 17,1 s, con el bus
    // ya casi en el kilómetro, y la notificación salía tan pegada al toque
    // que parecía dispararla el dedo. Los dos segundos que se le quitan
    // aquí son los que la tarjeta lleva en pantalla desde que salió el
    // número (11,64 s): el mismo respiro que hay entre los demás toques.
    this.a(13600, () => this.toqueSobre(this.el('alert-btn')));
    this.a(13860, () => {
      this.setAviso(true);
      // El detalle sólo aparece con el aviso puesto, igual que en la app:
      // mientras hay distancia y no hay aviso, la hoja no dice nada.
      this.avisoActivo = true;
      this.setDetalle('Puedes cambiar de aplicación; no cierres Ya Viene del todo');
    });
    // El ciclo no corta: primero se recoge lo que sobra —el aviso flotante,
    // el detalle— y después la app se disuelve. Cuando vuelve a entrar ya
    // está recolocada, así que no se ve nada saltar.
    this.a(26400, () => {
      this.cerrando = true;
      this.escena?.querySelector('[data-escena="notif"]')?.classList.remove('is-on');
      this.setDetalle('');
      // Los buses se van primero, uno con el otro, y el trazado detrás:
      // cada capa se apaga con la transición que ya tenía.
      this.map.showBuses(false);
    });
    this.a(27000, () => {
      this.map.showRoute(false);
      this.map.showPin(false);
      this.raiz.classList.add('is-cerrando');
    });
    this.a(28000, () => this.play());
  }

  /**
   * La tarjeta flotante dice lo que dice la notificación de la app, en una
   * línea: "El bus <placa> está cerca de ti". Y aparece cuando aparecería de
   * verdad: con el aviso armado y el bus ya dentro del kilómetro. La
   * distancia no se repite aquí —está en la hoja del teléfono, justo
   * debajo—, y es la misma tarjeta del paso 3 y de la sección del mapa.
   */
  private notificacion(placa: string, metros: number): void {
    const dentro = !this.cerrando && this.avisoActivo && metros <= this.radioAvisoM;
    const tarjeta = this.escena?.querySelector('[data-escena="notif"]');
    if (dentro) {
      this.escenaTexto('notif-title', `El bus ${placa} está cerca de ti`);
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
    this.texto('alert-label', puesto ? 'Aviso activado' : 'Avisarme cuando esté cerca');
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

  /**
   * "Ver buses en vivo": entran los buses y la hoja pide que se elija uno.
   * La distancia no sale todavía —no hay a qué medirla— y por eso el
   * cronómetro de la hoja tampoco arranca aquí.
   */
  private enVivo(): void {
    this.setChip('cerca');
    this.setDetalle('');
    this.colocarBuses();
    this.map.showBuses(true);
    this.setVacio('elegirBus');
    this.arrancarBuses();
  }

  /** El dedo toca un bus: a partir de aquí la hoja le sigue el rastro. */
  private seguirBus(indice: number): void {
    this.busElegido = indice;
    this.map.setBusElegido(indice);
    this.mostrarVista('eta');
    this.setDetalle('Buscando la posición del bus…');
    this.actualizarEta();
    this.etaId ??= window.setInterval(() => this.actualizarEta(), 1000);
  }

  /* ---------- Distancia (espeja _metricParts/_urgencyColor) ---------- */

  private partesMetrica(metros: number): [string, string] {
    if (metros < 1000) return [Math.round(metros).toString(), 'm de ti'];
    return [(metros / 1000).toFixed(1), 'km de ti'];
  }

  private colorUrgencia(metros: number): string {
    if (metros < 300) return 'var(--app-coral-accessible)';
    if (metros < this.radioAvisoM) return 'var(--app-warn-accessible)';
    return 'var(--app-primary-accessible)';
  }

  /**
   * Metros que le faltan a un bus para llegar al pin, sobre el recorrido y
   * no en línea recta: el bus tiene que pasar por la vía, no cruzar por
   * encima de las manzanas.
   */
  private metrosHastaPin(bus: EstadoBus): number | null {
    const largo = this.map.metrosDeRuta;
    if (!largo) return null;
    return ((this.pinT - bus.t + 1) % 1) * largo;
  }

  /** El más próximo por delante del pin: el que el dedo va a tocar. */
  private masCercano(): number | null {
    let elegido: number | null = null;
    let cerca = Infinity;
    this.buses.forEach((b, i) => {
      const metros = this.metrosHastaPin(b);
      if (metros !== null && metros < cerca) {
        cerca = metros;
        elegido = i;
      }
    });
    return elegido;
  }

  /**
   * Refresca el número una vez por segundo y redondeado a la decena. A 60
   * fps y al metro, los dígitos cambiaban tan rápido que no se leían.
   */
  private actualizarEta(): void {
    if (this.busElegido === null) return;
    const bus = this.buses[this.busElegido];
    const crudo = bus === undefined ? null : this.metrosHastaPin(bus);
    if (bus === undefined || crudo === null) return;

    const metros = crudo < 100 ? Math.max(10, Math.round(crudo)) : Math.round(crudo / 10) * 10;
    const [valor, unidad] = this.partesMetrica(metros);

    // bus_labels.dart: routePlateLabel() arma "ruta - placa".
    this.texto('eta-route', `${this.rutaActual.nombre} - ${bus.placa}`);

    // Con distancia en pantalla y sin aviso puesto, la app no muestra
    // detalle: el número ya lo dice todo.
    if (!this.avisoActivo) this.setDetalle('');

    this.texto('eta-value', valor);
    this.texto('eta-unit', unidad);
    this.notificacion(bus.placa, metros);
    // La franja y el número llevan el mismo color: en la app los dos
    // salen de `stripColor`, no solo la franja.
    const urgencia = this.colorUrgencia(metros);
    const barra = this.el('eta-bar');
    if (barra) barra.style.background = urgencia;
    const numero = this.el('eta-value');
    if (numero) numero.style.color = urgencia;
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
    // El reloj de la distancia lo enciende seguirBus(): los buses ruedan
    // desde que aparecen, pero no hay número que refrescar hasta que se
    // elige uno.
    this.busesEnMarcha = true;
    if (this.visible) this.iniciarAnimacion();
  }

  private iniciarAnimacion(): void {
    if (this.animId !== null) return;

    // `previo` nace en null a propósito cada vez que se enciende: al volver
    // de estar fuera de vista, el primer cuadro vale dt = 0 y los buses
    // siguen desde donde estaban, en vez de dar un salto por todo el rato
    // que la cinta estuvo apagada.
    let previo: number | null = null;
    const bucle = (ahora: number): void => {
      const dt = previo === null ? 0 : Math.min(0.1, (ahora - previo) / 1000);
      previo = ahora;
      this.pasoBuses(dt);
      this.animId = requestAnimationFrame(bucle);
    };
    this.animId = requestAnimationFrame(bucle);
  }

  private detenerAnimacion(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private pararBuses(): void {
    this.busesEnMarcha = false;
    this.detenerAnimacion();
    if (this.etaId !== null) {
      clearInterval(this.etaId);
      this.etaId = null;
    }
  }
}
