/**
 * ContactForm — el formulario de "conecta tu flota".
 *
 * No finge nada: si hay un endpoint configurado (VITE_CONTACT_ENDPOINT) el
 * formulario lo llama de verdad y respeta lo que responda; si no lo hay,
 * abre WhatsApp con el mensaje ya escrito, que es el canal que la página
 * ofrece dos párrafos más arriba. En los dos caminos el botón vuelve a
 * quedar utilizable y los campos se limpian, para que un segundo envío no
 * choque contra un formulario muerto.
 */

/** El WhatsApp de Ya Viene, el mismo del botón de la sección. */
const WHATSAPP = '573004438626';

export class ContactForm {
  private readonly form: HTMLFormElement;
  private readonly boton: HTMLButtonElement;
  private readonly exito: HTMLElement | null;
  private readonly error: HTMLElement | null;
  private readonly etiquetaOriginal: string;
  private enviando = false;

  constructor(form: HTMLFormElement) {
    this.form = form;
    const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!boton) throw new Error('El formulario no tiene botón de envío');
    this.boton = boton;
    this.etiquetaOriginal = boton.textContent ?? 'Enviar';
    this.exito = document.getElementById('form-success');
    this.error = document.getElementById('form-error');

    form.addEventListener('submit', e => {
      e.preventDefault();
      void this.enviar();
    });
  }

  private get datos(): Record<string, string> {
    const campos = new FormData(this.form);
    const salida: Record<string, string> = {};
    for (const [clave, valor] of campos.entries()) {
      if (typeof valor === 'string') salida[clave] = valor.trim();
    }
    return salida;
  }

  private async enviar(): Promise<void> {
    if (this.enviando) return;
    if (!this.form.reportValidity()) return;

    this.enviando = true;
    this.mostrarError('');
    this.boton.disabled = true;
    this.boton.textContent = 'Enviando…';

    try {
      const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT;
      if (endpoint) await ContactForm.publicar(endpoint, this.datos);
      else this.abrirWhatsApp();
      this.form.reset();
      this.mostrarExito();
    } catch {
      this.mostrarError(
        'No pudimos enviar la solicitud. Vuelve a intentarlo o escríbenos por WhatsApp.'
      );
    } finally {
      // Pase lo que pase el botón vuelve: si falló hay que poder reintentar,
      // y si funcionó puede llegar otra empresa desde el mismo navegador.
      this.enviando = false;
      this.boton.disabled = false;
      this.boton.textContent = this.etiquetaOriginal;
    }
  }

  private static async publicar(endpoint: string, datos: Record<string, string>): Promise<void> {
    const respuesta = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`);
  }

  /** Mensaje con lo que la empresa acaba de escribir, listo para enviar. */
  private abrirWhatsApp(): void {
    const { nombre = '', empresa = '', telefono = '' } = this.datos;
    const texto =
      `Hola, soy ${nombre} de ${empresa}. ` +
      `Quiero conectar mi flota a Ya Viene. Mi teléfono es ${telefono}.`;
    const ventana = window.open(
      `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`,
      '_blank',
      'noopener'
    );
    // Si el navegador bloqueó la ventana el mensaje no salió: no se puede
    // dar por enviado algo que nadie recibió.
    if (!ventana) throw new Error('El navegador bloqueó la ventana de WhatsApp');
  }

  private mostrarExito(): void {
    if (!this.exito) return;
    this.exito.hidden = false;
    this.exito.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private mostrarError(mensaje: string): void {
    if (!this.error) return;
    this.error.textContent = mensaje;
    this.error.hidden = mensaje === '';
  }
}
