import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUS_ESTADOS,
  EXPLICACION,
  FLOTA,
  ICONO,
  PanelFlota,
  ROTULO,
  RUTAS,
  cuentas,
  estadoDe,
  leyenda,
  lista,
  pasaElFiltro,
  type Bus,
} from '../src/panel-flota';

/**
 * El panel de /empresas.html se deja tocar, y lo que cuenta tiene que
 * cuadrar con lo que enseña. Las cifras de las pestañas, las de la leyenda
 * y el largo de la lista salen de tres cuentas distintas —como en
 * `FleetState`— y es fácil que una se tuerza sin que las otras lo noten:
 * que la leyenda cuente dos veces al bus oculto que no transmite, o que las
 * pestañas cambien al cambiar de pestaña. El HTML trae pintado el estado de
 * partida a mano; la última prueba monta ese HTML y comprueba que el guion
 * no le cambia nada al arrancar.
 */

const placas = (buses: Bus[]): string[] => buses.map((b) => b.placa);

describe('la flota de partida', () => {
  it('cada bus es de una ruta del catálogo', () => {
    expect(FLOTA.filter((b) => !(b.ruta in RUTAS))).toEqual([]);
  });

  it('las placas no se repiten', () => {
    expect(new Set(placas([...FLOTA])).size).toBe(FLOTA.length);
  });

  it('cada uno de los cuatro estados tiene al menos un bus que lo enseñe', () => {
    expect(new Set(FLOTA.map(estadoDe))).toEqual(new Set(BUS_ESTADOS));
  });

  it('LMR826 es el inactivo: sin posición y con el turno abierto', () => {
    expect(FLOTA.filter((b) => estadoDe(b) === 'inactivo').map((b) => b.placa)).toEqual(['LMR826']);
  });
});

describe('BusEstado.de: una sola regla de precedencia', () => {
  const bus = (online: boolean, isGhost: boolean, visible: boolean): Bus => ({
    placa: 'X',
    ruta: 'tcherassi',
    online,
    isGhost,
    visible,
  });

  it('oculto gana a todo lo demás', () => {
    for (const online of [true, false]) {
      for (const isGhost of [true, false]) {
        expect(estadoDe(bus(online, isGhost, false))).toBe('oculto');
      }
    }
  });

  it('visible, el fantasma es inactivo transmita o no', () => {
    expect(estadoDe(bus(true, true, true))).toBe('inactivo');
    expect(estadoDe(bus(false, true, true))).toBe('inactivo');
  });

  it('visible y sin fantasma, la señal decide', () => {
    expect(estadoDe(bus(true, false, true))).toBe('en-linea');
    expect(estadoDe(bus(false, false, true))).toBe('sin-senal');
  });

  it('cada estado dice lo mismo que en el panel de escritorio', () => {
    expect(ROTULO).toEqual({
      'en-linea': 'En línea',
      inactivo: 'Inactivo',
      'sin-senal': 'Sin señal',
      oculto: 'Oculto',
    });
    expect(EXPLICACION).toEqual({
      'en-linea': 'En línea: el bus está transmitiendo',
      inactivo: 'Inactivo: lleva más de 90 s sin reportar, pero el turno sigue abierto',
      'sin-senal': 'Sin señal: el bus no está transmitiendo',
      oculto: 'Oculto: lo quitaste del mapa de los pasajeros',
    });
  });

  it('cada estado lleva un icono distinto, que es lo que no depende del color', () => {
    expect(new Set(BUS_ESTADOS.map((e) => ICONO[e])).size).toBe(BUS_ESTADOS.length);
  });
});

