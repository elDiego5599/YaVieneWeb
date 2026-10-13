import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Problema } from '../src/problema';

/**
 * Lo que «Qué resuelve» calcula con el ancho: el recorte de la píldora,
 * el alto común de los avisos, adónde va cada uno en la fila, cuánto sube
 * la píldora y los hilos. El DOM de prueba no maqueta, así que se le pone
 * una escena de medidas conocidas y las cuentas se hacen a mano:
 *
 *   escena 400×300 · píldora 100×30 en (150, 20) · avisos de 100 de ancho
 *   y 40 de alto, en las cuatro esquinas: (10,10) (290,10) (10,250) (290,250)
 *   · bajada 104 → la píldora sube a round((300 − (30+104+40)) / 2) = 63,
 *     o sea 43 px, y la fila queda en y = 63+30+104 = 197, x = 0,100,200,300.
 */

const seccionHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8').match(
  /<section[^>]*id="problema"[\s\S]*?<\/section>/
)![0];

let medir: () => void;
let fuentes: Promise<void>;

const seccion = (): HTMLElement => document.querySelector<HTMLElement>('#problema')!;
const estado = (): HTMLElement => seccion().querySelector<HTMLElement>('.escenario-estado')!;
const avisos = (): HTMLElement[] => Array.from(seccion().querySelectorAll<HTMLElement>('.aviso'));
const red = (): SVGSVGElement => seccion().querySelector<SVGSVGElement>('.escenario-red')!;
const lista = (): HTMLElement => seccion().querySelector<HTMLElement>('.avisos')!;
const nHilos = (sel: string): number => red().querySelectorAll(`path${sel}`).length;

const poner = (el: Element, medidas: Record<string, number>): void => {
  for (const [k, v] of Object.entries(medidas)) Object.defineProperty(el, k, { value: v, configurable: true });
};

const ciegas = [
  [10, 10],
  [290, 10],
  [10, 250],
  [290, 250],
];
let estilos: Map<Element, Record<string, string>>;
let altos: number[];

/** Pone la escena de arriba; `altos` son los offsetHeight de los avisos. */
function maquetar(): void {
  const escena = red().parentElement!;
  poner(escena, { clientWidth: 400, clientHeight: 300 });
  const celda = estado().parentElement!;
  poner(celda, { offsetLeft: 0, offsetTop: 0 });
  poner(estado(), { offsetLeft: 150, offsetTop: 20, offsetWidth: 100, offsetHeight: 30 });
  poner(estado().querySelector('.cara--claro')!, { offsetWidth: 60 });
  estilos.set(estado(), { paddingLeft: '10px', paddingRight: '10px' });
  estilos.set(red(), { display: 'block' });
  avisos().forEach((a, i) => {
    poner(a, { offsetHeight: altos[i] });
    estilos.set(a, { left: `${ciegas[i][0]}px`, top: `${ciegas[i][1]}px`, width: '100px', height: '40px' });
  });
}

