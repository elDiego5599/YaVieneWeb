import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Problema } from '../src/problema';

/**
 * «Ordenarse en su sitio» (dueño, 2026-10-12), como el diagrama de
 * Problem/Solution de incident.io: nada se aspira ni vuela al centro. El
 * ruido se apaga donde está, la alerta roja se vuelve la píldora verde en
 * su sitio, los avisos se enderezan y se deslizan a su fila de la píldora
 * hacia fuera y el árbol crece a su paso. Todo son transiciones de CSS
 * colgadas de `data-cara`, que es lo que hace que un corte arranque de lo
 * que se ve: el navegador las retoma desde el valor presente.
 *
 * Se leen las transiciones del CSS y se echan las cuentas (cuándo acaba
 * cada cosa, a cuántos px por cuadro va lo que más corre), no se mira
 * cómo se ve: eso se mide en el navegador.
 */

const leer = (nombre: string): string => readFileSync(resolve(process.cwd(), nombre), 'utf8');
const html = leer('index.html');
const seccionHtml = html.match(/<section[^>]*id="problema"[\s\S]*?<\/section>/)![0];
const css = leer('src/css/componentes/problema.css').replace(/\/\*[\s\S]*?\*\//g, '');
const ts = leer('src/problema.ts');

/** El bloque entero de una regla @ (con sus llaves anidadas). */
const bloque = (cabeza: string): string => {
  const i = css.indexOf(cabeza);
  expect(i, cabeza).toBeGreaterThanOrEqual(0);
  let nivel = 0;
  for (let j = css.indexOf('{', i); j < css.length; j++) {
    if (css[j] === '{') nivel++;
    else if (css[j] === '}' && --nivel === 0) return css.slice(css.indexOf('{', i) + 1, j);
  }
  throw new Error(`sin cerrar: ${cabeza}`);
};
const ancho = bloque('@media (min-width: 1024px)');
/** Lo de fuera de toda regla @: lo que vale a cualquier ancho. */
const base = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

type Regla = { sel: string; cuerpo: string };
const reglas = (texto: string): Regla[] =>
  [...texto.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), cuerpo: m[2] }));
const de = (texto: string, sel: string): string =>
  reglas(texto)
    .filter((r) => r.sel.split(',').map((s) => s.trim()).includes(sel))
    .map((r) => r.cuerpo)
    .join('\n');

type Transicion = { prop: string; dur: string; curva: string; retardo: string };
const transiciones = (cuerpo: string): Transicion[] => {
  const valor = cuerpo.match(/(?:^|[;\s])transition:\s*([^;]+);?/)?.[1];
  if (!valor) return [];
  return partir(valor, ',').map((p) => {
    const trozos = partir(p, ' ').filter(Boolean);
    return { prop: trozos[0], dur: trozos[1], curva: trozos[2] ?? 'ease', retardo: trozos[3] ?? '0ms' };
  });
};
/** Parte por `sep` sólo en el primer nivel: lo de dentro de cubic-bezier() y calc() no cuenta. */
const partir = (texto: string, sep: string): string[] => {
  const partes: string[] = [];
  let nivel = 0;
  let actual = '';
  for (const c of texto.trim()) {
    if (c === '(') nivel++;
    if (c === ')') nivel--;
    if (c === sep && nivel === 0) {
      partes.push(actual.trim());
      actual = '';
    } else actual += c;
  }
  partes.push(actual.trim());
  return partes;
};
/** Un tiempo de CSS en ms, con `--orden` puesto (0, el aviso de dentro; 1, el de fuera). */
const ms = (t: string, orden: number): number => {
  const e = t
    .replace(/var\(--orden(?:,\s*0)?\)/g, String(orden))
    .replace(/calc/g, '')
    .replace(/(\d*\.?\d+)ms/g, '$1')
    .replace(/(\d*\.?\d+)s\b/g, '($1*1000)');
  return Number(Function(`return (${e})`)());
};
const fin = (t: Transicion, orden: number): number => ms(t.retardo, orden) + ms(t.dur, orden);

