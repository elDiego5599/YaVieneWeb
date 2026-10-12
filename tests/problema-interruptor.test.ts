import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Problema } from '../src/problema';

/**
 * El interruptor de «Qué resuelve» y lo que se mueve al pulsarlo: el
 * control responde en el acto, la escena entera cuelga de `data-cara` (el
 * CSS la ordena en su sitio, `problema-ceremonia.test.ts`) y quien pidió
 * que nada se mueva sólo ve un fundido. Se mira qué se anima, no cómo se ve.
 */

const leer = (nombre: string): string => readFileSync(resolve(process.cwd(), nombre), 'utf8');
const seccionHtml = leer('index.html').match(/<section[^>]*id="problema"[\s\S]*?<\/section>/)![0];
const css = leer('src/css/componentes/problema.css');
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

let animadas = 0;
let reducido = false;

const seccion = (): HTMLElement => document.querySelector<HTMLElement>('#problema')!;
const boton = (cara: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`.interruptor-opcion[data-cara="${cara}"]`)!;

beforeEach(() => {
  vi.useFakeTimers();
  animadas = 0;
  reducido = false;
  document.body.innerHTML = seccionHtml;
  // Si algo volviera a animarse desde aquí, se cuenta.
  Element.prototype.animate = function () {
    animadas += 1;
    return { cancel() {} } as unknown as Animation;
  } as typeof Element.prototype.animate;
  window.matchMedia = ((q: string) => ({
    matches: reducido && q.includes('reduce'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof IntersectionObserver;
  new Problema(seccion());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('el interruptor responde en el acto', () => {
  it('aria-pressed, el control y la escena cambian con el toque', () => {
    boton('claro').click();
    expect(boton('claro').getAttribute('aria-pressed')).toBe('true');
    expect(boton('ciego').getAttribute('aria-pressed')).toBe('false');
    expect(seccion().dataset.pulsado).toBe('claro');
    // Sin ceremonia que esperar: la escena se ordena desde el primer cuadro.
    expect(seccion().dataset.cara).toBe('claro');
    expect(animadas).toBe(0);
  });

  it('cortar a media escena es volver a cambiar el atributo, en el acto', () => {
    boton('claro').click();
    vi.advanceTimersByTime(300);
    boton('ciego').click();
    expect(seccion().dataset.cara).toBe('ciego');
    expect(seccion().dataset.pulsado).toBe('ciego');
    expect(seccion().querySelector('.seccion-titulo .cara--claro')?.getAttribute('aria-hidden')).toBe('true');
    expect(animadas).toBe(0);
  });

  it('la marca se mueve con el control, no con la cara de la escena', () => {
    expect(sinComentarios).toMatch(/\[data-pulsado='claro'\] \.interruptor-marca\s*\{[^}]*translateX\(100%\)/);
    expect(sinComentarios).not.toMatch(/\[data-cara='claro'\] \.interruptor-marca/);
  });

  it('al apoyar el dedo la opción acusa el toque en 90 ms', () => {
    const activo = sinComentarios.match(/\.interruptor-opcion:active\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(activo).toMatch(/opacity:\s*0?\.7/);
    expect(activo).toMatch(/90ms/);
  });

  it('la píldora toma su forma sin tocar el layout: ni width ni padding animados', () => {
    const transicion = sinComentarios.match(/\n\.escenario-estado\s*\{[^}]*transition:[^}]*\}/)![0];
    expect(transicion).not.toMatch(/\bwidth\s+0?\.\d/);
    expect(transicion).not.toMatch(/\bpadding\s+0?\.\d/);
    expect(sinComentarios).toMatch(/clip-path:\s*inset\(/);
  });
});

describe('quien pidió que nada se mueva', () => {
  it('no ve volar nada ni a la ida ni a la vuelta, y la cara cambia igual', () => {
    reducido = true;
    boton('claro').click();
    expect(seccion().dataset.cara).toBe('claro');
    boton('ciego').click();
    expect(seccion().dataset.cara).toBe('ciego');
    expect(animadas).toBe(0);
  });

  it('las caras se cruzan con un fundido corto, sin desplazarse', () => {
    const reducida = sinComentarios.slice(sinComentarios.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducida).toMatch(/\.cara\s*\{[^}]*--reposo:\s*0/);
    expect(reducida).toMatch(/\.cara\s*\{[^}]*transition:[^;}]*opacity 0?\.2s/);
  });
});

describe('los avisos: el título manda sobre la frase', () => {
  const peso = (sel: string): number =>
    Number(sinComentarios.match(new RegExp(`\\n\\${sel}\\s*\\{[^}]*font-weight:\\s*(\\d+)`))?.[1] ?? 400);
  it('el título pesa más que la frase y va en tinta plena', () => {
    expect(peso('.aviso-titulo')).toBeGreaterThan(peso('.aviso-frase'));
    const titulo = sinComentarios.match(/\n\.aviso-titulo\s*\{([^}]*)\}/)![1];
    expect(titulo).toMatch(/color:\s*var\(--tinta\)/);
    expect(titulo).not.toMatch(/font-size:\s*13px/);
  });
});
