import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactForm } from '../src/contact-form';

/**
 * Lo que `contact-form.test.ts` no cubre: el servidor que dice que no, la
 * conexión que se cae y el segundo intento, el formulario incompleto y la
 * página a la que le falta un trozo. En todos los casos se mira lo que ve
 * la empresa que escribe: qué aviso sale, si sus datos siguen ahí y si el
 * botón le deja volver a intentarlo.
 */

const ENDPOINT = 'https://api.example.com/contacto';

/** El formulario de index.html, con los paneles de éxito y error opcionales. */
function montar({ exito = true, error = true, textosExito = true } = {}): HTMLFormElement {
  document.body.innerHTML = `
    <form id="contact-form">
      <input name="nombre" value="Diego" required />
      <input name="empresa" value="Sobusa" />
      <input name="telefono" value="300 000 0000" />
      <button type="submit">Quiero conectar mi flota</button>
    </form>
    ${error ? '<p id="form-error" role="alert" hidden></p>' : ''}
    ${
      exito
        ? `<div id="form-success" tabindex="-1" hidden>${
            textosExito
              ? '<h3 data-exito-titulo>¡Solicitud recibida!</h3><p data-exito-texto>Te contactaremos pronto.</p>'
              : ''
          }</div>`
        : ''
    }
  `;
  return document.getElementById('contact-form') as HTMLFormElement;
}

async function enviar(form: HTMLFormElement): Promise<void> {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  // El envío es async: cede un tick para que corra.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const campo = (nombre: string): HTMLInputElement =>
  document.querySelector<HTMLInputElement>(`input[name="${nombre}"]`)!;
const boton = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const error = (): HTMLElement => document.getElementById('form-error') as HTMLElement;
const exito = (): HTMLElement => document.getElementById('form-success') as HTMLElement;

describe('ContactForm cuando algo sale mal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    // happy-dom no implementa el desplazamiento; el formulario lo pide al acabar.
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Riesgo: el servidor responde 500 y la página dice «recibida» igual.
  it('si el servidor responde con error avisa y no da nada por enviado', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', ENDPOINT);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const form = montar();
    new ContactForm(form);
    await enviar(form);

    expect(error().hidden).toBe(false);
    expect(error().textContent).toContain('No pudimos enviar la solicitud');
    expect(exito().hidden).toBe(true);
    expect(boton().disabled).toBe(false);
    expect(boton().textContent).toBe('Quiero conectar mi flota');
  });

  // Riesgo: un envío fallido borra lo que la empresa escribió y la obliga a empezar de cero.
  it('si el envío falla los datos escritos se quedan en el formulario', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', ENDPOINT);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    const form = montar();
    new ContactForm(form);
    campo('nombre').value = 'Ana';
    campo('empresa').value = 'Coolitoral';
    await enviar(form);

    expect(campo('nombre').value).toBe('Ana');
    expect(campo('empresa').value).toBe('Coolitoral');
  });

  // Riesgo: la conexión se cae (fetch rechaza) y el botón se queda en «Enviando…» para siempre.
  it('con la conexión caída avisa y devuelve el botón', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', ENDPOINT);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const form = montar();
    new ContactForm(form);
    await enviar(form);

    expect(error().hidden).toBe(false);
    expect(boton().disabled).toBe(false);
    expect(boton().textContent).toBe('Quiero conectar mi flota');
  });

  // Riesgo: tras un fallo, el reintento no llega o deja el aviso de error viejo a la vista.
  it('el reintento tras un fallo envía y quita el aviso de error', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', ENDPOINT);
    const post = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', post);

    const form = montar();
    new ContactForm(form);
    await enviar(form);
    expect(error().hidden).toBe(false);

    await enviar(form);
    expect(post).toHaveBeenCalledTimes(2);
    expect(error().hidden).toBe(true);
    expect(error().textContent).toBe('');
    expect(exito().hidden).toBe(false);
  });

  // Riesgo: mientras se envía el botón sigue activo y sin decir nada.
  it('mientras espera al servidor el botón dice «Enviando…» y no se deja pulsar', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', ENDPOINT);
    let soltar!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((r) => (soltar = r))));

    const form = montar();
    new ContactForm(form);
    await enviar(form);
    expect(boton().disabled).toBe(true);
    expect(boton().textContent).toBe('Enviando…');

    soltar(new Response(null, { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(boton().disabled).toBe(false);
    expect(boton().textContent).toBe('Quiero conectar mi flota');
  });

  // Riesgo: se manda al servidor lo que se escribió con espacios de más.
  it('manda los campos sin espacios sobrantes', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', ENDPOINT);
    const post = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', post);

    const form = montar();
    new ContactForm(form);
    campo('nombre').value = '   Ana María  ';
    campo('telefono').value = '\t3001234567 ';
    await enviar(form);

    const cuerpo = JSON.parse((post.mock.calls[0]![1] as RequestInit).body as string);
    expect(cuerpo).toEqual({ nombre: 'Ana María', empresa: 'Sobusa', telefono: '3001234567' });
  });

  // Riesgo: un campo obligatorio vacío se envía igual (o abre WhatsApp con «Hola, soy  de …»).
  it('con un campo obligatorio vacío no envía ni abre WhatsApp', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', '');
    const abrir = vi.fn();
    vi.stubGlobal('open', abrir);
    const post = vi.fn();
    vi.stubGlobal('fetch', post);

    const form = montar();
    new ContactForm(form);
    campo('nombre').value = '';
    await enviar(form);

    expect(abrir).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(exito().hidden).toBe(true);
    expect(boton().disabled).toBe(false);
  });

  // Riesgo: el navegador no deja tocar `opener` y eso se lee como fallo del envío.
  it('si el navegador no deja cortar el vínculo, WhatsApp se abre igual', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', '');
    const ventana = {
      location: { href: '' },
      set opener(_v: unknown) {
        throw new Error('SecurityError');
      },
    };
    vi.stubGlobal('open', vi.fn().mockReturnValue(ventana));

    const form = montar();
    new ContactForm(form);
    await enviar(form);

    expect(ventana.location.href).toContain('https://wa.me/573004438626');
    expect(error().hidden).toBe(true);
    expect(exito().hidden).toBe(false);
  });

  // Riesgo: el mensaje de WhatsApp rompe la URL con tildes, «&» o «#» en el nombre de la empresa.
  it('el mensaje de WhatsApp llega entero aunque lleve tildes o símbolos', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', '');
    const ventana = { opener: {} as unknown, location: { href: '' } };
    vi.stubGlobal('open', vi.fn().mockReturnValue(ventana));

    const form = montar();
    new ContactForm(form);
    campo('empresa').value = 'Transportes Peña & Cía #2';
    await enviar(form);

    const url = new URL(ventana.location.href);
    expect(url.searchParams.get('text')).toBe(
      'Hola, soy Diego de Transportes Peña & Cía #2. Quiero conectar mi flota a Ya Viene. Mi teléfono es 300 000 0000.'
    );
  });

  // Riesgo: tras el envío el foco se queda en un formulario que ya no importa y el lector no lee el aviso.
  it('al acabar lleva el foco al panel de éxito', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', ENDPOINT);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    const form = montar();
    new ContactForm(form);
    await enviar(form);

    expect(document.activeElement).toBe(exito());
    // Con servidor sí se recibió: el panel conserva su «¡Solicitud recibida!».
    expect(exito().querySelector('[data-exito-titulo]')!.textContent).toBe('¡Solicitud recibida!');
  });
});

