import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * Una pasada por las cuatro páginas de la landing buscando las averías
 * que no se ven leyendo el código.
 */

const PAGINAS = [
  { ruta: '/', nombre: 'portada' },
  { ruta: '/empresas.html', nombre: 'empresas' },
  { ruta: '/privacidad.html', nombre: 'privacidad' },
  { ruta: '/terminos.html', nombre: 'términos' },
  { ruta: '/404.html', nombre: 'error 404' },
];

/* La política de contenido que Vercel manda en producción. Se lee del
   mismo `vercel.json` que se publica —no de una copia— para que la
   prueba no pueda quedarse hablando de una política que ya no existe.

   Una política estricta es fácil de escribir y fácil de romper: basta un
   `<style>` suelto, un icono en `data:` o una fuente de Google para que
   el navegador empiece a bloquear cosas en silencio, en producción y no
   aquí. Por eso se prueba con ella puesta. */
const CSP = (() => {
  const raiz = fileURLToPath(new URL('../vercel.json', import.meta.url));
  const config = JSON.parse(readFileSync(raiz, 'utf8')) as {
    headers: { headers: { key: string; value: string }[] }[];
  };
  const cabecera = config.headers
    .flatMap((r) => r.headers)
    .find((h) => h.key.toLowerCase() === 'content-security-policy');
  if (!cabecera) throw new Error('vercel.json ya no manda Content-Security-Policy');
  return cabecera.value;
})();

/** Ruidos que no son culpa nuestra y que no vale la pena perseguir. */
const RUIDO = [/favicon\.ico/i, /Download the React DevTools/i];

type Averias = {
  consola: string[];
  excepciones: string[];
  fallidas: string[];
};

function vigilar(page: Page): Averias {
  const av: Averias = { consola: [], excepciones: [], fallidas: [] };

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
    const texto = msg.text();
    if (RUIDO.some((re) => re.test(texto))) return;
    av.consola.push(`[${msg.type()}] ${texto}`);
  });

  page.on('pageerror', (err) => av.excepciones.push(err.message));

  page.on('requestfailed', (req) => {
    if (RUIDO.some((re) => re.test(req.url()))) return;
    av.fallidas.push(`${req.url()} — ${req.failure()?.errorText ?? 'sin motivo'}`);
  });

  page.on('response', (res) => {
    if (res.status() >= 400 && !RUIDO.some((re) => re.test(res.url()))) {
      av.fallidas.push(`${res.url()} — HTTP ${res.status()}`);
    }
  });

  return av;
}

/**
 * Busca quién se sale de cuadro. Devolver el elemento culpable y no un
 * simple «se desborda» es la diferencia entre arreglarlo en un minuto y
 * pasarse media tarde bisecando CSS.
 */
async function quienSeDesborda(page: Page) {
  return page.evaluate(() => {
    const ancho = document.documentElement.clientWidth;
    // Un píxel de tolerancia: el redondeo de subpíxel del navegador puede
    // dar 1440,4 donde el diseño dice 1440.
    const margen = 1;
    const culpables: { sel: string; derecha: number; ancho: number }[] = [];

    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const cs = getComputedStyle(el);
      // Lo que ya está escondido a propósito no cuenta.
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
      // Ni lo que vive dentro de un contenedor que lo recorta o que sí
      // puede desplazarse. `clip` cuenta igual que `hidden`: recorta lo
      // que se sale y no crea barra. Lo usa el visor de los tres pasos,
      // que es una carrusel —el teléfono de turno va en el centro y los
      // otros dos se corren fuera del marco— y `hidden` ahí rompería el
      // pegado de la escena (ver layout.css).
      let padre = el.parentElement;
      let dentroDeScroll = false;
      while (padre && padre !== document.body) {
        const pcs = getComputedStyle(padre);
        if (
          pcs.overflowX === 'auto' ||
          pcs.overflowX === 'scroll' ||
          pcs.overflowX === 'hidden' ||
          pcs.overflowX === 'clip'
        ) {
          dentroDeScroll = true;
          break;
        }
        padre = padre.parentElement;
      }
      if (dentroDeScroll) continue;

      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > ancho + margen) {
        const sel =
          el.tagName.toLowerCase() +
          (el.id ? `#${el.id}` : '') +
          (el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
            : '');
        culpables.push({ sel, derecha: Math.round(r.right), ancho: Math.round(r.width) });
      }
    }

    return {
      anchoVentana: ancho,
      anchoDocumento: document.documentElement.scrollWidth,
      culpables: culpables.slice(0, 8),
    };
  });
}

