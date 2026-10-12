import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Problema } from '../src/problema';

/**
 * El interruptor de «Qué resuelve» y lo que se mueve al pulsarlo
 * (auditoría apple-design, 2026-10-12): el control responde en el acto,
 * la escena se puede cortar a media ida sin saltos, la vuelta recorre el
 * camino de la ida al revés y quien pidió que nada se mueva no ve volar
 * nada. Se mira qué se anima y desde dónde, no cómo se ve.
 */

const leer = (nombre: string): string => readFileSync(resolve(process.cwd(), nombre), 'utf8');
const seccionHtml = leer('index.html').match(/<section[^>]*id="problema"[\s\S]*?<\/section>/)![0];
const css = leer('src/css/componentes/problema.css');
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * La pendiente de una cubic-bezier en su arranque y en su punto más
 * rápido (en múltiplos de la velocidad media), muestreada.
 */
const pendientes = (curva: string): { arranque: number; pico: number } => {
  const [x1, y1, x2, y2] = curva.match(/cubic-bezier\(([^)]+)\)/)![1].split(',').map(Number);
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
  return { arranque, pico };
};

type Vuelo = {
  el: Element;
  keyframes: Keyframe[];
  opciones: KeyframeAnimationOptions;
  cancelada: boolean;
};
let vuelos: Vuelo[] = [];
/** Lo que el navegador diría que lleva puesto cada pieza a media animación. */
let presente = new Map<Element, { transform: string; opacity: string }>();
let reducido = false;

const seccion = (): HTMLElement => document.querySelector<HTMLElement>('#problema')!;
const boton = (cara: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`.interruptor-opcion[data-cara="${cara}"]`)!;
const hasta = (fase: string): void => {
  for (let i = 0; i < 400 && seccion().dataset.fase !== fase; i++) vi.advanceTimersByTime(10);
};
const de = (sel: string): Vuelo[] => vuelos.filter((v) => v.el.matches(sel));
const PIEZAS = '.aviso, .seccion-cabecera .dos-caras';

beforeEach(() => {
  vi.useFakeTimers();
  vuelos = [];
  presente = new Map();
  reducido = false;
  document.body.innerHTML = seccionHtml;
  Element.prototype.getBoundingClientRect = function () {
    return { x: 10, y: 10, width: 100, height: 40, top: 10, left: 10, right: 110, bottom: 50 } as DOMRect;
  };
  Element.prototype.animate = function (this: Element, keyframes: Keyframe[], opciones: KeyframeAnimationOptions) {
    const vuelo: Vuelo = { el: this, keyframes, opciones, cancelada: false };
    vuelos.push(vuelo);
    return {
      playState: 'running',
      cancel: () => {
        vuelo.cancelada = true;
        // Cancelada, la pieza vuelve a su sitio de golpe: leer después
        // de cancelar es leer el reposo, no lo que se veía.
        presente.delete(this);
      },
    } as unknown as Animation;
  } as typeof Element.prototype.animate;
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) => {
    const real = original(el, pseudo);
    const visto = presente.get(el);
    if (!visto) return real;
    return new Proxy(real, {
      get: (t, k) => (k === 'transform' ? visto.transform : k === 'opacity' ? visto.opacity : Reflect.get(t, k)),
    });
  });
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
  it('aria-pressed y el atributo del control cambian con el toque; la escena sigue su ceremonia', () => {
    boton('claro').click();
    expect(boton('claro').getAttribute('aria-pressed')).toBe('true');
    expect(boton('ciego').getAttribute('aria-pressed')).toBe('false');
    expect(seccion().dataset.pulsado).toBe('claro');
    // La cara de la escena todavía no: cambia a mitad de la ceremonia.
    expect(seccion().dataset.cara).toBe('ciego');
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
});

