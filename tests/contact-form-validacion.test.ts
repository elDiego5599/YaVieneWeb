import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from '../src/contact-form';

/**
 * Validación en línea del formulario de empresas: el mensaje propio sale
 * junto al campo al salir de él, se corrige al escribir y, al enviar con
 * errores, se marcan todos y el foco va al primero. Sin burbujas nativas.
 */

function montar(valores: { nombre?: string; empresa?: string; telefono?: string } = {}): HTMLFormElement {
  const { nombre = '', empresa = '', telefono = '' } = valores;
  document.body.innerHTML = `
    <form id="contact-form">
      <input required id="nombre" name="nombre" value="${nombre}" aria-describedby="nombre-error" />
      <p id="nombre-error" class="form-campo-error" aria-live="polite"></p>
      <input required id="empresa" name="empresa" value="${empresa}" aria-describedby="empresa-error" />
      <p id="empresa-error" class="form-campo-error" aria-live="polite"></p>
      <input required type="tel" id="telefono" name="telefono" value="${telefono}"
        pattern="[0-9 +\\(\\)\\-]{7,20}" aria-describedby="telefono-ayuda telefono-error" />
      <p id="telefono-ayuda">Ej.: 300 123 4567</p>
      <p id="telefono-error" class="form-campo-error" aria-live="polite"></p>
      <button type="submit">Quiero conectar mi flota</button>
    </form>
    <p id="form-error" role="alert" hidden></p>
    <div id="form-success" tabindex="-1" hidden></div>
  `;
  return document.getElementById('contact-form') as HTMLFormElement;
}

const campo = (id: string): HTMLInputElement => document.getElementById(id) as HTMLInputElement;
const aviso = (id: string): string => document.getElementById(`${id}-error`)!.textContent ?? '';
const escribir = (id: string, valor: string): void => {
  campo(id).value = valor;
  campo(id).dispatchEvent(new Event('input', { bubbles: true }));
};
const salir = (id: string): void => {
  // Al salir el navegador lanza `blur` (no burbujea) y `focusout` (sí).
  campo(id).dispatchEvent(new Event('focusout', { bubbles: true }));
};
const enviar = async (form: HTMLFormElement): Promise<void> => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
};

