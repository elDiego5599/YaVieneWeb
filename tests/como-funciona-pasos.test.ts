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
const fantasma = (): HTMLElement | null => document.querySelector<HTMLElement>('.cf-escena--fantasma');
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
  vi.restoreAllMocks();
});

describe('pestañas de los tres pasos', () => {
  it('carrusel: el paso que entra llega por el lado al que se va, y el que sale se va por el otro', () => {
    vi.useFakeTimers();
    // Cada cambio deja terminar el viaje: el que aún va saliendo vuelve
    // por donde iba (prueba de abajo).
    const llega = (): void => {
      vi.advanceTimersByTime(600);
    };
    const lugar = (paso: string): string | undefined =>
      document.querySelector<HTMLElement>(`.cf-explica[data-paso="${paso}"]`)!.dataset.lugar;
    pestana('aviso').click();
    expect([lugar('aviso'), lugar('ruta')]).toEqual(['actual', 'antes']);
    llega();
    pestana('bus').click();
    expect([lugar('bus'), lugar('aviso')]).toEqual(['actual', 'despues']);
    llega();
    // Las flechas dan la vuelta en círculo: al pasar del borde la lámina
    // rebota y corre al otro extremo, como si se devolviera el carrete.
    tecla('bus', 'ArrowRight');
    llega();
    tecla('aviso', 'ArrowRight');
    expect(escena().dataset.paso).toBe('ruta');
    expect([lugar('ruta'), fantasma()?.dataset.lugar]).toEqual(['actual', 'despues']);
    expect([lugar('ruta'), lugar('aviso')]).toEqual(['actual', 'despues']);
    llega();
    tecla('ruta', 'ArrowLeft');
    expect(escena().dataset.paso).toBe('aviso');
    expect([lugar('aviso'), fantasma()?.dataset.lugar]).toEqual(['actual', 'antes']);
    expect([lugar('aviso'), lugar('ruta')]).toEqual(['actual', 'antes']);
  });

  it('la escena va en el carrusel: la vieja se va de lado, copia muda, y se quita al llegar', () => {
    vi.useFakeTimers();
    pestana('bus').click();
    const vieja = fantasma()!;
    expect([vieja.dataset.paso, vieja.dataset.lugar]).toEqual(['ruta', 'antes']);
    expect(vieja.hasAttribute('data-sale')).toBe(true);
    // Muda para el lector y sin ids repetidos ni otra pestaña que nombrar.
    expect(vieja.getAttribute('aria-hidden')).toBe('true');
    expect(vieja.querySelector('[id], .solo-lectores')).toBeNull();
    expect(vieja.hasAttribute('role') || vieja.id !== '').toBe(false);
    // Va detrás de la escena viva: `querySelector('.cf-escena')` sigue dando esa.
    expect(document.querySelector('.cf-escena')).toBe(escena());
    expect([escena().dataset.paso, escena().dataset.lugar]).toEqual(['bus', 'actual']);
    vi.advanceTimersByTime(600);
    expect(fantasma()).toBeNull();
    expect(escena().hasAttribute('data-entra')).toBe(false);
  });

  it('dos clics seguidos: la escena que iba saliendo termina su viaje y luego se quita', () => {
    vi.useFakeTimers();
    pestana('bus').click();
    vi.advanceTimersByTime(200);
    pestana('aviso').click();
    const copias = Array.from(document.querySelectorAll<HTMLElement>('.cf-escena--fantasma'));
    expect(copias.map((c) => [c.dataset.paso, c.dataset.lugar])).toEqual([
      ['bus', 'antes'],
      ['ruta', 'antes'],
    ]);
    expect(copias.every((c) => c.hasAttribute('data-sale'))).toBe(true);
    vi.advanceTimersByTime(600);
    expect(fantasma()).toBeNull();
  });

  it('elegir el paso que aún va saliendo lo trae de vuelta por donde va, texto y cuadro juntos', () => {
    vi.useFakeTimers();
    const grid = document.querySelector<HTMLElement>('.cf-grid')!;
    // De la ruta a la izquierda: rebota y avanza hasta el aviso, que entra
    // por la derecha; la ruta se va por la izquierda.
    tecla('ruta', 'ArrowLeft');
    vi.advanceTimersByTime(120);
    // A medio viaje se vuelve a la ruta: regresa por la izquierda, por
    // donde se iba, aunque la pestaña quede a la izquierda; y sin rebote.
    pestana('ruta').click();
    expect(grid.dataset.direccion).toBe('atras');
    expect(grid.hasAttribute('data-rebote')).toBe(false);
    const ruta = document.querySelector<HTMLElement>('.cf-explica[data-paso="ruta"]')!;
    expect(ruta.dataset.lugar).toBe('actual');
    // Su copia en vuelo la toma la escena viva: no quedan dos rutas.
    const copias = Array.from(document.querySelectorAll<HTMLElement>('.cf-escena--fantasma'));
    expect(copias.map((c) => [c.dataset.paso, c.dataset.lugar])).toEqual([['aviso', 'despues']]);
    vi.advanceTimersByTime(600);
    expect(fantasma()).toBeNull();
  });

  it('el texto que cambia de rumbo a medio viaje se fija donde va y sale de ahí; el quieto no', () => {
    // El navegador acortaría la transición invertida y el texto se
    // separaría de su cuadro, que siempre parte de donde se ve.
    const ruta = document.querySelector<HTMLElement>('.cf-explica[data-paso="ruta"]')!;
    const bus = document.querySelector<HTMLElement>('.cf-explica[data-paso="bus"]')!;
    ruta.getAnimations = () => [{ transitionProperty: 'translate', playState: 'running' }] as unknown as Animation[];
    bus.getAnimations = () => [{ transitionProperty: 'opacity', playState: 'running' }] as unknown as Animation[];
    const real = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((e) =>
      e === ruta ? ({ translate: '-123px' } as CSSStyleDeclaration) : real(e)
    );
    const estilos = new MutationObserver(() => {});
    estilos.observe(ruta, { attributeFilter: ['style'], attributeOldValue: true });
    const deBus = new MutationObserver(() => {});
    deBus.observe(bus, { attributeFilter: ['style'] });
    pestana('bus').click();
    const pasos = estilos.takeRecords().map((r) => r.oldValue ?? '');
    expect(pasos).toContain('transition: none; translate: -123px;');
    expect([ruta.style.translate, ruta.style.transition]).toEqual(['', '']);
    expect(deBus.takeRecords().filter((r) => (r.target as HTMLElement).style.translate !== '')).toEqual([]);
    vi.restoreAllMocks();
  });

  it('tres clics seguidos: el texto que aún se va sigue con su cuadro, y al llegar se queda quieto', () => {
    vi.useFakeTimers();
    const bus = document.querySelector<HTMLElement>('.cf-explica[data-paso="bus"]')!;
    pestana('bus').click();
    vi.advanceTimersByTime(150);
    pestana('aviso').click();
    vi.advanceTimersByTime(60);
    // La ruta aún se iba por la izquierda: vuelve por ahí, y el bus, que
    // también se iba por la izquierda, no salta al otro lado: sigue con su
    // copia del cuadro.
    pestana('ruta').click();
    expect([bus.dataset.lugar, bus.hasAttribute('data-sale')]).toEqual(['antes', true]);
    const copia = Array.from(document.querySelectorAll<HTMLElement>('.cf-escena--fantasma')).find(
      (c) => c.dataset.paso === 'bus',
    )!;
    expect(copia.dataset.lugar).toBe('antes');
    vi.advanceTimersByTime(600);
    expect(bus.hasAttribute('data-sale')).toBe(false);
  });

  it('dar la vuelta con las flechas rebota; pasar al vecino de al lado, no', () => {
    vi.useFakeTimers();
    const grid = document.querySelector<HTMLElement>('.cf-grid')!;
    tecla('ruta', 'ArrowRight');
    expect(grid.hasAttribute('data-rebote')).toBe(false);
    vi.advanceTimersByTime(600);
    tecla('bus', 'ArrowRight');
    vi.advanceTimersByTime(600);
    tecla('aviso', 'ArrowRight');
    expect(escena().dataset.paso).toBe('ruta');
    expect(grid.hasAttribute('data-rebote')).toBe(true);
    // Un paso normal enseguida le quita el rebote al que viene.
    tecla('ruta', 'ArrowRight');
    expect(grid.hasAttribute('data-rebote')).toBe(false);
    vi.advanceTimersByTime(600);
    tecla('bus', 'ArrowLeft');
    vi.advanceTimersByTime(600);
    tecla('ruta', 'ArrowLeft');
    expect(escena().dataset.paso).toBe('aviso');
    expect(grid.hasAttribute('data-rebote')).toBe(true);
    vi.advanceTimersByTime(600);
    expect(grid.hasAttribute('data-rebote')).toBe(false);
  });

  it('con movimiento reducido dar la vuelta no rebota', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    tecla('ruta', 'ArrowLeft');
    expect(escena().dataset.paso).toBe('aviso');
    expect(document.querySelector('.cf-grid')!.hasAttribute('data-rebote')).toBe(false);
  });

  it('con movimiento reducido la escena cambia en su sitio, sin copia', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    pestana('aviso').click();
    expect(escena().dataset.paso).toBe('aviso');
    expect(fantasma()).toBeNull();
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
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, {
      intervalo: 5000,
    });
    const lista = document.querySelector<HTMLElement>('[role="tablist"]')!;
    expect(lista.hasAttribute('data-auto')).toBe(true);
    vi.advanceTimersByTime(15000);
    expect(escena().dataset.paso).toBe('ruta');
    vi.advanceTimersByTime(5000);
    expect(escena().dataset.paso).toBe('bus');
  });

  it('un clic detiene el avance y quita data-auto', () => {
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, {
      intervalo: 5000,
    });
    pestana('aviso').click();
    vi.advanceTimersByTime(20000);
    expect(escena().dataset.paso).toBe('aviso');
    expect(document.querySelector('[role="tablist"]')!.hasAttribute('data-auto')).toBe(false);
  });

  it('con movimiento reducido no arranca el avance', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, {
      intervalo: 5000,
    });
    vi.advanceTimersByTime(10000);
    expect(escena().dataset.paso).toBe('ruta');
    expect(document.querySelector('[role="tablist"]')!.hasAttribute('data-auto')).toBe(false);
  });

  it('avisa cada cambio manual y automático', () => {
    const alCambiar = vi.fn();
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, {
      intervalo: 5000,
      alCambiar,
    });
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
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, {
      intervalo: 5000,
    });
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
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, {
      intervalo: 5000,
    });
    // La barrita solo corre cuando el carrusel se ve: antes no arranca.
    const lista = document.querySelector<HTMLElement>('[role="tablist"]')!;
    expect(lista.hasAttribute('data-auto')).toBe(false);
    avisar([{ isIntersecting: true }]);
    expect(lista.hasAttribute('data-auto')).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(escena().dataset.paso).toBe('bus');
    avisar([{ isIntersecting: false }]);
    expect(lista.hasAttribute('data-auto')).toBe(false);
    vi.advanceTimersByTime(20000);
    expect(escena().dataset.paso).toBe('bus');
    avisar([{ isIntersecting: true }]);
    expect(lista.hasAttribute('data-auto')).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(escena().dataset.paso).toBe('aviso');
  });

  it('pausa con la pestaña oculta y reanuda al volver', () => {
    const oculta = vi.spyOn(document, 'hidden', 'get');
    oculta.mockReturnValue(true);
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, { intervalo: 5000 });
    vi.advanceTimersByTime(10000);
    expect(escena().dataset.paso).toBe('ruta');
    expect(document.querySelector('[role="tablist"]')!.hasAttribute('data-auto')).toBe(false);
    oculta.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(5000);
    expect(escena().dataset.paso).toBe('bus');
  });
});