/** Arranque y pico de una cubic-bezier, en múltiplos de la velocidad media. */
const pendientes = (curva: string): { arranque: number; pico: number; puntos: number[] } => {
  const puntos = curva.match(/cubic-bezier\(([^)]+)\)/)![1].split(',').map(Number);
  const [x1, y1, x2, y2] = puntos;
  const bz = (a: number, b: number, t: number): number => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let pico = 0;
  let arranque = 0;
  for (let i = 0; i < 2000; i++) {
    const [t0, t1] = [i / 2000, (i + 1) / 2000];
    const dx = bz(x1, x2, t1) - bz(x1, x2, t0);
    const m = dx > 1e-9 ? (bz(y1, y2, t1) - bz(y1, y2, t0)) / dx : 0;
    if (i === 0) arranque = m;
    pico = Math.max(pico, m);
  }
  return { arranque, pico, puntos };
};
/** El cuadro más rápido (60 Hz) de una pieza que recorre `px` con esta transición. */
const pxPorCuadro = (t: Transicion, px: number): number => (pendientes(t.curva).pico * px) / ms(t.dur, 0) * (1000 / 60);

const ida = (sel: string): Transicion[] => transiciones(de(ancho, `[data-cara='claro'] ${sel}`));
const vuelta = (sel: string): Transicion[] => transiciones(de(ancho, sel));
const prop = (lista: Transicion[], p: string): Transicion => {
  const t = lista.find((x) => x.prop === p);
  expect(t, p).toBeDefined();
  return t!;
};

/** Lo que se mueve en la escena: todo lo que cambia entre una cara y otra a ≥ 1024. */
const PIEZAS = ['.aviso', '.escenario-estado', '.escenario-estado::before', '.chispa', '.ruido', '.hilo--enredo', '.tramo--tronco', '.tramo--codo', '.tramo--viga', '.tramo--rodilla', '.tramo--bajada'];

