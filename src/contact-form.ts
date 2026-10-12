/**
 * ContactForm — el formulario de "conecta tu flota".
 *
 * No finge nada: si hay un endpoint configurado (VITE_CONTACT_ENDPOINT) el
 * formulario lo llama de verdad y respeta lo que responda; si no lo hay,
 * abre WhatsApp con el mensaje ya escrito, que es el canal que la página
 * ofrece dos párrafos más arriba. Si sale bien, el formulario deja su
 * sitio al panel que cuenta qué pasó; si falla, se queda con los datos
 * escritos, el aviso de error y el botón listo para reintentar.
 */

/** El WhatsApp de Ya Viene, el mismo del botón de la sección. Se exporta
    para que `tests/coherencia.test.ts` compruebe que los enlaces escritos
    a mano en el HTML siguen apuntando a este número y no a uno viejo. */
export const WHATSAPP = '573004438626';

/** Lo que se le dice a la empresa cuando un campo viene vacío. */
const FALTA: Record<string, string> = {
  nombre: 'Escriba su nombre.',
  empresa: 'Escriba el nombre de la empresa.',
  telefono: 'Escriba un teléfono o WhatsApp.'
};
const FALTA_GENERICO = 'Complete este campo.';
const TELEFONO_MALO = 'Escriba un teléfono válido: solo números, de 7 a 20 caracteres.';

export class ContactForm {
  readonly #form: HTMLFormElement;
  readonly #boton: HTMLButtonElement;
  readonly #exito: HTMLElement | null;
  readonly #error: HTMLElement | null;
  readonly #etiquetaOriginal: string;
  #enviando = false;

  constructor(form: HTMLFormElement) {
    this.#form = form;
    const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!boton) throw new Error('El formulario no tiene botón de envío');
    this.#boton = boton;
    this.#etiquetaOriginal = boton.textContent ?? 'Enviar';
    this.#exito = document.getElementById('form-success');
    this.#error = document.getElementById('form-error');

    // La validación la hace este archivo, con mensajes propios junto a cada
    // campo; las burbujas nativas de `reportValidity()` salen sin estilo,
    // en el idioma del navegador y de una en una. Las reglas siguen siendo
    // las del HTML (`required`, `pattern`): aquí sólo se leen.
    form.noValidate = true;
    // Al salir del campo se revisa; al escribir sólo se revisa si ya estaba
    // marcado, para no regañar a quien aún está a mitad de la frase.
    form.addEventListener('focusout', e => {
      if (e.target instanceof HTMLInputElement) this.#validar(e.target);
    });
    form.addEventListener('input', e => {
      if (e.target instanceof HTMLInputElement && e.target.getAttribute('aria-invalid') === 'true') {
        this.#validar(e.target);
      }
    });
    form.addEventListener('reset', () => {
      for (const c of this.#campos) this.#marcar(c, '');
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      void this.#enviar();
    });
  }

  get #campos(): HTMLInputElement[] {
    return [...this.#form.querySelectorAll<HTMLInputElement>('input[name]')];
  }

