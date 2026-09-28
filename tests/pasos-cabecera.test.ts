import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';
import { PasoDemo } from '../src/paso-demo';
import type { PhoneMap } from '../src/phone-map';

/**
 * Los teléfonos del segundo y el tercer momento no llevaban la cabecera
 * de la app —la píldora de la ruta y el chip de ubicación—, y el tercero
 * además apagaba el punto de espera entre vuelta y vuelta. En el hueco
 * del bucle quedaba un mapa pelado con una línea azul: el cuadro que el
 * dueño vio en el iPhone y que no se parece a la app. En la app la
 * cabecera sólo se aparta mientras el selector está abierto
 * (cabecera_flotante.dart) y el punto no se va solo.
 */

/** Un mapa de mentira que sólo recuerda si el punto está puesto. */
function mapaFalso(): PhoneMap & { pin: boolean; ruta: boolean } {
  const mapa = {
    pin: false,
    ruta: true,
    rutas: YV_RUTAS.rutas,
    metrosDeRuta: 20000,
    setRoute: () => {},
    showRoute(v: boolean) {
      mapa.ruta = v;
    },
    tVisible: () => 0.5,
    setPin: () => {},
    showPin(v: boolean) {
      mapa.pin = v;
    },
    showBuses: () => {},
    setBuses: () => {},
    setBusElegido: () => {},
    nodoBus: () => null,
    destroy: () => {},
  };
  return mapa as unknown as PhoneMap & { pin: boolean; ruta: boolean };
}

function momento(n: number): { toma: HTMLElement; mapa: PhoneMap & { pin: boolean; ruta: boolean }; demo: PasoDemo } {
  const toma = document.querySelector<HTMLElement>(`[data-demo="${n}"]`)!;
  const mapa = mapaFalso();
  const demo = new PasoDemo(toma, mapa, n);
  demo.activar(true);
  return { toma, mapa, demo };
}

const texto = (raiz: HTMLElement, sel: string): string =>
  raiz.querySelector(sel)?.textContent?.trim() ?? '';

/** Recorre el bucle a saltos y devuelve una foto en cada uno. */
function recorrer<T>(ms: number, foto: () => T): T[] {
  const fotos: T[] = [];
  for (let t = 0; t <= ms; t += 100) {
    fotos.push(foto());
    vi.advanceTimersByTime(100);
  }
  return fotos;
}

describe('la cabecera de la app en los pasos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)![1]!;
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('el tercero enseña la ruta, el chip y el punto durante todo el bucle', () => {
    const { toma, mapa, demo } = momento(3);
    const fotos = recorrer(14000, () => ({
      ruta: texto(toma, '[data-el="pill-title"]'),
      chip: toma.querySelector('[data-el="chip"]')?.classList.contains('is-on'),
      chipTexto: texto(toma, '[data-el="chip-text"]'),
      pin: mapa.pin,
    }));
    demo.destroy();
    for (const f of fotos) {
      expect(f).toEqual({
        ruta: 'C16 Calle 72 Uninorte',
        chip: true,
        chipTexto: '1 bus cerca de tu punto',
        pin: true,
      });
    }
  });

  it('el segundo aparta la cabecera sólo con el selector abierto', () => {
    const { toma, mapa, demo } = momento(2);
    const topbar = toma.querySelector<HTMLElement>('[data-el="topbar"]')!;
    const hoja = toma.querySelector<HTMLElement>('[data-el="sheet"]')!;
    const fotos = recorrer(15000, () => ({
      apartada: topbar.classList.contains('esta-apartada'),
      hoja: hoja.classList.contains('is-on'),
      ruta: texto(toma, '[data-el="pill-title"]'),
      chip: texto(toma, '[data-el="chip-text"]'),
      pin: mapa.pin,
      recorrido: mapa.ruta,
    }));
    demo.destroy();

    for (const [i, f] of fotos.entries()) {
      expect(f.apartada).toBe(f.hoja);
      expect(f.pin).toBe(true);
      // La píldora dice «Ruta activa» sólo si la línea está en el mapa: al
      // final del bucle se quitaba el recorrido y la cabecera seguía
      // anunciando la C16 con dos buses que ya no estaban.
      if (!f.apartada) {
        expect(f.ruta === 'C16 Calle 72 Uninorte', `t=${i * 100} ms`).toBe(f.recorrido);
      }
    }
    // Arranca sin ruta, como la app antes de elegirla…
    expect(fotos[0]).toMatchObject({ ruta: '¿Qué bus esperas?', chip: 'Tu punto de espera' });
    // …y al pulsar «Ver buses en vivo» vuelve con la C16 y sus dos buses.
    expect(fotos[100]).toMatchObject({
      apartada: false,
      ruta: 'C16 Calle 72 Uninorte',
      chip: '2 buses cerca de tu punto',
    });
  });
});
