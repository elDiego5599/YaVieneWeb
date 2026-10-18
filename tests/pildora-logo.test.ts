import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La píldora de búsqueda del teléfono espeja `search_pill_bar.dart`: la
 * punta izquierda lleva el logo de la app (dueño, 2026-10-18), no el ☰ del
 * menú que se fue, y la derecha la lupa (`Icons.search_rounded`) o la X.
 * El logo mide 36 y va concéntrico con la punta redonda: en un hueco de 48,
 * `Alignment(-0.5, 0)` lo corre 3 a la izquierda del centro.
 */
const raiz = process.cwd();
const html = readFileSync(resolve(raiz, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const css = readFileSync(resolve(raiz, 'src/css/phone-simulator.css'), 'utf8');
const pildora = html.match(/<div class="app-pill" data-el="pill">([\s\S]*?)<span class="app-pill-text">/)![1];
const regla = (sel: string): string =>
  css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[2] ?? '';

describe('la píldora del teléfono, como la de la app', () => {
  it('la punta izquierda lleva el logo y no el menú', () => {
    expect(pildora).toMatch(/<span class="app-pill-btn app-pill-logo">\s*<img src="\/logo\.svg" alt="" width="36" height="36">/);
    expect(pildora).not.toContain('M4 7h16M4 12h16M4 17h16');
  });

  it('el logo mide 36 y va 3 a la izquierda del centro del hueco', () => {
    expect(regla('.app-pill-logo img')).toMatch(/width:\s*calc\(36 \* var\(--u\)\)/);
    expect(regla('.app-pill-logo img')).toMatch(/height:\s*calc\(36 \* var\(--u\)\)/);
    expect(regla('.app-pill-logo img')).toMatch(/translate:\s*calc\(-3 \* var\(--u\)\)/);
  });

  it('la punta derecha lleva la lupa, no el ajuste', () => {
    const derecha = html.match(/data-el="pill-der">([\s\S]*?)<\/span>/)![1];
    expect(derecha).toContain('class="icono-lupa"');
    expect(derecha).not.toContain('icono-tune');
    expect(regla('.app-pill-btn--der .icono-lupa')).toMatch(/width:\s*calc\(22 \* var\(--u\)\)/);
  });
});
