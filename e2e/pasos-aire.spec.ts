import { test, expect } from '@playwright/test';

/**
 * Entre la cinta de empresas y «Tres pasos» quedaban 130 px de blanco en
 * el teléfono —un séptimo de la pantalla sin nada—: los 38 del final de
 * la cinta más el relleno de la escena, que no se puede quitar porque es
 * lo que deja libre la barra de arriba cuando la escena se pega. El aire
 * lo pone la escena y la cinta termina con sus logos.
 */
test('entre la cinta de empresas y los pasos no queda un hueco', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil', 'el hueco se ve en el teléfono');
  await page.goto('/');
  const hueco = await page.evaluate(() => {
    const cinta = document.querySelector('.marcas-claras')!;
    const logos = [...cinta.querySelectorAll('img')].map((i) => i.getBoundingClientRect().bottom);
    const titulo = document.querySelector('#solucion h2')!.getBoundingClientRect().top;
    return { aire: titulo - Math.max(...logos), sobra: cinta.getBoundingClientRect().bottom - Math.max(...logos) };
  });
  expect(hueco.aire).toBeLessThanOrEqual(100);
  // Los logos no se recortan: la cinta sigue llegando hasta ellos.
  expect(hueco.sobra).toBeGreaterThanOrEqual(0);
});