for (const { ruta, nombre } of PAGINAS) {
  test.describe(nombre, () => {
    test('carga limpia, sin errores ni peticiones colgando', async ({ page }) => {
      const av = vigilar(page);
      await page.goto(ruta, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      expect(av.excepciones, 'excepciones de JavaScript').toEqual([]);
      expect(av.consola, 'errores y avisos en consola').toEqual([]);
      expect(av.fallidas, 'peticiones que no llegaron').toEqual([]);
    });

    test('no se puede desplazar de lado', async ({ page }) => {
      await page.goto(ruta, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      const arriba = await quienSeDesborda(page);
      expect(
        arriba.culpables,
        `se salen de los ${arriba.anchoVentana}px de ancho`
      ).toEqual([]);
      expect(arriba.anchoDocumento).toBeLessThanOrEqual(arriba.anchoVentana + 1);

      // Y otra vez con la página recorrida entera, que hay animaciones
      // que sólo se disparan al bajar y pueden empujar hacia el lado.
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(700);

      const abajo = await quienSeDesborda(page);
      expect(abajo.culpables, 'se salen de cuadro tras bajar del todo').toEqual([]);
    });

    test('no pide nada a servidores ajenos', async ({ page }) => {
      const ajenas: string[] = [];
      page.on('request', (req) => {
        const url = new URL(req.url());
        if (url.hostname !== 'localhost' && url.protocol !== 'data:' && url.protocol !== 'blob:') {
          ajenas.push(req.url());
        }
      });
      await page.goto(ruta, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      expect(ajenas, 'peticiones a dominios de terceros').toEqual([]);
    });

    test('aguanta la política de contenido de producción', async ({ page }) => {
      const violaciones: string[] = [];
      await page.exposeFunction('anotarViolacion', (v: string) => void violaciones.push(v));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          const w = window as unknown as { anotarViolacion?: (v: string) => void };
          w.anotarViolacion?.(`${e.violatedDirective} ← ${e.blockedURI || e.sourceFile}`);
        });
      });

      // El servidor de pruebas no manda la cabecera; se la ponemos aquí
      // encima, tal cual sale de `vercel.json`.
      await page.route('**/*', async (route) => {
        const respuesta = await route.fetch();
        await route.fulfill({
          response: respuesta,
          headers: { ...respuesta.headers(), 'content-security-policy': CSP },
        });
      });

      await page.goto(ruta, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      // Recorrerla entera: hay animaciones, mapas y hojas que sólo piden
      // cosas cuando les toca aparecer.
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(900);

      expect(violaciones, 'la política de contenido bloqueó algo nuestro').toEqual([]);
    });

    test('el esqueleto accesible está en su sitio', async ({ page }) => {
      await page.goto(ruta, { waitUntil: 'load' });

      await expect(page).toHaveTitle(/.+/);
      expect(await page.locator('html').getAttribute('lang')).toBe('es');
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);

      // El enlace de salto existe y apunta a algo que existe de verdad.
      const salto = page.locator('a.saltar-al-contenido');
      await expect(salto).toHaveCount(1);
      const destino = await salto.getAttribute('href');
      await expect(page.locator(destino!)).toHaveCount(1);

      // Y nace fuera de cuadro: si el escondite no llega en el primer
      // pintado se ve un parpadeo en cada recarga, que es justo lo que
      // arregla tener `critico.css` enlazada desde el <head>.
      const caja = await salto.boundingBox();
      expect(caja, 'el enlace de salto no tiene caja').not.toBeNull();
      expect(caja!.y + caja!.height, 'el enlace de salto asoma en pantalla').toBeLessThan(0);

      // Toda imagen lleva alt (aunque sea vacío si es decorativa).
      const sinAlt = await page.evaluate(
        () => Array.from(document.images).filter((i) => !i.hasAttribute('alt')).map((i) => i.src)
      );
      expect(sinAlt, 'imágenes sin atributo alt').toEqual([]);
    });
  });
}

