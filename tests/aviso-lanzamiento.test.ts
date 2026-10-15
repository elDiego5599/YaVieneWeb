import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvisoLanzamiento } from '../src/aviso-lanzamiento';
import { BACKEND } from '../src/backend';

/**
 * «Avísame cuando salga», montado como vive en index.html: el CTA, el
 * enlace de al lado y el formulario cuya píldora nace del CTA. Lo que se
 * prueba es lo que ve y oye la persona: estado, foco, mensajes y lo que
 * sale hacia el backend.
 */
function montar(): { form: HTMLFormElement; cta: HTMLButtonElement } {
  document.body.innerHTML = `
    <div class="hero-actions">
      <button type="button" data-aviso-abrir aria-expanded="false" aria-controls="aviso-lanzamiento">Avísame cuando salga</button>
      <a href="#como-funciona">Cómo funciona</a>
      <form id="aviso-lanzamiento" data-estado="cerrado" inert novalidate>
        <div class="aviso-pildora">
          <input name="telefono" type="tel" pattern="[0-9+ ()\\-]{7,20}" required />
          <button type="submit" aria-label="Enviar mi número"><svg class="aviso-boton-icono aviso-boton-enviar" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg><svg class="aviso-boton-icono aviso-boton-cerrar" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
          <p class="aviso-listo" role="status" tabindex="-1"></p>
        </div>
        <label><input type="checkbox" name="acepto" required /> Acepto</label>
        <p class="aviso-error" role="alert"></p>
      </form>
    </div>`;
  const form = document.querySelector<HTMLFormElement>('form')!;
  const cta = document.querySelector<HTMLButtonElement>('[data-aviso-abrir]')!;
  new AvisoLanzamiento(form, cta);
  return { form, cta };
}

const telefono = (): HTMLInputElement => document.querySelector('input[name="telefono"]')!;
const acepto = (): HTMLInputElement => document.querySelector('input[name="acepto"]')!;
const error = (): string => document.querySelector('.aviso-error')!.textContent ?? '';
const listo = (): HTMLElement => document.querySelector('.aviso-listo')!;
const enviar = (form: HTMLFormElement): void => {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};
const escribir = (valor: string): void => {
  telefono().value = valor;
  telefono().dispatchEvent(new Event('input', { bubbles: true }));
};

