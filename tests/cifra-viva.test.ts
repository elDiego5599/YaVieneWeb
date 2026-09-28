import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cifraViva } from '../src/cifra-viva';

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

  it('las cifras se casan por la derecha: 1.0 → 990', () => {
    const el = nuevo('1.0');
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

  it('el CSS la apaga con movimiento reducido y fija cifras tabulares', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/phone-simulator.css'), 'utf8');
    expect(css).toMatch(/\.eta-number\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.cifra-sube,\s*\.cifra-baja\s*\{\s*animation: none/
    );
  });
});
