/**
 * El panel de control de /empresas.html, que ahora se deja tocar.
 *
 * Era una imagen quieta: la ruta Tcherassi con sus cuatro buses y SFA482
 * elegido, siempre igual. Quien decide por una empresa no se cree una
 * captura; se cree lo que prueba. Así que ahora se cambia de ruta, se
 * filtra por estado, se elige un bus en la lista o en el mapa y se oculta
 * o se muestra, y todo lo demás —las cuentas, la leyenda, la ficha, el
 * interruptor de la fila— se entera como se entera allá.
 *
 * Dos rutas y no las seis de la portada: con dos ya se ve que el panel
 * separa la flota por ruta, y cada ruta de más son buses que colocar a
 * mano sobre el plano, cada uno con su rumbo.
 *
 * Cada gesto es el mismo método de `FleetNotifier` (`fleet_providers.dart`)
 * y cada cuenta el mismo getter de `FleetState`; al lado de cada función
 * va cuál. No hay servidor detrás: el estado vive aquí y vuelve al de
 * partida al recargar. El HTML ya trae pintado ese estado de partida, así
 * que sin este guion el panel se ve igual, sólo que no responde.
 */

/** `FleetStatusFilter`: las cuatro pestañas de la lista. */
export type Estado = 'todos' | 'linea' | 'ocultos' | 'sin-senal';

/**
 * Lo que el panel sabe de un bus. `isGhost` es el que lleva más de 90 s sin
 * mandar posición con el turno todavía abierto. Cuando el servidor lo marca
 * así, `online` baja con él: «en línea es haber reportado y no ser
 * fantasma», dice el oyente de `bus:position` en `fleet_providers.dart`.
 */
export interface Bus {
  placa: string;
  ruta: string;
  online: boolean;
  isGhost: boolean;
  visible: boolean;
}

/**
 * `BusEstado` (`bus_estado.dart`): en qué situación está un bus para el
 * operador. De aquí salen el icono y el color de la fila, la ficha, el
 * marcador y la leyenda, así que las cuatro piezas no pueden contar
 * historias distintas.
 */
export type BusEstado = 'en-linea' | 'inactivo' | 'sin-senal' | 'oculto';

/** `BusEstado.values`, en su orden, que es el de los renglones de la leyenda. */
export const BUS_ESTADOS: readonly BusEstado[] = ['en-linea', 'inactivo', 'sin-senal', 'oculto'];

/**
 * `BusEstado.de`, con su misma precedencia. «Oculto» va primero porque es
 * lo que explica que el pasajero no lo vea y lo único que el operador
 * decidió a mano; después, el fantasma es «Inactivo» transmita o no.
 */
export function estadoDe(bus: Bus): BusEstado {
  if (!bus.visible) return 'oculto';
  if (bus.isGhost) return 'inactivo';
  return bus.online ? 'en-linea' : 'sin-senal';
}

/** `BusEstado.rotulo`. */
export const ROTULO: Readonly<Record<BusEstado, string>> = {
  'en-linea': 'En línea',
  inactivo: 'Inactivo',
  'sin-senal': 'Sin señal',
  oculto: 'Oculto',
};

/** `_explicacion` de `fleet_list_tile.dart`: el aviso que sale al pasar sobre el icono. */
export const EXPLICACION: Readonly<Record<BusEstado, string>> = {
  'en-linea': 'En línea: el bus está transmitiendo',
  inactivo: 'Inactivo: lleva más de 90 s sin reportar, pero el turno sigue abierto',
  'sin-senal': 'Sin señal: el bus no está transmitiendo',
  oculto: 'Oculto: lo quitaste del mapa de los pasajeros',
};

/**
 * `BusEstado.icono`, como el símbolo que lo guarda en el HTML:
 * `wifi_tethering`, `pause_circle_outline`, `wifi_off` y `visibility_off`.
 * El de «Oculto» es el mismo ojo tachado del botón de ocultar.
 */
export const ICONO: Readonly<Record<BusEstado, string>> = {
  'en-linea': '#fi-emitiendo',
  inactivo: '#fi-pausa',
  'sin-senal': '#fi-sin-senal',
  oculto: '#fi-ocultar',
};

/** El catálogo de rutas, con el nombre que sale en la píldora y en el chip. */
export const RUTAS: Readonly<Record<string, string>> = {
  tcherassi: 'Tcherassi',
  vivero: 'Vivero Paraíso',
};

