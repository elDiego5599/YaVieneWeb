/**
 * Arranque de términos y privacidad.
 *
 * Tenían cabecera y pie propios y no cargaban JavaScript (iban con
 * `hoja.ts`, como el 404). Desde que llevan la misma isla de navegación y
 * el mismo pie que el resto del sitio (2026-09-28) necesitan lo que los
 * mueve: la isla que se abre y se cierra, y el rebote de iOS que tiñe el
 * lienzo con el color del pie. Nada más: ni apariciones ni mapa.
 */

import './css/fonts.css';
import './css/variables.css';
import './css/base.css';
import './css/layout.css';
import './css/components.css';
import './css/accesibilidad.css';

import { NavIsland } from './nav-island';
import { reboteDelPie } from './rebote';

const arrancar = (): void => {
  const isla = document.querySelector<HTMLElement>('.nav-island');
  const botonIsla = isla?.querySelector<HTMLButtonElement>('.nav-island-toggle');
  if (isla && botonIsla) new NavIsland(isla, botonIsla);
  reboteDelPie();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar, { once: true });
} else {
  arrancar();
}
