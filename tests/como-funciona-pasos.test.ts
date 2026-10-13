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
    // Las flechas dan la vuelta en círculo: manda la tecla, no el índice.
    tecla('bus', 'ArrowRight');
    llega();
    tecla('aviso', 'ArrowRight');
    expect(escena().dataset.paso).toBe('ruta');
    expect([lugar('ruta'), lugar('aviso')]).toEqual(['actual', 'antes']);
    llega();
    tecla('ruta', 'ArrowLeft');
    expect(escena().dataset.paso).toBe('aviso');
    expect([lugar('aviso'), lugar('ruta')]).toEqual(['actual', 'despues']);
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
    // De la ruta a la izquierda: el aviso entra por la izquierda y la ruta
    // se va por la derecha, con rebote.
    tecla('ruta', 'ArrowLeft');
    vi.advanceTimersByTime(120);
    // A medio viaje se vuelve a la ruta: regresa por la derecha, por donde
    // se iba, aunque la pestaña quede a la izquierda; y sin rebote.
    pestana('ruta').click();
    expect(grid.dataset.direccion).toBe('adelante');
    expect(grid.hasAttribute('data-rebote')).toBe(false);
    const ruta = document.querySelector<HTMLElement>('.cf-explica[data-paso="ruta"]')!;
    expect(ruta.dataset.lugar).toBe('actual');
    // Su copia en vuelo la toma la escena viva: no quedan dos rutas.
    const copias = Array.from(document.querySelectorAll<HTMLElement>('.cf-escena--fantasma'));
    expect(copias.map((c) => [c.dataset.paso, c.dataset.lugar])).toEqual([['aviso', 'antes']]);
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
  const cuadricula = (): HTMLElement => document.querySelector<HTMLElement>('.cf-grid')!;
  const puntero = (tipo: string, x: number, y = 0, en: HTMLElement = texto(), mas: PointerEventInit = {}): void => {
    en.dispatchEvent(
      new PointerEvent(tipo, {
        clientX: x,
        clientY: y,
        pointerId: 1,
        bubbles: true,
        ...mas,
      }),
    );
  };
  const arrastre = (): number => parseFloat(cuadricula().style.getPropertyValue('--cf-arrastre'));

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(texto(), 'clientWidth', {
      value: 400,
      configurable: true,
    });
  });

  it('arrastrar hacia la izquierda trae el paso siguiente, pegado al dedo', () => {
    puntero('pointerdown', 300);
    puntero('pointermove', 280);
    expect(cuadricula().hasAttribute('data-arrastrando')).toBe(true);
    puntero('pointermove', 100);
    expect(cuadricula().style.getPropertyValue('--cf-arrastre')).toBe('-200px');
    vi.advanceTimersByTime(100);
    puntero('pointerup', 100);
    expect(escena().dataset.paso).toBe('bus');
    expect(cuadricula().hasAttribute('data-arrastrando')).toBe(false);
    expect(cuadricula().style.getPropertyValue('--cf-arrastre')).toBe('');
  });

  it('la escena asoma también: su vecino entra pegado al dedo y, al soltar, el viejo se va', () => {
    puntero('pointerdown', 300);
    puntero('pointermove', 100);
    const asoma = fantasma()!;
    expect([asoma.dataset.paso, asoma.dataset.lugar]).toEqual(['bus', 'despues']);
    vi.advanceTimersByTime(100);
    puntero('pointerup', 100);
    expect([escena().dataset.paso, escena().dataset.lugar]).toEqual(['bus', 'actual']);
    expect([fantasma()!.dataset.paso, fantasma()!.dataset.lugar]).toEqual(['ruta', 'antes']);
  });

  it('se arrastra también desde la escena', () => {
    const marco = document.querySelector<HTMLElement>('.cf-marco')!;
    Object.defineProperty(marco, 'clientWidth', {
      value: 400,
      configurable: true,
    });
    puntero('pointerdown', 300, 0, marco);
    puntero('pointermove', 100, 0, marco);
    vi.advanceTimersByTime(100);
    puntero('pointerup', 100, 0, marco);
    expect(escena().dataset.paso).toBe('bus');
  });

  it('hacia la derecha trae el anterior, dando la vuelta', () => {
    puntero('pointerdown', 100);
    puntero('pointermove', 300);
    vi.advanceTimersByTime(100);
    puntero('pointerup', 300);
    expect(escena().dataset.paso).toBe('aviso');
  });

  it('pasado el primero, el tirón cede como goma, y al soltar da la vuelta con rebote', () => {
    puntero('pointerdown', 100);
    puntero('pointermove', 300);
    // 200 px de dedo hacia atrás desde el primero: la goma de iOS da
    // 200·400·0,55 / (400 + 0,55·200) = 86,3 px, menos de la mitad.
    expect(arrastre()).toBeCloseTo(86.27, 1);
    vi.advanceTimersByTime(100);
    puntero('pointerup', 300);
    expect(escena().dataset.paso).toBe('aviso');
    expect(cuadricula().hasAttribute('data-rebote')).toBe(true);
    vi.advanceTimersByTime(600);
    expect(cuadricula().hasAttribute('data-rebote')).toBe(false);
    // Y desde el último hacia adelante, igual.
    puntero('pointerdown', 300);
    puntero('pointermove', 100);
    expect(arrastre()).toBeCloseTo(-86.27, 1);
    vi.advanceTimersByTime(100);
    puntero('pointerup', 100);
    expect(escena().dataset.paso).toBe('ruta');
    expect(cuadricula().hasAttribute('data-rebote')).toBe(true);
  });

  it('entre vecinos el tirón va pegado al dedo y no rebota', () => {
    puntero('pointerdown', 300);
    puntero('pointermove', 100);
    expect(arrastre()).toBe(-200);
    vi.advanceTimersByTime(100);
    puntero('pointerup', 100);
    expect(escena().dataset.paso).toBe('bus');
    expect(cuadricula().hasAttribute('data-rebote')).toBe(false);
  });

  it('un segundo dedo no arranca otro gesto ni mueve el primero', () => {
    puntero('pointerdown', 300);
    puntero('pointerdown', 50, 0, texto(), { pointerId: 2 });
    puntero('pointermove', 350, 0, texto(), { pointerId: 2 });
    expect(cuadricula().hasAttribute('data-arrastrando')).toBe(false);
    puntero('pointermove', 100);
    expect(arrastre()).toBe(-200);
    puntero('pointerup', 350, 0, texto(), { pointerId: 2 });
    expect(cuadricula().hasAttribute('data-arrastrando')).toBe(true);
    vi.advanceTimersByTime(100);
    puntero('pointerup', 100);
    expect(escena().dataset.paso).toBe('bus');
  });

  it('un ratón soltado fuera antes de arrancar no deja el gesto colgado', () => {
    const raton = (b: number): PointerEventInit => ({
      pointerType: 'mouse',
      buttons: b,
    });
    puntero('pointerdown', 300, 0, texto(), raton(1));
    // Volvió sin botón: se soltó fuera, donde no se oyó el `pointerup`.
    puntero('pointermove', 100, 0, texto(), raton(0));
    expect(cuadricula().hasAttribute('data-arrastrando')).toBe(false);
    puntero('pointermove', 50, 0, texto(), raton(0));
    expect(cuadricula().hasAttribute('data-arrastrando')).toBe(false);
    expect(escena().dataset.paso).toBe('ruta');
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
    // Y la escena que asomaba también vuelve animada y luego se quita.
    expect(fantasma()!.hasAttribute('data-sale')).toBe(true);
    vi.advanceTimersByTime(600);
    expect(fantasma()).toBeNull();
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
    expect(cuadricula().hasAttribute('data-arrastrando')).toBe(false);
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
    Object.defineProperty(texto(), 'clientWidth', {
      value: 400,
      configurable: true,
    });
    new Pasos(document.querySelector<HTMLElement>('.cf-demo')!, {
      intervalo: 5000,
    });
    puntero('pointerdown', 200);
    puntero('pointermove', 100);
    vi.advanceTimersByTime(100);
    puntero('pointerup', 100);
    expect(escena().dataset.paso).toBe('bus');
    vi.advanceTimersByTime(20000);
    expect(escena().dataset.paso).toBe('bus');
  });
});