describe('flechas fijas sobre el cuadro', () => {
  const boton = (direccion: 'anterior' | 'siguiente'): HTMLButtonElement =>
    document.querySelector<HTMLButtonElement>(`.cf-control--${direccion}`)!;

  it('siguiente y anterior recorren, dan la vuelta con rebote y paran el avance automático', () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', undefined);
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
    document.body.innerHTML = banda;
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, { intervalo: 5000 });
    boton('siguiente').focus();
    boton('siguiente').click();
    expect(escena().dataset.paso).toBe('bus');
    expect(document.activeElement).toBe(boton('siguiente'));
    expect(document.querySelector('.cf-grid')!.hasAttribute('data-rebote')).toBe(false);
    boton('siguiente').click();
    expect(escena().dataset.paso).toBe('aviso');
    // Ya en reposo (un paso que aún sale vuelve por donde iba, sin rebote).
    vi.advanceTimersByTime(600);
    boton('siguiente').click();
    expect(escena().dataset.paso).toBe('ruta');
    expect(document.querySelector('.cf-grid')!.hasAttribute('data-rebote')).toBe(true);
    expect(document.querySelector<HTMLElement>('.cf-grid')!.dataset.direccion).toBe('atras');
    vi.advanceTimersByTime(600);
    boton('anterior').click();
    expect(escena().dataset.paso).toBe('aviso');
    expect(document.querySelector('.cf-grid')!.hasAttribute('data-rebote')).toBe(true);
    expect(document.querySelector<HTMLElement>('.cf-grid')!.dataset.direccion).toBe('adelante');
    vi.advanceTimersByTime(15000);
    expect(escena().dataset.paso).toBe('aviso');
    expect(document.querySelector('[role="tablist"]')!.hasAttribute('data-auto')).toBe(false);
  });
});
