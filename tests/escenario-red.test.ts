import { describe, expect, it } from 'vitest';
import { rutaOrtogonal, trazar, type Caja } from '../src/escenario-red';

/**
 * Los hilos del escenario de «Qué resuelve» (2026-10-12). Antes eran once
 * trazos fijos de un lienzo de 1160×460 recortado al centro: un fondo que
 * no tocaba nada (dueño: «no parecen conectar nada»). Ahora salen de las
 * cajas de verdad, como en el diagrama de incident.io: a ciegas cada hilo
 * va de una pieza a otra, y con Ya Viene es un árbol —tronco desde la
 * píldora, un bus y una bajada al centro de cada aviso—.
 */

/** Los números de un `d`, para mirar los extremos sin leer el formato. */
const numeros = (d: string): number[] => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const inicio = (d: string): [number, number] => numeros(d).slice(0, 2) as [number, number];
const fin = (d: string): [number, number] => numeros(d).slice(-2) as [number, number];

describe('rutaOrtogonal', () => {
  it('redondea cada codo con un arco del radio pedido', () => {
    expect(
      rutaOrtogonal(
        [
          [0, 0],
          [100, 0],
          [100, 80],
        ],
        12
      )
    ).toBe('M0 0L88 0A12 12 0 0 1 100 12L100 80');
  });

  it('gira hacia el otro lado con el arco al revés', () => {
    expect(
      rutaOrtogonal(
        [
          [0, 0],
          [0, 50],
          [40, 50],
        ],
        12
      )
    ).toBe('M0 0L0 38A12 12 0 0 0 12 50L40 50');
  });

  it('un tramo corto encoge el radio a su mitad, y sólo el de ese codo', () => {
    expect(
      rutaOrtogonal(
        [
          [0, 0],
          [0, 10],
          [30, 10],
          [30, 40],
        ],
        12
      )
    ).toBe('M0 0L0 5A5 5 0 0 0 5 10L18 10A12 12 0 0 1 30 22L30 40');
  });

  it('alineados, es una recta: ni codo ni arco', () => {
    expect(
      rutaOrtogonal(
        [
          [10, 0],
          [10, 30],
          [10, 30],
          [10, 90],
        ],
        12
      )
    ).toBe('M10 0L10 30L10 30L10 90');
  });
});

/** Un escenario de 1096×460 —el de 1440 de ancho— con su píldora al medio. */
const escena = { ancho: 1096, alto: 460 };
const pildora: Caja = { x: 383, y: 200, w: 330, h: 60 };
const tarjetas: Caja[] = [
  { x: 11, y: 14, w: 256, h: 140 },
  { x: 526, y: 18, w: 256, h: 150 },
  { x: 241, y: 306, w: 256, h: 140 },
  { x: 822, y: 302, w: 256, h: 140 },
];

const dentro = ([x, y]: [number, number], c: Caja): boolean =>
  x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h;

describe('trazar', () => {
  const plano = trazar(escena, pildora, tarjetas);

  it('con Ya Viene los avisos van en una fila: misma altura, mismo ancho y huecos iguales de borde a borde', () => {
    const { fila } = plano;
    expect(fila.map((c) => c.y)).toEqual([fila[0].y, fila[0].y, fila[0].y, fila[0].y]);
    expect(fila[0].x).toBe(0);
    expect(fila[3].x + fila[3].w).toBe(1096);
    const huecos = fila.slice(1).map((c, i) => c.x - (fila[i].x + fila[i].w));
    expect(huecos).toEqual([24, 24, 24]);
    // Los altos no se tocan: la fila mueve las tarjetas, no las estira.
    expect(fila.map((c) => c.h)).toEqual([140, 150, 140, 140]);
  });

  it('la píldora sube al centro de arriba y el conjunto queda centrado en el alto', () => {
    const { pildoraClara: p, fila } = plano;
    expect(p.x).toBe(pildora.x);
    expect(p.w).toBe(pildora.w);
    const arriba = p.y;
    const abajo = escena.alto - (fila[0].y + 150);
    expect(Math.abs(arriba - abajo)).toBeLessThanOrEqual(1);
    expect(fila[0].y).toBeGreaterThan(p.y + p.h);
  });

  it('el árbol: cuatro hilos que nacen del mismo punto bajo la píldora y acaban en el centro de arriba de cada aviso', () => {
    const { arbol, pildoraClara: p, fila } = plano;
    expect(arbol).toHaveLength(4);
    const raices = arbol.map(inicio);
    for (const r of raices) expect(r).toEqual(raices[0]);
    expect(raices[0][0]).toBe(p.x + p.w / 2);
    expect(dentro(raices[0], p)).toBe(true);
    arbol.forEach((d, i) => {
      const [x, y] = fin(d);
      expect(x).toBe(fila[i].x + fila[i].w / 2);
      expect(y).toBeGreaterThan(fila[i].y);
      expect(y - fila[i].y).toBeLessThanOrEqual(6);
    });
  });

  it('a ciegas cada hilo une dos piezas, y todos los avisos cuelgan de alguno', () => {
    const piezas = [pildora, ...tarjetas];
    const tocadas = new Set<number>();
    for (const d of plano.enredo) {
      const a = piezas.findIndex((c) => dentro(inicio(d), c));
      const b = piezas.findIndex((c) => dentro(fin(d), c));
      expect(a, `${d} sale de una pieza`).toBeGreaterThanOrEqual(0);
      expect(b, `${d} llega a una pieza`).toBeGreaterThanOrEqual(0);
      expect(a).not.toBe(b);
      tocadas.add(a).add(b);
    }
    expect(plano.enredo.length).toBeGreaterThanOrEqual(6);
    expect([...tocadas].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});
