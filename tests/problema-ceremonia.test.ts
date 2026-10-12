import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Problema } from '../src/problema';

/**
 * La ceremonia de «Qué resuelve» (2026-10-12): los cuatro avisos se
 * aspiran hacia la píldora como los rayos y las voces, y brotan desde ella
 * hasta su fila. Se mira qué elementos vuelan en cada fase, no cómo.
 */

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const seccion = html.match(/<section[^>]*id="problema"[\s\S]*?<\/section>/)![0];

type Vuelo = { el: Element; keyframes: Keyframe[]; opciones: KeyframeAnimationOptions };
let vuelos: Vuelo[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vuelos = [];
  document.body.innerHTML = seccion;
  // Una caja con tamaño para todos: lo que no se dibuja (0×0) no vuela.
  Element.prototype.getBoundingClientRect = function () {
    return { x: 10, y: 10, width: 100, height: 40, top: 10, left: 10, right: 110, bottom: 50 } as DOMRect;
  };
  Element.prototype.animate = function (this: Element, keyframes: Keyframe[], opciones: KeyframeAnimationOptions) {
    vuelos.push({ el: this, keyframes, opciones });
    return { cancel: () => {} } as Animation;
  } as typeof Element.prototype.animate;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof IntersectionObserver;
  const el = document.querySelector<HTMLElement>('#problema')!;
  new Problema(el);
  document.querySelector<HTMLButtonElement>('.interruptor-opcion[data-cara="claro"]')!.click();
});

afterEach(() => vi.useRealTimers());

const avisos = (): Vuelo[] => vuelos.filter((v) => v.el.classList.contains('aviso'));
const cabeza = (): Vuelo[] => vuelos.filter((v) => v.el.matches('.seccion-cabecera .dos-caras'));
const seccionEl = (): HTMLElement => document.querySelector<HTMLElement>('#problema')!;
/** Avanza el reloj hasta que la ceremonia llega a `fase` (no ata el test a los milisegundos). */
const hasta = (fase: string): void => {
  for (let i = 0; i < 400 && seccionEl().dataset.fase !== fase; i++) vi.advanceTimersByTime(10);
};

describe('la ceremonia de «Qué resuelve»', () => {
  it('en aspira los cuatro avisos vuelan al núcleo y acaban sin tamaño ni opacidad', () => {
    const v = avisos();
    expect(v).toHaveLength(4);
    for (const { keyframes } of v) {
      const ultimo = keyframes[keyframes.length - 1];
      expect(String(ultimo.transform)).toMatch(/scale\(0\.0/);
      expect(ultimo.opacity).toBe(0);
    }
  });

  it('en brota los cuatro avisos salen de la píldora, escalonados, y acaban a tamaño completo', () => {
    vuelos = [];
    hasta('brota');
    const v = avisos();
    expect(v).toHaveLength(4);
    const retardos = v.map((x) => Number(x.opciones.delay));
    expect(retardos).toEqual([...retardos].sort((a, b) => a - b));
    expect(new Set(retardos).size).toBe(4);
    for (const { keyframes } of v) {
      expect(String(keyframes[0].transform)).toMatch(/scale\(0\.0/);
      expect(keyframes[0].opacity).toBe(0);
      expect(keyframes[keyframes.length - 1].opacity).toBe(1);
    }
  });

  it('en aspira el titular y el párrafo vuelan al núcleo y acaban sin tamaño ni opacidad', () => {
    const v = cabeza();
    expect(v.map((x) => x.el.tagName).sort()).toEqual(['H2', 'P']);
    for (const { keyframes } of v) {
      const ultimo = keyframes[keyframes.length - 1];
      expect(String(ultimo.transform)).toMatch(/scale\(0\.0/);
      expect(ultimo.opacity).toBe(0);
    }
  });

  it('el interruptor no se traga', () => {
    expect(vuelos.some((v) => v.el.closest('.interruptor'))).toBe(false);
  });

  it('en brota el titular y el párrafo salen de la píldora, antes que los avisos, y acaban enteros', () => {
    vuelos = [];
    hasta('brota');
    const v = cabeza();
    expect(v).toHaveLength(2);
    for (const { keyframes } of v) {
      expect(String(keyframes[0].transform)).toMatch(/scale\(0\.0/);
      expect(keyframes[0].opacity).toBe(0);
      expect(keyframes[keyframes.length - 1].opacity).toBe(1);
    }
    const primerAviso = Math.min(...avisos().map((x) => Number(x.opciones.delay)));
    expect(Math.max(...v.map((x) => Number(x.opciones.delay)))).toBeLessThan(primerAviso);
  });

  it('el tragar es suave: viajes largos, aceleración progresiva y el fundido al final del viaje', () => {
    for (const { keyframes, opciones } of [...avisos(), ...cabeza()]) {
      expect(Number(opciones.duration)).toBeGreaterThanOrEqual(700);
      expect(opciones.easing).not.toBe('linear');
      // Antes del último cuadro la pieza sigue visible y con tamaño.
      const previo = keyframes[keyframes.length - 2];
      expect(Number(previo.opacity)).toBeGreaterThanOrEqual(0.5);
      expect(String(previo.transform)).not.toMatch(/scale\(0\.0/);
    }
  });

  it('la ceremonia entera dura a lo sumo 2,8 s y acaba en reposo', () => {
    vi.advanceTimersByTime(2800);
    expect(seccionEl().dataset.fase).toBe('reposo');
  });
});
