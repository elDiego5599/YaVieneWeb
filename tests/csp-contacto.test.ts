// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ResolvedConfig } from 'vite';
import { describe, expect, it } from 'vitest';

import { seoDeRaiz } from '../vite.config';

/**
 * El candado entre el formulario de empresas y la CSP (T3.16 / YV-30).
 *
 * El contacto va por WhatsApp (D7) y la CSP de `vercel.json` dice
 * `connect-src 'self'`: ningún `fetch` sale a otro origen. El día que se
 * configure `VITE_CONTACT_ENDPOINT` apuntando fuera, el navegador cortaría
 * el envío **en producción**, y el fallo lo descubriría una empresa real
 * escribiendo sin que nadie recibiera nada.
 *
 * `vite.config.ts` lo revienta en la construcción, con el arreglo en el
 * mensaje. Eso no lo cubría ninguna prueba: si alguien quita esa comprobación
 * —o la deja pasando una URL que la CSP no permite— nada se entera.
 */

const raiz = process.cwd();

/** El plugin declara `configResolved` como función; Vite también acepta la
 *  forma de objeto, así que se desenvuelve antes de llamarla. */
function comprobar(env: Record<string, string>): void {
  const plugin = seoDeRaiz();
  const gancho = plugin.configResolved;
  const fn = typeof gancho === 'function' ? gancho : gancho?.handler;
  if (!fn) throw new Error('el plugin ya no tiene configResolved');
  // `this` no se usa en el gancho; el resto de ResolvedConfig tampoco.
  (fn as (config: ResolvedConfig) => void).call(
    null as never,
    { env } as unknown as ResolvedConfig,
  );
}

describe('el endpoint de contacto contra la CSP', () => {
  it('sin endpoint no dice nada: hoy el formulario va por WhatsApp', () => {
    expect(() => comprobar({ VITE_SITE_URL: 'https://yaviene.co' })).not.toThrow();
  });

  it('un endpoint relativo pasa: lo cubre el propio `self`', () => {
    expect(() => comprobar({ VITE_CONTACT_ENDPOINT: '/api/contacto' })).not.toThrow();
  });

  it('un endpoint de otro origen tumba la construcción, no la producción', () => {
    expect(() => comprobar({ VITE_CONTACT_ENDPOINT: 'https://api.ejemplo.com/contacto' }))
      .toThrow(/connect-src/);
  });

  it('el mensaje dice qué origen añadir, no solo que falló', () => {
    expect(() => comprobar({ VITE_CONTACT_ENDPOINT: 'https://api.ejemplo.com/contacto' }))
      .toThrow(/https:\/\/api\.ejemplo\.com/);
  });

  it('un endpoint que no es URL ni ruta se rechaza por sí mismo', () => {
    expect(() => comprobar({ VITE_CONTACT_ENDPOINT: 'api.ejemplo.com' }))
      .toThrow(/no es una URL válida/);
  });

  it('la CSP publicada sigue diciendo `connect-src \'self\'`', () => {
    // Es el motivo de que el candado exista: mientras la CSP diga `'self'`,
    // un endpoint de otro origen no puede funcionar en producción.
    //
    // Si `vercel.json` cambiara de forma y el candado leyera una CSP vacía,
    // seguiría lanzando —una cadena vacía no contiene ningún origen—, así
    // que ese despiste falla del lado seguro y no hay nada que cazar ahí.
    // Lo que sí se rompería en silencio es lo contrario: abrir la CSP y
    // dejar de necesitar el candado sin quitarlo. Esto lo vigila.
    const vercel = JSON.parse(readFileSync(resolve(raiz, 'vercel.json'), 'utf8')) as {
      headers: { headers: { key: string; value: string }[] }[];
    };
    const csp = vercel.headers[0]?.headers
      ?.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).toMatch(/connect-src [^;]*'self'/);
  });
});
