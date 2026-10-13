import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Problema } from '../src/problema';

/**
 * El aviso de cortesía de «Qué resuelve»: la primera vez que la sección
 * asoma se cambia sola de lado tras 2,4 s; si se va antes, se deshace la
 * cuenta y vuelve al problema; quien toque el interruptor lo apaga.
 */

const seccionHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').match(
  /<section[^>]*id="problema"[\s\S]*?<\/section>/
)![0];

type Entrada = { isIntersecting: boolean; intersectionRatio: number; intersectionRect: { height: number } };
let avisar: (entradas: Entrada[]) => void;
let desconectado = 0;

const seccion = (): HTMLElement => document.querySelector<HTMLElement>('#problema')!;
const boton = (cara: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`.interruptor-opcion[data-cara="${cara}"]`)!;
const ver = (ratio: number, altoVisible = 0, dentro = true): void =>
  avisar([{ isIntersecting: dentro, intersectionRatio: ratio, intersectionRect: { height: altoVisible } }]);

beforeEach(() => {
  vi.useFakeTimers();
  desconectado = 0;
  document.body.innerHTML = seccionHtml;
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver = class {
    constructor(cb: (e: Entrada[]) => void) { avisar = cb; }
    observe() {}
    disconnect() { desconectado += 1; }
    unobserve() {}
  } as unknown as typeof IntersectionObserver;
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  new Problema(seccion());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('el cambio automático al asomar', () => {
  it('con el 70% a la vista, a los 2,4 s enseña la otra cara', () => {
    ver(0.7);
    vi.advanceTimersByTime(2399);
    expect(seccion().dataset.cara).toBe('ciego');
    vi.advanceTimersByTime(1);
    expect(seccion().dataset.cara).toBe('claro');
    expect(seccion().dataset.pulsado).toBe('claro');
  });

  it('una sección más alta que la ventana vale con ocupar el 60% de ella', () => {
    ver(0.3, 480); // 480 = 60% de 800
    vi.advanceTimersByTime(2400);
    expect(seccion().dataset.cara).toBe('claro');
  });

  it('con poco a la vista y poco alto no cuenta como mirada', () => {
    ver(0.3, 479);
    vi.advanceTimersByTime(5000);
    expect(seccion().dataset.cara).toBe('ciego');
  });

  it('fuera de la ventana no cuenta, aunque el cociente sea alto', () => {
    ver(1, 800, false);
    vi.advanceTimersByTime(5000);
    expect(seccion().dataset.cara).toBe('ciego');
  });

  it('volver a asomar con la cuenta en marcha no la reinicia', () => {
    ver(0.8);
    vi.advanceTimersByTime(2000);
    ver(0.9);
    vi.advanceTimersByTime(400);
    expect(seccion().dataset.cara).toBe('claro');
  });

  it('irse antes de tiempo deshace la cuenta', () => {
    ver(0.8);
    vi.advanceTimersByTime(1000);
    ver(0.1, 0, false);
    vi.advanceTimersByTime(5000);
    expect(seccion().dataset.cara).toBe('ciego');
  });

  it('irse después del cambio devuelve el problema', () => {
    ver(0.8);
    vi.advanceTimersByTime(2400);
    expect(seccion().dataset.cara).toBe('claro');
    ver(0.15, 0, false);
    expect(seccion().dataset.cara).toBe('ciego');
    expect(boton('ciego').getAttribute('aria-pressed')).toBe('true');
  });

  it('entre el 15% y el umbral de mirada ni cuenta ni rebobina', () => {
    ver(0.8);
    vi.advanceTimersByTime(2400);
    ver(0.5, 100);
    expect(seccion().dataset.cara).toBe('claro');
  });

  it('un toque durante la cuenta la cancela y apaga el observador', () => {
    ver(0.8);
    vi.advanceTimersByTime(1000);
    boton('claro').click();
    expect(desconectado).toBe(1);
    boton('ciego').click();
    vi.advanceTimersByTime(5000);
    expect(seccion().dataset.cara).toBe('ciego');
  });

  it('un toque sin cuenta en marcha también apaga el observador', () => {
    boton('claro').click();
    expect(desconectado).toBe(1);
  });
});
