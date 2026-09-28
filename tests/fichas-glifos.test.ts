import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Las tres fichas del problema llevaban el mismo «?» en la cara ciega y el
 * mismo «✓» en la clara, en letra de máquina dentro de un círculo: el
 * mismo sello repetido tres veces no dice nada de la ficha y se lee como
 * un hueco por rellenar. Cada ficha lleva ahora su dibujo a trazo fino
 * —uno por cara—, que cuenta de un vistazo lo que dice el título.
 */
describe('los glifos de las fichas del problema', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  // Sólo la sección: la página entera trae hojas de estilo que el DOM de
  // prueba intentaría descargar.
  const seccion = html.match(/<section[^>]*id="problema"[\s\S]*?<\/section>/)![0];
  const doc = new DOMParser().parseFromString(seccion, 'text/html');
  const glifos = [...doc.querySelectorAll('#problema .ficha-glifo')];

  it('hay uno por ficha, con sus dos caras', () => {
    expect(glifos).toHaveLength(3);
    for (const glifo of glifos) {
      expect(glifo.getAttribute('aria-hidden')).toBe('true');
      expect(glifo.querySelector(':scope > .cara--ciego > svg')).not.toBeNull();
      expect(glifo.querySelector(':scope > .cara--claro > svg')).not.toBeNull();
    }
  });

  it('son dibujos, no letras', () => {
    for (const glifo of glifos) {
      expect(glifo.textContent!.trim()).toBe('');
    }
  });

  it('los seis dibujos son distintos entre sí', () => {
    const dibujos = glifos.flatMap((g) =>
      [...g.querySelectorAll(':scope > .cara > svg')].map((svg) => svg.innerHTML.replace(/\s+/g, ' '))
    );
    expect(dibujos).toHaveLength(6);
    expect(new Set(dibujos).size).toBe(6);
  });

  it('a trazo fino y del color de la cara', () => {
    for (const svg of glifos.flatMap((g) => [...g.querySelectorAll('svg')])) {
      expect(svg.getAttribute('fill')).toBe('none');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(Number(svg.getAttribute('stroke-width'))).toBeLessThanOrEqual(1.7);
    }
  });
});