/*
  La banda de empresas en /empresas.html. Es prueba social: si un logo no
  carga, no se lee o sale en gris, la banda deja de probar nada. Se
  comprueba que los siete logos estén en color real y cargados.
*/
test.describe('la banda de empresas', () => {
  test('los siete logos se ven en color y cargan correctamente en /empresas.html', async ({ page }) => {
    await page.goto('/empresas.html', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    await page.locator('.empresa-marcas').scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);

    const logos = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.empresa-marcas-grupo:not([aria-hidden]) .empresa-marcas-logo')).map((logo) => {
        const img = logo as HTMLImageElement;
        const caja = img.getBoundingClientRect();
        return {
          empresa: img.alt,
          pintado: img.complete && img.naturalWidth > 0,
          filtro: getComputedStyle(img).filter,
          opacidad: Number(getComputedStyle(img).opacity),
          alto: Math.round(caja.height),
        };
      })
    );

    expect(logos.length, 'las siete empresas están en el carrusel').toBe(7);
    expect(logos.filter((p) => !p.pintado).map((p) => p.empresa), 'logos que no cargaron').toEqual([]);
    expect(logos.filter((p) => p.filtro !== 'none').map((p) => p.empresa), 'logos con filtro encima').toEqual([]);
    expect(logos.filter((p) => p.opacidad < 1).map((p) => p.empresa), 'logos a media tinta').toEqual([]);
    expect(logos.filter((p) => p.alto < 18).map((p) => p.empresa), 'logos demasiado pequeños para leerse').toEqual([]);
  });
});

/*
  La cinta de empresas, en la portada y en /empresas.html. La portada
  tenía los siete logos quietos en una rejilla; ahora corren como en
  empresas. Los bordes se probaron desenfocados por capas y el dueño los
  vio demasiado borrosos: los logos van nítidos hasta que el blanco se los
  come, con un desvanecido algo más ancho que las franjas de 56 px del
  principio, que cortaban como una pared.
*/
for (const ruta of ['/', '/empresas.html']) {
  test(`la cinta de empresas corre y se desvanece en los bordes en ${ruta}`, async ({ page }) => {
    await page.goto(ruta, { waitUntil: 'load' });
    const cinta = page.locator('.empresa-marcas-carrusel');
    await expect(cinta).toHaveCount(1);
    await cinta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);

    const medida = () =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLElement>('.empresa-marcas-carrusel')!;
        const pista = c.querySelector<HTMLElement>('.empresa-marcas-track')!;
        const imgs = Array.from(c.querySelectorAll<HTMLImageElement>('.empresa-marcas-logo'));
        const desenfocados = Array.from(c.querySelectorAll<HTMLElement>('*')).filter((e) => {
          const f = getComputedStyle(e).backdropFilter || '';
          return (f && f !== 'none') || getComputedStyle(e).filter !== 'none';
        });
        return {
          x: new DOMMatrix(getComputedStyle(pista).transform).m41,
          logos: imgs.length,
          sinCargar: imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.alt || i.src),
          desenfocados: desenfocados.length,
          filos: ['::before', '::after'].map((p) => ({
            ancho: Number.parseFloat(getComputedStyle(c, p).width),
            fondo: getComputedStyle(c, p).backgroundImage,
          })),
        };
      });

    const antes = await medida();
    await page.waitForTimeout(600);
    const despues = await medida();

    expect(antes.logos, 'siete logos y su copia para cerrar la vuelta').toBe(14);
    expect(antes.sinCargar, 'logos sin cargar: la cinta enseñaría un hueco').toEqual([]);
    expect(despues.x, 'la cinta no se mueve').toBeLessThan(antes.x);
    expect(antes.desenfocados, 'algo de la cinta sale borroso').toBe(0);
    for (const filo of antes.filos) {
      expect(filo.fondo, 'el borde no se desvanece').toContain('gradient');
      expect(filo.ancho, 'un borde estrecho corta los logos como una pared').toBeGreaterThanOrEqual(40);
      expect(filo.ancho, 'un borde ancho se come la cinta').toBeLessThanOrEqual(120);
    }
  });
}

