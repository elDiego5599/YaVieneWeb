import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guardas de la auditoría `apple-design` sobre el CSS. Leen las hojas como
 * texto, igual que `pildora.test.ts`: no miden píxeles, atan lo que la
 * auditoría pidió para que una edición futura no lo deshaga sin enterarse.
 */

const css = (nombre: string): string =>
  readFileSync(resolve(process.cwd(), 'src/css', nombre), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Cuerpo de un `@media (...)` buscado por su condición, con llaves balanceadas. */
const media = (hoja: string, condicion: string): string => {
  const ini = hoja.indexOf(`@media ${condicion}`);
  if (ini < 0) return '';
  let i = hoja.indexOf('{', ini);
  const desde = i + 1;
  for (let nivel = 0; i < hoja.length; i++) {
    if (hoja[i] === '{') nivel++;
    if (hoja[i] === '}' && --nivel === 0) return hoja.slice(desde, i);
  }
  return '';
};

/** Cuerpos de todas las reglas cuyo selector (lista) incluye exactamente `selector`. */
const reglas = (hoja: string, selector: string): string =>
  Array.from(hoja.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter(([, sel]) => sel.split(',').some((s) => s.trim() === selector))
    .map(([, , cuerpo]) => cuerpo)
    .join('\n');

const nav = css('componentes/nav.css');
const botones = css('componentes/botones.css');
const mapa = css('componentes/mapa.css');
const pie = css('componentes/pie.css');
const acc = css('accesibilidad.css');
const anim = css('animations.css');
const sim = css('phone-simulator.css');

describe('movimiento reducido: quita el desplazamiento y deja el fundido', () => {
  const reducido = media(anim, '(prefers-reduced-motion: reduce)');

  it('las apariciones, el aviso del mapa y el panel del menú se funden en ~200 ms', () => {
    expect(reglas(reducido, '.reveal')).toMatch(/transition:\s*opacity 0?\.2s/);
    expect(reglas(reducido, '.reveal')).toMatch(/transform:\s*none\s*!important/);
    expect(reglas(reducido, '.mapa-aviso')).toMatch(/transition:[^;]*opacity 0?\.2s/);
    expect(reglas(reducido, '.mapa-aviso')).toMatch(/transform:\s*none\s*!important/);
  });

  it('el panel del menú móvil se funde y el botón que lo abre sigue ahí', () => {
    const r = media(nav, '(prefers-reduced-motion: reduce)');
    expect(reglas(r, '.nav-island-toggle')).not.toMatch(/display:\s*none/);
    expect(r).toMatch(/\.nav-island-reveal[\s\S]*opacity 0?\.2s/);
  });

  it('la cifra que cambia se funde en vez de apagarse', () => {
    expect(sim).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.cifra-sube,\s*\.cifra-baja\s*\{\s*animation:\s*cifra-funde 200ms[^;]*!important/
    );
    expect(sim).toMatch(/@keyframes cifra-funde\s*\{\s*from\s*\{\s*opacity:\s*0;?\s*\}\s*\}/);
  });
});

describe('transparencia reducida', () => {
  const r = media(acc, '(prefers-reduced-transparency: reduce)');

  it('la cabecera pasa a papel opaco y sin desenfoque', () => {
    expect(reglas(r, '.site-header')).toMatch(/backdrop-filter:\s*none/);
    expect(reglas(r, '.site-header:not(.is-arriba)')).toMatch(/background:\s*var\(--papel\)/);
  });

  it('el crédito del mapa y el botón del pie dejan de ser translúcidos', () => {
    expect(reglas(r, '.mapa-credito')).toMatch(/background:\s*#fff/i);
    expect(reglas(r, '.footer-actions .btn-outline')).toMatch(/background:\s*#fff/i);
  });
});

describe('más contraste', () => {
  const r = media(acc, '(prefers-contrast: more)');

  it('sube las tintas y las líneas a tonos plenos', () => {
    const raiz = reglas(r, ':root');
    expect(raiz).toMatch(/--tinta-media:\s*rgba\(11,\s*18,\s*32,\s*0?\.88\)/);
    expect(raiz).toMatch(/--tinta-tenue:\s*rgba\(11,\s*18,\s*32,\s*0?\.78\)/);
    expect(raiz).toMatch(/--text-muted:\s*var\(--tinta-tenue\)/);
    expect(raiz).toMatch(/--linea:\s*rgba\(11,\s*18,\s*32,\s*0?\.45\)/);
    expect(raiz).toMatch(/--linea-fuerte:\s*rgba\(11,\s*18,\s*32,\s*0?\.45\)/);
  });

  it('la cabecera es opaca, sin desenfoque y con filo', () => {
    const c = reglas(r, '.site-header:not(.is-arriba)');
    expect(c).toMatch(/background:\s*var\(--papel\)/);
    expect(c).toMatch(/backdrop-filter:\s*none/);
    expect(c).toMatch(/var\(--linea-fuerte\)/);
  });

  it('interruptor y ficha de ruta llevan borde de 1px (el botón de contorno ya usa el token)', () => {
    for (const sel of ['.interruptor', '.ruta-ficha']) {
      expect(reglas(r, sel), sel).toMatch(/border:\s*1px solid var\(--linea-fuerte\)/);
    }
  });
});

describe('cabecera al bajar: sombra de borde, no línea', () => {
  it('no tiene border-bottom y la sombra viaja con la transición', () => {
    const base = reglas(nav, '.site-header');
    const bajada = reglas(nav, '.site-header:not(.is-arriba)');
    expect(base).not.toMatch(/border-bottom/);
    expect(bajada).not.toMatch(/border-bottom/);
    expect(bajada).toMatch(
      /box-shadow:\s*0 1px 0 rgba\(11,\s*18,\s*32,\s*0?\.06\),\s*0 8px 24px -16px rgba\(11,\s*18,\s*32,\s*0?\.18\)/
    );
    expect(base).toMatch(/transition:[^;]*box-shadow 0\.8s var\(--ease-fluida\)/);
  });
});

describe('menú móvil', () => {
  const reveal = reglas(nav, '.nav-island-reveal') + reglas(nav, '.nav-island.is-open > .nav-island-reveal');

  it('nace del botón y no del centro del panel', () => {
    expect(reveal).toMatch(/transform-origin:\s*calc\(100% - 19px\) 0/);
  });

  it('abre y cierra con la curva fluida, sin rebote', () => {
    expect(reveal).not.toMatch(/ease-spring/);
    expect(reglas(nav, '.nav-island.is-open > .nav-island-reveal')).toMatch(
      /transform 0\.3s var\(--ease-fluida\)/
    );
    expect(reglas(nav, '.nav-island-reveal')).toMatch(/transform 0\.22s var\(--ease-fluida\)/);
  });

  it('el botón de la barra conserva opacidad y transform en su transición', () => {
    const cta = reglas(nav, '.nav-island .nav-island-cta');
    expect(cta).toMatch(/transition:[\s\S]*opacity /);
    expect(cta).toMatch(/transition:[\s\S]*transform /);
  });

  it('el nombre de la sección va en tinta media', () => {
    expect(reglas(nav, '.nav-lugar')).toMatch(/color:\s*var\(--tinta-media\)/);
  });

  it('no queda el desplazamiento muerto de 880 que otra regla pisa', () => {
    expect(nav).not.toMatch(/translateX\(-12px\)/);
  });
});

describe('botones y avisos', () => {
  it('.btn-primary / .btn-outline transicionan transform (el :active)', () => {
    expect(reglas(botones, '.btn-primary')).toMatch(/transition:[^;]*transform var\(--transition-hover\)/);
  });

  it('la flecha y el aviso del mapa no rebotan', () => {
    expect(reglas(botones, '.btn-flecha')).not.toMatch(/ease-spring/);
    expect(reglas(botones, '.btn-flecha')).toMatch(/transform 0\.38s var\(--ease-fluida\)/);
    expect(reglas(mapa, '.mapa-aviso')).not.toMatch(/ease-spring/);
    expect(reglas(mapa, '.mapa-aviso')).toMatch(/transform 0\.45s var\(--ease-fluida\)/);
  });
});

describe('animar solo lo que va por la tarjeta gráfica', () => {
  const panel = css('componentes/empresas-pagina.css');

  it('el botón del interruptor de flota se mueve con translate y scale', () => {
    const t = reglas(panel, '.flota-interruptor::after');
    expect(t).not.toMatch(/transition:[^;]*\b(top|left|width|height)\b/);
    expect(t).toMatch(/transition:[^;]*translate/);
    expect(t).toMatch(/transition:[^;]*scale/);
    expect(reglas(panel, '.flota-fila--oculta .flota-interruptor::after')).not.toMatch(
      /\b(top|left|width|height):/
    );
  });

  it('la fila del 404 desliza su contenido y no su relleno', () => {
    const e = css('componentes/error-404.css');
    expect(e).not.toMatch(/transition:[^;]*padding-left/);
    expect(e).not.toMatch(/padding-left:\s*10px/);
  });
});

describe('código muerto fuera', () => {
  it('ni el bus de tinta ni la respiración del pie existen ya', () => {
    expect(sim).not.toMatch(/tinta-bus|tinta-estela/);
    expect(pie).not.toMatch(/footer-gradient-respiro/);
  });
});

describe('tipografía', () => {
  const hero = css('componentes/hero.css');
  const rutas = css('componentes/rutas.css');
  const legales = css('componentes/legales.css');
  const e404 = css('componentes/error-404.css');
  const empresas = css('componentes/empresas-pagina.css');

  it('los títulos activan el tamaño óptico', () => {
    expect(reglas(css('base.css'), 'h1, h2, h3, h4') + reglas(css('base.css'), 'h1')).toMatch(
      /font-optical-sizing:\s*auto/
    );
  });

  it('el pie: cifra apretada y titular a 30 px en móvil y 54 en escritorio', () => {
    const fuerte = Array.from(pie.matchAll(/\.footer-status strong\s*\{([^}]*)\}/g)).map((m) => m[1]).join('');
    expect(fuerte).toMatch(/line-height:\s*1\.05/);
    expect(pie).toMatch(/font-size:\s*clamp\(30px,\s*1\.35rem \+ 2\.25vw,\s*54px\)/);
  });

  it('titulares de mapa y empresas: 600 y -0.035em, como el resto', () => {
    for (const hoja of [mapa, empresas]) {
      const t = reglas(hoja, '.mapa-inner > .seccion-cabecera .seccion-titulo') +
        reglas(hoja, '#panel .seccion-titulo');
      expect(t).toMatch(/font-weight:\s*600/);
      expect(t).toMatch(/letter-spacing:\s*-0\.035em/);
    }
  });

  it('letra pequeña con tracking neutro o positivo', () => {
    expect(reglas(hero, '.tienda-chip')).toMatch(/letter-spacing:\s*0;/);
    expect(reglas(hero, '.hero-credit')).toMatch(/letter-spacing:\s*0?\.015em/);
    expect(reglas(mapa, '.mapa-credito')).toMatch(/letter-spacing:\s*0?\.015em/);
    const fecha = reglas(legales, '.legal-fecha');
    expect(fecha).toMatch(/letter-spacing:\s*0?\.08em/);
    expect(fecha).toMatch(/font-weight:\s*700/);
    expect(fecha).toMatch(/line-height:\s*1\.3/);
    // La insignia de la ficha de ruta espeja `AppTextStyles.etiqueta` (-0,1 de tracking).
    expect(reglas(rutas, '.ruta-ficha-insignia')).toMatch(/letter-spacing:\s*-0\.1px/);
  });

  it('los rótulos del 404 usan el tracking de los demás rótulos y peso 600', () => {
    for (const sel of ['.err-ojo', '.err-pedida-rotulo', '.err-indice-rotulo']) {
      const r = reglas(e404, sel);
      expect(r, sel).toMatch(/letter-spacing:\s*var\(--rotulo-track\)/);
      expect(r, sel).toMatch(/font-weight:\s*600/);
    }
  });
});

describe('contraste del texto secundario', () => {
  const hero = css('componentes/hero.css');
  it('subtítulo, crédito y línea legal del pie van en tinta media (≥ 4,5:1)', () => {
    expect(reglas(hero, '.hero-subtext-lead')).toMatch(/color:\s*var\(--tinta-media\)/);
    expect(reglas(hero, '.hero-credit')).toMatch(/color:\s*var\(--tinta-media\)/);
    const bajo = Array.from(pie.matchAll(/\.footer-bottom\s*\{([^}]*)\}/g)).map((m) => m[1]).join('');
    expect(bajo).toMatch(/color:\s*var\(--tinta-media\)/);
  });

  it('la línea del pie se vuelve aire: sin border-top en .footer-bottom', () => {
    const bajo = Array.from(pie.matchAll(/\.footer-bottom\s*\{([^}]*)\}/g)).map((m) => m[1]).join('');
    expect(bajo).not.toMatch(/border-top/);
  });
});
