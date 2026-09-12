/**
 * El panel de control de /empresas.html, que ahora se deja tocar.
 *
 * Era una imagen quieta: la ruta Tcherassi con sus cuatro buses y SFA-482
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
 * Lo que el panel sabe de un bus. `isGhost` no está: es el bus que el
 * servidor da por muerto aunque siga mandando posiciones, y en esta flota
 * no hay ninguno, así que `online && !isGhost` se queda en `online`.
 */
export interface Bus {
  placa: string;
  ruta: string;
  online: boolean;
  visible: boolean;
}

/** El catálogo de rutas, con el nombre que sale en la píldora y en el chip. */
export const RUTAS: Readonly<Record<string, string>> = {
  tcherassi: 'Tcherassi',
  vivero: 'Vivero Paraíso',
};

/**
 * La flota de partida, en el orden de la lista: por identificador de bus,
 * que es como la ordena `fleetList`. En cada ruta hay uno sin señal y en
 * Tcherassi además uno oculto, para que cada pestaña tenga algo que
 * enseñar y la de «Ocultos» de Vivero Paraíso salga vacía hasta que se
 * oculte uno.
 */
export const FLOTA: readonly Bus[] = [
  { placa: 'SFA-482', ruta: 'tcherassi', online: true, visible: true },
  { placa: 'TUH-513', ruta: 'tcherassi', online: true, visible: true },
  { placa: 'DMV-238', ruta: 'tcherassi', online: false, visible: true },
  { placa: 'WNP-659', ruta: 'tcherassi', online: true, visible: false },
  { placa: 'KJT-704', ruta: 'vivero', online: true, visible: true },
  { placa: 'BQX-391', ruta: 'vivero', online: true, visible: true },
  { placa: 'LMR-826', ruta: 'vivero', online: false, visible: true },
];

