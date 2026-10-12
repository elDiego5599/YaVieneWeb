import { describe, expect, it } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';
import { fichaDeRuta, pintarCifras } from '../src/rutas';
import type { RutaLanding } from '../src/types';

/**
 * Las cifras de cabecera de la sección del mapa y la ficha de cada ruta,
 * como las lee quien entra: el número grande con su rótulo, y un botón por
 * ruta (el detalle de la ficha, en rutas-fichas.test.ts).
 */

const rutas = YV_RUTAS.rutas;

/** Lo que se lee en la cabecera: [número, rótulo] por dato. */
function cifras(): [string, string][] {
  const caja = document.createElement('div');
  pintarCifras(caja);
  return Array.from(caja.querySelectorAll('.rutas-dato'), (d) => [
    d.querySelector('.rutas-dato-numero')!.textContent!,
    d.querySelector('.rutas-dato-rotulo')!.textContent!,
  ]);
}

describe('las cifras de cabecera', () => {
  // Riesgo: el titular dice un número de rutas distinto del que dibuja el mapa.
  it('cuentan las rutas que dibuja el mapa, en tres datos con su rótulo', () => {
    const [r, t, k] = cifras();
    expect(cifras().map(([, rotulo]) => rotulo)).toEqual(['rutas', 'terminales', 'kilómetros']);
    expect(r![0]).toBe(String(rutas.length));
    expect(t![0]).toMatch(/^\d+$/);
    expect(k![0]).toMatch(/^\d+(,\d)?$/);
  });

  // Riesgo: una terminal que sirve a dos rutas se cuenta dos veces e infla el dato.
  it('una terminal compartida por dos rutas se cuenta una sola vez', () => {
    const nombres = rutas.flatMap((r) => [r.terminalA, r.terminalB]);
    const terminales = Number(cifras()[1]![0]);
    expect(terminales).toBe(new Set(nombres).size);
    // Los datos de hoy sí repiten cabeceras (Granabastos, Uninorte): la cuenta no puede ser el doble de rutas.
    expect(terminales).toBeLessThan(nombres.length);
  });

  // Riesgo: los kilómetros salen con punto decimal o con la cola de coma flotante (326.79999…).
  it('los kilómetros son la suma con un decimal y coma', () => {
    const suma = rutas.reduce((s, r) => s + r.km, 0);
    const km = cifras()[2]![0];
    expect(km).not.toContain('.');
    expect(Number(km.replace(',', '.'))).toBeCloseTo(suma, 1);
    expect(km.split(',')[1]?.length ?? 0).toBeLessThanOrEqual(1);
  });

  // Riesgo: pintar dos veces (una recarga del módulo) duplica los datos.
  it('pintar otra vez sobre la misma caja no duplica nada', () => {
    const caja = document.createElement('div');
    pintarCifras(caja);
    pintarCifras(caja);
    expect(caja.querySelectorAll('.rutas-dato')).toHaveLength(3);
  });
});

describe('la ficha de ruta', () => {
  const ficha = (r: RutaLanding): HTMLButtonElement => fichaDeRuta(r);

  // Riesgo: la ficha es un enlace o un botón de envío y al pulsarla navega o envía un formulario.
  it('es un botón de tipo button con el id de su ruta', () => {
    const f = ficha(rutas[0]!);
    expect(f.tagName).toBe('BUTTON');
    expect(f.type).toBe('button');
    expect(f.dataset.ruta).toBe(rutas[0]!.id);
    // El estado lo pone quien la coloca: sale sin marcar.
    expect(f.hasAttribute('aria-pressed')).toBe(false);
  });
});
