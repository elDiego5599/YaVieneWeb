import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La banda «Cómo funciona» (dueño, 2026-10-12): antes de «Problema»,
 * justo después de la cinta de logos y su divisor. Texto a la izquierda, con
 * su ceja (dueño, 2026-10-12, que la quitó y la devolvió), y a la derecha un mockup breve de la app del
 * pasajero, como el bloque de On-call de incident.io (dueño, 2026-10-12)
 * con su cuadro grande sobre el fondo blanco: un cuadro en el verde de «Problema» con el
 * teléfono (el mismo mapa que los del hero) y, debajo, los tres pasos como
 * pestañas que cambian lo que enseña la pantalla. El teléfono es
 * decoración (`aria-hidden`); cada paso lleva su descripción para el
 * lector de pantalla. El divisor que sigue a la cinta de logos queda antes
 * de esta banda; entre ella y «Problema» ya no va raya (dueño, 2026-10-12).
 *
 * Su id NO es `solucion`: `sin-como-funciona.test.ts` sigue vigilando
 * que la sección vieja no vuelva.
 */
const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8');
const html = leer('index.html').replace(/<!--[\s\S]*?-->/g, '');
const css = leer('src/css/componentes/como-funciona.css');
const cssTelefono = leer('src/css/phone-simulator.css');

