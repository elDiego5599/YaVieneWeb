import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasoFoco } from '../src/paso-foco';

/**
 * El rodillo de «Cómo funciona» se detiene en cada paso (dueño,
 * 2026-10-07): mientras se baja dentro de un tramo la lista no se mueve,
 * y sólo al cruzar al siguiente rueda una posición entera. Antes seguía
 * al dedo en continuo y se sentía suelta.
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
    [0.3, '0'],
    [0.34, '1'],
    [0.5, '1'],
    [0.65, '1'],
    [0.7, '2'],
    [1, '2'],
  ])('con la pista al %s se queda quieto en el paso %s', (avance, paso) => {
    expect(giro(montar(avance))).toBe(paso);
  });
});
