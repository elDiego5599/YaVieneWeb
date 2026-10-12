import { describe, expect, it } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';

/** Los pares de coordenadas de un `d` hecho sólo de M y L, como los emite el generador. */
function puntosDe(d: string): Array<[number, number]> {
  const numeros = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const pares: Array<[number, number]> = [];
  for (let i = 0; i + 1 < numeros.length; i += 2) pares.push([numeros[i], numeros[i + 1]]);
  return pares;
}

/**
 * Los recorridos de rutas.json son de ida y vuelta: salen de la terminal A
 * y vuelven a ella. El generador tomaba como terminales el primer y el
 * último punto, que caen en el mismo sitio, así que se dibujaban dos
 * círculos encimados en la salida y la otra punta no se marcaba (auditoría,
 * hallazgo 4). La terminal B va donde el bus da la vuelta: el vértice del
 * trazo más alejado de la salida, a mitad de camino.
 */
describe('cada ruta dibuja sus dos terminales donde van', () => {
  const lejos = (a: [number, number], b: [number, number]): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

  for (const ruta of YV_RUTAS.rutas) {
    it(`${ruta.id}: A en la salida y B en la vuelta del recorrido`, () => {
      const puntos = puntosDe(ruta.d);
      const [a, b] = ruta.extremos;
      expect(ruta.extremos).toHaveLength(2);
      expect(a, 'la terminal A es donde arranca el trazo').toEqual(puntos[0]);

      const vuelta = puntos.reduce((mejor, p) => (lejos(p, a) > lejos(mejor, a) ? p : mejor));
      expect(b, 'la terminal B es el punto del trazo más alejado de la salida').toEqual(vuelta);
      // Pasa por el trazo, y no cerca de él: el círculo cae sobre la línea.
      expect(puntos).toContainEqual(b);
      // Y está en la otra punta de la ciudad: más de 1 km de la A.
      expect(lejos(a, b) * YV_RUTAS.metrosPorUnidad).toBeGreaterThan(1000);
    });
  }
});
