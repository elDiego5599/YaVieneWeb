import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';
import { carrilEmpresas, carrilRutas } from '../src/selector';

/**
 * Espejo de `_escalonFila` (route_selector_sheet.dart): las filas de las
 * listas del selector entran una detrás de otra, a 45 ms cada una, y el
 * escalón se topa en la sexta.
 */
describe('las filas del selector entran escalonadas', () => {
  const turnos = (carril: HTMLElement): string[] =>
    Array.from(carril.children, (fila) => (fila as HTMLElement).style.getPropertyValue('--i'));

  it('cada fila lleva su turno', () => {
    expect(turnos(carrilEmpresas()).slice(0, 3)).toEqual(['0', '1', '2']);
  });

  // Con las cuatro empresas el tope no se llegaba a tocar: hace falta una
  // lista más larga que seis para ver que la séptima y la octava esperan
  // lo mismo que la sexta.
  it('el turno se topa en la sexta fila', () => {
    const [base] = YV_RUTAS.rutas;
    const ocho = Array.from({ length: 8 }, (_, i) => ({ ...base, id: `R-${900 + i}` }));
    expect(turnos(carrilRutas(ocho))).toEqual(['0', '1', '2', '3', '4', '5', '5', '5']);
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
