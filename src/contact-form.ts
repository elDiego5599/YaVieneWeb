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

/** El WhatsApp de Ya Viene, el mismo del botón de la sección. Se exporta
    para que `tests/coherencia.test.ts` compruebe que los enlaces escritos
    a mano en el HTML siguen apuntando a este número y no a uno viejo. */
export const WHATSAPP = '573004438626';

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
      this.mostrarExito(!endpoint);
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

    // Se abre en dos tiempos y no de una, y la razón es un detalle de la
    // norma que costaba caro: `window.open(url, '_blank', 'noopener')`
    // devuelve `null` SIEMPRE. Es coherente —si se corta el vínculo con
    // quien abre, no hay ventana que devolver— pero aquí ese `null` se
    // leía como «la bloquearon», y salía el peor resultado posible:
    // WhatsApp se abría con el mensaje escrito y la página, al volver,
    // decía que no se había podido enviar.
    //
    // Abriendo primero una pestaña en blanco sí hay ventana en la mano.
    // Si viene `null` es que la bloquearon de verdad, y sólo entonces se
    // avisa. El vínculo se corta a mano antes de llevarla a wa.me —eso
    // es lo que hacía `noopener`— y se corta mientras la pestaña todavía
    // es nuestra, que es el único momento en que se puede.
    const ventana = window.open('', '_blank');
    if (!ventana) throw new Error('El navegador bloqueó la ventana de WhatsApp');
    try {
      ventana.opener = null;
    } catch {
      // Navegador que no deja tocarlo: la pestaña se abre igual.
    }
    ventana.location.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
  }

  /**
   * Por WhatsApp nadie ha recibido nada todavía: el mensaje queda escrito
   * y la empresa aún tiene que darle a enviar. Decirle «solicitud
   * recibida» sería mentirle sobre el único paso que falta, así que cada
   * camino cuenta lo que de verdad pasó.
   */
  private mostrarExito(porWhatsApp: boolean): void {
    if (!this.exito) return;
    if (porWhatsApp) {
      const titulo = this.exito.querySelector('[data-exito-titulo]');
      const texto = this.exito.querySelector('[data-exito-texto]');
      if (titulo) titulo.textContent = 'Te abrimos WhatsApp';
      if (texto) {
        texto.textContent =
          'La conversación va con tus datos ya escritos. Dale a enviar y te respondemos por ahí.';
      }
    }
    this.exito.hidden = false;
    this.exito.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private mostrarError(mensaje: string): void {
    if (!this.error) return;
    this.error.textContent = mensaje;
    this.error.hidden = mensaje === '';
  }
}
