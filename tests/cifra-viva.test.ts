import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cifraViva, distanciaAviso, metrica } from '../src/cifra-viva';

/**
 * Espejo de `cifra_viva.dart` (app_pasajero): la distancia de la hoja gira
 * solo en las cifras que cambian, y hacia arriba cuando el bus se acerca.
 * Aquí cada cifra que cambia es un `<span>` que entra con su animación; las
 * que no cambian van quietas. De palabra a número, en seco.
 */

const nuevo = (texto: string): HTMLElement => {
  const el = document.createElement('div');
  el.textContent = texto;
  return el;
};

const cifras = (el: HTMLElement): [string, string][] =>
  Array.from(el.children, (s) => [s.textContent ?? '', s.className]);

describe('cifraViva', () => {
  it('marca solo las cifras que cambian y el texto queda entero', () => {
    const el = nuevo('850');
    el.dataset.valor = '850';
    cifraViva(el, '849', 849);
    expect(el.textContent).toBe('849');
    expect(cifras(el)).toEqual([
      ['8', ''],
      ['4', 'cifra-baja'],
      ['9', 'cifra-baja'],
    ]);
  });

  it('si sube, las cifras entran desde abajo', () => {
    const el = nuevo('849');
    el.dataset.valor = '849';
    cifraViva(el, '850', 850);
    expect(cifras(el).map(([, c]) => c)).toEqual(['', 'cifra-sube', 'cifra-sube']);
  });

  it('las cifras se casan por la derecha: 1,0 → 990', () => {
    const el = nuevo('1,0');
    el.dataset.valor = '1000';
    cifraViva(el, '990', 990);
    expect(cifras(el)).toEqual([
      ['9', 'cifra-baja'],
      ['9', 'cifra-baja'],
      ['0', ''],
    ]);
  });

  it('de palabra a número no gira', () => {
    const el = nuevo('—');
    cifraViva(el, '850', 850);
    expect(el.textContent).toBe('850');
    expect(el.children).toHaveLength(0);
  });

  it('el mismo texto no toca el DOM', () => {
    const el = nuevo('850');
    el.dataset.valor = '850';
    const antes = el.firstChild;
    cifraViva(el, '850', 850);
    expect(el.firstChild).toBe(antes);
  });

  it('el CSS la reduce a un fundido con movimiento reducido y fija cifras tabulares', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/phone-simulator.css'), 'utf8');
    expect(css).toMatch(/\.eta-number\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.cifra-sube,\s*\.cifra-baja\s*\{\s*animation: cifra-funde 200ms/
    );
  });
});

/**
 * `distanciaPartes` de distancia.dart en la app: bajo el kilómetro en metros,
 * por encima en kilómetros con un decimal y coma —la hoja de la app, la
 * voz, las fichas de ruta y el mapa en vivo ya la escribían así; los dos
 * teléfonos de la landing ponían punto—.
 */
describe('metrica', () => {
  it('bajo el kilómetro, metros enteros', () => {
    expect(metrica(850)).toEqual(['850', 'm de ti']);
  });

  it('desde el kilómetro, kilómetros con coma decimal', () => {
    expect(metrica(1000)).toEqual(['1,0', 'km de ti']);
    expect(metrica(1250)).toEqual(['1,3', 'km de ti']);
  });

  // Riesgo: decidir con los metros crudos. 999,6 m se redondean a 1000 y
  // la cifra decía «1000 m» en vez de «1,0 km».
  it('decide con los metros ya redondeados', () => {
    expect(metrica(999.4)).toEqual(['999', 'm de ti']);
    expect(metrica(999.6)).toEqual(['1,0', 'km de ti']);
  });
});

/**
 * `distanciaAviso` de rueda_distancia.dart: la distancia del aviso, de 500 m
 * a 3 km de 100 en 100, escrita como la cifra de la hoja pero con su unidad
 * pegada («Te avisamos a 800 m», «1,0 km» en la rueda).
 */
describe('distanciaAviso', () => {
  it('bajo el kilómetro en metros, desde el kilómetro con coma', () => {
    expect(distanciaAviso(500)).toBe('500 m');
    expect(distanciaAviso(900)).toBe('900 m');
    expect(distanciaAviso(1000)).toBe('1,0 km');
    expect(distanciaAviso(2900)).toBe('2,9 km');
    expect(distanciaAviso(3000)).toBe('3,0 km');
  });
});
