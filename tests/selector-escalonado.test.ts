import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { carrilEmpresas } from '../src/selector';

/**
 * Espejo de `_escalonFila` (route_selector_sheet.dart): las filas de las
 * listas del selector entran una detrás de otra, a 45 ms cada una, y el
 * escalón se topa en la sexta.
 */
describe('las filas del selector entran escalonadas', () => {
  it('cada fila lleva su turno, topado en 5', () => {
    const turnos = Array.from(carrilEmpresas().children, (fila) =>
      (fila as HTMLElement).style.getPropertyValue('--i')
    );
    expect(turnos.slice(0, 3)).toEqual(['0', '1', '2']);
    expect(turnos.every((t) => Number(t) <= 5)).toBe(true);
  });

  it('el CSS las anima al abrir la lista y respeta el movimiento reducido', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/css/phone-simulator.css'), 'utf8');
    expect(css).toMatch(
      /\.sheet-view--lista\.active \.app-tile\s*\{\s*animation: fila-entra[^;]*var\(--i\) \* 45ms/
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.sheet-view--lista\.active \.app-tile\s*\{\s*animation: none/
    );
  });
});