describe('cortar la ida a media escena', () => {
  it('cada pieza vuelve al reposo desde donde se veía, no desde su sitio', () => {
    boton('claro').click();
    vi.advanceTimersByTime(300);
    const piezas = [...document.querySelectorAll(`${PIEZAS}, .escenario-estado`)];
    piezas.forEach((el, i) =>
      presente.set(el, { transform: `matrix(0.5, 0, 0, 0.5, ${40 + i}, -30)`, opacity: '0.8' })
    );
    const antes = vuelos.length;
    boton('ciego').click();

    expect(vuelos.slice(0, antes).every((v) => v.cancelada)).toBe(true);
    const regresos = vuelos.slice(antes);
    piezas.forEach((el, i) => {
      const regreso = regresos.find((v) => v.el === el);
      expect(regreso, el.className).toBeDefined();
      expect(regreso!.keyframes[0].transform).toBe(`matrix(0.5, 0, 0, 0.5, ${40 + i}, -30)`);
      // El scale de la píldora no lleva opacidad; las piezas sí.
      if (!el.matches('.escenario-estado')) expect(Number(regreso!.keyframes[0].opacity)).toBe(0.8);
      // Cerca de su sitio (≈ 50 px) el regreso es el corto, 350 ms.
      expect(Number(regreso!.opciones.duration)).toBe(350);
      expect(Number(regreso!.opciones.delay ?? 0)).toBe(0);
    });
    expect(seccion().dataset.cara).toBe('ciego');
    expect(seccion().dataset.fase).toBe('reposo');
  });

  it('lejos de su sitio el regreso se alarga con la distancia y arranca sin tirón', () => {
    boton('claro').click();
    vi.advanceTimersByTime(1000);
    // A media aspiración, a 300–420 px de su sitio y aún enteras (escala
    // 1): lo peor para la vista, lejos y bien visibles.
    const piezas = [...document.querySelectorAll(PIEZAS)];
    piezas.forEach((el, i) =>
      presente.set(el, { transform: `matrix(1, 0, 0, 1, ${300 + 20 * i}, -100)`, opacity: '1' })
    );
    const lejos = Math.max(...piezas.map((_, i) => Math.hypot(300 + 20 * i, 100)));
    const antes = vuelos.length;
    boton('ciego').click();
    const regresos = vuelos.slice(antes).filter((v) => v.el.matches(PIEZAS));
    expect(regresos).toHaveLength(piezas.length);
    for (const { opciones } of regresos) {
      const ms = Number(opciones.duration);
      // Todas juntas, con la duración de la más lejana: 1,75 ms por px.
      expect(ms).toBe(Math.round(Math.min(800, Math.max(350, lejos * 1.75))));
      expect(ms).toBeLessThan(800);
      const { arranque, pico } = pendientes(String(opciones.easing));
      // Sale de parado: el giro de sentido no es un muro.
      expect(arranque).toBeLessThan(0.1);
      // El cuadro más rápido (a 60 Hz) de la más lejana, entera y opaca.
      expect((pico * lejos) / ms * (1000 / 60)).toBeLessThanOrEqual(25);
    }
  });

  it('los avisos vuelven del desorden a la fila (y al revés) con la misma curva, sin tirón', () => {
    const escritorio = sinComentarios.slice(sinComentarios.indexOf('@media (min-width: 1024px)'));
    const transicion = escritorio.match(/\n\s*\.aviso\s*\{[^}]*transition:([^;]*);/)![1];
    for (const prop of ['translate', 'rotate']) {
      const [, s, curva] = transicion.match(new RegExp(`${prop}\\s+(\\d*\\.?\\d+)s\\s+(cubic-bezier\\([^)]+\\))`))!;
      const { arranque, pico } = pendientes(curva);
      expect(arranque).toBeLessThan(0.1);
      // La distancia más larga entre la fila y el desorden a 1440: 330 px.
      expect((pico * 330) / (Number(s) * 1000) * (1000 / 60)).toBeLessThanOrEqual(25);
    }
  });

  it('la píldora se cierra y se abre sin tocar el layout: ni width ni padding animados', () => {
    // La regla de la píldora que lleva la transición (hay otra antes con su turno).
    const transicion = sinComentarios.match(/\n\.escenario-estado\s*\{[^}]*transition:[^}]*\}/)![0];
    expect(transicion).not.toMatch(/\bwidth\s+0?\.\d/);
    expect(transicion).not.toMatch(/\bpadding\s+0?\.\d/);
    expect(sinComentarios).not.toMatch(/\[data-fase='aspira'\] \.escenario-estado,\s*\[data-fase='carga'\] \.escenario-estado\s*\{[^}]*width/);
    expect(sinComentarios).toMatch(/clip-path:\s*inset\(/);
  });
});