describe('nada se aspira: la ceremonia vieja no deja rastro', () => {
  it('ni núcleo ni halo en el HTML; ni fases ni keyframes en el CSS; ni vuelos en el TS', () => {
    expect(seccionHtml).not.toMatch(/estado-nucleo|estado-halo/);
    expect(css).not.toMatch(/estado-nucleo|estado-halo|data-fase|@keyframes/);
    expect(ts).not.toMatch(/dataset\.fase|\.animate\(|remolino|aspira|brota/i);
  });
});

describe('cada pieza se ordena en su sitio', () => {
  it('el ruido se apaga donde está: opacidad y un poco de escala, sin desplazarse', () => {
    for (const sel of ['.chispa', '.ruido']) {
      const claro = de(css, `[data-cara='claro'] ${sel}`);
      expect(claro, sel).toMatch(/opacity:\s*0\b/);
      const escala = Number(claro.match(/(?:^|[;\s])scale:\s*(\d*\.?\d+)/)?.[1]);
      expect(escala).toBeGreaterThanOrEqual(0.85);
      expect(escala).toBeLessThan(1);
      expect(claro).not.toMatch(/translate/);
    }
  });

  it('la alerta se vuelve la píldora en su sitio: el verde entra encima del rojo y el recorte toma su forma', () => {
    const claro = de(ancho, "[data-cara='claro'] .escenario-estado");
    expect(claro).toMatch(/translate:\s*0 var\(--subida/);
    expect(claro).toMatch(/rotate:\s*0deg/);
    // La forma, a cualquier ancho: el recorte se cierra a lo que mide «Ya Viene».
    expect(de(css, "[data-cara='claro'] .escenario-estado")).toMatch(/clip-path:\s*inset\(0 var\(--recorte/);
    expect(de(css, '.escenario-estado::before')).toMatch(/background:\s*var\(--acento\)/);
    expect(de(css, '.escenario-estado::before')).toMatch(/opacity:\s*0\b/);
    expect(de(css, "[data-cara='claro'] .escenario-estado::before")).toMatch(/opacity:\s*1\b/);
    // Sólo compositor: ni color, ni sombra, ni tamaño animados.
    for (const t of [...transiciones(de(css, '.escenario-estado')), ...vuelta('.escenario-estado'), ...ida('.escenario-estado')]) {
      expect(['translate', 'rotate', 'clip-path']).toContain(t.prop);
    }
    for (const t of [...transiciones(de(css, '.escenario-estado::before')), ...vuelta('.escenario-estado::before'), ...ida('.escenario-estado::before')]) {
      expect(t.prop).toBe('opacity');
    }
  });

  it('los avisos se enderezan y se deslizan a su fila, de la píldora hacia fuera; a la vuelta, de fuera hacia dentro', () => {
    expect(de(ancho, "[data-cara='claro'] .aviso")).toMatch(/translate:\s*var\(--fila\)[^}]*rotate:\s*0deg/);
    const [va, vuelve] = [prop(ida('.aviso'), 'translate'), prop(vuelta('.aviso'), 'translate')];
    expect(ms(va.retardo, 1)).toBeGreaterThan(ms(va.retardo, 0));
    expect(ms(vuelve.retardo, 0)).toBeGreaterThan(ms(vuelve.retardo, 1));
    // Enderezarse va con el viaje, no aparte.
    expect(prop(ida('.aviso'), 'rotate')).toEqual({ ...va, prop: 'rotate' });
    expect(prop(vuelta('.aviso'), 'rotate')).toEqual({ ...vuelve, prop: 'rotate' });
  });

  it('el árbol crece al paso de los avisos: tronco, luego viga, luego la bajada, que llega con su aviso', () => {
    expect(de(css, '.tramo')).toMatch(/transform-box:\s*fill-box/);
    expect(de(ancho, '.tramo--tronco')).toMatch(/scale:\s*1 0/);
    expect(de(ancho, '.tramo--bajada')).toMatch(/scale:\s*1 0/);
    expect(de(ancho, '.tramo--viga')).toMatch(/scale:\s*0 1/);
    expect(de(ancho, '.tramo--codo')).toMatch(/opacity:\s*0\b/);
    for (const sel of ['.tramo--tronco', '.tramo--viga', '.tramo--bajada']) {
      expect(de(ancho, `[data-cara='claro'] ${sel}`), sel).toMatch(/scale:\s*1\b/);
    }
    for (const orden of [0, 1]) {
      const [tronco, viga, bajada] = ['.tramo--tronco', '.tramo--viga', '.tramo--bajada'].map((s) => prop(ida(s), 'scale'));
      expect(ms(viga.retardo, orden)).toBeGreaterThanOrEqual(fin(tronco, orden) - 20);
      expect(ms(bajada.retardo, orden)).toBeGreaterThanOrEqual(fin(viga, orden) - 20);
      expect(Math.abs(fin(bajada, orden) - fin(prop(ida('.aviso'), 'translate'), orden))).toBeLessThanOrEqual(20);
      // Y a la vuelta, al revés: la bajada se recoge antes que la viga, y ésta antes que el tronco.
      const [t2, v2, b2] = ['.tramo--tronco', '.tramo--viga', '.tramo--bajada'].map((s) => prop(vuelta(s), 'scale'));
      expect(ms(v2.retardo, orden)).toBeGreaterThanOrEqual(fin(b2, orden) - 20);
      expect(ms(t2.retardo, orden)).toBeGreaterThanOrEqual(fin(v2, orden) - 20);
    }
  });

  it('la cabecera cruza en el sitio: 6 px como mucho y la nueva entra mientras la vieja se va', () => {
    for (const sel of ['#problema .seccion-cabecera .cara--ciego', '#problema .seccion-cabecera .cara--claro']) {
      expect(Math.abs(parseFloat(de(ancho, sel).match(/--reposo:\s*(-?\d+)px/)![1])), sel).toBeLessThanOrEqual(6);
    }
    const sale = prop(transiciones(de(ancho, "[data-cara='claro'] .seccion-cabecera .cara--ciego")), 'opacity');
    const entra = prop(transiciones(de(ancho, "[data-cara='claro'] .seccion-cabecera .cara--claro")), 'opacity');
    expect(ms(entra.retardo, 0)).toBeLessThan(fin(sale, 0));
  });
});

describe('los tiempos', () => {
  it('la transición de escritorio gana a la de base: ninguna regla suelta la pisa después', () => {
    // A igual especificidad gana la última: una regla de base con su
    // `transition` detrás del bloque de ≥1024 dejaría la vuelta en el
    // fundido corto y la pieza saltaría de golpe a su sitio.
    const sinNotas = css.replace(/\/\*[\s\S]*?\*\//g, '');
    let fin = sinNotas.indexOf('{', sinNotas.indexOf('@media (min-width: 1024px)'));
    for (let nivel = 0; ; fin++) {
      if (sinNotas[fin] === '{') nivel++;
      if (sinNotas[fin] === '}' && --nivel === 0) break;
    }
    // Lo de después del bloque, sin el de movimiento reducido (que sí manda).
    const despues = sinNotas.slice(fin + 1).split('@media (prefers-reduced-motion')[0];
    for (const s of PIEZAS) {
      const tarde = [...despues.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
        (m) => /transition\s*:/.test(m[2]) && m[1].split(',').map((x) => x.trim()).includes(s)
      );
      expect(tarde.map((m) => m[1].trim()), s).toEqual([]);
    }
  });

  const finIda = (): number =>
    Math.max(...PIEZAS.flatMap((s) => ida(s).flatMap((t) => [fin(t, 0), fin(t, 1)])));
  const finVuelta = (): number =>
    Math.max(...PIEZAS.flatMap((s) => vuelta(s).flatMap((t) => [fin(t, 0), fin(t, 1)])));

  it('la ida dura entre 1,0 y 1,3 s; la vuelta, unos 0,8', () => {
    expect(finIda()).toBeGreaterThanOrEqual(1000);
    expect(finIda()).toBeLessThanOrEqual(1300);
    expect(finVuelta()).toBeGreaterThanOrEqual(700);
    expect(finVuelta()).toBeLessThanOrEqual(850);
  });

  it('siempre hay algo en pantalla: la píldora no se apaga nunca y empieza a cambiar en el primer cuadro', () => {
    expect(de(css, "[data-cara='claro'] .escenario-estado")).not.toMatch(/opacity:\s*0\b/);
    expect(Math.min(...ida('.escenario-estado').map((t) => ms(t.retardo, 0)))).toBe(0);
    // Y algo se mueve también en el primer cuadro de la vuelta.
    expect(Math.min(...PIEZAS.flatMap((s) => vuelta(s).map((t) => Math.min(ms(t.retardo, 0), ms(t.retardo, 1)))))).toBe(0);
  });

  it('sin tirones: cada curva sale de parado y lo que más viaja no pasa de 25 px por cuadro', () => {
    for (const s of PIEZAS) {
      for (const t of [...ida(s), ...vuelta(s)]) {
        if (t.curva.startsWith('cubic-bezier')) expect(pendientes(t.curva).arranque, `${s} ${t.curva}`).toBeLessThan(0.1);
        else expect(t.prop, `${s} ${t.curva}`).toMatch(/opacity|scale/);
      }
    }
    // Del desorden a la fila son hasta ~330 px a 1440; la píldora sube ~150.
    for (const t of [prop(ida('.aviso'), 'translate'), prop(vuelta('.aviso'), 'translate')]) {
      expect(pxPorCuadro(t, 330)).toBeLessThanOrEqual(25);
    }
    for (const t of [prop(ida('.escenario-estado'), 'translate'), prop(vuelta('.escenario-estado'), 'translate')]) {
      expect(pxPorCuadro(t, 150)).toBeLessThanOrEqual(25);
    }
  });

  it('la vuelta va con la curva de la ida espejada', () => {
    const [x1, y1, x2, y2] = pendientes(prop(ida('.aviso'), 'translate').curva).puntos;
    const espejo = pendientes(prop(vuelta('.aviso'), 'translate').curva).puntos;
    expect(espejo.map((n) => +n.toFixed(2))).toEqual([1 - x2, 1 - y2, 1 - x1, 1 - y1].map((n) => +n.toFixed(2)));
  });

  it('por debajo de 1024 las caras sólo se funden, en 200 ms y sin viajar', () => {
    const oculta = de(base, "[data-cara='claro'] .cara--ciego");
    const vista = de(base, "[data-cara='claro'] .cara--claro");
    for (const cuerpo of [oculta, vista]) {
      const lista = transiciones(cuerpo).filter((t) => t.prop !== 'visibility');
      expect(lista.map((t) => [t.prop, ms(t.dur, 0)])).toEqual([['opacity', 200]]);
    }
    expect(de(base, '.cara--ciego')).toMatch(/--reposo:\s*0/);
    expect(de(base, '.cara--claro')).toMatch(/--reposo:\s*0/);
  });
});

describe('lo que pone problema.ts', () => {
  let observadores = 0;
  beforeEach(() => {
    observadores = 0;
    document.body.innerHTML = seccionHtml;
    globalThis.ResizeObserver = class {
      constructor(private cb: () => void) {}
      observe() {
        this.cb();
      }
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
    globalThis.IntersectionObserver = class {
      constructor() {
        observadores++;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof IntersectionObserver;
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    Element.prototype.animate = vi.fn() as unknown as typeof Element.prototype.animate;
  });
  afterEach(() => vi.restoreAllMocks());

  const seccion = (): HTMLElement => document.querySelector<HTMLElement>('#problema')!;
  const boton = (cara: string): HTMLButtonElement =>
    document.querySelector<HTMLButtonElement>(`.interruptor-opcion[data-cara="${cara}"]`)!;
  const fijar = (el: Element, medidas: Record<string, number>): void => {
    for (const [k, v] of Object.entries(medidas)) Object.defineProperty(el, k, { value: v, configurable: true });
  };

  it('el toque cambia la escena en el acto, también a medias, y nada se anima desde JS', () => {
    new Problema(seccion());
    boton('claro').click();
    expect(seccion().dataset.cara).toBe('claro');
    expect(document.querySelector('.seccion-titulo .cara--claro')!.hasAttribute('aria-hidden')).toBe(false);
    expect(document.querySelector('.seccion-titulo .cara--ciego')!.getAttribute('aria-hidden')).toBe('true');
    // Un corte es otro cambio de atributo: el CSS retoma desde lo que se ve.
    boton('ciego').click();
    expect(seccion().dataset.cara).toBe('ciego');
    expect(seccion().dataset.pulsado).toBe('ciego');
    expect(Element.prototype.animate).not.toHaveBeenCalled();
  });

  it('mide la fila, el recorte de la píldora y el orden de cada aviso desde ella', () => {
    const escena = document.querySelector('.escenario')!;
    fijar(escena, { clientWidth: 1096, clientHeight: 460 });
    const pildora = document.querySelector<HTMLElement>('.escenario-estado')!;
    // La celda lleva `position: relative` (su sombra va por encima de los
    // hilos): los `offset*` de la píldora son desde ella, y lo que cuenta
    // es dónde cae en el escenario.
    fijar(pildora.parentElement!, { offsetLeft: 383, offsetTop: 200 });
    fijar(pildora, { offsetLeft: 0, offsetTop: 0, offsetWidth: 330, offsetHeight: 48 });
    pildora.style.padding = '14px 36px';
    fijar(pildora.querySelector('.cara--claro')!, { offsetWidth: 100 });
    const sitios = [[11, 14], [526, 18], [241, 306], [822, 302]];
    document.querySelectorAll<HTMLElement>('.aviso').forEach((aviso, i) => {
      Object.assign(aviso.style, { left: `${sitios[i][0]}px`, top: `${sitios[i][1]}px`, width: '256px', height: '140px' });
    });
    new Problema(seccion());

    // (330 − 100 − 72) / 2: lo que sobra a cada lado de «Ya Viene» con su aire.
    expect(pildora.style.getPropertyValue('--recorte')).toBe('79px');
    const ordenes = [...document.querySelectorAll<HTMLElement>('.aviso')].map((a) => a.style.getPropertyValue('--orden'));
    expect(ordenes).toEqual(['1', '0', '0', '1']);
    // Sube a (460 − (48 + 104 + 140)) / 2 = 84 desde los 200 de la celda.
    expect(pildora.style.getPropertyValue('--subida')).toBe('-116px');
    const tramos = [...document.querySelectorAll<SVGPathElement>('.tramo')];
    expect(tramos).toHaveLength(20);
    for (const t of tramos) expect(['0', '1']).toContain(t.style.getPropertyValue('--orden'));
  });

  it('los cuatro avisos toman el alto del más alto (dueño, 2026-10-12: mismo ancho y alto)', () => {
    const altos = [118, 135, 115, 136];
    document.querySelectorAll<HTMLElement>('.aviso').forEach((aviso, i) => fijar(aviso, { offsetHeight: altos[i] }));
    new Problema(seccion());
    expect(document.querySelector<HTMLElement>('.avisos')!.style.getPropertyValue('--alto-aviso')).toBe('136px');
  });

  it('quien pidió que nada se mueva no ve el cambio solo: no se vigila el asomo', () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    new Problema(seccion());
    expect(observadores).toBe(0);
  });

  it('sin esa petición, sí', () => {
    new Problema(seccion());
    expect(observadores).toBe(1);
  });
});