/**
 * La flota de partida, en el orden de la lista: por identificador de bus,
 * que es como la ordena `fleetList`. Cada ruta tiene uno que no transmite
 * y Tcherassi además uno oculto, para que cada pestaña tenga algo que
 * enseñar y la de «Ocultos» de Vivero Paraíso salga vacía hasta que se
 * oculte uno. El de Vivero Paraíso es el inactivo, LMR826: así los cuatro
 * estados de la leyenda tienen un bus en el mapa, y la ruta con la que
 * abre la página enseña los tres que se ven a la primera —en línea, sin
 * señal, oculto—.
 */
export const FLOTA: readonly Bus[] = [
  { placa: 'SFA482', ruta: 'tcherassi', online: true, isGhost: false, visible: true },
  { placa: 'TUH513', ruta: 'tcherassi', online: true, isGhost: false, visible: true },
  { placa: 'DMV238', ruta: 'tcherassi', online: false, isGhost: false, visible: true },
  { placa: 'WNP659', ruta: 'tcherassi', online: true, isGhost: false, visible: false },
  { placa: 'KJT704', ruta: 'vivero', online: true, isGhost: false, visible: true },
  { placa: 'BQX391', ruta: 'vivero', online: true, isGhost: false, visible: true },
  { placa: 'LMR826', ruta: 'vivero', online: false, isGhost: true, visible: true },
];

/** El `switch (statusFilter)` de `fleetList`. */
export function pasaElFiltro(bus: Bus, estado: Estado): boolean {
  switch (estado) {
    case 'todos':
      return true;
    case 'linea':
      return bus.online && !bus.isGhost;
    case 'ocultos':
      return !bus.visible;
    case 'sin-senal':
      return !bus.online || bus.isGhost;
  }
}

/** `_routeScoped`. */
const deLaRuta = (buses: readonly Bus[], ruta: string): Bus[] =>
  buses.filter((b) => b.ruta === ruta);

/** `fleetList`: lo que sale en la lista y, lo mismo, en el mapa. */
export const lista = (buses: readonly Bus[], ruta: string, estado: Estado): Bus[] =>
  deLaRuta(buses, ruta).filter((b) => pasaElFiltro(b, estado));

/**
 * Las cifras de las pestañas: `totalBuses`, `onlineBuses`, `hiddenBuses` y
 * `offlineBuses`. Todas de la ruta y ninguna del filtro de estado, así que
 * no cambian al pasar de una pestaña a otra. Se solapan a propósito, como
 * allá: son filtros y no estados, y el oculto que transmite está en «En
 * línea» y en «Ocultos» a la vez.
 */
export function cuentas(buses: readonly Bus[], ruta: string): Record<Estado, number> {
  const r = deLaRuta(buses, ruta);
  return {
    todos: r.length,
    linea: r.filter((b) => pasaElFiltro(b, 'linea')).length,
    ocultos: r.filter((b) => pasaElFiltro(b, 'ocultos')).length,
    'sin-senal': r.filter((b) => pasaElFiltro(b, 'sin-senal')).length,
  };
}

/**
 * Las de la leyenda del mapa, que no son las de las pestañas: cada bus de
 * la ruta cae en un estado y sólo en uno, así que las cuatro suman el
 * total (el `conteo` de `ControlMap.build`). El oculto que transmite cuenta
 * como oculto y no como en línea.
 */
export function leyenda(buses: readonly Bus[], ruta: string): Record<BusEstado, number> {
  const conteo: Record<BusEstado, number> = {
    'en-linea': 0,
    inactivo: 0,
    'sin-senal': 0,
    oculto: 0,
  };
  for (const b of deLaRuta(buses, ruta)) conteo[estadoDe(b)] += 1;
  return conteo;
}

/** `_emptyMessage`, con una ruta siempre elegida. */
export const VACIO: Readonly<Record<Estado, string>> = {
  todos: 'Sin buses registrados',
  linea: 'Ningún bus en línea en esta ruta',
  ocultos: 'Ningún bus oculto en esta ruta',
  'sin-senal': 'Ningún bus sin señal en esta ruta',
};

/** Una píldora o una pestaña: la clase que la pinta y lo que le dice al lector. */
function marcar(el: Element, activo: boolean, clase: string): void {
  el.classList.toggle(clase, activo);
  el.setAttribute('aria-pressed', String(activo));
}

export class PanelFlota {
  readonly #buses: Bus[] = FLOTA.map((b) => ({ ...b }));
  #ruta = 'tcherassi';
  #estado: Estado = 'todos';
  #elegido: string | null = 'SFA482';

