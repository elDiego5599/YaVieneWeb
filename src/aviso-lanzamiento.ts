/**
 * AvisoLanzamiento — «Avísame cuando salga» del hero.
 *
 * El CTA se vuelve el campo: la píldora del número nace del sitio exacto
 * del botón (`--aviso-izq` / `--aviso-der`, el recorte de partida que
 * anima el CSS) y vuelve a él al cerrar, con Escape o tocando fuera con
 * el campo vacío (sin ×: se veía fatal entre el número y enviar). Todo el
 * movimiento es CSS sobre `clip-path`, `opacity` y `transform`: si se
 * invierte a medias, parte de donde va. Aquí solo hay estado
 * (`data-estado`: cerrado · abierto · listo), foco y mensajes.
 *
 * Sin endpoint propio (la CSP es `connect-src 'self'`), el envío abre
 * WhatsApp con el mensaje y el número escritos, como el formulario de
 * empresas.
 */
import { WHATSAPP } from './whatsapp';

const FALTA = 'Escribe tu número de celular.';
const MALO = 'Escribe un número válido: solo números, de 7 a 20 caracteres.';
const SIN_ACEPTAR = 'Acepta el tratamiento de datos para continuar.';
const BLOQUEADA = 'El navegador bloqueó la ventana de WhatsApp. Inténtalo de nuevo.';
const LISTO = 'Listo. Te escribimos por WhatsApp.';
/** Lo que se queda la confirmación antes de volver al CTA: da para leerla. */
const DURA_LISTO = 2400;

export class AvisoLanzamiento {
  readonly #form: HTMLFormElement;
  readonly #cta: HTMLButtonElement;
  readonly #pildora: HTMLElement;
  readonly #telefono: HTMLInputElement;
  readonly #acepto: HTMLInputElement;
  readonly #error: HTMLElement;
  readonly #listo: HTMLElement;
  #temporizador = 0;

  constructor(form: HTMLFormElement, cta: HTMLButtonElement) {
    this.#form = form;
    this.#cta = cta;
    this.#pildora = form.querySelector<HTMLElement>('.aviso-pildora')!;
    this.#telefono = form.querySelector<HTMLInputElement>('input[name="telefono"]')!;
    this.#acepto = form.querySelector<HTMLInputElement>('input[name="acepto"]')!;
    this.#error = form.querySelector<HTMLElement>('.aviso-error')!;
    this.#listo = form.querySelector<HTMLElement>('.aviso-listo')!;

    cta.addEventListener('click', () => this.#abrir());
    // Tocar fuera cierra solo si no hay nada escrito: un toque perdido no
    // se lleva el número. En captura, para enterarse aunque otro lo pare.
    document.addEventListener(
      'pointerdown',
      e => {
        const fuera = !form.contains(e.target as Node) && !cta.contains(e.target as Node);
        if (fuera && form.dataset.estado === 'abierto' && !this.#telefono.value.trim()) this.#cerrar(false);
      },
      true,
    );
    form.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.#cerrar();
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      this.#enviar();
    });
    // En línea: al salir del campo se avisa un número malo (el vacío no:
    // salir sin escribir no es un error); al escribir solo se corrige el
    // aviso que ya está a la vista, no se adelanta otro.
    // El blur también llega al cerrar (el foco vuelve al CTA) y al pasar
    // el foco a la casilla por su error: ninguno de los dos es «salir del
    // campo» con algo que corregir, así que no pisan nada.
    this.#telefono.addEventListener('blur', () => {
      const libre = this.#error.textContent === '' || this.#errorDeTelefono();
      if (this.#form.dataset.estado === 'abierto' && this.#telefono.value.trim() && libre) {
        this.#mostrar(this.#errorTelefono());
      }
    });
    this.#telefono.addEventListener('input', () => {
      if (this.#errorDeTelefono()) this.#mostrar(this.#errorTelefono());
    });
    this.#acepto.addEventListener('change', () => {
      if (this.#error.textContent === SIN_ACEPTAR && this.#acepto.checked) this.#mostrar('');
    });
  }

  #estado(estado: 'cerrado' | 'abierto' | 'listo'): void {
    const abierto = estado !== 'cerrado';
    this.#form.dataset.estado = estado;
    this.#form.toggleAttribute('inert', !abierto);
    this.#cta.toggleAttribute('inert', abierto);
    this.#cta.setAttribute('aria-expanded', String(abierto));
  }

  #abrir(): void {
    clearTimeout(this.#temporizador);
    // El recorte de partida es el rectángulo del CTA dentro de la píldora.
    // Se lee al abrir (la letra web pudo cambiar su ancho) y se fija antes
    // de cambiar de estado, para que la transición salga de ahí.
    const cta = this.#cta.getBoundingClientRect();
    const pildora = this.#pildora.getBoundingClientRect();
    this.#form.style.setProperty('--aviso-izq', `${cta.left - pildora.left}px`);
    this.#form.style.setProperty('--aviso-der', `${pildora.right - cta.right}px`);
    void this.#form.offsetWidth;
    this.#estado('abierto');
    this.#telefono.focus();
  }

  /** `devolverFoco` en falso al tocar fuera: el foco va donde se tocó, no
      salta de vuelta al CTA. */
  #cerrar(devolverFoco = true): void {
    clearTimeout(this.#temporizador);
    const enForm = this.#form.contains(document.activeElement);
    // Cerrado queda `inert`: el foco no se puede quedar dentro.
    if (enForm && !devolverFoco) (document.activeElement as HTMLElement).blur();
    const conFoco = devolverFoco && enForm;
    this.#mostrar('');
    this.#listo.textContent = '';
    this.#estado('cerrado');
    if (conFoco) this.#cta.focus();
  }

  #errorTelefono(): string {
    if (this.#telefono.value.trim() === '') return FALTA;
    return this.#telefono.checkValidity() ? '' : MALO;
  }

  #errorDeTelefono(): boolean {
    return this.#error.textContent === FALTA || this.#error.textContent === MALO;
  }

  #mostrar(mensaje: string): void {
    this.#error.textContent = mensaje;
    if (mensaje === FALTA || mensaje === MALO) this.#telefono.setAttribute('aria-invalid', 'true');
    else this.#telefono.removeAttribute('aria-invalid');
    if (mensaje === SIN_ACEPTAR) this.#acepto.setAttribute('aria-invalid', 'true');
    else this.#acepto.removeAttribute('aria-invalid');
  }

  #enviar(): void {
    const mensaje = this.#errorTelefono() || (this.#acepto.checked ? '' : SIN_ACEPTAR);
    this.#mostrar(mensaje);
    if (mensaje) {
      (mensaje === SIN_ACEPTAR ? this.#acepto : this.#telefono).focus();
      return;
    }
    const texto = `Hola, avísenme cuando salga la app de Ya Viene. Mi número es ${this.#telefono.value.trim()}.`;
    const ventana = window.open('', '_blank');
    if (!ventana) {
      this.#error.textContent = BLOQUEADA;
      return;
    }
    try {
      ventana.opener = null;
    } catch {
      // Navegador que no deja tocarlo: la pestaña se abre igual.
    }
    ventana.location.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
    this.#form.reset();
    this.#listo.textContent = LISTO;
    this.#estado('listo');
    this.#listo.focus();
    this.#temporizador = window.setTimeout(() => this.#cerrar(), DURA_LISTO);
  }
}
