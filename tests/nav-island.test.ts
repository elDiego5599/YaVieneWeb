import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavIsland } from '../src/nav-island';

/**
 * La isla de navegación, abierta y cerrada por cada camino que tiene.
 *
 * Hasta la auditoría (hallazgo 8) nada abría ni cerraba la isla en las
 * pruebas: sólo se buscaba el texto `new NavIsland(` en el fuente. Así
 * llegó a `main` el primer toque de Android que no abría el menú. Aquí va
 * lo que se prueba sin navegador —el botón, el respiro del puntero, el
 * toque fuera, los enlaces, el scroll—; el foco de teclado, que depende de
 * `:focus-visible`, y la marca de la sección se prueban en e2e/isla.spec.ts
 * con Chromium.
 */

const puntero = (tipo: string, pointerType: string, opciones: EventInit = {}): Event =>
  Object.assign(new Event(tipo, opciones), { pointerType });

function montar(): { isla: HTMLElement; boton: HTMLButtonElement; enlace: HTMLAnchorElement; fuera: HTMLElement } {
  document.body.innerHTML = `
    <header class="site-header">
      <nav class="nav-island">
        <button type="button" class="nav-island-toggle" aria-expanded="false" aria-label="Abrir el menú"></button>
        <a class="nav-link" href="#uno">Uno</a>
      </nav>
    </header>
    <section id="uno"></section>
    <p id="fuera">fuera</p>`;
  const isla = document.querySelector<HTMLElement>('.nav-island')!;
  const boton = isla.querySelector<HTMLButtonElement>('.nav-island-toggle')!;
  new NavIsland(isla, boton);
  return { isla, boton, enlace: isla.querySelector('a')!, fuera: document.getElementById('fuera')! };
}

const abierta = (isla: HTMLElement): boolean => isla.classList.contains('is-open');

describe('NavIsland', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('el botón abre y cierra, y dice lo que hará el siguiente clic', () => {
    const { isla, boton } = montar();
    boton.click();
    expect(abierta(isla)).toBe(true);
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.getAttribute('aria-label')).toBe('Cerrar el menú');
    boton.click();
    expect(abierta(isla)).toBe(false);
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(boton.getAttribute('aria-label')).toBe('Abrir el menú');
  });

  it('el ratón la abre al entrar y la cierra al salir, con un respiro de 120 ms', () => {
    const { isla } = montar();
    isla.dispatchEvent(puntero('pointerenter', 'mouse'));
    expect(abierta(isla)).toBe(true);

    isla.dispatchEvent(puntero('pointerleave', 'mouse'));
    vi.advanceTimersByTime(119);
    expect(abierta(isla), 'se cerró antes del respiro').toBe(true);
    vi.advanceTimersByTime(1);
    expect(abierta(isla)).toBe(false);
  });

  it('volver dentro del respiro la deja abierta: el hueco hasta el panel no la cierra', () => {
    const { isla } = montar();
    isla.dispatchEvent(puntero('pointerenter', 'mouse'));
    isla.dispatchEvent(puntero('pointerleave', 'mouse'));
    vi.advanceTimersByTime(80);
    isla.dispatchEvent(puntero('pointerenter', 'mouse'));
    vi.advanceTimersByTime(500);
    expect(abierta(isla)).toBe(true);
  });

  it('el dedo no la abre ni la cierra al entrar o salir: eso es cosa del botón', () => {
    const { isla, boton } = montar();
    isla.dispatchEvent(puntero('pointerenter', 'touch'));
    expect(abierta(isla)).toBe(false);
    boton.click();
    isla.dispatchEvent(puntero('pointerleave', 'touch'));
    vi.advanceTimersByTime(500);
    expect(abierta(isla)).toBe(true);
  });

  it('un toque fuera la cierra; uno dentro, no', () => {
    const { isla, boton, fuera } = montar();
    boton.click();
    boton.dispatchEvent(puntero('pointerdown', 'touch', { bubbles: true }));
    expect(abierta(isla)).toBe(true);
    fuera.dispatchEvent(puntero('pointerdown', 'touch', { bubbles: true }));
    expect(abierta(isla)).toBe(false);
  });

  it('un enlace la recoge: ya llevó a la sección', () => {
    const { isla, boton, enlace } = montar();
    boton.click();
    enlace.click();
    expect(abierta(isla)).toBe(false);
  });

  it('desplazar la página la cierra', () => {
    const { isla, boton } = montar();
    boton.click();
    window.dispatchEvent(new Event('scroll'));
    expect(abierta(isla)).toBe(false);
  });

  it('Escape la cierra y devuelve el foco al botón sin volver a abrirla', () => {
    const { isla, boton } = montar();
    boton.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(abierta(isla)).toBe(false);
    expect(document.activeElement).toBe(boton);
    vi.advanceTimersByTime(500);
    expect(abierta(isla), 'el foco devuelto la reabrió').toBe(false);
  });

  it('Escape con la isla cerrada no le mueve el foco a nadie', () => {
    const { fuera } = montar();
    fuera.tabIndex = -1;
    fuera.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.activeElement).toBe(fuera);
  });
});

