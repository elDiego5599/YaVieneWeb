import { expect, test } from '@playwright/test';

/**
 * El formulario de empresas, enviado de verdad en el navegador.
 *
 * El panel de éxito sale donde estaba el formulario: el formulario se va.
 * `hidden` no basta por sí solo, porque la hoja le da `display: flex` y
 * una regla de autor le gana al `display: none` del navegador; esto mira
 * que de verdad desaparezca de la pantalla.
 */
test('al enviar, el formulario se va y queda el panel de éxito', async ({ page }) => {
  // La pestaña de WhatsApp no se abre: basta con que haya ventana.
  await page.addInitScript(() => {
    window.open = () => ({ opener: null, location: { href: '' } }) as unknown as Window;
  });
  await page.goto('/empresas.html');
  const form = page.locator('#contact-form');
  await form.scrollIntoViewIfNeeded();
  await form.locator('#nombre').fill('Diego');
  await form.locator('#empresa').fill('Sobusa');
  await form.locator('#telefono').fill('300 000 0000');
  await form.locator('button[type="submit"]').click();

  await expect(page.locator('#form-success')).toBeVisible();
  await expect(form).toBeHidden();
  await expect(page.locator('#form-error')).toBeHidden();
});
