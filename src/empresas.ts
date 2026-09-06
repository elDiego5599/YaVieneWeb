/**
 * Arranque de /empresas.html.
 *
 * La página que lee una empresa de transporte antes de decidir si conecta
 * su flota. No tiene mapa, ni teléfono en marcha, ni scrollytelling: es
 * una explicación, un recorte del panel de control y el formulario, así
 * que carga sólo las tres piezas que de verdad usa —la isla de
 * navegación, las apariciones al entrar en pantalla y el formulario—, no
 * el paquete entero de la portada.
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

import { marcarAnimable } from './animable';
import { ContactForm } from './contact-form';
import { NavIsland } from './nav-island';
import { encenderScrollSuave } from './scroll-suave';
import { ScrollEffects } from './scroll-effects';

const arrancar = (): void => {
  new ScrollEffects();

  const isla = document.querySelector<HTMLElement>('.nav-island');
  const botonIsla = isla?.querySelector<HTMLButtonElement>('.nav-island-toggle');
  if (isla && botonIsla) new NavIsland(isla, botonIsla);

  const form = document.querySelector<HTMLFormElement>('#contact-form');
  if (form) new ContactForm(form);
};

// Lo mismo que en la portada: sin esta marca nada empieza escondido, así
// que si el guion no llega la página se lee igual. Ver animable.ts.
marcarAnimable();

encenderScrollSuave();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar, { once: true });
} else {
  arrancar();
}
