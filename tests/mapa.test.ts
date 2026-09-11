import { describe, expect, it } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';

/**
 * El mapa en vivo promete la ciudad entera: cualquiera de las seis rutas se
 * elige y se ve de punta a punta, con sus terminales, sus buses y el punto
 * de espera encima. Durante un tiempo compartió el mosaico de los
 * teléfonos, que es sólo la pantalla del pin, y el viewBox de 804 x 1750 se
 * comía rutas que llegan hasta y = 2673 y x = -740. Nada fallaba: el SVG
 * recortaba en silencio. Esto lo caza la próxima vez que el generador mueva
 * un encuadre.
 */

type Caja = [number, number, number, number];

/** Los pares de coordenadas de un `d` hecho sólo de M y L, como los emite el generador. */
function puntosDe(d: string): Array<[number, number]> {
  const numeros = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const pares: Array<[number, number]> = [];
  for (let i = 0; i + 1 < numeros.length; i += 2) pares.push([numeros[i], numeros[i + 1]]);
  return pares;
}

const dentro = ([x, y]: [number, number], [vx, vy, w, h]: Caja): boolean =>
  x >= vx && x <= vx + w && y >= vy && y <= vy + h;

describe('el mapa en vivo cabe entero en su lienzo', () => {
  const caja = YV_RUTAS.ciudad.viewBox;

  for (const ruta of YV_RUTAS.rutas) {
    it(`${ruta.id} no se sale del viewBox de la ciudad`, () => {
      const puntos = puntosDe(ruta.d);
      expect(puntos.length, 'el recorrido vino vacío').toBeGreaterThan(1);
      expect(puntos.filter((p) => !dentro(p, caja))).toEqual([]);
      expect(ruta.extremos.filter((p) => !dentro(p, caja))).toEqual([]);
    });
  }

  it('el fondo tiene la proporción del viewBox y no se estira', () => {
    const [, , w, h] = caja;
    const { ancho, alto } = YV_RUTAS.ciudad.mapa;
    // Medio píxel de tolerancia sobre el lado largo: el viewBox va con un
    // decimal y la captura en píxeles enteros.
    expect(Math.abs(w / h - ancho / alto)).toBeLessThan(0.5 / Math.max(ancho, alto));
  });
});
