import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';
import { PasoDemo } from '../src/paso-demo';
import type { PhoneMap } from '../src/phone-map';
import type { RutaLanding } from '../src/types';

/**
 * Los tres teléfonos de «Cómo funciona», mirados como los ve quien baja
 * por la página: qué dice el chip en cada momento, qué cifra sale en la
 * hoja y de qué color, cuándo suena el aviso, y qué pasa con movimiento
 * reducido o con datos de ruta que no son los de siempre.
 * `pasos-cabecera.test.ts` ya cuida la cabecera del segundo y el tercero.
 */

/** Un mapa de mentira que recuerda lo que el guion le pide. */
interface MapaFalso extends PhoneMap {
  pin: boolean;
  ruta: boolean;
  busesVisibles: boolean;
  elegido: number | null;
  destruido: boolean;
}

function mapaFalso({ metros = 20000, rutas = YV_RUTAS.rutas }: { metros?: number; rutas?: RutaLanding[] } = {}): MapaFalso {
  const mapa = {
    pin: false,
    ruta: true,
    busesVisibles: false,
    elegido: null as number | null,
    destruido: false,
    rutas,
    metrosDeRuta: metros,
    setRoute: () => {},
    showRoute(v: boolean) {
      mapa.ruta = v;
    },
    tVisible: () => 0.5,
    setPin: () => {},
    showPin(v: boolean) {
      mapa.pin = v;
    },
    showBuses(v: boolean) {
      mapa.busesVisibles = v;
    },
    setBuses: () => {},
    setBusElegido(i: number | null) {
      mapa.elegido = i;
    },
    nodoBus: () => document.createElement('span'),
    destroy() {
      mapa.destruido = true;
    },
  };
  return mapa as unknown as MapaFalso;
}

const toma = (n: number): HTMLElement => document.querySelector<HTMLElement>(`[data-demo="${n}"]`)!;
const el = (raiz: HTMLElement, nombre: string): HTMLElement =>
  raiz.querySelector<HTMLElement>(`[data-el="${nombre}"]`)!;
/** El texto que se lee, con los saltos y sangrías del HTML hechos un espacio. */
const texto = (raiz: HTMLElement, nombre: string): string =>
  (el(raiz, nombre).textContent ?? '').replace(/\s+/g, ' ').trim();
/** La fila de la rueda que queda en medio, la elegida. */
const elegida = (raiz: HTMLElement): string => raiz.querySelector('.rueda-fila.is-elegida')?.textContent ?? '';
const encendido = (raiz: HTMLElement, nombre: string): boolean => el(raiz, nombre).classList.contains('is-on');
/** El ícono que se ve de un grupo que se intercambia. */
const iconoVisible = (raiz: HTMLElement, grupo: string): string[] =>
  Array.from(raiz.querySelectorAll<HTMLElement>(`[data-grupo="${grupo}"]`))
    .filter((n) => !n.hasAttribute('hidden'))
    .map((n) => n.dataset.icono!);

/** Recorre el bucle a saltos de 100 ms y devuelve una foto en cada uno. */
function recorrer<T>(ms: number, foto: () => T): T[] {
  const fotos: T[] = [];
  for (let t = 0; t <= ms; t += 100) {
    fotos.push(foto());
    vi.advanceTimersByTime(100);
  }
  return fotos;
}

/** Los metros que dice la hoja, leídos de la cifra y su unidad. */
function metrosEnHoja(raiz: HTMLElement): number {
  const valor = texto(raiz, 'eta-value');
  const unidad = texto(raiz, 'eta-unit');
  const n = Number(valor.replace(',', '.'));
  return unidad.startsWith('km') ? n * 1000 : n;
}