  /** El mensaje que toca al campo, o '' si está bien. */
  #mensaje(campo: HTMLInputElement): string {
    // Unos espacios solos no son un dato: el envío los recorta y quedaría vacío.
    if (campo.required && campo.value.trim() === '') return FALTA[campo.name] ?? FALTA_GENERICO;
    if (campo.value !== '' && !campo.checkValidity()) return TELEFONO_MALO;
    return '';
  }

  /** Revisa un campo y lo marca o desmarca. Devuelve si está bien. */
  #validar(campo: HTMLInputElement): boolean {
    const mensaje = this.#mensaje(campo);
    this.#marcar(campo, mensaje);
    return mensaje === '';
  }

  /** `aria-invalid` + el texto del aviso (`<id>-error`, que es región viva educada). */
  #marcar(campo: HTMLInputElement, mensaje: string): void {
    if (mensaje) campo.setAttribute('aria-invalid', 'true');
    else campo.removeAttribute('aria-invalid');
    const aviso = document.getElementById(`${campo.id}-error`);
    if (aviso) aviso.textContent = mensaje;
  }

  get #datos(): Record<string, string> {
    const campos = new FormData(this.#form);
    const salida: Record<string, string> = {};
    for (const [clave, valor] of campos.entries()) {
      if (typeof valor === 'string') salida[clave] = valor.trim();
    }
    return salida;
  }

  async #enviar(): Promise<void> {
    if (this.#enviando) return;
    // Se marcan todos a la vez (no se corta en el primero) y el foco va al
    // primero que falla, que es donde el lector de pantalla empieza a leer.
    const malos = this.#campos.filter(c => !this.#validar(c));
    if (malos.length > 0) {
      malos[0]!.focus();
      return;
    }

    this.#enviando = true;
    // Cada intento parte limpio: sin el aviso de error del anterior y sin
    // su éxito. Si no, un fallo después de un envío bueno dejaba a la vez
    // «Le abrimos WhatsApp» y «No pudimos enviar».
    this.#mostrarError('');
    if (this.#exito) this.#exito.hidden = true;
    this.#boton.disabled = true;
    this.#boton.textContent = 'Enviando…';

    try {
      // Hoy no hay `VITE_CONTACT_ENDPOINT` puesto en Vercel, así que el
      // camino que se usa de verdad es el segundo: el formulario abre
      // WhatsApp con los datos escritos y no queda registro de la solicitud
      // en ningún sitio. Es a propósito y no un pendiente a medias —no hay
      // servidor de la web ni buzón que atender, y la conversación con la
      // empresa acaba en WhatsApp igualmente—, pero tiene una consecuencia
      // que conviene tener escrita: quien rellena y no le da a enviar en
      // WhatsApp se pierde, y nadie se entera. El día que haya dónde
      // guardarlas, este camino ya está hecho y `mostrarExito` ya cuenta
      // cada final por separado, pero declarar la variable **no basta**: la
      // CSP de `vercel.json` dice `connect-src 'self'` y el navegador
      // cortaría el envío en producción. Hay que añadir el origen ahí en el
      // mismo commit; `vite.config.ts` revienta la construcción si no se
      // hace, y `tests/csp-contacto.test.ts` vigila que siga reventando.
      const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT;
      if (endpoint) await ContactForm.#publicar(endpoint, this.#datos);
      else this.#abrirWhatsApp();
      this.#form.reset();
      this.#mostrarExito(!endpoint);
    } catch {
      // El formulario vuelve con los datos escritos, para reintentar.
      this.#form.hidden = false;
      this.#mostrarError(
        'No pudimos enviar la solicitud. Inténtelo de nuevo o escríbanos por WhatsApp.'
      );
    } finally {
      // Pase lo que pase el botón vuelve: si falló hay que poder reintentar
      // sin recargar la página.
      this.#enviando = false;
      this.#boton.disabled = false;
      this.#boton.textContent = this.#etiquetaOriginal;
    }
  }

  static async #publicar(endpoint: string, datos: Record<string, string>): Promise<void> {
    const respuesta = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`);
  }

  /** Mensaje con lo que la empresa acaba de escribir, listo para enviar. */
  #abrirWhatsApp(): void {
    const { nombre = '', empresa = '', telefono = '' } = this.#datos;
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
  #mostrarExito(porWhatsApp: boolean): void {
    if (!this.#exito) return;
    if (porWhatsApp) {
      const titulo = this.#exito.querySelector('[data-exito-titulo]');
      const texto = this.#exito.querySelector('[data-exito-texto]');
      if (titulo) titulo.textContent = 'Le abrimos WhatsApp';
      if (texto) {
        texto.textContent =
          'La conversación lleva sus datos ya escritos. Pulse enviar y le responderemos por ese medio.';
      }
    }
    // El panel sale donde estaba el formulario, y el formulario se va: ya
    // está enviado, y dejarlo a la vista vacío pedía rellenarlo otra vez.
    // Sólo si hay panel que enseñar; sin él, el formulario es lo único
    // que queda en pie.
    this.#form.hidden = true;
    this.#exito.hidden = false;
    this.#exito.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Llevar la vista hasta el panel sólo sirve a quien mira. El foco es lo
    // que hace que un lector de pantalla lo lea entero y que el siguiente
    // tabulador salga de aquí y no del formulario que acaba de desaparecer.
    this.#exito.focus({ preventScroll: true });
  }

  #mostrarError(mensaje: string): void {
    if (!this.#error) return;
    this.#error.textContent = mensaje;
    this.#error.hidden = mensaje === '';
  }
}
