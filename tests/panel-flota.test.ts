import { describe, expect, it } from 'vitest';
import { FLOTA, RUTAS, cuentas, leyenda, lista, pasaElFiltro, type Bus } from '../src/panel-flota';

/**
 * El panel de /empresas.html se deja tocar, y lo que cuenta tiene que
 * cuadrar con lo que enseña. Las cifras de las pestañas, las de la leyenda
 * y el largo de la lista salen de tres cuentas distintas —como en
 * `FleetState`— y es fácil que una se tuerza sin que las otras lo noten:
 * que la leyenda cuente en verde al oculto que transmite, o que las
 * pestañas cambien al cambiar de pestaña. El HTML trae pintado el estado de
 * partida a mano; si estas cifras cambian, también hay que cambiar las del
 * HTML, que se ven antes de que arranque el guion.
 */

const placas = (buses: Bus[]): string[] => buses.map((b) => b.placa);

describe('la flota de partida', () => {
  it('cada bus es de una ruta del catálogo', () => {
    expect(FLOTA.filter((b) => !(b.ruta in RUTAS))).toEqual([]);
  });

  it('las placas no se repiten', () => {
    expect(new Set(placas([...FLOTA])).size).toBe(FLOTA.length);
  });
});

describe('fleetList: lo que sale en la lista y en el mapa', () => {
  it('sin filtro de estado, sólo la ruta elegida', () => {
    expect(placas(lista(FLOTA, 'tcherassi', 'todos'))).toEqual(['SFA-482', 'TUH-513', 'DMV-238', 'WNP-659']);
    expect(placas(lista(FLOTA, 'vivero', 'todos'))).toEqual(['KJT-704', 'BQX-391', 'LMR-826']);
  });

  it('«En línea» incluye al oculto que transmite', () => {
    expect(placas(lista(FLOTA, 'tcherassi', 'linea'))).toEqual(['SFA-482', 'TUH-513', 'WNP-659']);
  });

  it('«Ocultos» y «Sin señal» por ruta', () => {
    expect(placas(lista(FLOTA, 'tcherassi', 'ocultos'))).toEqual(['WNP-659']);
    expect(placas(lista(FLOTA, 'vivero', 'ocultos'))).toEqual([]);
    expect(placas(lista(FLOTA, 'vivero', 'sin-senal'))).toEqual(['LMR-826']);
  });

  it('el filtro de estado mira sólo la señal y la visibilidad', () => {
    const oculto: Bus = { placa: 'X', ruta: 'tcherassi', online: false, visible: false };
    expect(pasaElFiltro(oculto, 'todos')).toBe(true);
    expect(pasaElFiltro(oculto, 'linea')).toBe(false);
    expect(pasaElFiltro(oculto, 'ocultos')).toBe(true);
    expect(pasaElFiltro(oculto, 'sin-senal')).toBe(true);
  });
});

describe('las cifras', () => {
  it('las pestañas cuentan la ruta, no el filtro de estado', () => {
    expect(cuentas(FLOTA, 'tcherassi')).toEqual({ todos: 4, linea: 3, ocultos: 1, 'sin-senal': 1 });
    expect(cuentas(FLOTA, 'vivero')).toEqual({ todos: 3, linea: 2, ocultos: 0, 'sin-senal': 1 });
  });

  it('la leyenda cuenta en línea sólo lo que el pasajero ve', () => {
    expect(leyenda(FLOTA, 'tcherassi')).toEqual({ linea: 2, 'sin-senal': 1, ocultos: 1 });
    expect(leyenda(FLOTA, 'vivero')).toEqual({ linea: 2, 'sin-senal': 1, ocultos: 0 });
  });

  it('ocultar un bus lo pasa de una cifra de la leyenda a otra', () => {
    const flota = FLOTA.map((b) => (b.placa === 'KJT-704' ? { ...b, visible: false } : b));
    expect(leyenda(flota, 'vivero')).toEqual({ linea: 1, 'sin-senal': 1, ocultos: 1 });
    expect(cuentas(flota, 'vivero').linea).toBe(2);
  });
});
