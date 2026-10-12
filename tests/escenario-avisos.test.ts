import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import glosario from '../src/glosario.json';

/**
 * El escenario de «Qué resuelve» (2026-10-12): las voces sueltas, los
 * cables y las tres fichas con párrafo se cambiaron por cuatro avisos
 * como los de un teléfono —un dato pequeño y una frase— sobre una red de
 * líneas tono sobre tono, y los párrafos bajaron a tres columnas sueltas.
 * La lectura sigue estando en el titular y en las columnas: los avisos
 * son dibujo, pero se tienen que poder leer igual.
 */

const leer = (nombre: string): string => readFileSync(resolve(process.cwd(), nombre), 'utf8');

const html = leer('index.html');
// Sólo la sección: la página entera trae hojas de estilo que el DOM de
// prueba intentaría descargar.
const seccion = html.match(/<section[^>]*id="problema"[\s\S]*?<\/section>/)![0];
const doc = new DOMParser().parseFromString(seccion, 'text/html');
const css = leer('src/css/componentes/problema.css');
const variables = leer('src/css/variables.css');

/** Lo que dice cada aviso en una cara: [dato, frase]. */
const avisos = (cara: 'ciego' | 'claro'): [string, string][] =>
  [...doc.querySelectorAll(`.avisos .aviso-texto > .cara--${cara}`)].map((c) => {
    const dato = c.querySelector('small')?.textContent?.trim() ?? '';
    const todo = c.textContent!.replace(/\s+/g, ' ').trim();
    return [dato, todo.slice(dato.length).trim()];
  });

/** El cuerpo de las reglas cuyo selector es exactamente éste. */
const reglas = (selector: string): string =>
  Array.from(
    css.matchAll(new RegExp(`(?:^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g')),
    (m) => m[1]
  ).join('\n');

const luminancia = ([r, g, b]: number[]): number => {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

/** El color de un token sobre blanco, con su alfa ya mezclado. */
const sobreBlanco = (token: string): number[] => {
  const valor = variables.match(new RegExp(`${token}:\\s*([^;]+);`))![1].trim();
  const rgba = valor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (rgba) {
    const a = Number(rgba[4]);
    return [1, 2, 3].map((i) => Number(rgba[i]) * a + 255 * (1 - a));
  }
  return [1, 3, 5].map((i) => parseInt(valor.slice(i, i + 2), 16));
};
const contrasteSobreBlanco = (token: string): number =>
  1.05 / (luminancia(sobreBlanco(token)) + 0.05);

describe('el escenario de «Qué resuelve»', () => {
  it('cuatro avisos decorativos, cada uno con un dato y una frase por cara', () => {
    expect(doc.querySelector('.avisos')?.getAttribute('aria-hidden')).toBe('true');
    expect(doc.querySelectorAll('.avisos .aviso')).toHaveLength(4);
    for (const cara of ['ciego', 'claro'] as const) {
      const lista = avisos(cara);
      expect(lista).toHaveLength(4);
      for (const [dato, frase] of lista) {
        expect(dato).not.toBe('');
        // Una frase, no un párrafo.
        expect(frase).not.toBe('');
        expect(frase.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it('a ciegas: la espera contada en cuatro momentos', () => {
    expect(avisos('ciego')).toEqual([
      ['7:42 a. m.', 'Llevo 30 minutos esperando'],
      ['Grupo del barrio', '¿Ya pasó el bus?'],
      ['Paradero de la 46', 'Empezó a llover'],
      ['Ahora', 'Mejor me voy caminando'],
    ]);
  });

  it('con Ya Viene: el aviso de la app tal cual, con una ruta real de Sobusa', () => {
    const [primero] = avisos('claro');
    const rutas = [...leer('src/data/rutas-landing.ts').matchAll(/nombre: "([A-Z]\d+) [^"]+"/g)];
    // Solo el código: con el nombre entero la frase partía en tres líneas.
    const ruta = rutas.find((r) => primero[0] === `Sobusa · Ruta ${r[1]}`);
    expect(ruta, 'el dato es «Sobusa · Ruta <código real>»').toBeDefined();
    expect(primero[1]).toBe(glosario.aviso.app.replace('{ruta}', ruta![1]));
  });

  it('con Ya Viene: distancia y no tiempo, y nunca una placa', () => {
    const texto = avisos('claro').flat().join(' ');
    expect(texto).toMatch(/\d,\d km/);
    expect(texto).not.toMatch(/min|minuto|llega en|\bETA\b/i);
    expect(texto).not.toMatch(/\b[A-Z]{3}\s?-?\d{3}\b/);
  });

  it('los avisos se leen: el dato pequeño también pasa AA sobre la tarjeta blanca', () => {
    expect(reglas('.aviso')).toMatch(/background:\s*var\(--papel\)/);
    const dato = reglas('.aviso small').match(/color:\s*var\((--[\w-]+)\)/)![1];
    expect(contrasteSobreBlanco(dato)).toBeGreaterThanOrEqual(4.5);
    const frase = reglas('.aviso-texto').match(/color:\s*var\((--[\w-]+)\)/)![1];
    expect(contrasteSobreBlanco(frase)).toBeGreaterThanOrEqual(4.5);
  });

  it('la píldora es lo único saturado: ningún otro relleno rojo en la sección', () => {
    const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const rojos = [...sinComentarios.matchAll(/([^{}]+)\{[^}]*background(?:-color)?:\s*var\(--coral-accessible\)/g)].map(
      (m) => m[1].trim()
    );
    expect(rojos).toEqual(['.escenario-estado']);
  });

  it('lo retirado no deja CSS huérfano', () => {
    for (const viejo of ['.ruido', '.ficha', '.escenario-arbol', '.escenario-circuito', '.circuito-cable', '.red-cable', 'chispa--signo']) {
      expect(css, viejo).not.toContain(viejo);
      expect(seccion, viejo).not.toContain(viejo.replace(/^\./, 'class="'));
    }
    // Los chispazos son rayos dibujados, sin «?» ni «!».
    for (const chispa of doc.querySelectorAll('.chispa')) expect(chispa.textContent!.trim()).toBe('');
  });

  it('los tres textos largos bajan a columnas, con sus dos caras', () => {
    const columnas = [...doc.querySelectorAll('.columnas > .columna.dos-caras')];
    expect(columnas).toHaveLength(3);
    for (const columna of columnas) {
      expect(columna.querySelector(':scope > .cara--ciego .columna-titulo')).not.toBeNull();
      expect(columna.querySelector(':scope > .cara--ciego .columna-texto')).not.toBeNull();
      expect(columna.querySelector(':scope > .cara--claro')?.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
