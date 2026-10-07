import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasoFoco } from '../src/paso-foco';

/**
 * El rodillo de «Cómo funciona» sigue al dedo entre dos pasos y se queda
 * quieto un buen trecho en cada uno (dueño, 2026-10-07): ni suelto en
 * continuo, como al principio, ni a saltos de un paso entero, que no
 * dejaba ver el movimiento. Así no se pasa de largo y tampoco cansa.
 */

/** Monta la pista con un alto de tres pantallas y la deja en `avance` (0 a 1). */
function montar(avance: number) {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private cb: IntersectionObserverCallback) {}
      observe() {
        this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
      }
      disconnect() {}
    }
  );
  const recorrido = 3 * innerHeight;
  const pista = document.createElement('div');
  pista.getBoundingClientRect = () =>
    ({ top: -avance * recorrido, height: recorrido + innerHeight }) as DOMRect;
  const riel = document.createElement('ol');
  const columnas = [0, 1, 2].map(() => document.createElement('div'));
  new PasoFoco({ pista, columnas, marcas: [], riel, alCambiar: () => {} });
  return riel;
}

const giro = (riel: HTMLElement) => riel.style.getPropertyValue('--paso-giro');

afterEach(() => vi.unstubAllGlobals());

describe('el rodillo de los pasos', () => {
  it.each([
    [0.05, '0'],
    [0.2, '0'],
    [0.42, '1'],
    [0.5, '1'],
    [0.58, '1'],
    [0.8, '2'],
    [1, '2'],
  ])('con la pista al %s se queda quieto en el paso %s', (avance, paso) => {
    expect(giro(montar(avance))).toBe(paso);
  });

  it.each([
    [1 / 3, '0.5'],
    [2 / 3, '1.5'],
  ])('en el cruce, al %s, va a medio camino (%s)', (avance, paso) => {
    expect(giro(montar(avance))).toBe(paso);
  });

  it('entre la parada y el cruce sigue al dedo', () => {
    const valores = [0.26, 0.29, 0.31].map((a) => Number(giro(montar(a))));
    expect(valores[0]).toBeGreaterThan(0);
    expect(valores[0]).toBeLessThan(valores[1]!);
    expect(valores[1]).toBeLessThan(valores[2]!);
    expect(valores[2]).toBeLessThan(0.5);
  });
});
