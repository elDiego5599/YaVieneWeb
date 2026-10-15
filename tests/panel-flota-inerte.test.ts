import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelFlota } from '../src/panel-flota';

/**
 * En el teléfono la maqueta del panel es un dibujo pequeño, no una
 * herramienta: sus botones medirían 8 px y, al estar en medio de la página,
 * se llevaban el toque y el desplazamiento de quien sólo bajaba. Ahí queda
 * inerte (`inert`: ni toques, ni foco de teclado). En escritorio se toca.
 */

/** Un `matchMedia` que se puede cambiar a mano y avisa a sus oyentes. */
function simularPantalla(movil: boolean) {
  const oyentes = new Set<() => void>();
  let ahora = movil;
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    get matches() {
      return consulta.includes('max-width') ? ahora : false;
    },
    media: consulta,
    addEventListener: (_: string, f: () => void) => oyentes.add(f),
    removeEventListener: (_: string, f: () => void) => oyentes.delete(f),
  }));
  return (valor: boolean) => {
    ahora = valor;
    oyentes.forEach((f) => f());
  };
}

function montar(): HTMLElement {
  const html = readFileSync(resolve(process.cwd(), 'empresas.html'), 'utf8');
  document.body.innerHTML = html.match(/<div class="flota">[\s\S]*?(?=<div class="despacho-pie")/)![0];
  const raiz = document.querySelector<HTMLElement>('.flota')!;
  new PanelFlota(raiz);
  return raiz;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('la maqueta del panel en el teléfono', () => {
  it('es inerte: no recibe toques ni foco', () => {
    simularPantalla(true);
    expect(montar().hasAttribute('inert')).toBe(true);
  });

  it('en escritorio se deja tocar', () => {
    simularPantalla(false);
    expect(montar().hasAttribute('inert')).toBe(false);
  });

  it('sigue a la pantalla si cruza el punto de corte (girar el teléfono, estirar la ventana)', () => {
    const cambiar = simularPantalla(true);
    const raiz = montar();
    cambiar(false);
    expect(raiz.hasAttribute('inert')).toBe(false);
    cambiar(true);
    expect(raiz.hasAttribute('inert')).toBe(true);
  });
});