const banda = /<section[^>]*id="como-funciona"[^>]*>[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
const divisor = '<hr class="divisor" aria-hidden="true" />';

describe('banda «Cómo funciona»', () => {
  it('va justo antes de #problema, sin divisor entre las dos (dueño, 2026-10-12: la raya sobraba)', () => {
    expect(banda).not.toBe('');
    const ini = html.indexOf(banda);
    const problema = html.indexOf('id="problema"');
    expect(problema).toBeGreaterThan(ini);
    expect(html.slice(ini + banda.length).trimStart().startsWith('<section class="panel panel--banda" id="problema"')).toBe(true);
    const finMarcas = html.indexOf('</section>', html.indexOf('id="marcas"')) + '</section>'.length;
    expect(html.slice(finMarcas).trimStart().startsWith(divisor)).toBe(true);
  });

  it('la cinta de siete logos va tras el hero sin raya y con una antes de la primera sección, sin texto (dueño, 2026-10-12)', () => {
    const franja = /<section[^>]*id="marcas"[^>]*>[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(franja).not.toBe('');
    const ini = html.indexOf(franja);
    const fin = ini + franja.length;
    expect(html.indexOf('id="hero"')).toBeLessThan(ini);
    expect(html.slice(html.indexOf('id="hero"'), ini)).not.toContain(divisor);
    expect(html.slice(fin).trimStart().startsWith(divisor)).toBe(true);
    expect(html.split(divisor)).toHaveLength(2);
    expect(html.indexOf('id="como-funciona"')).toBeGreaterThan(fin);
    expect(franja.match(/empresa-marcas-grupo/g)).toHaveLength(2);
    expect(franja).toMatch(/empresa-marcas-grupo" aria-hidden="true"/);
    expect(franja.match(/<img [^>]*alt="[^"]+"/g)).toHaveLength(7);
    expect(franja.match(/<img [^>]*alt=""/g)).toHaveLength(7);
    // Nada de texto visible: ni titulares, ni párrafos, ni enlaces.
    expect(franja).not.toMatch(/<h[1-6]|<p\b|<a\b|<span|<button/);
    expect(franja.replace(/<[^>]*>/g, '').trim()).toBe('');
  });

  it('lleva titular con acento verde y párrafo, sin ceja ni botón (dueño, 2026-10-12)', () => {
    expect(banda).not.toMatch(/cf-ceja/);
    expect(banda).toMatch(/<h2[^>]*>\s*Tres pasos <span class="acentuado">y ya sabes dónde viene\.<\/span>\s*<\/h2>/);
    expect(banda.slice(0, banda.indexOf('cf-demo'))).not.toMatch(/<a\b|btn-primary/);
  });

  it('separa la segunda frase del subtítulo y añade una explicación por paso', () => {
    expect(banda).toMatch(/class="seccion-lead">Escoge tu ruta, mira el bus moverse en el mapa y deja un aviso\.<br\s*\/>Te avisamos cuando esté cerca de ti\./);
    // Cada paso lleva su idea con título en el rojo de «Problema» y el
    // texto en gris (dueño, 2026-10-12).
    const extras = [
      ['Cero fricción', 'Sin cuentas, sin correos y sin contraseñas. Abres la app, seleccionas tu empresa y en dos toques estás viendo el recorrido completo.'],
      ['Cálculo real', 'La distancia no se mide en línea recta; calcula los giros y el trazado real de la calle. Si la app dice 940 metros, es porque esa es la distancia exacta sobre el asfalto.'],
      ['Seguridad en la calle', 'Activa la notificación y guarda el teléfono. No tienes que estar con el celular en la mano en el paradero mirando la pantalla cada 30 segundos.'],
    ];
    for (const [i, paso] of ['ruta', 'bus', 'aviso'].entries()) {
      const [titulo, texto] = extras[i];
      expect(banda).toContain(
        `<div class="cf-explica-extra"><p class="cf-extra-titulo">${titulo}</p><p class="cf-extra-texto">${texto}</p></div>`
      );
      expect(banda.match(new RegExp(`<p class="solo-lectores" data-paso="${paso}"[^>]*>[^<]*${titulo}\\. ${texto}</p>`))).not.toBeNull();
    }
    expect(banda).not.toMatch(/Sobusa ya había pasado|desayunar|metro a metro/);
    expect(css).toMatch(/\.cf-explica-extra\s*\{[^}]*background:\s*#fff/s);
    expect(css).toMatch(/\.cf-extra-titulo\s*\{[^}]*color:\s*var\(--coral-accessible\)/s);
    expect(css).toMatch(/\.cf-extra-texto\s*\{[^}]*color:\s*var\(--tinta-tenue\)/s);
  });

  it('a lo ancho, el texto del paso termina donde termina la escena, no las pestañas', () => {
    const ancho = css.slice(css.lastIndexOf('@media (min-width: 1024px)'));
    // La demo ocupa dos filas (escena y pestañas) y comparte sus líneas con
    // la caja: el texto vive solo en la primera, la de la escena.
    expect(ancho).toMatch(/\.cf-demo\s*\{[^}]*grid-row:\s*1 \/ span 2[^}]*grid-template-rows:\s*subgrid/s);
    expect(ancho).toMatch(/\.cf-texto\s*\{[^}]*grid-row:\s*1/s);
    expect(ancho).toMatch(/\.cf-grid\s*\{[^}]*row-gap:\s*0/s);
  });

  it('los pasos son un carrusel: se recorta de lado y cambia con botones', () => {
    // Una sola lámina: la caja grande recorta, y texto y cuadro viajan lo
    // mismo, su ancho entero (dueño, 2026-10-13).
    expect(css).toMatch(/\.cf-grid\s*\{[^}]*--cf-viaje:\s*calc\(100cqw \+ 2 \* var\(--cf-aire\)\)[^}]*container-type:\s*inline-size[^}]*overflow-x:\s*clip/s);
    for (const pieza of ['explica', 'escena']) {
      expect(css).toMatch(new RegExp(`\\.cf-${pieza}\\s*\\{[^}]*translate:\\s*calc\\(var\\(--cf-lugar\\) \\* var\\(--cf-viaje\\)`, 's'));
    }
    expect(css.match(/\.cf-texto\s*\{[^}]*\}/)![0]).not.toMatch(/overflow/);
    expect(css).toMatch(/\.cf-explica\[data-lugar="antes"\]\s*\{[^}]*--cf-lugar:\s*-1/s);
    expect(css).toMatch(/\.cf-explica\[data-lugar="despues"\]\s*\{[^}]*--cf-lugar:\s*1/s);
    // El cuadro entero viaja con el texto: fondo, esquinas y filo son de
    // la escena, y el marco no recorta (dueño, 2026-10-13).
    // Las flechas van fuera de la caja que recorta, para montarse en su
    // filo exterior (dueño, 2026-10-13).
    expect(banda).toMatch(/<div class="cf-carrusel">\s*<button type="button" class="cf-control cf-control--anterior"[\s\S]*?<button type="button" class="cf-control cf-control--siguiente"[\s\S]*?<\/button>\s*<div class="cf-grid">/);
    expect(banda).toMatch(/<div class="cf-marco">\s*<div class="cf-escena"/);
    expect(css.match(/\.cf-marco\s*\{[^}]*\}/)![0]).not.toMatch(/overflow|background|border-radius/);
    expect(css).not.toContain('.cf-marco::after');
    expect(css).toMatch(/\.cf-escena\s*\{[^}]*border-radius:\s*20px[^}]*background:/s);
    expect(css).toMatch(/\.cf-escena::after\s*\{[^}]*z-index:\s*3[^}]*border:\s*1px/s);
    // Al dar la vuelta, lo que llega se pasa y vuelve, y cabe en el aire.
    expect(css).toMatch(
      /\.cf-grid\[data-rebote\] :is\(\.cf-explica, \.cf-escena\)[^{]*\{[^}]*cubic-bezier\(0\.3, 0, 0\.2, 1\.2\)/s
    );
    expect(css).toMatch(/\.cf-escena\[data-lugar="antes"\]\s*\{[^}]*--cf-lugar:\s*-1/s);
    // Con movimiento reducido no hay desliz: solo el fundido.
    const reducido = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducido).toMatch(/\.cf-explica,\s*\.cf-escena\s*\{[^}]*translate:\s*none/s);
  });


  it('las flechas quedan ocultas hasta hover/foco, aparecen en táctil y miden 44 px', () => {
    expect(banda).toMatch(/class="cf-control cf-control--anterior" aria-label="Paso anterior" aria-controls="cf-escena" hidden/);
    expect(banda).toMatch(/class="cf-control cf-control--siguiente" aria-label="Paso siguiente" aria-controls="cf-escena" hidden/);
    expect(css).toMatch(/\.cf-control\s*\{[^}]*position:\s*absolute[^}]*width:\s*44px[^}]*height:\s*44px/s);
    expect(css).toMatch(/@media \(hover:\s*hover\) and \(pointer:\s*fine\)[\s\S]*?\.cf-control \{ opacity:\s*0/);
    expect(css).toMatch(/\.cf-carrusel:hover \.cf-control/);
    // Centradas en el filo de la caja grande: mitad dentro, mitad fuera.
    expect(css).toMatch(/\.cf-control--anterior\s*\{[^}]*left:\s*0[^}]*translate:\s*max\(-50%, -1 \* var\(--calle\)\) -50%/s);
    expect(css).toMatch(/\.cf-control--siguiente\s*\{[^}]*right:\s*0[^}]*translate:\s*min\(50%, var\(--calle\)\) -50%/s);
    expect(css).toMatch(/@media \(hover:\s*none\)[\s\S]*?\.cf-control \{ opacity:\s*1/);
    expect(css).toMatch(/\.cf-carrusel:focus-within \.cf-control/);
    // Con 60 px libres a cada lado, fuera de la caja, a 16 px de su filo.
    const ancho = css.slice(css.indexOf('@media (min-width: 1312px)'));
    expect(ancho).toMatch(/\.cf-control--anterior \{ translate:\s*calc\(-100% - 16px\) -50%/);
    expect(ancho).toMatch(/\.cf-control--siguiente \{ translate:\s*calc\(100% \+ 16px\) -50%/);
    expect(ancho).toMatch(/\.cf-carrusel::before\s*\{[^}]*inset:\s*0 -60px/s);
  });
  it('el teléfono no pinta una sombra rectangular sobre el fondo de la escena', () => {
    const tel = css.match(/\.cf-telefono \.phone-shell\s*\{[^}]*\}/)![0];
    expect(tel).not.toMatch(/box-shadow/);
  });

  it('«Elige tu ruta» se queda quieta: no repite su entrada (dueño, 2026-10-12)', () => {
    const main = readFileSync(resolve(process.cwd(), 'src/main.ts'), 'utf8');
    expect(main).not.toContain('cf-ruta-reproduciendo');
    expect(css).not.toContain('cf-ruta-reproduciendo');
  });

  it('la columna de texto no lleva logos ni botón', () => {
    expect(banda).not.toMatch(/empresa-marcas|logos-empresas/);
  });

  it('los tres pasos son pestañas que gobiernan la escena', () => {
    const pestanas = banda.match(/<button[^>]*role="tab"[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(banda).toMatch(/role="tablist"/);
    expect(pestanas.map((p) => p.replace(/<[^>]*>/g, '').trim())).toEqual([
      'Elige tu ruta',
      'Mira el bus',
      'Deja un aviso',
    ]);
    expect(pestanas.map((p) => /data-paso="(\w+)"/.exec(p)?.[1])).toEqual(['ruta', 'bus', 'aviso']);
    expect(pestanas.every((p) => p.includes('aria-controls="cf-escena"'))).toBe(true);
    expect(pestanas[0]).toMatch(/aria-selected="true"/);
    expect(pestanas.slice(1).every((p) => /aria-selected="false"[^>]*tabindex="-1"/.test(p))).toBe(true);
    expect(banda).toMatch(
      /id="cf-escena" role="tabpanel" aria-labelledby="cf-paso-ruta" data-paso="ruta" data-lugar="actual"/
    );
    // Una descripción por paso; sin JavaScript se lee la del primero.
    expect(banda.match(/class="solo-lectores" data-paso="\w+"/g)).toHaveLength(3);
    expect(banda.match(/class="solo-lectores" data-paso="\w+" hidden/g)).toHaveLength(2);
  });

  it('el teléfono es decoración, con el mapa de los del hero', () => {
    expect(banda).toMatch(/class="cf-telefono"[^>]*aria-hidden="true"/);
    expect(banda).toMatch(/class="phone-shell tel-marco"/);
    expect(banda).toMatch(/<img class="tel-marco-img" src="\/img\/marco-iphone\.webp" width="720" height="1469"[^>]*aria-hidden="true">/);
    expect(banda).toMatch(/<span class="phone-island"><\/span>/);
    expect(banda).not.toContain('phone-key');
    expect(cssTelefono).toMatch(/\.tel-marco\s*\{[^}]*aspect-ratio:\s*720 \/ 1469[^}]*padding:\s*0/s);
    expect(cssTelefono).toMatch(/\.tel-marco \.phone-screen\s*\{[^}]*width:\s*89\.8%[^}]*height:\s*95\.57%/s);
    expect(cssTelefono).toMatch(/\.tel-marco-img\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s);
    expect(banda).toMatch(/class="phone-map" id="cf-mapa-tel"/);
    expect(banda).toMatch(/class="phone-map" id="cf-mapa"/);
    expect(leer('src/main.ts')).toMatch(/#cf-mapa-tel/);
    // Lo que nombra la app, con sus palabras.
    expect(banda).toContain('Elige tu ruta');
    expect(banda).toMatch(/Te avisamos a 1,0 km/);
    expect(banda).toMatch(/eta-detail-accion">Cambiar</);
    document.body.innerHTML = banda;
    const aviso = document.querySelector('.cf-aviso-notificacion')!.textContent ?? '';
    expect(document.querySelector('.cf-aviso-titulo')?.textContent).toBe('Bus de la ruta C16 está cerca de ti'); // (dueño, 2026-10-12)
    expect(aviso).not.toMatch(/[A-Z]{3}\d{3}/);
    expect(aviso).not.toMatch(/\d\s?(m|km)\b/);
  });

  it('muestra las tres pantallas de la app y no duplica ids del hero', () => {
    expect(banda).toContain('Ver buses en vivo');
    expect(banda).toContain('Avisarme cuando esté cerca');
    expect(banda).toContain('Aviso activado');
    const idsHero = [...(html.matchAll(/\bid="([^"]+)"/g))].map((match) => match[1]);
    expect(new Set(idsHero).size).toBe(idsHero.length);
  });

  it('monta el mapa compartido como composición independiente para el paso del bus', () => {
    document.body.innerHTML = banda;
    expect(document.querySelectorAll('#cf-mapa')).toHaveLength(1);
    expect(document.querySelectorAll('#cf-mapa-tel')).toHaveLength(1);
    expect(banda).not.toMatch(/cf-capa--bus|cf-capa--aviso/);
    expect(document.querySelector('#cf-mapa')!.closest('.cf-mapa-tarjeta')).not.toBeNull();
    expect(document.querySelector('#cf-mapa-tel')!.closest('.phone-screen')).not.toBeNull();
    expect(document.querySelector('.cf-mapa-distancia')?.textContent).toContain('medido por la calle');
    expect(document.querySelector('.cf-mapa-distancia .eta-number')?.textContent).toBe('1,8');
    expect(document.querySelector('[role="tablist"]')!.closest('.cf-demo')).not.toBeNull();
  });

  it('muestra el selector de distancia y la notificación en la composición del aviso', () => {
    expect(banda).toContain('¿A qué distancia te avisamos?');
    expect(banda).toContain('900 m');
    expect(banda).toContain('1,0 km');
    expect(banda).toContain('1,1 km');
    expect(banda).toContain('800 m');
    expect(banda).toContain('1,2 km');
    expect(banda).toMatch(/class="cf-aviso-notificacion[^"]*"[^>]*aria-hidden="true"/);
    expect(banda).toMatch(/class="cf-guardar"[^>]*>Guardar</);
    expect(banda).toMatch(/class="eta-detail-accion">Cambiar</);
    expect(banda).toMatch(/Aviso activado/);
    expect(banda).toMatch(/Avisarme cuando esté cerca/);
    document.body.innerHTML = banda;
    expect(document.querySelector('.cf-aviso-composicion button, .cf-aviso-composicion h1, .cf-aviso-composicion h2, .cf-aviso-composicion h3')).toBeNull();
    expect(css).toMatch(/\.cf-aviso-texto\s*\{[^}]*text-align:\s*center/s);
    // La app y el aviso van en dos renglones, no pegados en uno.
    expect(css).toMatch(/\.cf-aviso-texto\s*\{[^}]*display:\s*grid/s);
    expect(css).toMatch(/\.cf-mapa-tarjeta\s+\.map-route-active\s*\{[^}]*stroke-width/s);
    expect(leer('src/main.ts')).toMatch(/pasoActual === 'aviso'/);
    expect(leer('src/main.ts')).toMatch(/cancelAnimationFrame/);
  });

  it('el paso del bus lleva una hoja con la distancia y el botón lleno, como eta_bottom_sheet.dart (dueño, 2026-10-12)', () => {
    document.body.innerHTML = banda;
    const hoja = document.querySelector('.cf-mapa-tarjeta .cf-mapa-hoja');
    expect(hoja?.querySelector('.cf-mapa-distancia')).not.toBeNull();
    expect(hoja?.querySelector('.cf-bus-cta')?.textContent).toBe('Avisarme cuando esté cerca');
    expect(css).toMatch(/\.cf-bus-cta\s*\{[^}]*background:\s*var\(--azul-boton\)/s);
    expect(css).toMatch(/\.cf-bus-cta\s*\{[^}]*color:\s*#fff/s);
    expect(leer('src/main.ts')).toMatch(/\.cf-mapa-hoja'\)\?\.classList\.(add|remove)\('cf-distancia-espera'\)/);
  });

  it('«Aviso activado» sale al guardar y la notificación 2 s después (dueño, 2026-10-12)', () => {
    expect(css).toMatch(/\.cf-aviso-confirmacion\s*\{[^}]*opacity:\s*0/s);
    expect(css).toMatch(/\.cf-aviso-guardado \.cf-aviso-confirmacion\s*\{[^}]*opacity:\s*1/s);
    const main = leer('src/main.ts');
    expect(main).toMatch(/classList\.add\('cf-aviso-guardado'\)/);
    expect(main).toMatch(/cf-notificacion-visible'\);\s*\}, 2000\)/);
  });

  it('en el paso de la ruta enseña el selector dentro del teléfono', () => {
    // Sin esta regla las capas se quedan en `opacity: 0` y el teléfono sale
    // con el mapa pelado.
    expect(css).toMatch(/\.cf-escena\[data-paso="ruta"\] \.cf-capa--ruta\s*\{[^}]*opacity:\s*1/);
  });

  it('pone las fichas de la ruta delante de la flecha y el mapa en una tarjeta inset', () => {
    expect(css).toMatch(/\.cf-chips\s*\{[^}]*z-index:\s*2/);
    expect(css).toMatch(/\.cf-flecha\s*\{[^}]*z-index:\s*1/);
    expect(css).toMatch(/\.cf-mapa-tarjeta \.phone-map\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s);
    expect(css).toMatch(/\.cf-tap\b/);
  });

  it('usa la ciudad completa y tokens de acabado sereno en la demo', () => {
    expect(leer('src/main.ts')).toMatch(/new PhoneMap\(svgCf, lienzoCf, \{ zoom: 1 \}\)/);
    expect(css).toMatch(/--cf-borde:\s*rgba\(/);
    expect(css).toMatch(/--cf-sombra:\s*0 1px 2px/);
    expect(css).toMatch(/scale:\s*0\.985/);
  });

  it('espeja Dart con su comentario y entra con el .reveal de la página', () => {
    expect(css).toMatch(/eta_bottom_sheet\.dart/);
    expect(css).toMatch(/bus_notification_service\.dart/);
    expect(banda).toMatch(/class="cf-demo reveal"/);
    expect(leer('src/css/components.css')).toContain("./componentes/como-funciona.css");
  });

  it('en el paso 2 se toca «Avisarme», sale la campanita y la hoja vibra (dueño, 2026-10-15)', () => {
    document.body.innerHTML = banda;
    const cta = document.querySelector('.cf-mapa-hoja .cf-bus-cta');
    expect(cta?.querySelector('svg.cf-campana[aria-hidden="true"]')).not.toBeNull();
    const main = leer('src/main.ts');
    expect(main).toMatch(/classList\.add\('cf-aviso-puesto'\)/);
    expect(main).toMatch(/classList\.remove\([^)]*'cf-aviso-puesto'/);
    expect(css).toMatch(/\.cf-aviso-puesto\s*\{[^}]*animation:\s*cf-vibrar/s);
    expect(css).toMatch(/\.cf-aviso-puesto \.cf-campana\s*\{[^}]*animation:\s*cf-campana/s);
  });

  it('en el paso 3 el aviso que llega también vibra; sin movimiento, nada vibra', () => {
    expect(css).toMatch(/\.cf-aviso-notificacion\.cf-notificacion-visible\s*\{[^}]*animation:\s*cf-vibrar/s);
    const quieto = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(quieto).toMatch(/\.cf-aviso-puesto[^{]*\{[^}]*animation:\s*none/s);
    expect(quieto).toMatch(/\.cf-notificacion-visible[^{]*\{[^}]*animation:\s*none/s);
  });

  it('«Cambiar» del paso 3 es la píldora de la app al filo, no un enlace en la frase', () => {
    document.body.innerHTML = banda;
    const conf = document.querySelector('.cf-aviso-confirmacion')!;
    expect(conf.querySelector('br')).toBeNull();
    expect(conf.lastElementChild?.matches('.eta-detail-accion')).toBe(true);
    expect(css).toMatch(/\.cf-aviso-confirmacion \.eta-detail-accion\s*\{[^}]*border-radius:\s*999px[^}]*color:\s*var\(--app-coral-accessible\)/s);
  });
});