  readonly #raiz: HTMLElement;
  readonly #pildoras: HTMLElement[];
  readonly #pestanas: HTMLElement[];
  readonly #filas: HTMLElement[];
  readonly #marcadores: HTMLElement[];
  readonly #cifrasLeyenda: HTMLElement[];
  readonly #cuenta: HTMLElement;
  readonly #vacio: HTMLElement;
  readonly #iconoTodos: Element;
  readonly #ficha: HTMLElement;

  constructor(raiz: HTMLElement) {
    this.#raiz = raiz;
    const todos = (sel: string): HTMLElement[] => Array.from(raiz.querySelectorAll<HTMLElement>(sel));
    const uno = (sel: string): HTMLElement => raiz.querySelector<HTMLElement>(sel)!;
    this.#pildoras = todos('[data-accion="ruta"]');
    this.#pestanas = todos('[data-accion="estado"]');
    this.#filas = todos('.flota-fila');
    this.#marcadores = todos('.flota-bus');
    this.#cifrasLeyenda = todos('[data-leyenda]');
    this.#cuenta = uno('.flota-cuenta');
    this.#vacio = uno('.flota-vacio');
    this.#iconoTodos = uno('[data-todos]');
    this.#ficha = uno('.flota-ficha');

    // Un solo oyente para todo el panel: cada botón dice qué hace en su
    // `data-accion`, y el bus al que se refiere lo pone la fila o el
    // marcador que lo contiene. El de la ficha no está dentro de ninguno y
    // actúa sobre el elegido, igual que allá.
    raiz.addEventListener('click', (e) => this.#tocar(e));

    // En el teléfono (880 es el corte de la página) es un dibujo pequeño y no
    // una herramienta: inerte, no se lleva el toque ni el desplazamiento de
    // quien baja la página, ni da foco de teclado a botones de 8 px.
    const movil = window.matchMedia('(max-width: 879px)');
    const inerte = (): void => {
      raiz.toggleAttribute('inert', movil.matches);
    };
    inerte();
    movil.addEventListener('change', inerte);

    this.#pintar();
  }

  #bus(placa: string): Bus {
    return this.#buses.find((b) => b.placa === placa)!;
  }

  #tocar(e: MouseEvent): void {
    const boton = (e.target as Element).closest<HTMLElement>('[data-accion]');
    if (!boton || !this.#raiz.contains(boton)) return;
    const placa = boton.closest<HTMLElement>('[data-bus]')?.dataset.bus ?? this.#elegido;

    switch (boton.dataset.accion) {
      // `setRouteFilter`. No suelta el bus elegido: allá tampoco, y la
      // ficha se queda abierta con su ruta en el chip mientras se mira la
      // otra.
      case 'ruta':
        this.#ruta = boton.dataset.ruta!;
        break;
      // `setStatusFilter`.
      case 'estado':
        this.#estado = boton.dataset.estado as Estado;
        break;
      // `selectBus`, desde la fila o desde el marcador. Tocar el elegido
      // otra vez no lo suelta: eso lo hace sólo la X de la ficha.
      case 'elegir':
        this.#elegido = placa;
        break;
      // `toggleVisibility`, desde el interruptor de la fila o el botón de
      // la ficha. Allá espera al servidor con un indicador girando; aquí
      // no hay servidor que esperar.
      case 'visibilidad':
        if (placa) this.#bus(placa).visible = !this.#bus(placa).visible;
        break;
      // `selectBus(null)`. La X deja de existir al cerrarse la ficha, así
      // que el foco pasa a la fila del bus que se estaba viendo: si no, se
      // iría al principio de la página y quien va con teclado perdería el
      // sitio. Si esa fila no está a la vista —el bus es de la otra ruta o
      // lo quita la pestaña—, a la píldora de la ruta que se está mirando,
      // que es donde se decide qué se ve.
      case 'cerrar': {
        const fila = this.#filas.find((f) => f.dataset.bus === this.#elegido && !f.hidden);
        this.#elegido = null;
        this.#pintar();
        const destino =
          fila?.querySelector<HTMLElement>('[data-accion="elegir"]') ??
          this.#pildoras.find((p) => p.dataset.ruta === this.#ruta);
        destino?.focus({ preventScroll: true });
        return;
      }
      default:
        return;
    }
    this.#pintar();
  }

