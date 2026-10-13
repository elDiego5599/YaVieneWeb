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
  it('carrusel: el paso que entra llega por el lado al que se va, y el que sale se va por el otro', () => {
    const lugar = (paso: string): string | undefined =>
      document.querySelector<HTMLElement>(`.cf-explica[data-paso="${paso}"]`)!.dataset.lugar;
    pestana('aviso').click();
    expect([lugar('aviso'), lugar('ruta')]).toEqual(['actual', 'antes']);
    pestana('bus').click();
    expect([lugar('bus'), lugar('aviso')]).toEqual(['actual', 'despues']);
    // Las flechas dan la vuelta en círculo: manda la tecla, no el índice.
    tecla('bus', 'ArrowRight');
    tecla('aviso', 'ArrowRight');
    expect(escena().dataset.paso).toBe('ruta');
    expect([lugar('ruta'), lugar('aviso')]).toEqual(['actual', 'antes']);
    tecla('ruta', 'ArrowLeft');
    expect(escena().dataset.paso).toBe('aviso');
    expect([lugar('aviso'), lugar('ruta')]).toEqual(['actual', 'despues']);
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

describe('arrastrar los pasos de lado', () => {
  const texto = (): HTMLElement => document.querySelector<HTMLElement>('.cf-texto')!;
  const puntero = (tipo: string, x: number, y = 0): void => {
    texto().dispatchEvent(new PointerEvent(tipo, { clientX: x, clientY: y, pointerId: 1, bubbles: true }));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(texto(), 'clientWidth', { value: 400, configurable: true });
  });

  it('arrastrar hacia la izquierda trae el paso siguiente, pegado al dedo', () => {
    puntero('pointerdown', 300);
    puntero('pointermove', 280);
    expect(texto().hasAttribute('data-arrastrando')).toBe(true);
    puntero('pointermove', 100);
    expect(texto().style.getPropertyValue('--cf-arrastre')).toBe('-200px');
    vi.advanceTimersByTime(100);
    puntero('pointerup', 100);
    expect(escena().dataset.paso).toBe('bus');
    expect(texto().hasAttribute('data-arrastrando')).toBe(false);
    expect(texto().style.getPropertyValue('--cf-arrastre')).toBe('');
  });

  it('hacia la derecha trae el anterior, dando la vuelta', () => {
    puntero('pointerdown', 100);
    puntero('pointermove', 300);
    vi.advanceTimersByTime(100);
    puntero('pointerup', 300);
    expect(escena().dataset.paso).toBe('aviso');
  });

  it('un tirón corto y lento vuelve a su sitio; uno corto y rápido pasa de paso', () => {
    puntero('pointerdown', 200);
    puntero('pointermove', 170);
    vi.advanceTimersByTime(1000);
    puntero('pointermove', 170);
    puntero('pointerup', 170);
    expect(escena().dataset.paso).toBe('ruta');
    // El vecino que asomaba se va animado, no de golpe.
    expect(document.querySelector<HTMLElement>('.cf-explica[data-paso="bus"]')!.hasAttribute('data-sale')).toBe(true);
    puntero('pointerdown', 200);
    vi.advanceTimersByTime(16);
    puntero('pointermove', 150);
    vi.advanceTimersByTime(16);
    puntero('pointerup', 150);
    expect(escena().dataset.paso).toBe('bus');
  });

  it('menos de 10 px, o un gesto vertical, no arrastra ni cambia de paso', () => {
    puntero('pointerdown', 200, 0);
    puntero('pointermove', 205, 0);
    expect(texto().hasAttribute('data-arrastrando')).toBe(false);
    puntero('pointermove', 210, 80);
    puntero('pointermove', 100, 80);
    puntero('pointerup', 100, 80);
    expect(escena().dataset.paso).toBe('ruta');
  });

  it('arrastrar detiene el avance automático', () => {
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
    document.body.innerHTML = banda;
    Object.defineProperty(texto(), 'clientWidth', { value: 400, configurable: true });
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, { intervalo: 5000 });
    puntero('pointerdown', 200);
    puntero('pointermove', 100);
    vi.advanceTimersByTime(100);
    puntero('pointerup', 100);
    expect(escena().dataset.paso).toBe('bus');
    vi.advanceTimersByTime(20000);
    expect(escena().dataset.paso).toBe('bus');
  });
});