describe('fleetList: lo que sale en la lista y en el mapa', () => {
  it('sin filtro de estado, sólo la ruta elegida', () => {
    expect(placas(lista(FLOTA, 'tcherassi', 'todos'))).toEqual(['SFA482', 'TUH513', 'DMV238', 'WNP659']);
    expect(placas(lista(FLOTA, 'vivero', 'todos'))).toEqual(['KJT704', 'BQX391', 'LMR826']);
  });

  it('«En línea» incluye al oculto que transmite', () => {
    expect(placas(lista(FLOTA, 'tcherassi', 'linea'))).toEqual(['SFA482', 'TUH513', 'WNP659']);
  });

  it('«Ocultos» y «Sin señal» por ruta, y el inactivo cae en «Sin señal»', () => {
    expect(placas(lista(FLOTA, 'tcherassi', 'ocultos'))).toEqual(['WNP659']);
    expect(placas(lista(FLOTA, 'vivero', 'ocultos'))).toEqual([]);
    expect(placas(lista(FLOTA, 'vivero', 'sin-senal'))).toEqual(['LMR826']);
  });

  it('el filtro de estado mira la señal, el fantasma y la visibilidad', () => {
    const oculto: Bus = { placa: 'X', ruta: 'tcherassi', online: false, isGhost: false, visible: false };
    expect(pasaElFiltro(oculto, 'todos')).toBe(true);
    expect(pasaElFiltro(oculto, 'linea')).toBe(false);
    expect(pasaElFiltro(oculto, 'ocultos')).toBe(true);
    expect(pasaElFiltro(oculto, 'sin-senal')).toBe(true);

    const fantasma: Bus = { placa: 'Y', ruta: 'tcherassi', online: true, isGhost: true, visible: true };
    expect(pasaElFiltro(fantasma, 'linea')).toBe(false);
    expect(pasaElFiltro(fantasma, 'sin-senal')).toBe(true);
  });
});

describe('las cifras', () => {
  it('las pestañas cuentan la ruta, no el filtro de estado', () => {
    expect(cuentas(FLOTA, 'tcherassi')).toEqual({ todos: 4, linea: 3, ocultos: 1, 'sin-senal': 1 });
    expect(cuentas(FLOTA, 'vivero')).toEqual({ todos: 3, linea: 2, ocultos: 0, 'sin-senal': 1 });
  });

  it('un fantasma que manda posiciones sale de «En Línea» y entra en «Sin Señal»', () => {
    const flota = FLOTA.map((b) => (b.placa === 'KJT704' ? { ...b, isGhost: true } : b));
    expect(cuentas(flota, 'vivero')).toEqual({ todos: 3, linea: 1, ocultos: 0, 'sin-senal': 2 });
  });

  it('la leyenda da un estado por bus, así que suma lo que la ruta', () => {
    expect(leyenda(FLOTA, 'tcherassi')).toEqual({ 'en-linea': 2, inactivo: 0, 'sin-senal': 1, oculto: 1 });
    expect(leyenda(FLOTA, 'vivero')).toEqual({ 'en-linea': 2, inactivo: 1, 'sin-senal': 0, oculto: 0 });
    for (const ruta of Object.keys(RUTAS)) {
      const suma = Object.values(leyenda(FLOTA, ruta)).reduce((a, b) => a + b, 0);
      expect(suma, ruta).toBe(cuentas(FLOTA, ruta).todos);
    }
  });

  it('ocultar un bus lo pasa de una cifra de la leyenda a otra', () => {
    const flota = FLOTA.map((b) => (b.placa === 'KJT704' ? { ...b, visible: false } : b));
    expect(leyenda(flota, 'vivero')).toEqual({ 'en-linea': 1, inactivo: 1, 'sin-senal': 0, oculto: 1 });
    expect(cuentas(flota, 'vivero').linea).toBe(2);
  });

  it('el bus oculto y sin señal se cuenta una vez, no dos', () => {
    const flota = FLOTA.map((b) => (b.placa === 'DMV238' ? { ...b, visible: false } : b));
    expect(leyenda(flota, 'tcherassi')).toEqual({ 'en-linea': 2, inactivo: 0, 'sin-senal': 0, oculto: 2 });
  });
});

