/**
 * Arranque de /empresas.html.
 *
 * La página que lee una empresa de transporte antes de decidir si conecta
 * su flota. No tiene mapa en vivo, ni teléfono en marcha, ni
 * scrollytelling: es el panel de control entero en un monitor, que se
 * deja tocar, lo que la empresa gana con él y el formulario. Así que carga
 * sólo las cuatro piezas que de verdad usa —la isla de navegación, las
 * apariciones al entrar en pantalla, el panel y el formulario—, no el
 * paquete entero de la portada.
 *
 * `phone-simulator.css` se queda fuera por lo mismo: aquí no hay ningún
 * teléfono que vestir.
 */

import './css/fonts.css';
import './css/variables.css';
import './css/base.css';
import './css/layout.css';
import './css/components.css';

/* El CSS de esta página no entra en `components.css`: sólo se usa aquí, y
   metiéndolo en el índice común lo pagaban también la portada y las
   legales. Va después, así que en la cascada sigue siendo el último. */
import './css/componentes/empresas-pagina.css';
import './css/animations.css';
import './css/accesibilidad.css';

import { ContactForm } from './contact-form';
import { NavIsland } from './nav-island';
import { PanelFlota } from './panel-flota';
import { encenderScrollSuave } from './scroll-suave';
import { ScrollEffects } from './scroll-effects';

const arrancar = (): void => {
  new ScrollEffects();

  const isla = document.querySelector<HTMLElement>('.nav-island');
  const botonIsla = isla?.querySelector<HTMLButtonElement>('.nav-island-toggle');
  if (isla && botonIsla) new NavIsland(isla, botonIsla);

  const flota = document.querySelector<HTMLElement>('.flota');
  if (flota) new PanelFlota(flota);

  const form = document.querySelector<HTMLFormElement>('#contact-form');
  if (form) new ContactForm(form);
};

encenderScrollSuave();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar, { once: true });
} else {
  arrancar();
}