/* En empresas la cinta llega a los dos lados de la ficha: dentro del
   relleno se quedaba más estrecha que la línea que la separa del texto,
   y el dueño la pidió un poco más ancha. El blanco de sus filos es el de
   la ficha, así que no se ve dónde acaba. */
test('en empresas, la cinta va de lado a lado de la ficha', async ({ page }) => {
  for (const ancho of [1440, 390]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto('/empresas.html', { waitUntil: 'load' });
    const caja = await page.evaluate(() => {
      const ficha = document.querySelector('.empresa-ficha')!.getBoundingClientRect();
      const cinta = document.querySelector('.empresa-marcas-carrusel')!.getBoundingClientRect();
      return { izq: cinta.left - ficha.left, der: ficha.right - cinta.right, rebosa: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(caja.izq, `${ancho} px: no llega al lado izquierdo de la ficha`).toBeLessThanOrEqual(2);
    expect(caja.der, `${ancho} px: no llega al lado derecho de la ficha`).toBeLessThanOrEqual(2);
    expect(caja.izq, `${ancho} px: se sale de la ficha`).toBeGreaterThanOrEqual(0);
    expect(caja.rebosa, `${ancho} px: la página se desborda de lado`).toBe(0);
  }
});

/* En la portada la cinta ocupa algo más que la fila quieta de logos que
   tenía antes (1180): hasta 1280, con las calles de la página a los
   lados. Una regla de `.empresa-marcas-carrusel` con el mismo peso la
   estiraba a todo el ancho. */
test('la cinta de la portada no pasa del ancho de la columna', async ({ page }) => {
  for (const ancho of [1600, 390]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto('/', { waitUntil: 'load' });
    const caja = await page.locator('.empresa-marcas-carrusel').evaluate((c) => {
      const r = c.getBoundingClientRect();
      return { izq: r.left, der: document.documentElement.clientWidth - r.right, ancho: r.width };
    });
    expect(caja.ancho, `${ancho} px: más ancha que la columna`).toBeLessThanOrEqual(1280);
    if (ancho === 1600) expect(caja.ancho, 'no ganó el ancho pedido').toBeGreaterThan(1180);
    expect(caja.izq, `${ancho} px: pegada al borde izquierdo`).toBeGreaterThanOrEqual(16);
    expect(Math.abs(caja.izq - caja.der), `${ancho} px: no queda centrada`).toBeLessThan(2);
  }
});

/* En un teléfono el aparato de «Cómo funciona» se quedaba en 191 px de
   ancho —menos de la mitad de la pantalla— y su letra no se leía. Todo lo
   que no es teléfono se aprieta (sin el rótulo repetido de la barra, el
   titular a dos líneas) y el aparato se lleva lo ganado. Y la escena
   sigue cabiendo entera: si no, lo que sobra de una escena pegada no se
   alcanza nunca. */
test('en el teléfono, el aparato de los pasos se lleva más de la mitad del ancho', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 760 });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#solucion .pasos-cuadro').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const escena = await page.evaluate(() => {
    const marco = document.querySelector<HTMLElement>('#solucion .escena')!;
    const dentro = marco.firstElementChild!.getBoundingClientRect();
    const hueco = window.innerHeight - Number.parseFloat(getComputedStyle(marco).paddingTop);
    return {
      telefono: document.querySelector('.paso-columna.is-activa .phone-shell')!.getBoundingClientRect().width,
      rotulo: getComputedStyle(document.querySelector('.pasos-cabecera .seccion-rotulo')!).display,
      // La caja sale en píxeles de pantalla y el interlineado sin el
      // `zoom` de `encaje`: se multiplica por el factor para comparar.
      lineas: (() => {
        const titulo = document.querySelector('.pasos-cabecera .seccion-titulo')!;
        const factor = Number.parseFloat(getComputedStyle(marco).getPropertyValue('--encaje')) || 1;
        const interlineado = Number.parseFloat(getComputedStyle(titulo).lineHeight) * factor;
        return Math.round(titulo.getBoundingClientRect().height / interlineado);
      })(),
      sobra: dentro.height - hueco,
    };
  });
  expect(escena.telefono, 'el aparato sigue pequeño').toBeGreaterThanOrEqual(210);
  expect(escena.rotulo, 'el rótulo repite el de la barra').toBe('none');
  expect(escena.lineas, 'el titular ocupa más de dos líneas').toBeLessThanOrEqual(2);
  expect(escena.sobra, 'la escena ya no cabe en la ventana').toBeLessThanOrEqual(1);
});

