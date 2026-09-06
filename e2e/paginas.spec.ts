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
      // puede desplazarse. `clip` cuenta igual que `hidden`: recorta lo que
      // se salga y, a diferencia de `hidden`, ni siquiera deja un desplazado
      // posible dentro. Es lo que usan el cartel del hero, que mide más que
      // la ventana a propósito, y el teletipo, que es una tira que da
      // vueltas. Lo que se sale de ellos no llega a la ventana.
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

      // Toda imagen lleva alt (aunque sea vacío si es decorativa).
      const sinAlt = await page.evaluate(
        () => Array.from(document.images).filter((i) => !i.hasAttribute('alt')).map((i) => i.src)
      );
      expect(sinAlt, 'imágenes sin atributo alt').toEqual([]);
    });
  });
}

/*
  El guion del problema —los golpes de texto que entraban con el reloj y
  que, mientras esperaban su turno, dejaban «sol» y «lluvia» invisibles
  pero pulsables— ya no existe: el problema pasó de pista de dos pantallas
  y media a franja, y en una franja no hay turnos que esperar. Todo lo que
  hay se ve desde el primer momento, así que no queda nada escondido que
  se pueda tocar por error. La prueba que lo vigilaba se retira con él.
*/

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
  Sin JavaScript, la página se lee entera.

  Es la avería más cara de todas y la más silenciosa: las apariciones al
  bajar empezaban escondidas en el CSS y sólo se destapaban cuando el
  observador las tocaba, así que cualquier cosa que dejara el guion fuera
  —un despliegue a medias, una extensión, una red que corta el módulo—
  servía una hoja en blanco con el fondo puesto. Ahora el estado escondido
  cuelga de una clase que sólo pone el propio guion, y esta prueba lo
  vigila apagando el JavaScript del todo. Ver animable.ts.
*/
test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const { ruta, nombre } of [
    { ruta: '/', nombre: 'portada' },
    { ruta: '/empresas.html', nombre: 'empresas' },
  ]) {
    test(`el contenido de ${nombre} se ve aunque el guion no llegue`, async ({ page }) => {
      await page.goto(ruta, { waitUntil: 'load' });

      // Nadie puso la marca, así que nada tiene derecho a estar escondido.
      await expect(page.locator('html.animable')).toHaveCount(0);

      /* Se dejan fuera las que el diseño quita en esta anchura —los dos
         teléfonos de los lados van `display: none` en móvil—: eso no lo
         decide el guion, lo decide una consulta de medios, y sigue igual
         con el JavaScript puesto. Lo que se mira es lo que se enseña. */
      const opacos = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            /* Las cinco entradas más la escena del hero. Los hijos de una
               serie entran uno a uno, así que se miran ellos y no sólo el
               contenedor: es al hijo al que se le apaga la opacidad. Las
               líneas de un titular partido no se listan porque sin guion
               no existen —el titular es texto corrido, y así se lee—. */
            '.escena-entra, .entra-corte, .entra-ficha, .entra-traza, .entra-cuenta, .entra-relevo, .entra-relevo > *'
          )
        )
          .filter((el) => {
            const estilo = getComputedStyle(el);
            return estilo.display !== 'none' && estilo.visibility !== 'hidden';
          })
          .map((el) => ({
            clase: el.className,
            opacidad: Number(getComputedStyle(el).opacity),
            alto: Math.round(el.getBoundingClientRect().height),
          }))
      );

      expect(opacos.length, 'la página tiene piezas que aparecen al bajar').toBeGreaterThan(0);

      /* Se busca lo transparente del todo, no lo atenuado: los buses del
         hero bajan a 0,9 en pantalla estrecha porque así está pensado el
         dibujo, y eso se ve. Lo que no puede quedar es un 0. */
      expect(
        opacos.filter((p) => p.opacidad <= 0.05).map((p) => p.clase),
        'piezas invisibles sin guion que las destape'
      ).toEqual([]);
      expect(
        opacos.filter((p) => p.alto === 0).map((p) => p.clase),
        'piezas sin altura sin guion que las despliegue'
      ).toEqual([]);

      // Y el titular sigue siendo legible, que es lo que se vino a leer.
      await expect(page.locator('h1')).toBeVisible();
    });
  }
});