describe('el panel montado', () => {
  /** El panel tal cual está en la página, sin el resto. */
  function montar(): HTMLElement {
    const html = readFileSync(resolve(process.cwd(), 'empresas.html'), 'utf8');
    const panel = html.match(/<div class="flota">[\s\S]*?(?=<div class="despacho-pie")/)?.[0];
    expect(panel, 'ya no está el panel en empresas.html').toBeTruthy();
    document.body.innerHTML = panel!;
    return document.querySelector<HTMLElement>('.flota')!;
  }

  const tocar = (raiz: HTMLElement, selector: string): void => {
    raiz.querySelector<HTMLElement>(selector)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };

  const cifrasLeyenda = (raiz: HTMLElement): Record<string, string> =>
    Object.fromEntries(
      Array.from(raiz.querySelectorAll<HTMLElement>('[data-leyenda]'), (b) => [b.dataset.leyenda!, b.textContent!])
    );

  it('el HTML de partida ya trae pintado lo que pinta el guion', () => {
    // happy-dom deja `class=""` al apagar una clase que el elemento no
    // tenía; el navegador no escribe nada (DOM, «update steps» de
    // `DOMTokenList`). Eso no es una diferencia de pintura y se quita.
    const sinClaseVacia = (html: string): string => html.replaceAll(' class=""', '');
    const raiz = montar();
    const antes = raiz.outerHTML;
    new PanelFlota(raiz);
    expect(sinClaseVacia(raiz.outerHTML)).toBe(antes);
  });

  it('cada estado tiene su icono guardado en el panel', () => {
    const raiz = montar();
    for (const e of BUS_ESTADOS) {
      expect(raiz.querySelector(`symbol${ICONO[e]}`), ICONO[e]).not.toBeNull();
    }
  });

  it('el inactivo de Vivero Paraíso se ve en la fila, el mapa, la leyenda y la ficha', () => {
    const raiz = montar();
    new PanelFlota(raiz);
    tocar(raiz, '[data-ruta="vivero"]');

    const fila = raiz.querySelector<HTMLElement>('.flota-fila[data-bus="LMR826"]')!;
    expect(fila.hidden).toBe(false);
    expect(fila.dataset.busEstado).toBe('inactivo');
    expect(fila.querySelector('.flota-fila-placa title')!.textContent).toBe(EXPLICACION.inactivo);
    expect(fila.querySelector('.flota-fila-placa use')!.getAttribute('href')).toBe(ICONO.inactivo);
    expect(fila.querySelector('.flota-fila-elegir')!.getAttribute('aria-label')).toBe('Elegir LMR826, inactivo');
    expect(raiz.querySelector<HTMLElement>('.flota-bus[data-bus="LMR826"]')!.dataset.busEstado).toBe('inactivo');
    expect(cifrasLeyenda(raiz)).toEqual({ 'en-linea': '2', inactivo: '1', 'sin-senal': '0', oculto: '0' });

    tocar(raiz, '.flota-fila[data-bus="LMR826"] .flota-fila-elegir');
    const ficha = raiz.querySelector<HTMLElement>('.flota-ficha')!;
    expect(ficha.dataset.busEstado).toBe('inactivo');
    expect(ficha.querySelector('[data-ficha="estado"]')!.textContent).toBe('Inactivo');
    expect(ficha.querySelector('[data-ficha="estado-icono"]')!.getAttribute('href')).toBe(ICONO.inactivo);
  });

  it('pulsar el icono de estado de la fila también elige el bus', () => {
    const raiz = montar();
    new PanelFlota(raiz);
    tocar(raiz, '.flota-fila[data-bus="TUH513"] .flota-fila-placa use');
    expect(raiz.querySelector('.flota-fila[data-bus="TUH513"]')!.classList.contains('es-elegida')).toBe(true);
    expect(raiz.querySelector('.flota-ficha [data-ficha="placa"]')!.textContent).toBe('TUH513');
  });

  it('ocultar un bus le cambia el estado en todas partes a la vez', () => {
    const raiz = montar();
    new PanelFlota(raiz);
    tocar(raiz, '.flota-fila[data-bus="SFA482"] [data-accion="visibilidad"]');

    const fila = raiz.querySelector<HTMLElement>('.flota-fila[data-bus="SFA482"]')!;
    expect(fila.dataset.busEstado).toBe('oculto');
    expect(fila.querySelector('.flota-fila-placa title')!.textContent).toBe(EXPLICACION.oculto);
    expect(fila.querySelector('.flota-fila-elegir')!.getAttribute('aria-label')).toBe('Elegir SFA482, oculto');
    expect(raiz.querySelector<HTMLElement>('.flota-bus[data-bus="SFA482"]')!.dataset.busEstado).toBe('oculto');
    expect(cifrasLeyenda(raiz)).toEqual({ 'en-linea': '1', inactivo: '0', 'sin-senal': '1', oculto: '2' });

    const ficha = raiz.querySelector<HTMLElement>('.flota-ficha')!;
    expect(ficha.dataset.busEstado).toBe('oculto');
    expect(ficha.querySelector('[data-ficha="estado"]')!.textContent).toBe('Oculto');
    expect(ficha.querySelector('[data-ficha="estado-icono"]')!.getAttribute('href')).toBe(ICONO.oculto);
  });
});

describe('el buscador del panel dibujado', () => {
  it('dice lo mismo que el del panel, sin conductor', () => {
    // No hay app de conductor ni conductores en el panel: el buscador de
    // `dashboard_screen.dart` dice «Buscar placa o ruta…» (dueño, 2026-10-27).
    const html = readFileSync(resolve(process.cwd(), 'empresas.html'), 'utf8');
    expect(html).toContain('<span>Buscar placa o ruta…</span>');
    expect(html).not.toMatch(/conductor…/);
  });
});