describe('el halo del círculo', () => {
  it('vive en la celda de la píldora, no en la del escenario: mide lo que ella', () => {
    // En la rejilla del escenario (460 de alto a ≥1024) el halo, estirado,
    // medía 46 × 460 y su remolino giraba como una cápsula de lado a lado
    // (dueño, 2026-10-12). En una celda propia con la píldora, estirarse es
    // medir lo que ella.
    const halo = document.querySelector('.estado-halo')!;
    const celda = halo.parentElement!;
    expect(celda.classList.contains('escenario')).toBe(false);
    expect([...celda.children].map((el) => el.className)).toEqual(['escenario-estado', 'estado-halo']);
    const regla = sinComentarios.match(new RegExp(`\\n\\.${celda.classList[0]}\\s*\\{([^}]*)\\}`))![1];
    expect(regla).toMatch(/display:\s*grid/);
    expect(regla).toMatch(/grid-area:\s*1\s*\/\s*1/);
  });

  it('no vuela ni gira con las piezas: sólo engorda con la píldora', () => {
    boton('claro').click();
    vi.advanceTimersByTime(3000);
    const delHalo = de('.estado-halo');
    expect(delHalo.length).toBeGreaterThan(0);
    for (const { keyframes } of delHalo) {
      for (const k of keyframes) expect(String(k.transform ?? '')).not.toMatch(/translate|rotate/);
    }
  });
});

describe('la vuelta, el camino de la ida al revés', () => {
  beforeEach(() => {
    boton('claro').click();
    vi.advanceTimersByTime(3000);
    expect(seccion().dataset.fase).toBe('reposo');
    vuelos = [];
  });

  it('las piezas de la fila entran en la píldora desde el primer cuadro', () => {
    boton('ciego').click();
    const entran = de(PIEZAS);
    expect(entran).toHaveLength(6);
    expect(Math.min(...entran.map((v) => Number(v.opciones.delay ?? 0)))).toBe(0);
    for (const { keyframes, opciones } of entran) {
      const ultimo = keyframes[keyframes.length - 1];
      expect(String(ultimo.transform)).toMatch(/scale\(0\.0/);
      expect(ultimo.opacity).toBe(0);
      // Techo del escalonado.
      expect(Number(opciones.delay ?? 0)).toBeLessThanOrEqual(150);
    }
  });

  it('y salen de ella a su desorden: avisos, texto, rayos y voces, ya con la cara de antes', () => {
    boton('ciego').click();
    vuelos = [];
    hasta('brota');
    expect(seccion().dataset.cara).toBe('ciego');
    const salen = de(`${PIEZAS}, .chispa, .ruido`);
    expect(salen.length).toBe(13);
    for (const { keyframes } of salen) {
      expect(String(keyframes[0].transform)).toMatch(/scale\(0\.0/);
      expect(keyframes[0].opacity).toBe(0);
      expect(keyframes[keyframes.length - 1].opacity).toBe(1);
    }
  });

  it('dura unos 0,8 s y acaba en reposo', () => {
    boton('ciego').click();
    vi.advanceTimersByTime(850);
    expect(seccion().dataset.fase).toBe('reposo');
    expect(seccion().dataset.cara).toBe('ciego');
  });

  it('el relevo de CSS arranca en 0 y no escalona más de 150 ms', () => {
    const turnos = [...sinComentarios.matchAll(/--turno:\s*(\d+)ms/g)].map((m) => Number(m[1]));
    expect(Math.min(...turnos)).toBe(0);
    expect(Math.max(...turnos)).toBeLessThanOrEqual(150);
    const enredo = sinComentarios.match(/\n\.hilo--enredo\s*\{[^}]*transition:[^;]*?(\d*\.?\d+)s;/)!;
    expect(Number(enredo[1])).toBeLessThanOrEqual(0.15);
  });
});

describe('quien pidió que nada se mueva', () => {
  it('no ve volar nada ni a la ida ni a la vuelta, y la cara cambia igual', () => {
    reducido = true;
    boton('claro').click();
    expect(seccion().dataset.cara).toBe('claro');
    boton('ciego').click();
    expect(seccion().dataset.cara).toBe('ciego');
    expect(vuelos).toHaveLength(0);
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