  /** Todo el panel a partir del estado, de una vez: como `build` en Flutter. */
  #pintar(): void {
    const enLista = new Set(lista(this.#buses, this.#ruta, this.#estado).map((b) => b.placa));
    const cifras = cuentas(this.#buses, this.#ruta);
    const cifrasMapa = leyenda(this.#buses, this.#ruta);

    for (const p of this.#pildoras) marcar(p, p.dataset.ruta === this.#ruta, 'es-activo');
    for (const p of this.#pestanas) {
      const estado = p.dataset.estado as Estado;
      marcar(p, estado === this.#estado, 'es-activa');
      p.querySelector('b')!.textContent = String(cifras[estado]);
    }

    // La cifra junto a «BUSES» es el largo de la lista, filtro de estado
    // incluido: en el Dart es `buses.length`, no `totalBuses`.
    this.#cuenta.textContent = String(enLista.size);
    this.#vacio.hidden = enLista.size > 0;
    this.#vacio.textContent = VACIO[this.#estado];

    for (const fila of this.#filas) {
      const bus = this.#bus(fila.dataset.bus!);
      const estado = estadoDe(bus);
      const elegida = bus.placa === this.#elegido;
      fila.hidden = !enLista.has(bus.placa);
      fila.dataset.busEstado = estado;
      fila.classList.toggle('es-elegida', elegida);
      fila.classList.toggle('flota-fila--oculta', !bus.visible);
      // El icono junto a la placa, con el aviso de `Tooltip` en su
      // `<title>`. El lector de pantalla no lo recorre: el rótulo ya va en
      // el nombre del botón de la fila, que es lo que sí se recorre.
      fila.querySelector('.flota-fila-placa use')!.setAttribute('href', ICONO[estado]);
      fila.querySelector('.flota-fila-placa title')!.textContent = EXPLICACION[estado];
      const elegir = fila.querySelector('[data-accion="elegir"]')!;
      elegir.setAttribute('aria-pressed', String(elegida));
      elegir.setAttribute('aria-label', `Elegir ${bus.placa}, ${ROTULO[estado].toLowerCase()}`);
      fila.querySelector('[data-accion="visibilidad"]')!.setAttribute('aria-checked', String(bus.visible));
      fila.querySelector('.flota-permiso-texto')!.textContent = bus.visible ? 'PERMITIDO' : 'OCULTO';
    }

    // El marcador sale de la misma `fleetList` que la lista: lo que el
    // filtro quita de una lo quita del otro. Cómo se dibuja lo dice su
    // estado, el mismo `BusEstado.de` que pinta la fila.
    for (const m of this.#marcadores) {
      const bus = this.#bus(m.dataset.bus!);
      const elegido = bus.placa === this.#elegido;
      m.classList.toggle('es-fuera', !enLista.has(bus.placa));
      m.dataset.busEstado = estadoDe(bus);
      m.classList.toggle('es-elegido', elegido);
    }

    for (const c of this.#cifrasLeyenda) {
      c.textContent = String(cifrasMapa[c.dataset.leyenda as BusEstado]);
    }

    // El botón de la barra ofrece lo contrario de lo que hay: ocultar
    // todos si todos se ven y mostrarlos si falta alguno. Mira la flota
    // entera, no la ruta, como `allBusesVisible`.
    this.#iconoTodos.setAttribute(
      'href',
      this.#buses.every((b) => b.visible) ? '#fi-ocultar' : '#fi-mostrar'
    );

    this.#pintarFicha();
  }

  /**
   * `_SelectedBusCard`. Al cerrarse no se vacía: se funde con lo último que
   * enseñaba, y vaciarla antes dejaría ver una ficha en blanco yéndose.
   * `inert` la saca del recorrido del teclado mientras está cerrada.
   */
  #pintarFicha(): void {
    const bus = this.#elegido ? this.#bus(this.#elegido) : null;
    this.#ficha.classList.toggle('es-cerrada', !bus);
    this.#ficha.toggleAttribute('inert', !bus);
    if (!bus) return;

    const campo = (nombre: string): Element => this.#ficha.querySelector(`[data-ficha="${nombre}"]`)!;
    const estado = estadoDe(bus);
    this.#ficha.dataset.busEstado = estado;
    campo('placa').textContent = bus.placa;
    campo('estado').textContent = ROTULO[estado];
    campo('estado-icono').setAttribute('href', ICONO[estado]);
    campo('ruta').textContent = RUTAS[bus.ruta];
    campo('ocultar').textContent = bus.visible ? 'Ocultar' : 'Mostrar';
    campo('ocultar-icono').setAttribute('href', bus.visible ? '#fi-ocultar' : '#fi-mostrar');
    this.#ficha.querySelector('.flota-ocultar')!.classList.toggle('es-mostrar', !bus.visible);
  }
}