/* Las tres tomas de «Cómo funciona» llevan la cabecera de la app en el
   mismo sitio y con textos distintos. En el relevo la que entra se aclara
   encima de la que sale, y se leían dos píldoras superpuestas —«¿Qué bus
   esperas?» sobre «C16…», dos «Quitar»—. En ningún cuadro del viaje puede
   haber más de una cabecera a la vista. */
test('en el relevo de los pasos nunca hay dos cabeceras a la vez', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('#solucion .pasos-cuadro').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  for (const paso of [1, 2]) {
    const peor = await page.evaluate(async (i) => {
      const visibles = (): number =>
        [...document.querySelectorAll<HTMLElement>('.pasos-pase .paso-columna')].filter((col) => {
          const barra = col.querySelector<HTMLElement>('.phone-topbar')!;
          return Number(getComputedStyle(col).opacity) * Number(getComputedStyle(barra).opacity) > 0.08;
        }).length;
      document.querySelectorAll<HTMLElement>('.paso-boton')[i]!.click();
      let max = 0;
      const fin = performance.now() + 2200;
      while (performance.now() < fin) {
        max = Math.max(max, visibles());
        await new Promise(requestAnimationFrame);
      }
      return max;
    }, paso);
    expect(peor, `relevo al paso ${paso + 1}`).toBeLessThanOrEqual(1);
  }
});

/* El aviso del tercer momento sale del hombro del teléfono, arriba. Desde
   que la toma lleva la cabecera de la app, a esa altura está la píldora:
   la tarjeta se montaba sobre media «C16 Calle 72 Uninorte» y se leían
   las dos a medias. Tiene que caer en el mapa, entre el chip y la hoja. */
test('el aviso de los pasos no pisa la cabecera ni la hoja', async ({ page }) => {
  for (const [ancho, alto] of [[1440, 900], [1024, 768], [402, 760]] as const) {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto('/', { waitUntil: 'load' });
    await page.locator('#solucion .pasos-cuadro').scrollIntoViewIfNeeded();
    const choques = await page.evaluate(() => {
      const toma = document.querySelector<HTMLElement>('[data-demo="3"]')!;
      const pieza = (sel: string) => toma.querySelector<HTMLElement>(sel)!;
      const aviso = pieza('[data-el="notif"]');
      const hoja = pieza('[data-el="sheet"]');
      for (const el of [aviso, hoja]) {
        el.style.transition = 'none';
        el.classList.add('is-on');
      }
      const a = aviso.getBoundingClientRect();
      const pisa = (el: HTMLElement): boolean => {
        const r = el.getBoundingClientRect();
        return a.left < r.right && r.left < a.right && a.top < r.bottom && r.top < a.bottom;
      };
      return {
        pildora: pisa(pieza('.app-pill')),
        chip: pisa(pieza('[data-el="chip"]')),
        hoja: pisa(hoja),
      };
    });
    expect(choques, `${ancho}×${alto}`).toEqual({ pildora: false, chip: false, hoja: false });
  }
});