describe('AvisoLanzamiento', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  describe('abrir y cerrar', () => {
    it('el CTA abre la píldora, le pasa el foco al número y se aparta', () => {
      const { form, cta } = montar();
      cta.click();
      expect(form.dataset.estado).toBe('abierto');
      expect(cta.getAttribute('aria-expanded')).toBe('true');
      expect(form.hasAttribute('inert')).toBe(false);
      expect(cta.hasAttribute('inert')).toBe(true);
      expect(document.activeElement).toBe(telefono());
    });

    it('la píldora sale del sitio exacto del CTA', () => {
      const { form, cta } = montar();
      const pildora = form.querySelector<HTMLElement>('.aviso-pildora')!;
      vi.spyOn(cta, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 0, 230, 48));
      vi.spyOn(pildora, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 0, 470, 48));
      cta.click();
      expect(form.style.getPropertyValue('--aviso-izq')).toBe('0px');
      expect(form.style.getPropertyValue('--aviso-der')).toBe('240px');
    });

    it('no hay × en la píldora: se cierra con Escape o tocando fuera', () => {
      const { form } = montar();
      expect(form.querySelector('[data-aviso-cerrar]')).toBeNull();
    });

    it('tocar fuera con el campo vacío cierra por el mismo camino', () => {
      const { form, cta } = montar();
      cta.click();
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(form.dataset.estado).toBe('cerrado');
      expect(cta.getAttribute('aria-expanded')).toBe('false');
      expect(form.hasAttribute('inert')).toBe(true);
      expect(cta.hasAttribute('inert')).toBe(false);
      expect(document.activeElement).not.toBe(telefono());
    });

    it('tocar fuera con un número escrito no cierra: no se pierde lo escrito', () => {
      const { form, cta } = montar();
      cta.click();
      escribir('3001234567');
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(form.dataset.estado).toBe('abierto');
    });

    it('tocar dentro del formulario o en el CTA no cierra', () => {
      const { form, cta } = montar();
      cta.click();
      acepto().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      cta.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(form.dataset.estado).toBe('abierto');
    });

    it('cerrado, tocar fuera no hace nada', () => {
      const { form, cta } = montar();
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(form.dataset.estado).toBe('cerrado');
      expect(cta.getAttribute('aria-expanded')).toBe('false');
    });

    it('sin nada escrito el botón es una × que cierra; al escribir vuelve la flecha', () => {
      const { form, cta } = montar();
      const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      const pedir = vi.fn();
      vi.stubGlobal('fetch', pedir);
      cta.click();
      expect(boton.hasAttribute('data-cerrar')).toBe(true);
      expect(boton.getAttribute('aria-label')).toBe('Cerrar');
      escribir('3');
      expect(boton.hasAttribute('data-cerrar')).toBe(false);
      expect(boton.getAttribute('aria-label')).toBe('Enviar mi número');
      escribir('  ');
      expect(boton.hasAttribute('data-cerrar')).toBe(true);
      boton.click();
      expect(form.dataset.estado).toBe('cerrado');
      expect(document.activeElement).toBe(cta);
      expect(error()).toBe('');
      expect(pedir).not.toHaveBeenCalled();
    });

    it('tras enviar, el campo vacío vuelve a mostrar la ×', async () => {
      const { form, cta } = montar();
      const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
      cta.click();
      escribir('300 000 0000');
      acepto().checked = true;
      boton.click();
      for (let i = 0; i < 10; i++) await Promise.resolve();
      expect(form.dataset.estado).toBe('listo');
      expect(boton.hasAttribute('data-cerrar')).toBe(true);
    });

    it('Escape cierra; otra tecla no', () => {
      const { form, cta } = montar();
      cta.click();
      telefono().dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(form.dataset.estado).toBe('abierto');
      telefono().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(form.dataset.estado).toBe('cerrado');
      expect(document.activeElement).toBe(cta);
    });

    it('cerrar guarda lo escrito pero borra el error', () => {
      const { form, cta } = montar();
      cta.click();
      escribir('12');
      enviar(form);
      expect(error()).not.toBe('');
      telefono().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(error()).toBe('');
      expect(telefono().hasAttribute('aria-invalid')).toBe(false);
      expect(telefono().value).toBe('12');
    });
  });

  describe('validación', () => {
    it('vacío: pide el número, lo marca inválido y vuelve a él', () => {
      const { form, cta } = montar();
      const abrir = vi.fn();
      vi.stubGlobal('open', abrir);
      cta.click();
      acepto().focus();
      enviar(form);
      expect(error()).toBe('Escribe tu número de celular.');
      expect(telefono().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(telefono());
      expect(abrir).not.toHaveBeenCalled();
    });

    it('número malo: lo dice', () => {
      const { form, cta } = montar();
      cta.click();
      escribir('12');
      enviar(form);
      expect(error()).toBe('Escribe un celular válido, como 300 123 4567.');
    });

    it('sin la casilla: la pide, la marca y le pasa el foco', () => {
      const { form, cta } = montar();
      cta.click();
      escribir('300 000 0000');
      enviar(form);
      expect(error()).toBe('Acepta el tratamiento de datos para continuar.');
      expect(acepto().getAttribute('aria-invalid')).toBe('true');
      expect(telefono().hasAttribute('aria-invalid')).toBe(false);
      expect(document.activeElement).toBe(acepto());
    });

    it('al salir del campo: un número malo se avisa, el vacío no', () => {
      const { cta } = montar();
      cta.click();
      telefono().dispatchEvent(new FocusEvent('blur'));
      expect(error()).toBe('');
      escribir('12');
      telefono().dispatchEvent(new FocusEvent('blur'));
      expect(error()).toBe('Escribe un celular válido, como 300 123 4567.');
      expect(telefono().getAttribute('aria-invalid')).toBe('true');
    });

    it('al corregir el número el error se va sin esperar al envío', () => {
      const { form, cta } = montar();
      cta.click();
      escribir('12');
      enviar(form);
      escribir('300 000');
      expect(error()).toBe('');
      expect(telefono().hasAttribute('aria-invalid')).toBe(false);
    });

    it('escribir sin error a la vista no adelanta ninguno', () => {
      const { cta } = montar();
      cta.click();
      escribir('1');
      expect(error()).toBe('');
    });

    it('marcar la casilla quita su error', () => {
      const { form, cta } = montar();
      cta.click();
      escribir('300 000 0000');
      enviar(form);
      acepto().checked = true;
      acepto().dispatchEvent(new Event('change', { bubbles: true }));
      expect(error()).toBe('');
      expect(acepto().hasAttribute('aria-invalid')).toBe(false);
    });
  });

  describe('envío', () => {
    const llenar = (cta: HTMLButtonElement): void => {
      cta.click();
      escribir(' 300 000 0000 ');
      acepto().checked = true;
    };
    const responde = (status: number): ReturnType<typeof vi.fn> => {
      const pedir = vi.fn().mockResolvedValue(new Response(null, { status }));
      vi.stubGlobal('fetch', pedir);
      return pedir;
    };
    /** Deja correr la respuesta del fetch y sus `.then` (microtareas: no
        mueve el reloj, falso o no). */
    const esperar = async (): Promise<void> => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
      expect(document.querySelector('form')!.hasAttribute('aria-busy')).toBe(false);
    };

    it('manda el número y el permiso al backend, con la cabecera que salta el aviso de ngrok', async () => {
      const { form, cta } = montar();
      const pedir = responde(201);
      llenar(cta);
      enviar(form);
      await esperar();
      expect(pedir).toHaveBeenCalledTimes(1);
      const [url, opciones] = pedir.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BACKEND}/api/lanzamiento`);
      expect(opciones.method).toBe('POST');
      expect(opciones.headers).toEqual({
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1'
      });
      expect(JSON.parse(opciones.body as string)).toEqual({ telefono: '300 000 0000', acepto: true });
    });

    it('no abre WhatsApp: el número va solo al backend', async () => {
      const { form, cta } = montar();
      const abrir = vi.fn();
      vi.stubGlobal('open', abrir);
      responde(201);
      llenar(cta);
      enviar(form);
      await esperar();
      expect(abrir).not.toHaveBeenCalled();
    });

    it('mientras viaja, otro envío no sale: un doble toque no manda dos', async () => {
      const { form, cta } = montar();
      let soltar: (r: Response) => void = () => {};
      const pedir = vi.fn().mockReturnValue(new Promise<Response>(r => (soltar = r)));
      vi.stubGlobal('fetch', pedir);
      llenar(cta);
      enviar(form);
      expect(form.getAttribute('aria-busy')).toBe('true');
      enviar(form);
      expect(pedir).toHaveBeenCalledTimes(1);
      soltar(new Response(null, { status: 201 }));
      await esperar();
      expect(form.dataset.estado).toBe('listo');
    });

    it('confirma en la misma píldora y luego vuelve al CTA', async () => {
      const { form, cta } = montar();
      responde(201);
      llenar(cta);
      enviar(form);
      await esperar();
      expect(form.dataset.estado).toBe('listo');
      expect(listo().textContent).toBe('Listo. Te avisamos cuando salga.');
      expect(document.activeElement).toBe(listo());
      expect(telefono().value).toBe('');
      expect(acepto().checked).toBe(false);
    });

    it('la confirmación dura 2,4 s y el foco vuelve al CTA', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const { form, cta } = montar();
      responde(201);
      llenar(cta);
      enviar(form);
      await esperar();
      vi.advanceTimersByTime(2399);
      expect(form.dataset.estado).toBe('listo');
      vi.advanceTimersByTime(1);
      expect(form.dataset.estado).toBe('cerrado');
      expect(listo().textContent).toBe('');
      expect(document.activeElement).toBe(cta);
    });

    it('si el foco ya se fue a otra parte, volver al CTA no se lo roba', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const { form, cta } = montar();
      responde(201);
      llenar(cta);
      enviar(form);
      await esperar();
      const enlace = document.querySelector<HTMLAnchorElement>('a')!;
      enlace.focus();
      vi.advanceTimersByTime(2400);
      expect(form.dataset.estado).toBe('cerrado');
      expect(document.activeElement).toBe(enlace);
    });

    it('reabrir durante la confirmación la corta: el temporizador no la cierra después', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const { form, cta } = montar();
      responde(201);
      llenar(cta);
      enviar(form);
      await esperar();
      listo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      cta.click();
      vi.advanceTimersByTime(2400);
      expect(form.dataset.estado).toBe('abierto');
    });

    it.each([
      [400, 'Escribe un celular válido, como 300 123 4567.'],
      [429, 'Ya recibimos varios números desde aquí. Inténtalo más tarde.'],
      [503, 'No pudimos guardar tu número. Inténtalo de nuevo.'],
      [500, 'No pudimos guardar tu número. Inténtalo de nuevo.']
    ])('si el backend responde %i lo dice y se queda abierta con lo escrito', async (status, mensaje) => {
      const { form, cta } = montar();
      responde(status);
      llenar(cta);
      enviar(form);
      await esperar();
      expect(error()).toBe(mensaje);
      expect(form.dataset.estado).toBe('abierto');
      expect(telefono().value).toBe(' 300 000 0000 ');
      expect(acepto().checked).toBe(true);
    });

    it('el 400 marca el número y le devuelve el foco', async () => {
      const { form, cta } = montar();
      responde(400);
      llenar(cta);
      enviar(form);
      await esperar();
      expect(telefono().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(telefono());
    });

    it('sin red lo dice igual, sin perder lo escrito', async () => {
      const { form, cta } = montar();
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      llenar(cta);
      enviar(form);
      await esperar();
      expect(error()).toBe('No pudimos guardar tu número. Inténtalo de nuevo.');
      expect(form.dataset.estado).toBe('abierto');
      expect(telefono().value).toBe(' 300 000 0000 ');
    });

    it('si cerraron la píldora mientras viajaba, la respuesta no la reabre', async () => {
      const { form, cta } = montar();
      let soltar: (r: Response) => void = () => {};
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>(r => (soltar = r))));
      llenar(cta);
      enviar(form);
      telefono().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      soltar(new Response(null, { status: 500 }));
      await esperar();
      expect(form.dataset.estado).toBe('cerrado');
      expect(error()).toBe('');
    });
  });
});
