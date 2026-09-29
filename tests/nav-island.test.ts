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
