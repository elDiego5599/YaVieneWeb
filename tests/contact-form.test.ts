import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ContactForm } from '../src/contact-form';

/**
 * Monta el formulario tal cual vive en index.html: los ids son los mismos
 * que busca ContactForm (form-success, form-error) y el botón es de tipo
 * submit dentro del form.
 */
function montarFormulario(): HTMLFormElement {
  document.body.innerHTML = `
    <form id="contact-form">
      <input name="nombre" value="Diego" />
      <input name="empresa" value="Sobusa" />
      <input name="telefono" value="300 000 0000" />
      <button type="submit">Quiero conectar mi flota</button>
    </form>
    <p id="form-error" role="alert" hidden></p>
    <div id="form-success" hidden></div>
  `;
  return document.getElementById('contact-form') as HTMLFormElement;
}

async function enviar(form: HTMLFormElement): Promise<void> {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  // El envío es async: cede un tick para que corra.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('ContactForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('con endpoint configurado hace POST real y no abre WhatsApp', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', 'https://api.example.com/contacto');
    const post = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', post);
    const abrirWhatsApp = vi.fn().mockReturnValue({});
    vi.stubGlobal('open', abrirWhatsApp);

    const form = montarFormulario();
    new ContactForm(form);
    await enviar(form);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe('https://api.example.com/contacto');
    const cuerpo = JSON.parse((post.mock.calls[0][1] as RequestInit).body as string);
    expect(cuerpo).toEqual({ nombre: 'Diego', empresa: 'Sobusa', telefono: '300 000 0000' });
    expect(abrirWhatsApp).not.toHaveBeenCalled();
    expect((document.getElementById('form-success') as HTMLElement).hidden).toBe(false);
  });

  it('sin endpoint abre WhatsApp con el mensaje pre-armado', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', '');
    const abrirWhatsApp = vi.fn().mockReturnValue({});
    vi.stubGlobal('open', abrirWhatsApp);
    const post = vi.fn();
    vi.stubGlobal('fetch', post);

    const form = montarFormulario();
    new ContactForm(form);
    await enviar(form);

    expect(post).not.toHaveBeenCalled();
    expect(abrirWhatsApp).toHaveBeenCalledTimes(1);
    const url = abrirWhatsApp.mock.calls[0][0] as string;
    expect(url).toContain('https://wa.me/573004438626');
    expect(decodeURIComponent(url)).toContain('Hola, soy Diego de Sobusa');
    expect((document.getElementById('form-success') as HTMLElement).hidden).toBe(false);
  });

  it('con la ventana bloqueada muestra error y no da por enviado nada', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', '');
    vi.stubGlobal('open', vi.fn().mockReturnValue(null));

    const form = montarFormulario();
    new ContactForm(form);
    await enviar(form);

    const error = document.getElementById('form-error') as HTMLElement;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toContain('No pudimos enviar');
    expect((document.getElementById('form-success') as HTMLElement).hidden).toBe(true);
    // El botón vuelve: un fallo no puede dejar el formulario muerto.
    expect((form.querySelector('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('bloquea el doble envío mientras el primero está en vuelo', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', 'https://api.example.com/contacto');
    let soltar!: () => void;
    const post = vi.fn().mockReturnValue(new Promise<void>((resolve) => { soltar = resolve; }));
    vi.stubGlobal('fetch', post);
    vi.stubGlobal('open', vi.fn());

    const form = montarFormulario();
    new ContactForm(form);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Segundo envío mientras el primero espera: ignorado.
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(post).toHaveBeenCalledTimes(1);

    soltar();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((form.querySelector('button') as HTMLButtonElement).disabled).toBe(false);
  });
});
