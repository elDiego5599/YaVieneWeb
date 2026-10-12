import { describe, expect, it } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';
import { codigoDeRuta, fichaDeRuta } from '../src/rutas';

/**
 * La ficha del riel se lee como la fila del selector de la app
 * (`route_selector_sheet.dart`): el código («C16») en su insignia y al
 * lado el resto del nombre. Decisión del dueño, 2026-10-12: sin terminales
 * ni kilometraje en la ficha.
 */
describe('codigoDeRuta (espejo de _routeCode)', () => {
  it.each([
    ['B18 Tcherassi', { code: 'B18', rest: 'Tcherassi' }],
    ['C12 Vivero Paraíso', { code: 'C12', rest: 'Vivero Paraíso' }],
    ['  C14   Carrera 54 Uninorte ', { code: 'C14', rest: 'Carrera 54 Uninorte' }],
    ['101 Centro', { code: '101', rest: 'Centro' }],
    ['AB12C Norte', { code: 'AB12C', rest: 'Norte' }],
  ])('separa «%s»', (nombre, esperado) => {
    expect(codigoDeRuta(nombre)).toEqual(esperado);
  });

  // Riesgo: una ruta sin código, o solo código, pierde su título.
  it.each(['Ruta Norte', 'B18', '  ', '', 'ABC123 Sur', 'B1234 Sur', 'b18 Sur'])(
    '«%s» no tiene código: se queda el nombre entero',
    (nombre) => {
      expect(codigoDeRuta(nombre)).toBeNull();
    },
  );

  it('las seis rutas de hoy traen código', () => {
    for (const ruta of YV_RUTAS.rutas) expect(codigoDeRuta(ruta.nombre)).not.toBeNull();
  });
});

describe('la ficha del riel', () => {
  const ruta = YV_RUTAS.rutas[0]!;

  it('lleva la insignia con el código y al lado el nombre sin él', () => {
    const f = fichaDeRuta(ruta);
    expect(f.querySelector('.ruta-ficha-insignia')!.textContent).toBe('B18');
    expect(f.querySelector('.ruta-ficha-nombre')!.textContent).toBe('Tcherassi');
  });

  // Riesgo: las terminales o el kilometraje vuelven a la ficha.
  it('no lleva terminales, flecha ni kilometraje', () => {
    const f = fichaDeRuta(ruta);
    expect(f.textContent).not.toContain(ruta.terminalA);
    expect(f.textContent).not.toContain(ruta.terminalB);
    expect(f.textContent).not.toContain('km');
    expect(f.querySelector('.ruta-ficha-tramo, .ruta-ficha-flecha, .ruta-ficha-km')).toBeNull();
  });

  // Riesgo: dos spans pegados se leen «B18Tcherassi».
  it('el nombre accesible es el nombre entero de la ruta', () => {
    expect(fichaDeRuta(ruta).getAttribute('aria-label')).toBe(ruta.nombre);
  });

  it('sin código, solo el nombre entero y sin insignia', () => {
    const f = fichaDeRuta({ ...ruta, nombre: 'Ruta Norte' });
    expect(f.querySelector('.ruta-ficha-insignia')).toBeNull();
    expect(f.querySelector('.ruta-ficha-nombre')!.textContent).toBe('Ruta Norte');
  });

  // Riesgo: un nombre con marcado se pinta como HTML.
  it('el nombre se escribe como texto', () => {
    const f = fichaDeRuta({ ...ruta, nombre: '<img src=x>' });
    expect(f.querySelector('img')).toBeNull();
    expect(f.querySelector('.ruta-ficha-nombre')!.textContent).toBe('<img src=x>');
  });
});
