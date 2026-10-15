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
 * El número va al backend (`POST /api/lanzamiento`, D15 del backend) con
 * el permiso marcado; allí se guarda con la fecha y se borra a pedido o
 * tras el aviso. El backend lo normaliza y es el que decide si vale: aquí
 * solo se filtra lo que el campo ya marca como malo.
 */
import { BACKEND } from './backend';

const FALTA = 'Escribe tu número de celular.';
const MALO = 'Escribe un celular válido, como 300 123 4567.';
const SIN_ACEPTAR = 'Acepta el tratamiento de datos para continuar.';
const MUCHOS = 'Ya recibimos varios números desde aquí. Inténtalo más tarde.';
const FALLO = 'No pudimos guardar tu número. Inténtalo de nuevo.';
const LISTO = 'Listo. Te avisamos cuando salga.';
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
    // Un doble toque no manda dos: el que viaja decide.
    if (this.#form.hasAttribute('aria-busy')) return;
    const mensaje = this.#errorTelefono() || (this.#acepto.checked ? '' : SIN_ACEPTAR);
    this.#mostrar(mensaje);
    if (mensaje) {
      (mensaje === SIN_ACEPTAR ? this.#acepto : this.#telefono).focus();
      return;
    }
    this.#form.setAttribute('aria-busy', 'true');
    fetch(`${BACKEND}/api/lanzamiento`, {
      method: 'POST',
      // Sin la cabecera, ngrok gratis contesta a un navegador con su página
      // de aviso en vez de pasar la petición al backend.
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ telefono: this.#telefono.value.trim(), acepto: true })
    })
      .then(r => r.status, () => 0)
      .then(estado => {
        this.#form.removeAttribute('aria-busy');
        // Si la cerraron mientras viajaba, la respuesta no la reabre.
        if (this.#form.dataset.estado !== 'abierto') return;
        if (estado === 201) return this.#confirmar();
        this.#mostrar(estado === 400 ? MALO : estado === 429 ? MUCHOS : FALLO);
        if (estado === 400) this.#telefono.focus();
      });
  }

  #confirmar(): void {
    this.#form.reset();
    this.#listo.textContent = LISTO;
    this.#estado('listo');
    this.#listo.focus();
    this.#temporizador = window.setTimeout(() => this.#cerrar(), DURA_LISTO);
  }
}
