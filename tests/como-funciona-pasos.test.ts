import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pasos } from '../src/como-funciona';

/**
 * Las pestañas de «Cómo funciona»: el patrón de pestañas de WAI-ARIA. Un
 * toque o las flechas cambian el paso; la escena cuelga de `data-paso` (el
 * CSS cambia la pantalla) y nombra la pestaña que la gobierna.
 */

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const banda = /<section[^>]*id="como-funciona"[^>]*>[\s\S]*?<\/section>/.exec(html)![0];

const pestana = (paso: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`[role="tab"][data-paso="${paso}"]`)!;
const escena = (): HTMLElement => document.querySelector<HTMLElement>('#cf-escena')!;
const tecla = (paso: string, key: string): void => {
  pestana(paso).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
};
const descripcionVisible = (): string[] =>
  Array.from(document.querySelectorAll<HTMLElement>('.solo-lectores[data-paso]'))
    .filter((p) => !p.hidden)
    .map((p) => p.dataset.paso!);

beforeEach(() => {
  document.body.innerHTML = banda;
  new Pasos(document.querySelector<HTMLElement>('.cf-demo')!);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pestañas de los tres pasos', () => {
  it('el texto entra por el lado al que se va: derecha adelante, izquierda atrás', () => {
    const cuadro = (): string | undefined => document.querySelector<HTMLElement>('.cf-grid')!.dataset.direccion;
    pestana('aviso').click();
    expect(cuadro()).toBe('adelante');
    pestana('bus').click();
    expect(cuadro()).toBe('atras');
    // Las flechas dan la vuelta en círculo: manda la tecla, no el índice.
    tecla('bus', 'ArrowRight');
    tecla('aviso', 'ArrowRight');
    expect(escena().dataset.paso).toBe('ruta');
    expect(cuadro()).toBe('adelante');
    tecla('ruta', 'ArrowLeft');
    expect(escena().dataset.paso).toBe('aviso');
    expect(cuadro()).toBe('atras');
  });

  it('la entrada al bus anima toque y tarjeta, y cambiar de paso cancela el toque pendiente', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
    expect(main).toMatch(/setBuses\(\[.*?,.*?\]\)/s);
    expect(main).toMatch(/clearTimeout/);
    expect(main).toMatch(/sinMovimiento\(\)/);
    expect(main).toMatch(/cf-tap/);
  });

  it('un toque cambia el paso, la escena y lo que oye el lector', () => {
    pestana('bus').click();
    expect(pestana('bus').getAttribute('aria-selected')).toBe('true');
    expect(pestana('bus').tabIndex).toBe(0);
    expect(pestana('ruta').getAttribute('aria-selected')).toBe('false');
    expect(pestana('ruta').tabIndex).toBe(-1);
    expect(escena().dataset.paso).toBe('bus');
    expect(escena().getAttribute('aria-labelledby')).toBe('cf-paso-bus');
    expect(descripcionVisible()).toEqual(['bus']);
  });

  it('las flechas recorren en círculo, Inicio y Fin van a los extremos, y el foco sigue', () => {
    tecla('ruta', 'ArrowLeft');
    expect(escena().dataset.paso).toBe('aviso');
    expect(document.activeElement).toBe(pestana('aviso'));
    tecla('aviso', 'ArrowRight');
    expect(escena().dataset.paso).toBe('ruta');
    tecla('ruta', 'End');
    expect(escena().dataset.paso).toBe('aviso');
    tecla('aviso', 'Home');
    expect(escena().dataset.paso).toBe('ruta');
    expect(document.activeElement).toBe(pestana('ruta'));
  });

  it('otra tecla no cambia nada', () => {
    tecla('ruta', 'Enter');
    expect(escena().dataset.paso).toBe('ruta');
  });
});

describe('avance automático de los pasos', () => {
  // La demo a la vista: el observador avisa al empezar a observarla.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(readonly avisar: (e: { isIntersecting: boolean }[]) => void) {}
        observe(): void {
          this.avisar([{ isIntersecting: true }]);
        }
        disconnect(): void {}
      }
    );
  });

  it('avanza en orden y vuelve a la ruta', () => {
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, { intervalo: 5000 });
    const lista = document.querySelector<HTMLElement>('[role="tablist"]')!;
    expect(lista.hasAttribute('data-auto')).toBe(true);
    vi.advanceTimersByTime(15000);
    expect(escena().dataset.paso).toBe('ruta');
    vi.advanceTimersByTime(5000);
    expect(escena().dataset.paso).toBe('bus');
  });

  it('un clic detiene el avance y quita data-auto', () => {
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, { intervalo: 5000 });
    pestana('aviso').click();
    vi.advanceTimersByTime(20000);
    expect(escena().dataset.paso).toBe('aviso');
    expect(document.querySelector('[role="tablist"]')!.hasAttribute('data-auto')).toBe(false);
  });

  it('con movimiento reducido no arranca el avance', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, { intervalo: 5000 });
    vi.advanceTimersByTime(10000);
    expect(escena().dataset.paso).toBe('ruta');
    expect(document.querySelector('[role="tablist"]')!.hasAttribute('data-auto')).toBe(false);
  });

  it('avisa cada cambio manual y automático', () => {
    const alCambiar = vi.fn();
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, { intervalo: 5000, alCambiar });
    vi.advanceTimersByTime(5000);
    pestana('aviso').click();
    expect(alCambiar.mock.calls).toEqual([['bus'], ['aviso']]);
  });

  it('sin intervalo conserva el modo manual', () => {
    vi.useRealTimers();
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!);
    vi.useFakeTimers();
    vi.advanceTimersByTime(20000);
    expect(escena().dataset.paso).toBe('ruta');
    expect(document.querySelector('[role="tablist"]')!.hasAttribute('data-auto')).toBe(false);
  });
});

describe('avance automático: sin observador y al salir de la vista', () => {
  beforeEach(() => vi.useFakeTimers());

  it('sin IntersectionObserver el avance arranca en el acto', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, { intervalo: 5000 });
    vi.advanceTimersByTime(5000);
    expect(escena().dataset.paso).toBe('bus');
  });

  it('al salir de la vista se para, y al volver sigue desde donde iba', () => {
    let avisar!: (e: { isIntersecting: boolean }[]) => void;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof avisar) {
          avisar = cb;
        }
        observe(): void {}
        disconnect(): void {}
      }
    );
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, { intervalo: 5000 });
    avisar([{ isIntersecting: true }]);
    vi.advanceTimersByTime(5000);
    expect(escena().dataset.paso).toBe('bus');
    avisar([{ isIntersecting: false }]);
    vi.advanceTimersByTime(20000);
    expect(escena().dataset.paso).toBe('bus');
    avisar([{ isIntersecting: true }]);
    vi.advanceTimersByTime(5000);
    expect(escena().dataset.paso).toBe('aviso');
  });
});
