import { describe, expect, it } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';
import { EMPRESA, carrilEmpresas, carrilRutas } from '../src/selector';
import type { RutaLanding } from '../src/types';

/**
 * Las dos listas del selector de ruta, como las lee quien mira el
 * teléfono: qué va en la insignia, qué en el título y qué debajo. Las
 * rutas se prueban también con nombres que no traen código —o que sólo
 * traen código—, que es lo primero que se tuerce si rutas.json cambia.
 */

/** Una ruta con los campos que el selector lee; el resto da igual aquí. */
const ruta = (id: string, nombre: string, terminalA = 'Granabastos', terminalB = 'Uninorte'): RutaLanding => ({
  id,
  nombre,
  terminalA,
  terminalB,
  km: 10,
  d: '',
  extremos: [],
});

/** Lo que se lee de cada fila: insignia, título y subtítulo. */
const filas = (carril: HTMLElement): { insignia: string; titulo: string; sub: string; icono: boolean }[] =>
  Array.from(carril.querySelectorAll<HTMLElement>('.app-tile'), (fila) => ({
    insignia: fila.querySelector('.app-tile-icon')!.textContent!.trim(),
    titulo: fila.querySelector('.app-tile-title')!.textContent!,
    sub: fila.querySelector('.app-tile-sub')?.textContent ?? '',
    icono: fila.querySelector('.app-tile-icon svg') !== null,
  }));

describe('la lista de rutas', () => {
  // Riesgo: el código del parabrisas (C16) no sale en la insignia y seis filas iguales sólo se distinguen leyendo.
  it('con código, el código va en la insignia y el destino de título', () => {
    const carril = carrilRutas([ruta('R-1', 'C16 Calle 72 Uninorte'), ruta('R-2', 'B18 Tcherassi', 'Nevada', 'Centro')]);
    expect(filas(carril)).toEqual([
      { insignia: 'C16', titulo: 'Calle 72 Uninorte', sub: 'Granabastos ↔ Uninorte', icono: false },
      { insignia: 'B18', titulo: 'Tcherassi', sub: 'Nevada ↔ Centro', icono: false },
    ]);
  });

  // Riesgo: una ruta sin código sale con la insignia vacía.
  it('sin código, la insignia lleva el ícono de ruta y el título el nombre entero', () => {
    const [fila] = filas(carrilRutas([ruta('R-1', 'Circular Norte')]));
    expect(fila).toEqual({ insignia: '', titulo: 'Circular Norte', sub: 'Granabastos ↔ Uninorte', icono: true });
  });

  // Riesgo: un nombre que es sólo el código deja el título en blanco.
  it('si el nombre es sólo el código, no lo parte y el título no queda vacío', () => {
    const [fila] = filas(carrilRutas([ruta('R-1', 'C16')]));
    expect(fila!.titulo).toBe('C16');
    expect(fila!.icono).toBe(true);
  });

  // Riesgo: una palabra que parece código pero no lo es (tres letras, cuatro cifras) se toma por código.
  it('una primera palabra que no es un código de parabrisas no se parte', () => {
    for (const nombre of ['ABC1 Centro', 'C1234 Centro', 'c16 Centro', 'Ruta 16']) {
      const [fila] = filas(carrilRutas([ruta('R-1', nombre)]));
      expect(fila!.titulo, nombre).toBe(nombre);
      expect(fila!.insignia, nombre).toBe('');
    }
  });

  // Riesgo: espacios de más en rutas.json descolocan el código o dejan huecos en el título.
  it('los espacios sobrantes del nombre no se cuelan en la insignia ni en el título', () => {
    const [fila] = filas(carrilRutas([ruta('R-1', '  B18   Tcherassi   Sur ')]));
    expect(fila!.insignia).toBe('B18');
    expect(fila!.titulo).toBe('Tcherassi Sur');
  });

  // Riesgo: una lista de rutas vacía revienta el selector entero.
  it('sin rutas la lista sale vacía, sin fallar', () => {
    const carril = carrilRutas([]);
    expect(carril.classList.contains('sheet-lista-inner')).toBe(true);
    expect(carril.children).toHaveLength(0);
  });

  // Riesgo: el guion no encuentra la fila que tiene que tocar (la busca por id de rutas.json).
  it('cada fila lleva el id de su ruta, en el orden de los datos', () => {
    const carril = carrilRutas(YV_RUTAS.rutas);
    expect(Array.from(carril.children, (f) => (f as HTMLElement).dataset.ruta)).toEqual(
      YV_RUTAS.rutas.map((r) => r.id)
    );
  });

  // Riesgo: un nombre con marcado HTML se pinta como HTML en vez de como texto.
  it('el nombre y las terminales se escriben como texto, no como HTML', () => {
    const carril = carrilRutas([ruta('R-1', 'C16 <b>Centro</b>', '<i>A</i>', 'B')]);
    expect(carril.querySelector('b, i')).toBeNull();
    expect(filas(carril)[0]!.titulo).toBe('<b>Centro</b>');
    expect(filas(carril)[0]!.sub).toBe('<i>A</i> ↔ B');
  });
});

describe('la lista de empresas', () => {
  const empresas = (): { nombre: string; iniciales: string; fondo: string; tinta: string; guion: boolean }[] =>
    Array.from(carrilEmpresas().querySelectorAll<HTMLElement>('.app-tile'), (fila) => {
      const insignia = fila.querySelector<HTMLElement>('.app-tile-icon')!;
      return {
        nombre: fila.querySelector('.app-tile-title')!.textContent!,
        iniciales: insignia.textContent!,
        fondo: insignia.style.background.toLowerCase(),
        tinta: insignia.style.color.toLowerCase(),
        guion: fila.dataset.el === 'tile-empresa',
      };
    });

  // Riesgo: el orden deja de ser alfabético y parece que se trata de favor a una empresa.
  it('van en orden alfabético, con sus iniciales', () => {
    expect(empresas().map((e) => [e.nombre, e.iniciales])).toEqual([
      ['Coolitoral', 'CO'],
      ['Sobusa', 'SO'],
      ['Sodis', 'SO'],
      ['Transmetro', 'TR'],
    ]);
  });

  // Riesgo: una empresa sale de un color distinto al que le da la app a su id.
  it('Sobusa sale en petróleo y Coolitoral en verde azulado, con iniciales en blanco', () => {
    const porNombre = Object.fromEntries(empresas().map((e) => [e.nombre, e]));
    const hex = (s: string): string => s.replace(/\s/g, '');
    // El navegador puede devolver el color en hex o en rgb(); los dos valen.
    expect(hex(porNombre.Sobusa!.fondo)).toMatch(/^(#1c5670|rgb\(28,86,112\))$/);
    expect(hex(porNombre.Coolitoral!.fondo)).toMatch(/^(#0f6a65|rgb\(15,106,101\))$/);
    for (const e of empresas()) expect(hex(e.tinta), e.nombre).toMatch(/^(#ffffff|rgb\(255,255,255\))$/);
  });

  // Riesgo: el dedo del guion busca una fila que no existe o toca otra empresa.
  it('sólo la del piloto lleva la marca que busca el dedo del guion', () => {
    expect(empresas().filter((e) => e.guion).map((e) => e.nombre)).toEqual([EMPRESA.nombre]);
  });
});
