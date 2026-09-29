import { expect, test } from '@playwright/test';

/**
 * La portada no tiene formulario de contacto: vive sólo en empresas.html,
 * que lo monta desde empresas.ts. Aun así main.ts importaba `ContactForm`,
 * y el empaquetador lo metía en el trozo compartido que la portada baja en
 * su primera visita, para que `querySelector('#contact-form')` devolviera
 * `null` (auditoría, hallazgo 11). Se mira el JavaScript que de verdad
 * descarga cada página.
 */

/** El JavaScript que baja la página, entero. */
async function scripts(page: import('@playwright/test').Page, ruta: string): Promise<string> {
  const cuerpos: Promise<string>[] = [];
  page.on('response', (r) => {
    if (r.request().resourceType() === 'script') cuerpos.push(r.text());
  });
  await page.goto(ruta, { waitUntil: 'networkidle' });
  return (await Promise.all(cuerpos)).join('\n');
}

test('la portada no descarga el formulario de contacto', async ({ page }) => {
  expect(await scripts(page, '/')).not.toContain('No pudimos enviar la solicitud');
});

test('empresas.html sí lo trae', async ({ page }) => {
  expect(await scripts(page, '/empresas.html')).toContain('No pudimos enviar la solicitud');
});