/* El carril de rutas del teléfono estira las fichas a la más alta. Con
   230 px fijos la C13 partía su tramo en tres líneas y las seis quedaban
   en 107 px con el texto flotando en medio. */
test('en el teléfono, las fichas de ruta van en una línea y a su alto', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 760 });
  await page.goto('/', { waitUntil: 'load' });
  const fichas = await page.locator('.mv-rutas .ruta-ficha').evaluateAll((todas) =>
    todas.map((f) => {
      const alto = (el: Element) => el.getBoundingClientRect().height;
      return {
        alto: alto(f),
        cabeza: alto(f.querySelector('.ruta-ficha-cabeza')!),
        tramo: alto(f.querySelector('.ruta-ficha-tramo')!),
      };
    })
  );
  expect(fichas).toHaveLength(6);
  const [primera] = fichas;
  for (const ficha of fichas) {
    expect(ficha.alto, 'una ficha más alta que el resto').toBe(primera.alto);
    expect(ficha.tramo, 'el tramo se parte en dos líneas').toBeLessThan(ficha.cabeza * 1.5);
  }
  expect(primera.alto, 'las fichas se estiran').toBeLessThanOrEqual(72);
});

test('con movimiento reducido la cinta de empresas se queda quieta', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'load' });
  const nombre = await page.locator('.empresa-marcas-track').evaluate((p) => getComputedStyle(p).animationName);
  expect(nombre).toBe('none');
});

test.describe('el mapa en vivo con el teclado', () => {
  /*
    El punto de espera sólo se movía tocando o pinchando el mapa, así que
    con teclado la sección entera era una imagen. Esto comprueba las tres
    piezas del arreglo: que el mapa recibe el foco, que las flechas mueven
    el punto, y que lo que pasa se cuenta en el `role="status"` —el número
    de al lado no lo lee nadie si no se dice.
  */
  test('las flechas mueven el punto de espera y lo cuentan', async ({ page }) => {
    await page.goto('/');
    const mapa = page.locator('[data-mapa-svg]');
    await mapa.scrollIntoViewIfNeeded();
    await mapa.focus();
    expect(
      await page.evaluate(() => document.activeElement?.hasAttribute('data-mapa-svg') ?? false),
      'el mapa no recibe el foco'
    ).toBe(true);

    const voz = page.locator('[data-mapa-voz]');
    await expect(voz).toHaveText('');
    await page.keyboard.press('ArrowRight');
    await expect(voz).toContainText('Punto de espera movido');
    await expect(voz).toContainText('en línea recta hasta tu punto');

    // La flecha no puede además desplazar la página: si lo hiciera, mover
    // el punto sacaría el mapa de la pantalla a cada pulsación.
    const alto = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => window.scrollY)).toBe(alto);
  });
});

test.describe('el mapa en vivo dice que es una simulación', () => {
  /*
    Los dos buses del mapa los mueve la propia página (src/mapa-vivo.ts):
    no hay un bus de verdad detrás. La entrada de la sección lo decía, pero
    el mapa se mira sin leer lo de arriba, y un bus que avanza sobre rutas
    reales se lee como uno real. Por eso el mapa lleva su propio rótulo
    (T6.10, decisión D8). Aquí se mira que esté dentro del mapa y que se vea
    entero: el lienzo recorta lo que se sale (`overflow: hidden`), así que en
    el móvil un rótulo que no cabe se cortaría sin que nada fallara. Su
    contraste lo mide contraste.spec.ts.
  */
  test('el mapa lleva el rótulo «Simulación» y se ve entero', async ({ page }) => {
    await page.goto('/');
    const lienzo = page.locator('[data-mapa-lienzo]');
    const rotulo = lienzo.locator('[data-mapa-simulacion]');
    await expect(rotulo, 'el mapa no lleva el rótulo').toHaveCount(1);
    await rotulo.scrollIntoViewIfNeeded();
    await expect(rotulo).toBeVisible();
    await expect(rotulo).toHaveText('Simulación');

    const caja = await rotulo.boundingBox();
    const marco = await lienzo.boundingBox();
    expect(caja, 'el rótulo no tiene caja').not.toBeNull();
    expect(marco, 'el mapa no tiene caja').not.toBeNull();
    expect(caja!.x).toBeGreaterThanOrEqual(marco!.x);
    expect(caja!.y).toBeGreaterThanOrEqual(marco!.y);
    expect(caja!.x + caja!.width).toBeLessThanOrEqual(marco!.x + marco!.width);
    expect(caja!.y + caja!.height).toBeLessThanOrEqual(marco!.y + marco!.height);
  });
});

