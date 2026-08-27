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
      // Ni lo que vive dentro de un contenedor que sí puede desplazarse.
      let padre = el.parentElement;
      let dentroDeScroll = false;
      while (padre && padre !== document.body) {
        const pcs = getComputedStyle(padre);
        if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll' || pcs.overflowX === 'hidden') {
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

      // Toda imagen lleva alt (aunque sea vacío si es decorativa).
      const sinAlt = await page.evaluate(
        () => Array.from(document.images).filter((i) => !i.hasAttribute('alt')).map((i) => i.src)
      );
      expect(sinAlt, 'imágenes sin atributo alt').toEqual([]);
    });
  });
}

/*
  Lo que todavía no se ha asomado no se toca. Los golpes de texto del
  problema entran con el reloj, y mientras esperan están transparentes;
  transparente no es escondido, así que «sol» y «lluvia» —que son
  botones— se dejaban pulsar, y cambiaban el degradado de toda la
  sección, sin haber aparecido nunca en pantalla.
*/
test.describe('el guion del problema', () => {
  test('los golpes que aún no entran no se dejan tocar', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    // Justo a la entrada de la pista: la escena ya está pegada y en
    // pantalla, pero el reloj no ha llegado a ningún golpe todavía. Ahí
    // es donde los botones invisibles quedaban al alcance del dedo.
    await page.evaluate(() => {
      const pista = document.querySelector('#problema') as HTMLElement;
      const top = pista.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + 60, behavior: 'instant' });
    });
    await page.waitForTimeout(600);

    const escondidos = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.problema-beat:not(.is-visible)')).map((beat) => {
        const boton = beat.querySelector('[data-clima-choice]');
        const caja = (boton ?? beat).getBoundingClientRect();
        const centro = document.elementFromPoint(caja.left + caja.width / 2, caja.top + caja.height / 2);
        return {
          golpe: (beat as HTMLElement).dataset.beat,
          alcanzable: !!centro && (boton ?? beat).contains(centro),
        };
      })
    );

    // Que haya alguno escondido es parte de la prueba: si el guion no
    // arrancó, esto no estaría comprobando nada.
    expect(escondidos.length, 'ningún golpe esperando su turno').toBeGreaterThan(0);
    expect(
      escondidos.filter((b) => b.alcanzable).map((b) => b.golpe),
      'golpes invisibles que responden al dedo'
    ).toEqual([]);
  });
});

/*
  La banda de empresas. Es prueba social: si un logo no carga, no se lee o
  sale en gris, la banda deja de probar nada y encima señala a la empresa
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
