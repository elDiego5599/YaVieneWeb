import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * D8: el teléfono derecho del hero mueve buses sobre el mapa real de
 * Barranquilla, y un bus que avanza sobre rutas reales se lee como uno de
 * verdad. El rótulo «Simulación» lo decía en el mapa en vivo; cuando ese
 * mapa se fue (`a42b4a9`) se fue con él, aunque la demo del hero sigue
 * animando buses (AUD16-08). Vuelve en negrita al principio de la
 * atribución del mosaico, que es la del mapa del teléfono.
 */
describe('la demo del hero dice que es una simulación', () => {
  it('la atribución del mapa empieza por «Simulación»', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const credito = html.match(/<p class="hero-credit">([\s\S]*?)<\/p>/)![1];
    expect(credito).toMatch(/^<strong data-mapa-simulacion>Simulación\.<\/strong> Mapa base/);
  });
});
