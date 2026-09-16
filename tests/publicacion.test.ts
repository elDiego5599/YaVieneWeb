// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Lo que se publica y no se ve leyendo las páginas: las cabeceras que manda
 * Vercel, lo que la construcción escribe a partir de `VITE_SITE_URL` y qué
 * ficheros de entorno viajan dentro del repositorio.
 *
 * Entorno `node` y no happy-dom: aquí se construye la web de verdad, y un
 * DOM falso en los globales no pinta nada en una construcción.
 */

const raiz = process.cwd();

describe('las cabeceras de seguridad de vercel.json', () => {
  const vercel = JSON.parse(readFileSync(resolve(raiz, 'vercel.json'), 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const bloque = vercel.headers.find((h) => h.source === '/(.*)');
  const cabecera = (clave: string): string =>
    bloque?.headers.find((h) => h.key === clave)?.value ?? '';

  it('se aplican a todas las rutas', () => {
    expect(bloque, 'falta el bloque de cabeceras para "/(.*)"').toBeDefined();
  });

  it('la CSP no abre nada que la landing no use', () => {
    const csp = cabecera('Content-Security-Policy');
    for (const directiva of [
      "default-src 'none'",
      "script-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(directiva);
    }
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|data:|\*/);
  });

  it('HSTS de al menos un año, también en los subdominios', () => {
    const hsts = cabecera('Strict-Transport-Security');
    expect(Number(hsts.match(/max-age=(\d+)/)?.[1] ?? 0)).toBeGreaterThanOrEqual(31_536_000);
    expect(hsts).toContain('includeSubDomains');
  });

  it('marcos, tipos, referer y permisos', () => {
    expect(cabecera('X-Frame-Options')).toBe('DENY');
    expect(cabecera('X-Content-Type-Options')).toBe('nosniff');
    expect(cabecera('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    const permisos = cabecera('Permissions-Policy');
    for (const api of ['camera', 'geolocation', 'microphone', 'payment']) {
      expect(permisos).toContain(`${api}=()`);
    }
  });
});

/*
  Dos construcciones reales, una con dominio y otra sin la variable. El
  `.env` de cada máquina puede traer lo que sea, así que la de «sin definir»
  usa una carpeta de entorno vacía: es lo que pasa en un CI, donde ese
  fichero no está.
*/
const temporales: string[] = [];

afterAll(() => {
  for (const carpeta of temporales) rmSync(carpeta, { recursive: true, force: true });
});

async function construir(sitio: string | undefined): Promise<string> {
  const salida = mkdtempSync(join(tmpdir(), 'yaviene-build-'));
  const sinEnv = mkdtempSync(join(tmpdir(), 'yaviene-env-'));
  temporales.push(salida, sinEnv);

  const previo = { ...process.env };
  delete process.env.VITE_CONTACT_ENDPOINT;
  if (sitio === undefined) delete process.env.VITE_SITE_URL;
  else process.env.VITE_SITE_URL = sitio;
  try {
    await build({
      root: raiz,
      configFile: resolve(raiz, 'vite.config.ts'),
      envDir: sinEnv,
      logLevel: 'silent',
      build: { outDir: salida, emptyOutDir: true },
    });
  } finally {
    process.env = previo;
  }
  return salida;
}

const PAGINAS = ['index.html', 'empresas.html', 'privacidad.html', 'terminos.html', '404.html'];

const leerPaginas = (salida: string): Record<string, string> =>
  Object.fromEntries(PAGINAS.map((p) => [p, readFileSync(join(salida, p), 'utf8')]));

describe('la construcción y VITE_SITE_URL', () => {
  it('con dominio: URL absolutas en todas partes, robots.txt y sitemap.xml', async () => {
    // Con barra final a propósito: el plugin la quita, y ninguna URL puede
    // salir con la barra doblada.
    const salida = await construir('https://yaviene.co/');
    const paginas = leerPaginas(salida);

    expect(readFileSync(join(salida, 'robots.txt'), 'utf8')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://yaviene.co/sitemap.xml\n'
    );
    const sitemap = readFileSync(join(salida, 'sitemap.xml'), 'utf8');
    expect(Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), (m) => m[1])).toEqual([
      'https://yaviene.co/',
      'https://yaviene.co/empresas.html',
      'https://yaviene.co/privacidad.html',
      'https://yaviene.co/terminos.html',
    ]);

    expect(paginas['index.html']).toContain('<link rel="canonical" href="https://yaviene.co/" />');
    expect(paginas['empresas.html']).toContain(
      '<link rel="canonical" href="https://yaviene.co/empresas.html" />'
    );
    expect(paginas['index.html']).toContain('<meta property="og:image" content="https://yaviene.co/og.png" />');
    expect(paginas['index.html']).toContain('"url": "https://yaviene.co/"');
    for (const [pagina, html] of Object.entries(paginas)) {
      expect(html, pagina).not.toContain('%VITE_SITE_URL%');
      expect(html, pagina).not.toContain('yaviene.co//');
    }
  }, 120_000);

  it('sin definir: rutas relativas, sin canonical, sin robots.txt ni sitemap.xml', async () => {
    const salida = await construir(undefined);
    const paginas = leerPaginas(salida);

    expect(existsSync(join(salida, 'robots.txt'))).toBe(false);
    expect(existsSync(join(salida, 'sitemap.xml'))).toBe(false);
    expect(paginas['index.html']).toContain('<meta property="og:image" content="/og.png" />');
    for (const [pagina, html] of Object.entries(paginas)) {
      expect(html, pagina).not.toContain('%VITE_SITE_URL%');
      expect(html, pagina).not.toContain('rel="canonical"');
    }
    // La trampa que cuenta vite.config.ts: un canonical relativo que Vite
    // toma por recurso y copia con hash a assets/.
    expect(readdirSync(join(salida, 'assets')).filter((f) => f.endsWith('.html'))).toEqual([]);
  }, 120_000);
});

/*
  Un fichero de entorno rastreado es una puerta que queda abierta. En `.env`
  hoy va sólo `VITE_SITE_URL`, que no es secreto —el dominio es público—,
  pero es el sitio donde se escribirá la siguiente variable, y ésa sí puede
  ser una clave: entraría al repositorio sin que nadie la mirase, porque un
  fichero que ya estaba no se revisa. Así que viaja la plantilla y nada más;
  el valor de trabajo se queda en cada máquina y el de publicación lo pone
  Vercel en el proyecto.
*/
describe('los ficheros de entorno no viajan en el repositorio', () => {
  const git = (...argumentos: string[]) =>
    spawnSync('git', argumentos, { cwd: raiz, encoding: 'utf8' });

  it('sólo la plantilla está rastreada', () => {
    const salida = git('ls-files', '-z', '--', '.env', '.env.*');
    expect(salida.error ?? salida.status, 'no se pudo preguntar a git').toBe(0);
    expect(salida.stdout.split('\0').filter(Boolean)).toEqual(['.env.example']);
  });

  it('las reglas de ignorado tapan cualquier .env menos la plantilla', () => {
    // `--no-index` mira las reglas y no lo que ya esté rastreado: lo que se
    // exige es que la regla exista, no que hoy dé la casualidad.
    const ignorado = (nombre: string): boolean =>
      git('check-ignore', '--no-index', '-q', '--', nombre).status === 0;

    for (const nombre of ['.env', '.env.local', '.env.production', '.env.development']) {
      expect(ignorado(nombre), `${nombre} debería estar ignorado`).toBe(true);
    }
    expect(ignorado('.env.example'), 'la plantilla tiene que seguir viajando').toBe(false);
  });
});