function movimientoReducido(reducido: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    (consulta: string) =>
      ({
        matches: reducido && consulta.includes('prefers-reduced-motion: reduce'),
        media: consulta,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

let demos: PasoDemo[] = [];
function montarDemo(n: number, mapa: MapaFalso = mapaFalso()): { raiz: HTMLElement; mapa: MapaFalso; demo: PasoDemo } {
  const raiz = toma(n);
  const demo = new PasoDemo(raiz, mapa, n);
  demos.push(demo);
  return { raiz, mapa, demo };
}

beforeEach(() => {
  vi.useFakeTimers();
  movimientoReducido(false);
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)![1]!;
});

afterEach(() => {
  for (const demo of demos) demo.destroy();
  demos = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('con movimiento reducido', () => {
  // Riesgo: quien pidió no animar ve igual el bucle moviéndose.
  it('el teléfono se queda en la foto final del HTML y no programa nada', () => {
    movimientoReducido(true);
    const raiz = toma(3);
    const antes = {
      cifra: texto(raiz, 'eta-value'),
      aviso: texto(raiz, 'alert-label'),
      notif: raiz.querySelector('[data-el="notif"]')!.className,
      nota: texto(raiz, 'eta-sub'),
    };
    // La foto final es la de la app tras guardar 800 m en la rueda: el
    // aviso puesto y, sobre el botón, la distancia con su «Cambiar».
    expect(antes.nota).toBe('Te avisamos a 800 m Cambiar');
    expect(el(raiz, 'eta-sub').hidden).toBe(false);
    expect(encendido(raiz, 'dialogo')).toBe(false);
    const { mapa, demo } = montarDemo(3);
    demo.activar(true);

    expect(raiz.classList.contains('es-guion')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(20000);
    expect({
      cifra: texto(raiz, 'eta-value'),
      aviso: texto(raiz, 'alert-label'),
      notif: raiz.querySelector('[data-el="notif"]')!.className,
      nota: texto(raiz, 'eta-sub'),
    }).toEqual(antes);
    // El mapa sí se enciende, porque eso no se mueve: punto y buses quietos.
    expect(mapa.pin).toBe(true);
    expect(mapa.busesVisibles).toBe(true);
  });

  // Riesgo: con movimiento reducido el primer momento se queda sin punto ni chip (mapa pelado).
  it('el primer momento enseña el punto y el chip ya puestos', () => {
    movimientoReducido(true);
    const { raiz, mapa } = montarDemo(1);
    expect(mapa.pin).toBe(true);
    expect(texto(raiz, 'chip-text')).toBe('2 buses cerca de tu punto');
    expect(iconoVisible(raiz, 'chip')).toEqual(['pin']);
  });

  // Riesgo: las listas del selector salen vacías en la foto quieta.
  it('las listas del selector se escriben igual aunque no haya guion', () => {
    movimientoReducido(true);
    const { raiz } = montarDemo(2);
    expect(el(raiz, 'company-list').querySelectorAll('.app-tile')).toHaveLength(4);
    expect(el(raiz, 'route-list').querySelectorAll('.app-tile')).toHaveLength(YV_RUTAS.rutas.length);
  });
});

describe('1. Fija tu punto de espera', () => {
  // Riesgo: el chip anuncia buses cerca antes de que haya punto puesto.
  it('primero localiza, luego pone el punto y sólo entonces cuenta los buses', () => {
    const { raiz, mapa, demo } = montarDemo(1);
    demo.activar(true);

    expect(texto(raiz, 'chip-text')).toBe('Localizando tu ubicación…');
    expect(iconoVisible(raiz, 'chip')).toEqual(['gps']);
    expect(el(raiz, 'chip-action').hidden).toBe(true);
    expect(mapa.pin).toBe(false);

    vi.advanceTimersByTime(1100);
    expect(mapa.pin).toBe(true);
    expect(encendido(raiz, 'chip')).toBe(true);
    expect(mapa.busesVisibles).toBe(false);

    vi.advanceTimersByTime(1400);
    expect(texto(raiz, 'chip-text')).toBe('2 buses cerca de tu punto');
    expect(iconoVisible(raiz, 'chip')).toEqual(['pin']);
    expect(el(raiz, 'chip-sub').hidden).toBe(false);
    expect(texto(raiz, 'chip-sub')).toBe('Arrástralo para moverlo');
    expect(el(raiz, 'chip-action').hidden).toBe(false);
    expect(mapa.busesVisibles).toBe(true);
  });

  // Riesgo: el bucle no vuelve a empezar y el teléfono se queda congelado tras la primera vuelta.
  it('recoge el punto y vuelve a empezar el bucle', () => {
    const { raiz, mapa, demo } = montarDemo(1);
    demo.activar(true);
    vi.advanceTimersByTime(6700);
    expect(mapa.pin).toBe(false);
    expect(mapa.busesVisibles).toBe(false);
    expect(encendido(raiz, 'chip')).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(texto(raiz, 'chip-text')).toBe('Localizando tu ubicación…');
    vi.advanceTimersByTime(1100);
    expect(mapa.pin).toBe(true);
  });

  // Riesgo: mientras localiza, el chip ya pide arrastrar un punto que aún no está puesto.
  it('mientras localiza, el chip no enseña la pista de arrastrar', () => {
    const { raiz, demo } = montarDemo(1);
    demo.activar(true);
    const fotos = recorrer(7500, () => ({
      localizando: texto(raiz, 'chip-text') === 'Localizando tu ubicación…',
      chip: encendido(raiz, 'chip'),
      pista: !el(raiz, 'chip-sub').hidden,
    }));
    // Sin esto, si el guion deja de enseñar «Localizando…» con el chip
    // encendido, el bucle de abajo no afirma nada y la prueba pasa sola.
    expect(fotos.some((f) => f.chip && f.localizando), 'ningún cuadro con el chip localizando').toBe(true);
    for (const [i, f] of fotos.entries()) {
      if (f.chip && f.localizando) expect(f.pista, `t=${i * 100} ms`).toBe(false);
    }
  });
});

describe('2. Elige tu ruta', () => {
  // Riesgo: el selector salta pasos o el botón de abajo dice algo que no toca.
  it('las dos casillas se llenan de una en una y el botón dice qué falta', () => {
    const { raiz, demo } = montarDemo(2);
    demo.activar(true);
    const fotos = recorrer(9000, () => ({
      empresa: texto(raiz, 'sel-empresa-title'),
      ruta: texto(raiz, 'sel-ruta-title'),
      boton: texto(raiz, 'launch'),
      lista: el(raiz, 'launch').classList.contains('is-lista'),
    }));

    expect(fotos[0]).toEqual({ empresa: 'Empresa', ruta: 'Ruta', boton: 'Elegir empresa', lista: false });
    const c16 = YV_RUTAS.rutas.find((r) => r.id === 'R-106')!;
    expect(fotos[40]).toEqual({ empresa: 'Sobusa', ruta: 'Ruta', boton: 'Elegir ruta', lista: false });
    expect(fotos[80]).toEqual({ empresa: 'Sobusa', ruta: c16.nombre, boton: 'Ver buses en vivo', lista: true });
    expect(texto(raiz, 'sel-ruta-sub')).toBe(`${c16.terminalA} ↔ ${c16.terminalB}`);
    // El botón sólo se pone verde cuando ya no falta nada.
    for (const f of fotos) expect(f.lista).toBe(f.boton === 'Ver buses en vivo');
  });

  // Riesgo: la hoja da un brinco al entrar y salir de las listas (el alto debe ser el de la tarjeta).
  it('la hoja conserva el alto de la tarjeta al entrar en las listas', () => {
    const raiz = toma(2);
    const altos: Record<string, number> = { selector: 300, companies: 520, routes: 560 };
    for (const vista of raiz.querySelectorAll<HTMLElement>('.sheet-view')) {
      Object.defineProperty(vista, 'offsetHeight', { get: () => altos[vista.dataset.view!] ?? 0 });
    }
    const { demo } = montarDemo(2);
    demo.activar(true);
    const vistas = el(raiz, 'views');
    const fotos = recorrer(8000, () => ({
      activa: raiz.querySelector<HTMLElement>('.sheet-view.active')!.dataset.view,
      alto: vistas.style.height,
    }));
    expect(new Set(fotos.map((f) => f.activa))).toEqual(new Set(['selector', 'companies', 'routes']));
    expect(new Set(fotos.map((f) => f.alto))).toEqual(new Set(['300px']));
  });

  // Riesgo: la C16 es la última de seis y el dedo toca una fila que está fuera de la ventana de la lista.
  it('la lista de rutas se desplaza hasta la C16 antes del toque, sin pasarse del final', () => {
    const { raiz, demo } = montarDemo(2);
    const lista = el(raiz, 'route-list');
    const carril = lista.querySelector<HTMLElement>('.sheet-lista-inner')!;
    const fila = lista.querySelector<HTMLElement>('[data-ruta="R-106"]')!;
    Object.defineProperty(lista, 'clientHeight', { get: () => 200 });
    Object.defineProperty(carril, 'scrollHeight', { get: () => 480 });
    Object.defineProperty(fila, 'offsetTop', { get: () => 400 });
    Object.defineProperty(fila, 'offsetHeight', { get: () => 80 });
    demo.activar(true);

    // Al entrar en la lista se ve desde el principio, con más por debajo.
    vi.advanceTimersByTime(5000);
    expect(carril.style.transform).toBe('translateY(0px)');
    expect(lista.classList.contains('hay-abajo')).toBe(true);
    expect(lista.classList.contains('hay-arriba')).toBe(false);

    // Luego baja hasta el tope: la C16 a la vista y nada en blanco debajo.
    vi.advanceTimersByTime(500);
    expect(carril.style.transform).toBe('translateY(-280px)');
    expect(lista.classList.contains('hay-arriba')).toBe(true);
    expect(lista.classList.contains('hay-abajo')).toBe(false);
  });

  // Riesgo: con la escena encogida por `--encaje` el dedo cae fuera del botón que dice tocar.
  it('con la escena encogida el dedo cae en el centro de la píldora', () => {
    const raiz = toma(2);
    const pantalla = raiz.querySelector<HTMLElement>('.phone-screen')!;
    const pildora = el(raiz, 'pill');
    pantalla.getBoundingClientRect = () => ({ left: 100, top: 50, width: 180, height: 390 }) as DOMRect;
    pildora.getBoundingClientRect = () => ({ left: 150, top: 90, width: 100, height: 40 }) as DOMRect;
    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((nodo: Element) =>
      nodo === pantalla
        ? ({ getPropertyValue: () => '0.5' } as unknown as CSSStyleDeclaration)
        : original(nodo)
    );

    const { demo } = montarDemo(2);
    demo.activar(true);
    vi.advanceTimersByTime(300);
    // Centro de la píldora en pantalla: (150 − 100 + 50, 90 − 50 + 20) = (100, 60); a la mitad, el doble.
    expect(el(raiz, 'toque').style.left).toBe('200px');
    expect(el(raiz, 'toque').style.top).toBe('120px');
    expect(el(raiz, 'toque').classList.contains('is-on')).toBe(true);
    expect(pildora.classList.contains('is-pulsado')).toBe(true);
    vi.advanceTimersByTime(300);
    expect(pildora.classList.contains('is-pulsado')).toBe(false);
  });

  // Riesgo: si rutas.json deja de traer la C16, el selector y la píldora se quedan en blanco.
  it('sin la C16 en los datos, el guion elige la primera ruta y la nombra', () => {
    const rutas = YV_RUTAS.rutas.filter((r) => r.id !== 'R-106');
    const { raiz, demo } = montarDemo(2, mapaFalso({ rutas }));
    demo.activar(true);
    vi.advanceTimersByTime(9000);
    expect(texto(raiz, 'sel-ruta-title')).toBe(rutas[0]!.nombre);
    expect(texto(raiz, 'pill-title')).toBe(rutas[0]!.nombre);
    expect(texto(raiz, 'launch')).toBe('Ver buses en vivo');
  });
});

describe('3. Te avisamos', () => {
  /**
   * Lo que tiene que cumplirse en cada cuadro del bucle, sea cual sea el
   * largo del recorrido: el color va con la cifra —coral bajo 300 m, ámbar
   * dentro de la distancia del aviso, sin color más allá—, la tarjeta del
   * aviso sólo sale con el aviso armado y el bus dentro de esa distancia,
   * y la cifra no cambia más de una vez cada 420 ms.
   *
   * La distancia es la de `_radioDe` en eta_bottom_sheet.dart: sin aviso
   * ni distancia guardada, el kilómetro con el que arranca la rueda; con
   * el aviso armado, los 800 m que el guion guarda en ella.
   */
  function comprobarBucle(metrosDeRuta: number): { metros: number[]; notif: boolean[] } {
    const { raiz, demo } = montarDemo(3, mapaFalso({ metros: metrosDeRuta }));
    demo.activar(true);
    const valor = el(raiz, 'eta-value');
    const fotos = recorrer(14000, () => ({
      m: metrosEnHoja(raiz),
      texto: valor.textContent ?? '',
      cerca: valor.classList.contains('eta-number--cerca'),
      muyCerca: valor.classList.contains('eta-number--muy-cerca'),
      armado: el(raiz, 'alert-btn').classList.contains('active'),
      notif: encendido(raiz, 'notif'),
    }));

    let ultimoCambio = -Infinity;
    for (const [i, f] of fotos.entries()) {
      const t = `t=${i * 100} ms, ${f.texto} → ${f.m} m`;
      expect(Number.isFinite(f.m), t).toBe(true);
      expect(f.muyCerca, t).toBe(f.m < 300);
      const radio = f.armado ? 800 : 1000;
      expect(f.cerca, t).toBe(f.m >= 300 && f.m < radio);
      if (f.notif) {
        expect(f.armado, t).toBe(true);
        expect(f.m, t).toBeLessThanOrEqual(800);
      }
      if (i > 0 && f.texto !== fotos[i - 1]!.texto) {
        expect(i * 100 - ultimoCambio, t).toBeGreaterThanOrEqual(400);
        ultimoCambio = i * 100;
      }
    }
    return { metros: fotos.map((f) => f.m), notif: fotos.map((f) => f.notif) };
  }

  // Riesgo: el bus se acerca pero la cifra, el color o la tarjeta del aviso cuentan otra cosa.
  it('el bus se acerca, la cifra baja y el aviso sale al cruzar la distancia elegida', () => {
    const { metros, notif } = comprobarBucle(20000);
    expect(metros[0]).toBe(1300);
    const menor = Math.min(...metros);
    expect(menor).toBeLessThan(800);
    expect(menor).toBeGreaterThan(300);
    expect(notif.some(Boolean)).toBe(true);
    // Antes de guardar la distancia (5,3 s) no hay aviso, y la tarjeta
    // tarda unos segundos más: no parece disparada por el dedo.
    expect(notif.slice(0, 80).some(Boolean)).toBe(false);
  });

  // Riesgo: una ruta corta deja el bus a pocos metros y los colores o el aviso se tuercen.
  it('en una ruta corta, bajo 300 m la cifra va en coral y el aviso sigue la regla', () => {
    const { metros } = comprobarBucle(1200);
    expect(metros.some((m) => m < 300)).toBe(true);
  });

  // Riesgo: un recorrido sin medir (0 m) divide por cero y la hoja enseña NaN.
  it('con el recorrido sin medir la hoja no enseña NaN y se queda en la cifra de partida', () => {
    const { raiz, demo } = montarDemo(3, mapaFalso({ metros: 0 }));
    demo.activar(true);
    const textos = new Set(recorrer(12000, () => `${texto(raiz, 'eta-value')} ${texto(raiz, 'eta-unit')}`));
    expect([...textos]).toEqual(['1,3 km de ti']);
  });

  // Riesgo: la hoja se abre sin que se toque un bus, y no se sabe de cuál habla.
  it('primero se toca un bus y sólo entonces sube su hoja', () => {
    const { raiz, mapa, demo } = montarDemo(3);
    demo.activar(true);
    vi.advanceTimersByTime(1600);
    expect(encendido(raiz, 'sheet')).toBe(false);
    expect(mapa.elegido).toBeNull();
    vi.advanceTimersByTime(300);
    expect(mapa.elegido).toBe(0);
    expect(encendido(raiz, 'sheet')).toBe(true);
    expect(el(raiz, 'eta-sub').hidden).toBe(true);
  });

  // Riesgo: el aviso se arma sin preguntar la distancia, como antes del 2026-10-06.
  it('la primera vez el botón abre la rueda, en el kilómetro, sin armar nada', () => {
    const { raiz, demo } = montarDemo(3);
    demo.activar(true);
    vi.advanceTimersByTime(3300);
    expect(encendido(raiz, 'dialogo')).toBe(false);
    vi.advanceTimersByTime(100);
    expect(encendido(raiz, 'dialogo')).toBe(true);
    // Los textos de rueda_distancia.dart con primeraVez.
    expect(texto(raiz, 'dialogo-titulo')).toBe('¿A qué distancia te avisamos?');
    expect(texto(raiz, 'dialogo-guardar')).toBe('Guardar');
    expect(texto(raiz, 'dialogo-otra')).toBe('Solo esta vez');
    expect(elegida(raiz)).toBe('1,0 km');
    expect(texto(raiz, 'alert-label')).toBe('Avisarme cuando esté cerca');
    expect(el(raiz, 'eta-sub').hidden).toBe(true);
  });

  // Riesgo: la rueda ofrece distancias que la app no tiene.
  it('la rueda va de 500 m a 3,0 km de 100 en 100, escrita como en la app', () => {
    const { raiz } = montarDemo(3);
    const filas = Array.from(el(raiz, 'rueda').querySelectorAll('.rueda-fila'), (f) => f.textContent);
    expect(filas).toHaveLength(26);
    expect(filas.slice(0, 7)).toEqual(['500 m', '600 m', '700 m', '800 m', '900 m', '1,0 km', '1,1 km']);
    expect(filas.at(-1)).toBe('3,0 km');
  });

  // Riesgo: la rueda gira pero lo que se guarda, o lo que dice la hoja, es otra distancia.
  it('se gira a 800 m, se guarda, y la hoja dice «Te avisamos a 800 m» con su «Cambiar»', () => {
    const { raiz, demo } = montarDemo(3);
    demo.activar(true);
    vi.advanceTimersByTime(4500);
    expect(elegida(raiz)).toBe('800 m');
    // La rueda se coloca con la fila elegida en medio de las cinco.
    expect(el(raiz, 'rueda').style.getPropertyValue('--elegida')).toBe('3');
    expect(texto(raiz, 'alert-label')).toBe('Avisarme cuando esté cerca');

    vi.advanceTimersByTime(900);
    expect(encendido(raiz, 'dialogo')).toBe(false);
    expect(texto(raiz, 'alert-label')).toBe('Aviso activado');
    expect(iconoVisible(raiz, 'aviso')).toEqual(['visto']);
    expect(el(raiz, 'eta-sub').hidden).toBe(false);
    expect(texto(raiz, 'eta-sub')).toBe('Te avisamos a 800 m Cambiar');
  });

  // Riesgo: al empezar cada vuelta queda el aviso de la anterior puesto.
  it('cada vuelta empieza con el aviso sin armar y la hoja abajo', () => {
    const { raiz, mapa, demo } = montarDemo(3);
    demo.activar(true);
    vi.advanceTimersByTime(14000);
    expect(encendido(raiz, 'notif')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(texto(raiz, 'alert-label')).toBe('Avisarme cuando esté cerca');
    expect(iconoVisible(raiz, 'aviso')).toEqual(['campana']);
    expect(encendido(raiz, 'sheet')).toBe(false);
    expect(encendido(raiz, 'notif')).toBe(false);
    expect(encendido(raiz, 'dialogo')).toBe(false);
    expect(el(raiz, 'eta-sub').hidden).toBe(true);
    expect(elegida(raiz)).toBe('1,0 km');
    expect(mapa.elegido).toBeNull();
  });
});

describe('el reloj del guion', () => {
  /**
   * Cuadros cada `ms` en vez de los 16 del reloj falso: con 16 nunca se
   * cae justo en los 420 ms del refresco y un `<=` en su lugar pasaría
   * sin que nadie lo notara.
   */
  function cuadrosCada(ms: number): void {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), ms)
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  }

  // Riesgo: los buses del primer teléfono van a otra velocidad, o todos a
  // la misma y se apelotonan en una sola mancha.
  it('cada bus avanza a 58 m/s por su factor: 0,85 el primero, 0,22 más cada siguiente', () => {
    cuadrosCada(20);
    const largo = 20000;
    const mapa = mapaFalso({ metros: largo });
    const posiciones: number[][] = [];
    mapa.setBuses = (t: number[]) => {
      posiciones.push([...t]);
    };
    const { demo } = montarDemo(1, mapa);
    demo.activar(true);
    vi.advanceTimersByTime(4000);

    // Los dos buses salen a los 2,4 s; de ahí en adelante, cuadro a cuadro.
    const enMarcha = posiciones.filter((p) => p.length === 2);
    expect(enMarcha.length).toBeGreaterThan(20);
    for (let i = 2; i < enMarcha.length; i++) {
      for (const bus of [0, 1]) {
        const avance = ((enMarcha[i]![bus]! - enMarcha[i - 1]![bus]! + 1) % 1) * largo;
        expect(avance / 0.02, `bus ${bus}, cuadro ${i}`).toBeCloseTo(58 * (0.85 + bus * 0.22), 6);
      }
    }
  });

  // Riesgo: la cifra se refresca más lento de lo que dice la app (o más rápido y no se lee).
  it('la cifra de la hoja se refresca justo cada 420 ms mientras el bus se acerca', () => {
    cuadrosCada(20);
    const { raiz, demo } = montarDemo(3, mapaFalso({ metros: 20000 }));
    demo.activar(true);
    // El bus arranca a los 500 ms a 1300 m y cruza el kilómetro hacia los
    // 6,6 s; desde ahí la cifra va en metros redondeados a la decena, y
    // 20 m por refresco la cambian siempre.
    vi.advanceTimersByTime(7000);
    const valor = el(raiz, 'eta-value');
    const cambios: number[] = [];
    let antes = valor.textContent;
    for (let t = 0; t < 3000; t += 20) {
      vi.advanceTimersByTime(20);
      if (valor.textContent !== antes) {
        cambios.push(t);
        antes = valor.textContent;
      }
    }
    const intervalos = cambios.slice(1).map((t, i) => t - cambios[i]!);
    expect(intervalos.length).toBeGreaterThan(4);
    expect(new Set(intervalos)).toEqual(new Set([420]));
  });

  // Riesgo: a 300 m justos la cifra se pinta coral, y la app la pinta ámbar.
  it('a 300 m justos la cifra va en ámbar, no en coral', () => {
    cuadrosCada(20);
    // En una ruta de 1000 m, los 1300 m de partida dan la vuelta y el bus
    // sale a 300 m justos del punto.
    const { raiz, demo } = montarDemo(3, mapaFalso({ metros: 1000 }));
    demo.activar(true);
    const valor = el(raiz, 'eta-value');
    const vistos = new Map<number, string>();
    for (let t = 0; t < 12000; t += 20) {
      vi.advanceTimersByTime(20);
      vistos.set(metrosEnHoja(raiz), valor.className);
    }
    const a300 = vistos.get(300);
    expect(a300, `metros vistos: ${[...vistos.keys()].join(', ')}`).toBeDefined();
    expect(a300).toContain('eta-number--cerca');
    expect(a300).not.toContain('eta-number--muy-cerca');
  });
});

describe('encender y apagar', () => {
  // Riesgo: al salir de un paso su bucle sigue corriendo y consume aunque no se vea.
  it('al apagarlo se para el bucle y vuelve a la foto de reposo', () => {
    const { raiz, mapa, demo } = montarDemo(1);
    demo.activar(true);
    vi.advanceTimersByTime(3000);
    expect(mapa.busesVisibles).toBe(true);

    demo.activar(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(mapa.pin).toBe(false);
    expect(mapa.busesVisibles).toBe(false);
    expect(texto(raiz, 'chip-text')).toBe('Localizando tu ubicación…');
    vi.advanceTimersByTime(20000);
    expect(mapa.pin).toBe(false);
  });

  // Riesgo: encenderlo dos veces arranca dos bucles a la vez y todo va el doble de rápido.
  it('encenderlo otra vez no arranca un segundo bucle', () => {
    const { demo } = montarDemo(2);
    demo.activar(true);
    const relojes = vi.getTimerCount();
    demo.activar(true);
    expect(vi.getTimerCount()).toBe(relojes);
  });

  // Riesgo: destruir el paso deja relojes vivos que tocan un DOM que ya no está.
  it('destruirlo para todo y suelta el mapa', () => {
    const { mapa, demo } = montarDemo(3);
    demo.activar(true);
    vi.advanceTimersByTime(2000);
    demo.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(mapa.destruido).toBe(true);
  });

  // Riesgo: un momento sin teléfono en el HTML falla en silencio más adelante.
  it('un momento sin teléfono avisa con un error claro', () => {
    const vacio = document.createElement('div');
    expect(() => new PasoDemo(vacio, mapaFalso(), 1)).toThrow('PasoDemo: el momento no trae teléfono');
  });
});
