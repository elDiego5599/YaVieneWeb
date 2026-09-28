import { describe, expect, it } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';
import { fichaDeRuta } from '../src/rutas';

/**
 * La sección del mapa escribe sus cifras con coma decimal: «326,8
 * kilómetros» en el resumen y «4,3 km» en la lectura del bus. Las fichas
 * de ruta decían «56.9 km», con punto, justo encima de las dos: tres
 * números de la misma pieza en dos idiomas.
 */
describe('el kilometraje de las fichas de ruta', () => {
  it('va con coma decimal, como el resto de la sección', () => {
    for (const ruta of YV_RUTAS.rutas) {
      const km = fichaDeRuta(ruta).querySelector('.ruta-ficha-km')!.textContent!;
      expect(km).toBe(`${ruta.km.toFixed(1).replace('.', ',')} km`);
      expect(km).not.toMatch(/\d\.\d/);
    }
  });
});
