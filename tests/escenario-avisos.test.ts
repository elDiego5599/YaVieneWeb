import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import glosario from '../src/glosario.json';

/**
 * El escenario de «Qué resuelve» (2026-10-12): cuatro avisos como los de
 * un teléfono —un título pequeño y una frase— sobre una red de líneas tono
 * sobre tono, con hasta tres voces sueltas a ciegas. Los avisos son el
 * contenido de la sección (las tres columnas de texto largo bajaron a
 * ellos, condensadas), así que se leen: lo decorativo son los iconos, las
 * voces y la red.
 */

const leer = (nombre: string): string => readFileSync(resolve(process.cwd(), nombre), 'utf8');

const html = leer('index.html');
// Sólo la sección: la página entera trae hojas de estilo que el DOM de
// prueba intentaría descargar.
const seccion = html.match(/<section[^>]*id="problema"[\s\S]*?<\/section>/)![0];
const doc = new DOMParser().parseFromString(seccion, 'text/html');
const css = leer('src/css/componentes/problema.css');
const variables = leer('src/css/variables.css');

/** Lo que dice cada aviso en una cara: [título, frase]. */
const avisos = (cara: 'ciego' | 'claro'): [string, string][] =>
  [...doc.querySelectorAll(`.avisos .aviso-texto > .cara--${cara}`)].map((c) => [
    c.querySelector('h3')?.textContent?.trim() ?? '',
    c.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  ]);

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
  it('cuatro avisos reales, cada uno con un título y una frase por cara', () => {
    const contenedor = doc.querySelector('.avisos')!;
    expect(contenedor.hasAttribute('aria-hidden')).toBe(false);
    expect(doc.querySelectorAll('.avisos .aviso')).toHaveLength(4);
    for (const aviso of doc.querySelectorAll('.avisos .aviso')) {
      expect(aviso.hasAttribute('aria-hidden')).toBe(false);
      // El dibujo sí es decorativo.
      expect(aviso.querySelector('.aviso-icono')?.getAttribute('aria-hidden')).toBe('true');
      expect(aviso.querySelectorAll('.aviso-icono svg')).toHaveLength(2);
      // Sólo se oye la cara que se ve: la otra nace oculta y la mueve problema.ts.
      expect(aviso.querySelector('.aviso-texto > .cara--ciego')?.hasAttribute('aria-hidden')).toBe(false);
      expect(aviso.querySelector('.aviso-texto > .cara--claro')?.getAttribute('aria-hidden')).toBe('true');
    }
    for (const cara of ['ciego', 'claro'] as const) {
      const lista = avisos(cara);
      expect(lista).toHaveLength(4);
      for (const [titulo, frase] of lista) {
        expect(titulo).not.toBe('');
        // Una frase, no un párrafo.
        expect(frase).not.toBe('');
        expect(frase.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it('a ciegas: la espera contada en cuatro cosas, con el robo entre ellas', () => {
    expect(avisos('ciego')).toEqual([
      ['Esperar una eternidad', 'Ni tablero ni horario que se cumpla'],
      ['Bajo el sol o la lluvia', 'Se espera igual, sin sombra y mojándose'],
      ['Ese tiempo suma', 'Media hora perdida en el paradero'],
      ['Expuesto a robos', 'Mucho rato en la calle, celular en mano'],
    ]);
  });

  it('con Ya Viene: lo mismo resuelto, y el aviso de la app tal cual con una ruta real de Sobusa', () => {
    const claro = avisos('claro');
    expect(claro.map(([titulo]) => titulo)).toEqual([
      'Sabes cuál viene y por dónde',
      'Esperas donde te convenga',
      'Ese tiempo vuelve',
      'Menos rato en la calle',
    ]);
    expect(claro.map(([, frase]) => frase).filter((_, i) => i !== 1)).toEqual([
      'Ves tu bus en el mapa, a 1,2 km',
      'La media hora vuelve a tu día',
      'Sales de casa cuando el bus está cerca',
    ]);
    const rutas = [...leer('src/data/rutas-landing.ts').matchAll(/nombre: "([A-Z]\d+) [^"]+"/g)];
    // Solo el código: con el nombre entero la frase partía en tres líneas.
    const ruta = rutas.find((r) => claro[1][1] === glosario.aviso.app.replace('{ruta}', r[1]));
    expect(ruta, 'la frase es el aviso de la app con un código real').toBeDefined();
  });

  it('con Ya Viene: distancia y no tiempo, y nunca una placa', () => {
    const texto = avisos('claro').flat().join(' ');
    expect(texto).toMatch(/\d,\d km/);
    expect(texto).not.toMatch(/min|minuto|llega en|\bETA\b/i);
    expect(texto).not.toMatch(/\b[A-Z]{3}\s?-?\d{3}\b/);
  });

  it('los avisos se leen: el título pequeño y la frase pasan AA sobre la tarjeta blanca', () => {
    expect(reglas('.aviso')).toMatch(/background:\s*var\(--papel\)/);
    const titulo = reglas('.aviso-titulo').match(/color:\s*var\((--[\w-]+)\)/)![1];
    expect(contrasteSobreBlanco(titulo)).toBeGreaterThanOrEqual(4.5);
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

  it('hasta tres voces sueltas, sólo a ciegas y sólo en pantalla ancha', () => {
    const voces = [...doc.querySelectorAll('.ruido')];
    expect(voces.map((v) => v.textContent)).toEqual(['¿ya pasó el bus?', 'llevo 30 minutos esperando', 'me iré en taxi']);
    // Todas dentro de un único bloque decorativo.
    const bloque = doc.querySelectorAll('.ruidos');
    expect(bloque).toHaveLength(1);
    expect(bloque[0].getAttribute('aria-hidden')).toBe('true');
    expect(bloque[0].querySelectorAll('.ruido')).toHaveLength(voces.length);
    // Ocultas por defecto: sólo el escenario ancho las enseña.
    expect(reglas('.ruidos')).toMatch(/display:\s*none/);
    expect(css).toMatch(/@media \(min-width: 1024px\)\s*\{[\s\S]*?\.ruidos\s*\{\s*display:\s*block/);
    // En la otra cara se apagan donde están.
    expect(css).toMatch(/\[data-cara='claro'\] \.ruido[^{]*\{[^}]*opacity:\s*0/);
  });

  it('lo retirado no deja CSS huérfano', () => {
    for (const viejo of ['.ficha', '.escenario-arbol', '.escenario-circuito', '.circuito-cable', '.red-cable', 'chispa--signo', '.columna']) {
      expect(css, viejo).not.toContain(viejo);
      expect(seccion, viejo).not.toContain(viejo.replace(/^\./, 'class="'));
    }
    // Los chispazos son rayos dibujados, sin «?» ni «!».
    for (const chispa of doc.querySelectorAll('.chispa')) expect(chispa.textContent!.trim()).toBe('');
  });

  it('los hilos no son un fondo fijo: el lienzo llega vacío y los traza problema.ts con las cajas', () => {
    expect(seccion).not.toContain('preserveAspectRatio');
    const red = doc.querySelector('.escenario > svg.escenario-red')!;
    expect(red.getAttribute('aria-hidden')).toBe('true');
    expect(red.hasAttribute('viewBox')).toBe(false);
    expect(red.children).toHaveLength(0);
    const ts = leer('src/problema.ts');
    expect(ts).toMatch(/import \{[^}]*\btrazar\b[^}]*\} from '\.\/escenario-red'/);
    expect(ts).toContain('new ResizeObserver');
    // A ciegas se ve el enredo; con Ya Viene, el árbol entero, y el otro apagado.
    expect(css).toMatch(/\[data-cara='claro'\] \.hilo--enredo\s*\{[^}]*opacity:\s*0/);
    expect(css).toMatch(/\[data-cara='claro'\] \.tramo--tronco,[^{]*\{[^}]*scale:\s*1/);
    expect(css).toMatch(/\[data-cara='claro'\] \.tramo--codo\s*\{[^}]*opacity:\s*1/);
  });

  it('con Ya Viene los avisos se ponen en fila, derechos', () => {
    expect(css).toMatch(/\[data-cara='claro'\] \.aviso\s*\{[^}]*translate:\s*var\(--fila\)[^}]*rotate:\s*0deg/);
  });

  it('los textos largos ya no cuelgan debajo: viven en los avisos', () => {
    expect(doc.querySelector('.columnas, .columna-titulo, .columna-texto')).toBeNull();
  });
});
