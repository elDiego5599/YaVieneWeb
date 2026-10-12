import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El mismo nav en todas las páginas con isla (dueño, 2026-10-12): los
 * mismos enlaces, con el mismo nombre y al mismo sitio, y el mismo estilo
 * (vive en nav.css, no atado a la portada).
 */

const leer = (nombre: string): string => readFileSync(resolve(process.cwd(), nombre), 'utf8');

const menu = (pagina: string): string[] => {
  const doc = new DOMParser().parseFromString(leer(pagina), 'text/html');
  return [...doc.querySelectorAll('.nav-island-links a, .nav-island-cta')].map(
    (a) => `${a.textContent!.trim()} → ${a.getAttribute('href')!.replace(/^\/(?=#)/, '')}`
  );
};

describe('el nav', () => {
  it('es el mismo en la portada, empresas, privacidad y términos', () => {
    const portada = menu('index.html');
    expect(portada).toEqual(['Problema → #problema', 'Mapa en vivo → #mapa', 'Para empresas → /empresas.html']);
    for (const pagina of ['empresas.html', 'privacidad.html', 'terminos.html']) {
      expect(menu(pagina), pagina).toEqual(portada);
    }
  });

  it('su estilo de escritorio no depende del hero de la portada', () => {
    expect(leer('src/css/componentes/hero.css')).not.toMatch(/\.nav-island|\.nav-link|\.wordmark/);
    expect(leer('src/css/componentes/nav.css')).toMatch(/body \.site-header \.nav-link \{ font-size: 21px; \}/);
  });
});