/**
 * El foco y la marca de la sección, que la verificación del 2026-09-29
 * encontró sin probar aquí (el trinquete de cobertura estaba en rojo). En
 * e2e/isla.spec.ts se prueban con Chromium de verdad; aquí, cada rama con
 * medidas puestas a mano, que es lo que el navegador no deja forzar.
 */
describe('NavIsland: el foco del teclado', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('el tabulador la abre; el foco que deja un toque, no', () => {
    const { isla, enlace } = montar();
    const matches = Element.prototype.matches;
    const espia = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, s: string) {
      return s === ':focus-visible' ? false : matches.call(this, s);
    });
    enlace.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(abierta(isla), 'el foco de un toque la abrió: el clic de detrás la cerraría').toBe(false);
    espia.mockRestore();
    enlace.focus();
    expect(abierta(isla)).toBe(true);
  });

  it('moverse dentro la deja abierta; salir del todo la cierra', () => {
    const { isla, boton, enlace, fuera } = montar();
    boton.click();
    boton.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: enlace }));
    expect(abierta(isla)).toBe(true);
    enlace.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: fuera }));
    expect(abierta(isla)).toBe(false);
    boton.click();
    // Sin destino: el foco se fue de la ventana, o a nada que se pueda tocar.
    boton.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(abierta(isla)).toBe(false);
  });
});

describe('NavIsland: dónde estás', () => {
  const ALTO = 1000; // la línea de lectura cae en el 40 %: 400
  let scrollY = 0;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(ALTO);
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY);
    scrollY = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  /** Pone la sección entre `top` y `bottom` respecto a la ventana. */
  const caja = (el: HTMLElement, top: number, bottom: number): void => {
    el.getBoundingClientRect = () => ({ top, bottom }) as DOMRect;
  };

  function montarSecciones(conCabecera: boolean) {
    const nav = `
      <nav class="nav-island">
        <button type="button" class="nav-island-toggle"></button>
        ${conCabecera ? '<span data-nav-lugar></span>' : ''}
        <a class="nav-link" href="#uno">Uno</a>
        <a class="nav-island-cta" href="#dos" data-lugar="La sección dos">Ver la dos</a>
        <a class="nav-link" href="#sin-seccion">Huérfano</a>
      </nav>`;
    document.body.innerHTML = `
      ${conCabecera ? `<header class="site-header">${nav}</header>` : nav}
      <section id="uno"></section><section id="dos"></section>`;
    const uno = document.getElementById('uno')!;
    const dos = document.getElementById('dos')!;
    caja(uno, -200, 450);
    caja(dos, 450, 1400);
    const isla = document.querySelector<HTMLElement>('.nav-island')!;
    new NavIsland(isla, isla.querySelector('button')!);
    const [aUno, aDos] = isla.querySelectorAll<HTMLAnchorElement>('a');
    return { uno, dos, aUno, aDos, lugar: isla.querySelector<HTMLElement>('[data-nav-lugar]') };
  }

  const desplazar = (y: number): void => {
    scrollY = y;
    // Dos avisos en el mismo cuadro: se lee una sola vez.
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersToNextFrame();
  };

  it('marca la sección que cruza el 40 % y la escribe en la barra plegada', () => {
    const { uno, dos, aUno, aDos, lugar } = montarSecciones(true);
    const cabecera = document.querySelector('.site-header')!;
    expect(aUno.getAttribute('aria-current')).toBe('location');
    expect(aDos.hasAttribute('aria-current')).toBe(false);
    expect(lugar!.textContent, 'sin data-lugar va el texto del enlace').toBe('Uno');
    expect(cabecera.classList.contains('is-arriba')).toBe(true);

    caja(uno, -900, -250);
    caja(dos, -250, 700);
    desplazar(700);
    expect(aUno.hasAttribute('aria-current')).toBe(false);
    expect(aDos.getAttribute('aria-current')).toBe('location');
    expect(lugar!.textContent, 'con data-lugar va ese').toBe('La sección dos');
    expect(cabecera.classList.contains('is-arriba')).toBe(false);

    // En el pie no manda ninguna: la barra se queda sin marca.
    caja(dos, -1500, 100);
    desplazar(2200);
    expect(document.querySelector('[aria-current]')).toBeNull();
    expect(lugar!.textContent).toBe('');
  });

  it('sin cabecera ni rótulo también marca: la línea no depende de ellos', () => {
    const { uno, dos, aUno, aDos } = montarSecciones(false);
    expect(aUno.getAttribute('aria-current')).toBe('location');
    caja(uno, -900, -250);
    caja(dos, -250, 700);
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersToNextFrame();
    expect(aDos.getAttribute('aria-current')).toBe('location');
  });
});