describe('ContactForm con la página incompleta', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Riesgo: un formulario sin botón de envío falla en silencio y nadie se entera en desarrollo.
  it('sin botón de envío avisa con un error que dice qué falta', () => {
    document.body.innerHTML = '<form id="f"><input name="nombre" /></form>';
    const form = document.getElementById('f') as HTMLFormElement;
    expect(() => new ContactForm(form)).toThrow('El formulario no tiene botón de envío');
  });

  // Riesgo: una página sin los paneles de aviso revienta al enviar y deja el botón muerto.
  it('sin paneles de éxito ni de error el envío termina y el botón vuelve', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', ENDPOINT);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const form = montar({ exito: false, error: false });
    new ContactForm(form);
    await enviar(form);
    expect(boton().disabled).toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    await enviar(form);
    expect(boton().disabled).toBe(false);
    expect(boton().textContent).toBe('Quiero conectar mi flota');
  });

  // Riesgo: un panel de éxito sin título ni texto hace fallar el camino de WhatsApp.
  it('un panel de éxito sin título ni texto se enseña igual', async () => {
    vi.stubEnv('VITE_CONTACT_ENDPOINT', '');
    vi.stubGlobal('open', vi.fn().mockReturnValue({ opener: {}, location: { href: '' } }));

    const form = montar({ textosExito: false });
    new ContactForm(form);
    await enviar(form);

    expect(exito().hidden).toBe(false);
    expect(error().hidden).toBe(true);
  });
});