/* Aislamiento entre orígenes. COOP deja a la página sola en su grupo de
   ventanas: otra pestaña que la abra no conserva una referencia con la
   que tocarla. CORP same-origin impide que otro sitio incruste nuestros
   archivos. La excepción es `og.png`: la leen desde fuera las
   previsualizaciones de enlaces (WhatsApp, redes), y con same-origin
   algunas la dejan de mostrar. La regla de `vercel.json` excluye ese
   archivo con una expresión; aquí se comprueba contra qué rutas casa. */
test.describe('las cabeceras de aislamiento de vercel.json', () => {
  type Regla = { source: string; headers: { key: string; value: string }[] };
  const reglas = (JSON.parse(
    readFileSync(fileURLToPath(new URL('../vercel.json', import.meta.url)), 'utf8'),
  ) as { headers: Regla[] }).headers;

  /** Lo que Vercel mandaría para esa ruta: la última regla que casa gana. */
  function cabecera(ruta: string, clave: string): string | undefined {
    let valor: string | undefined;
    for (const regla of reglas) {
      if (!new RegExp(`^${regla.source}$`).test(ruta)) continue;
      const h = regla.headers.find((x) => x.key === clave);
      if (h) valor = h.value;
    }
    return valor;
  }

  test('COOP en todo, CORP same-origin salvo og.png', () => {
    // La CSP la lee vite.config.ts de la primera regla: sigue ahí.
    expect(reglas[0].headers.some((h) => h.key === 'Content-Security-Policy')).toBe(true);
    for (const ruta of ['/', '/empresas.html', '/assets/index.js', '/og.png']) {
      expect(cabecera(ruta, 'Cross-Origin-Opener-Policy')).toBe('same-origin');
    }
    for (const ruta of ['/', '/empresas.html', '/assets/index.js', '/og.png.bak', '/x/og.png']) {
      expect(cabecera(ruta, 'Cross-Origin-Resource-Policy'), ruta).toBe('same-origin');
    }
    expect(cabecera('/og.png', 'Cross-Origin-Resource-Policy')).toBe('cross-origin');
  });
});

/* En empresas la barra dice siempre «Para empresas» bajo 880 px, y el
   rótulo del hero, justo debajo, decía «Para empresas de transporte»: la
   misma etiqueta dos veces en la primera pantalla. En el teléfono se va
   el del hero; en el escritorio la barra no la lleva y el rótulo sigue. */
test('en empresas, el rótulo del hero no repite la barra en el teléfono', async ({ page }) => {
  const rotulo = page.locator('#panel .seccion-rotulo');
  await page.setViewportSize({ width: 402, height: 760 });
  await page.goto('/empresas.html', { waitUntil: 'load' });
  await expect(page.locator('.nav-lugar')).toBeVisible();
  await expect(page.locator('.nav-lugar')).toHaveText('Para empresas');
  await expect(rotulo, 'el rótulo repite el de la barra').toBeHidden();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.nav-lugar')).toBeHidden();
  await expect(rotulo, 'sin barra que lo diga, el rótulo hace falta').toBeVisible();
});