beforeEach(() => {
  document.body.innerHTML = seccionHtml;
  estilos = new Map();
  altos = [40, 60, 50, 40];
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    (el: Element) => (estilos.get(el) ?? original(el)) as unknown as CSSStyleDeclaration
  );
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver = class {
    constructor(cb: () => void) { medir = cb; }
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  fuentes = Promise.resolve();
  Object.defineProperty(document, 'fonts', { value: { ready: fuentes }, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lo que depende del ancho', () => {
  beforeEach(() => {
    maquetar();
    new Problema(seccion());
    medir();
  });

  it('cierra el recorte de la píldora a lo que sobra de «Ya Viene» con su aire', () => {
    // 100 − 60 − 10 − 10 = 20 sobran, 10 a cada lado.
    expect(estado().style.getPropertyValue('--recorte')).toBe('10px');
  });

  it('nunca da un recorte negativo', () => {
    poner(estado().querySelector('.cara--claro')!, { offsetWidth: 90 });
    medir();
    expect(estado().style.getPropertyValue('--recorte')).toBe('0px');
  });

  it('iguala los cuatro avisos al alto del más alto', () => {
    expect(lista().style.getPropertyValue('--alto-aviso')).toBe('60px');
  });

  it('sin altura medible no fija el mínimo y quita el anterior', () => {
    altos = [0, 0, 0, 0];
    maquetar();
    medir();
    expect(lista().style.getPropertyValue('--alto-aviso')).toBe('');
  });

  it('manda cada aviso a su puesto de la fila y sube la píldora', () => {
    expect(avisos().map((a) => a.style.getPropertyValue('--fila'))).toEqual([
      '-10px 187px',
      '-190px 187px',
      '190px -53px',
      '10px -53px',
    ]);
    expect(estado().style.getPropertyValue('--subida')).toBe('43px');
  });

  it('da turno 0 a los avisos de dentro y 1 a los de fuera', () => {
    expect(avisos().map((a) => a.style.getPropertyValue('--orden'))).toEqual(['1', '0', '0', '1']);
  });

  it('dibuja los hilos en el lienzo de la escena', () => {
    expect(red().getAttribute('viewBox')).toBe('0 0 400 300');
    expect(nHilos('.hilo--enredo')).toBe(7);
    // Por rama: tronco, codo, viga, codo y bajada.
    expect(nHilos('.tramo--tronco')).toBe(4);
    expect(nHilos('.tramo--codo')).toBe(8);
    expect(nHilos('.tramo--viga')).toBe(4);
    expect(nHilos('.tramo--bajada')).toBe(4);
    // El segundo codo de cada rama es la rodilla; la viga de dos ramas va hacia la izquierda.
    expect(nHilos('.tramo--rodilla')).toBe(4);
    expect(nHilos('.tramo--viga.tramo--izq')).toBe(2);
  });

  it('cada pieza del árbol lleva el turno de su aviso', () => {
    const turnos = [...red().querySelectorAll<SVGPathElement>('.hilo--arbol')].map((p) => p.style.getPropertyValue('--orden'));
    expect(turnos).toEqual([...Array(5).fill('1'), ...Array(5).fill('0'), ...Array(5).fill('0'), ...Array(5).fill('1')]);
  });

  it('al volver a medir reutiliza los hilos en vez de apilar otros', () => {
    medir();
    medir();
    expect(red().querySelectorAll('path')).toHaveLength(27);
  });

  it('traza también cuando la tipografía acaba de cargar', async () => {
    red().replaceChildren();
    estado().style.removeProperty('--recorte');
    new Problema(seccion());
    await fuentes;
    expect(estado().style.getPropertyValue('--recorte')).toBe('10px');
  });
});

describe('cuando el lienzo no se dibuja o falta una pieza', () => {
  it('bajo 1024 (lienzo oculto) deja el recorte y el alto pero ni fila ni hilos', () => {
    maquetar();
    estilos.set(red(), { display: 'none' });
    new Problema(seccion());
    medir();
    expect(estado().style.getPropertyValue('--recorte')).toBe('10px');
    expect(lista().style.getPropertyValue('--alto-aviso')).toBe('60px');
    expect(avisos()[0].style.getPropertyValue('--fila')).toBe('');
    expect(red().querySelectorAll('path')).toHaveLength(0);
    expect(red().hasAttribute('viewBox')).toBe(false);
  });

  it('si la lista de avisos no se encuentra, traza igual lo demás', () => {
    maquetar();
    lista().classList.remove('avisos');
    new Problema(seccion());
    medir();
    expect(estado().style.getPropertyValue('--subida')).toBe('43px');
    expect(red().querySelectorAll('path')).toHaveLength(27);
  });

  it('sin la cara clara en la píldora, todo su ancho menos el aire sobra', () => {
    maquetar();
    estado().querySelector('.cara--claro')!.remove();
    new Problema(seccion());
    medir();
    // (100 − 0 − 20) / 2
    expect(estado().style.getPropertyValue('--recorte')).toBe('40px');
  });

  it('sin píldora no hay nada que trazar', () => {
    estado().remove();
    new Problema(seccion());
    expect(() => medir()).not.toThrow();
    expect(red().querySelectorAll('path')).toHaveLength(0);
  });

  it('sin la tipografía del navegador (document.fonts) no revienta', () => {
    Object.defineProperty(document, 'fonts', { value: undefined, configurable: true });
    expect(() => new Problema(seccion())).not.toThrow();
  });
});
