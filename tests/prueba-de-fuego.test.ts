// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

// @ts-expect-error: el script es .mjs sin tipos.
import { MUTACIONES } from '../scripts/prueba-de-fuego.mjs';

/**
 * La prueba de fuego (`npm run fuego`) rompe `src/` a propósito y exige que
 * la suite lo note. Su lista busca texto exacto: si alguien cambia una de
 * esas líneas, la mutación dejaría de aplicar y la pieza quedaría sin vigilar
 * sin que nadie se enterara. Esto lo dice en la suite normal.
 */
type Mutacion = { archivo: string; de: string; a: string; que: string };

it('cada mutación de la prueba de fuego aplica una sola vez y cambia algo', () => {
  const lista = MUTACIONES as Mutacion[];
  expect(lista.length, 'la lista se encogió').toBeGreaterThanOrEqual(47);
  for (const [i, m] of lista.entries()) {
    const fuente = readFileSync(resolve(process.cwd(), m.archivo), 'utf8');
    expect(fuente.split(m.de).length, `#${i + 1} (${m.que}) en ${m.archivo}`).toBe(2);
    expect(m.a, `#${i + 1} no cambia nada`).not.toBe(m.de);
  }
});
