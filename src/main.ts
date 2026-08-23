/**
 * Arranque de la landing.
 *
 * Los estilos se importan aquí y no con <link> en el HTML: así el
 * empaquetador los junta, los versiona y avisa si un archivo desaparece,
 * en vez de que la página se cargue sin la mitad de su CSS.
 *
 * Cada módulo recibe los elementos que necesita ya resueltos. Si alguno
 * falta, esto lo detecta y se salta esa pieza; ninguna clase se construye
 * a medias con referencias nulas por dentro.
 */

import './css/variables.css';
import './css/base.css';
import './css/layout.css';
import './css/components.css';
import './css/phone-simulator.css';
import './css/animations.css';

import { ContactForm } from './contact-form';
import { NavIsland } from './nav-island';
import { PhoneMap } from './phone-map';
import { PhoneSimulator } from './phone-simulator';
import { ScrollEffects } from './scroll-effects';

const arrancar = (): void => {
  // Apariciones al entrar en pantalla: no depende de nada más.
  new ScrollEffects();

  const isla = document.querySelector<HTMLElement>('.nav-island');
  const botonIsla = isla?.querySelector<HTMLButtonElement>('.nav-island-toggle');
  if (isla && botonIsla) new NavIsland(isla, botonIsla);

  const svg = document.querySelector<SVGSVGElement>('#phone-routes');
  const lienzo = document.querySelector<HTMLElement>('#phone-map');
  const pantalla = document.querySelector<HTMLElement>('#phone');
  if (svg && lienzo && pantalla) {
    new PhoneSimulator(new PhoneMap(svg, lienzo), pantalla);
  }

  const form = document.querySelector<HTMLFormElement>('#contact-form');
  if (form) new ContactForm(form);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar, { once: true });
} else {
  arrancar();
}