describe('ContactForm: validación en línea', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Riesgo: las burbujas nativas vuelven y tapan los mensajes propios.
  it('apaga la validación nativa del navegador', () => {
    const form = montar();
    new ContactForm(form);
    expect(form.noValidate).toBe(true);
  });

  // Riesgo: se avisa al llegar al campo, antes de que la persona escriba.
  it('no marca nada hasta que se sale del campo', () => {
    new ContactForm(montar());
    expect(campo('nombre').getAttribute('aria-invalid')).toBeNull();
    expect(aviso('nombre')).toBe('');
  });

  // Riesgo: el error no llega al lector de pantalla ni se ve junto al campo.
  it('al salir de un campo vacío lo marca y escribe el mensaje en español', () => {
    new ContactForm(montar());
    salir('nombre');
    expect(campo('nombre').getAttribute('aria-invalid')).toBe('true');
    expect(aviso('nombre')).toBe('Escriba su nombre.');
    expect(campo('nombre').getAttribute('aria-describedby')).toContain('nombre-error');
  });

  // Riesgo: un campo con solo espacios pasa por válido y manda «Hola, soy  de…».
  it('unos espacios solos cuentan como vacío', () => {
    new ContactForm(montar());
    escribir('empresa', '    ');
    salir('empresa');
    expect(campo('empresa').getAttribute('aria-invalid')).toBe('true');
    expect(aviso('empresa')).toBe('Escriba el nombre de la empresa.');
  });

  // Riesgo: el teléfono con letras pasa, o el mensaje no dice qué falta.
  it('un teléfono con formato malo dice cómo escribirlo', () => {
    new ContactForm(montar());
    escribir('telefono', 'abc');
    salir('telefono');
    expect(campo('telefono').getAttribute('aria-invalid')).toBe('true');
    expect(aviso('telefono')).toBe('Escriba un teléfono válido: solo números, de 7 a 20 caracteres.');
    // La ayuda del formato sigue enlazada junto al error.
    expect(campo('telefono').getAttribute('aria-describedby')).toContain('telefono-ayuda');
  });

  it('un teléfono bien escrito no se marca', () => {
    new ContactForm(montar());
    escribir('telefono', '+57 (300) 123-4567');
    salir('telefono');
    expect(campo('telefono').getAttribute('aria-invalid')).toBeNull();
    expect(aviso('telefono')).toBe('');
  });

  // Riesgo: escribir en un campo virgen lo marca a mitad de la frase.
  it('al escribir no marca un campo que aún no estaba marcado', () => {
    new ContactForm(montar());
    escribir('telefono', '30');
    expect(campo('telefono').getAttribute('aria-invalid')).toBeNull();
    expect(aviso('telefono')).toBe('');
  });

  // Riesgo: el error se queda pegado aunque ya se corrigió.
  it('al corregir un campo marcado, el error se va en el acto', () => {
    new ContactForm(montar());
    salir('nombre');
    escribir('nombre', 'Diego');
    expect(campo('nombre').getAttribute('aria-invalid')).toBeNull();
    expect(aviso('nombre')).toBe('');
  });

  it('si al corregir sigue mal, sigue marcado con su mensaje', () => {
    new ContactForm(montar());
    escribir('telefono', 'abc');
    salir('telefono');
    escribir('telefono', 'abc1');
    expect(campo('telefono').getAttribute('aria-invalid')).toBe('true');
    expect(aviso('telefono')).not.toBe('');
  });

  // Riesgo: enviar con errores no dice cuáles ni lleva a ninguno.
  it('al enviar con errores marca todos, lleva el foco al primero y no envía', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', 'https://api.example.com/contacto');
    const post = vi.fn();
    vi.stubGlobal('fetch', post);
    const abrir = vi.fn();
    vi.stubGlobal('open', abrir);
    const form = montar({ empresa: 'Sobusa' });
    new ContactForm(form);
    await enviar(form);

    expect(campo('nombre').getAttribute('aria-invalid')).toBe('true');
    expect(campo('empresa').getAttribute('aria-invalid')).toBeNull();
    expect(campo('telefono').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(campo('nombre'));
    expect(post).not.toHaveBeenCalled();
    expect(abrir).not.toHaveBeenCalled();
    expect((document.getElementById('form-success') as HTMLElement).hidden).toBe(true);
    expect((form.querySelector('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('el foco va al primer campo inválido aunque no sea el primero del formulario', async () => {
    const form = montar({ nombre: 'Diego', empresa: 'Sobusa', telefono: '12' });
    new ContactForm(form);
    await enviar(form);
    expect(document.activeElement).toBe(campo('telefono'));
  });

  // Riesgo: tras corregir todo, el envío sigue bloqueado.
  it('con todo corregido el envío sigue su camino', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', 'https://api.example.com/contacto');
    const post = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', post);
    const form = montar();
    new ContactForm(form);
    await enviar(form);
    escribir('nombre', 'Diego');
    escribir('empresa', 'Sobusa');
    escribir('telefono', '300 123 4567');
    await enviar(form);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('empresas.html: el formulario', () => {
  const html = readFileSync(resolve(process.cwd(), 'empresas.html'), 'utf8');
  const form = html.match(/<form id="contact-form"[\s\S]*?<\/form>/)?.[0] ?? '';

  it('lleva novalidate y un aviso propio por campo, enlazado con aria-describedby', () => {
    expect(form).toMatch(/<form id="contact-form"[^>]*\bnovalidate\b/);
    for (const id of ['nombre', 'empresa', 'telefono']) {
      expect(form, id).toContain(`id="${id}-error"`);
      expect(form, id).toMatch(new RegExp(`aria-describedby="[^"]*${id}-error`));
    }
  });

  it('el teléfono lleva tipo, teclado, autocompletado, patrón y ejemplo', () => {
    const tel = form.match(/<input[^>]*id="telefono"[^>]*>/)?.[0] ?? '';
    expect(tel).toContain('type="tel"');
    expect(tel).toContain('inputmode="tel"');
    expect(tel).toContain('autocomplete="tel"');
    expect(tel).toContain('pattern="[0-9 +\\(\\)\\-]{7,20}"');
    expect(tel).toContain('telefono-ayuda');
    expect(form).toMatch(/id="telefono-ayuda"[^>]*>\s*Ej\.: 300 123 4567/);
  });
});
