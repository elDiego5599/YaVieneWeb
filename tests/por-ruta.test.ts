import { describe, expect, it } from 'vitest';
import { rutaMedible, type XY } from '../src/por-ruta';

/**
 * Espejo de ya_viene_core/test/por_ruta_test.dart: las mismas rutas y las
 * mismas cifras, dibujadas en metros. Aquí el bus no se proyecta (el de la
 * página va sobre el trazo), así que se pasa su avance a mano, el que da el
 * test de Dart como `avanceDe`.
 */
const medible = (p: XY[]) => rutaMedible(p)!;

// Ida por y = 0 y vuelta por y = 8: la misma calle, un carril por sentido.
// Circular (cierra a 8 m): 1000 + 8 + 1000 + 8 = 2016 m.
const idaYVuelta = () => medible([[0, 0], [1000, 0], [1000, 8], [0, 8]]);
// Una U abierta: este 1500 m, norte 400 m, oeste 1500 m.
const u = () => medible([[0, 0], [1500, 0], [1500, 400], [0, 400]]);
// Cuadrado de 500 m que acaba en (0, 10): cierra con 10 m, 2000 m.
const cuadrado = () => medible([[0, 0], [500, 0], [500, 500], [0, 500], [0, 10]]);

describe('distancia por la ruta (espejo de SeguidorRuta.distancia)', () => {
  it('ida y vuelta: el bus en la vuelta (avance 1508) llega al punto por la vuelta', () => {
    expect(idaYVuelta().medir(1508, [200, 4])).toBeCloseTo(304, -1);
  });

  it('ida y vuelta: yendo al este, la persona lo espera a la vuelta', () => {
    // Del 500 de la ida al 1000, 8 de giro y 800 de vuelta hasta x = 200,
    // más 4 de desvío.
    expect(idaYVuelta().medir(500, [200, 4])).toBeCloseTo(1312, -1);
  });

  it('400 m en línea recta son 3,4 km por la ruta', () => {
    expect(u().medir(0, [0, 400])).toBeCloseTo(3400, -1);
  });

  it('ruta abierta: un punto que el bus ya dejó atrás no se mide', () => {
    // (750, 400) en la U: 1500 + 400 + 750 = 2650.
    expect(u().medir(2650, [1500, 200])).toBeNull();
  });

  describe('circular: pasar del final al inicio no es retroceder', () => {
    it('a 20 m del final, un punto a 100 m del inicio queda a 120 m', () => {
      expect(cuadrado().medir(1980, [100, 0])).toBeCloseTo(120, -1);
    });

    it('el bus que cruza el inicio sigue contando hacia adelante', () => {
      expect(cuadrado().medir(20, [100, 0])).toBeCloseTo(80, -1);
      // Lo que dejó 80 m atrás es la vuelta siguiente: de 20 a 1940.
      expect(cuadrado().medir(20, [0, 60])).toBeCloseTo(1920, -1);
    });
  });

  describe('el ruido del GPS no manda al bus a la vuelta siguiente', () => {
    it('circular: 10 m pasado el punto, está ahí', () => {
      expect(cuadrado().medir(110, [100, 0])).toBeCloseTo(0, -1);
    });

    it('abierta: 10 m pasado el punto, está ahí', () => {
      expect(u().medir(510, [500, 0])).toBeCloseTo(0, -1);
    });

    it('circular: 60 m pasado, ya es la vuelta siguiente', () => {
      expect(cuadrado().medir(160, [100, 0])).toBeCloseTo(1940, -1);
    });
  });

  describe('null cuando no se sabe', () => {
    it('ruta sin segmento', () => {
      expect(rutaMedible([])).toBeNull();
      expect(rutaMedible([[0, 0]])).toBeNull();
      expect(rutaMedible([[0, 0], [0, 0]])).toBeNull();
    });

    it('punto a más de 300 m de la ruta', () => {
      expect(idaYVuelta().medir(500, [200, 400])).toBeNull();
    });
  });
});