/** El `switch (statusFilter)` de `fleetList`. */
export function pasaElFiltro(bus: Bus, estado: Estado): boolean {
  switch (estado) {
    case 'todos':
      return true;
    case 'linea':
      return bus.online;
    case 'ocultos':
      return !bus.visible;
    case 'sin-senal':
      return !bus.online;
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
 * no cambian al pasar de una pestaña a otra.
 */
export function cuentas(buses: readonly Bus[], ruta: string): Record<Estado, number> {
  const r = deLaRuta(buses, ruta);
  return {
    todos: r.length,
    linea: r.filter((b) => b.online).length,
    ocultos: r.filter((b) => !b.visible).length,
    'sin-senal': r.filter((b) => !b.online).length,
  };
}

/**
 * Las de la leyenda del mapa, que no son las de las pestañas: aquí «En
 * línea» es lo que el pasajero ve en verde, así que el oculto que
 * transmite no entra (`control_map.dart`, `_Legend`).
 */
export function leyenda(
  buses: readonly Bus[],
  ruta: string
): { linea: number; 'sin-senal': number; ocultos: number } {
  const r = deLaRuta(buses, ruta);
  return {
    linea: r.filter((b) => b.online && b.visible).length,
    'sin-senal': r.filter((b) => !b.online).length,
    ocultos: r.filter((b) => !b.visible).length,
  };
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
  private readonly buses: Bus[] = FLOTA.map((b) => ({ ...b }));
  private ruta = 'tcherassi';
  private estado: Estado = 'todos';
  private elegido: string | null = 'SFA-482';

  private readonly raiz: HTMLElement;
  private readonly pildoras: HTMLElement[];
  private readonly pestanas: HTMLElement[];
  private readonly filas: HTMLElement[];
  private readonly marcadores: HTMLElement[];
  private readonly cifrasLeyenda: HTMLElement[];
  private readonly cuenta: HTMLElement;
  private readonly vacio: HTMLElement;
  private readonly iconoTodos: Element;
  private readonly ficha: HTMLElement;

  constructor(raiz: HTMLElement) {
    this.raiz = raiz;
    const todos = (sel: string): HTMLElement[] => Array.from(raiz.querySelectorAll<HTMLElement>(sel));
    const uno = (sel: string): HTMLElement => raiz.querySelector<HTMLElement>(sel)!;
    this.pildoras = todos('[data-accion="ruta"]');
    this.pestanas = todos('[data-accion="estado"]');
    this.filas = todos('.flota-fila');
    this.marcadores = todos('.flota-bus');
    this.cifrasLeyenda = todos('[data-leyenda]');
    this.cuenta = uno('.flota-cuenta');
    this.vacio = uno('.flota-vacio');
    this.iconoTodos = uno('[data-todos]');
    this.ficha = uno('.flota-ficha');

    // Un solo oyente para todo el panel: cada botón dice qué hace en su
    // `data-accion`, y el bus al que se refiere lo pone la fila o el
    // marcador que lo contiene. El de la ficha no está dentro de ninguno y
    // actúa sobre el elegido, igual que allá.
    raiz.addEventListener('click', (e) => this.tocar(e));
    this.pintar();
  }

  private bus(placa: string): Bus {
    return this.buses.find((b) => b.placa === placa)!;
  }

  private tocar(e: MouseEvent): void {
    const boton = (e.target as Element).closest<HTMLElement>('[data-accion]');
    if (!boton || !this.raiz.contains(boton)) return;
    const placa = boton.closest<HTMLElement>('[data-bus]')?.dataset.bus ?? this.elegido;

    switch (boton.dataset.accion) {
      // `setRouteFilter`. No suelta el bus elegido: allá tampoco, y la
      // ficha se queda abierta con su ruta en el chip mientras se mira la
      // otra.
      case 'ruta':
        this.ruta = boton.dataset.ruta!;
        break;
      // `setStatusFilter`.
      case 'estado':
        this.estado = boton.dataset.estado as Estado;
        break;
      // `selectBus`, desde la fila o desde el marcador. Tocar el elegido
      // otra vez no lo suelta: eso lo hace sólo la X de la ficha.
      case 'elegir':
        this.elegido = placa;
        break;
      // `toggleVisibility`, desde el interruptor de la fila o el botón de
      // la ficha. Allá espera al servidor con un indicador girando; aquí
      // no hay servidor que esperar.
      case 'visibilidad':
        if (placa) this.bus(placa).visible = !this.bus(placa).visible;
        break;
      // `selectBus(null)`. La X deja de existir al cerrarse la ficha, así
      // que el foco pasa a la fila del bus que se estaba viendo: si no, se
      // iría al principio de la página y quien va con teclado perdería el
      // sitio. Si esa fila no está a la vista —el bus es de la otra ruta o
      // lo quita la pestaña—, a la píldora de la ruta que se está mirando,
      // que es donde se decide qué se ve.
      case 'cerrar': {
        const fila = this.filas.find((f) => f.dataset.bus === this.elegido && !f.hidden);
        this.elegido = null;
        this.pintar();
        const destino =
          fila?.querySelector<HTMLElement>('[data-accion="elegir"]') ??
          this.pildoras.find((p) => p.dataset.ruta === this.ruta);
        destino?.focus({ preventScroll: true });
        return;
      }
      default:
        return;
    }
    this.pintar();
  }

  /** Todo el panel a partir del estado, de una vez: como `build` en Flutter. */
  private pintar(): void {
    const enLista = new Set(lista(this.buses, this.ruta, this.estado).map((b) => b.placa));
    const cifras = cuentas(this.buses, this.ruta);
    const cifrasMapa = leyenda(this.buses, this.ruta);

    for (const p of this.pildoras) marcar(p, p.dataset.ruta === this.ruta, 'es-activo');
    for (const p of this.pestanas) {
      const estado = p.dataset.estado as Estado;
      marcar(p, estado === this.estado, 'es-activa');
      p.querySelector('b')!.textContent = String(cifras[estado]);
    }

    // La cifra junto a «BUSES» es el largo de la lista, filtro de estado
    // incluido: en el Dart es `buses.length`, no `totalBuses`.
    this.cuenta.textContent = String(enLista.size);
    this.vacio.hidden = enLista.size > 0;
    this.vacio.textContent = VACIO[this.estado];

    for (const fila of this.filas) {
      const bus = this.bus(fila.dataset.bus!);
      const elegida = bus.placa === this.elegido;
      fila.hidden = !enLista.has(bus.placa);
      fila.classList.toggle('es-elegida', elegida);
      fila.classList.toggle('flota-fila--oculta', !bus.visible);
      fila.querySelector('[data-accion="elegir"]')!.setAttribute('aria-pressed', String(elegida));
      fila.querySelector('[data-accion="visibilidad"]')!.setAttribute('aria-checked', String(bus.visible));
      fila.querySelector('.flota-permiso-texto')!.textContent = bus.visible ? 'PERMITIDO' : 'OCULTO';
    }

    // El marcador sale de la misma `fleetList` que la lista: lo que el
    // filtro quita de una lo quita del otro. Verde sólo si transmite y el
    // pasajero lo ve, como `active:` en `_buildMarker`.
    for (const m of this.marcadores) {
      const bus = this.bus(m.dataset.bus!);
      const elegido = bus.placa === this.elegido;
      m.classList.toggle('es-fuera', !enLista.has(bus.placa));
      m.classList.toggle('es-activo', bus.online && bus.visible);
      m.classList.toggle('es-elegido', elegido);
    }

    for (const c of this.cifrasLeyenda) {
      c.textContent = String(cifrasMapa[c.dataset.leyenda as keyof typeof cifrasMapa]);
    }

    // El botón de la barra ofrece lo contrario de lo que hay: ocultar
    // todos si todos se ven y mostrarlos si falta alguno. Mira la flota
    // entera, no la ruta, como `allBusesVisible`.
    this.iconoTodos.setAttribute(
      'href',
      this.buses.every((b) => b.visible) ? '#fi-ocultar' : '#fi-mostrar'
    );

    this.pintarFicha();
  }

  /**
   * `_SelectedBusCard`. Al cerrarse no se vacía: se funde con lo último que
   * enseñaba, y vaciarla antes dejaría ver una ficha en blanco yéndose.
   * `inert` la saca del recorrido del teclado mientras está cerrada.
   */
  private pintarFicha(): void {
    const bus = this.elegido ? this.bus(this.elegido) : null;
    this.ficha.classList.toggle('es-cerrada', !bus);
    this.ficha.toggleAttribute('inert', !bus);
    if (!bus) return;

    const campo = (nombre: string): Element => this.ficha.querySelector(`[data-ficha="${nombre}"]`)!;
    this.ficha.classList.toggle('flota-ficha--sin-senal', !bus.online);
    campo('placa').textContent = bus.placa;
    campo('estado').textContent = bus.online ? 'En línea' : 'Sin señal';
    campo('ruta').textContent = RUTAS[bus.ruta];
    campo('ocultar').textContent = bus.visible ? 'Ocultar' : 'Mostrar';
    campo('ocultar-icono').setAttribute('href', bus.visible ? '#fi-ocultar' : '#fi-mostrar');
    this.ficha.querySelector('.flota-ocultar')!.classList.toggle('es-mostrar', !bus.visible);
  }
}
