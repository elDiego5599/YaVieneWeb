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
 * tras el aviso. El campo aplica la misma regla que el backend
 * (`celularValido`, espejo de `normalizarTelefono` en
 * YaVieneBackend/src/data/lanzamiento.ts): lo que no sirve no sale.
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
/** El «no» de una contraseña mala: un vaivén corto que se apaga. */
const SACUDIDA: Keyframe[] = [0, -8, 7, -5, 3, -1, 0].map(x => ({ transform: `translateX(${x}px)` }));

// Lo que se puede escribir: cifras, espacios, guiones, paréntesis y un +
// solo adelante. Igual que `ESCRITO` en el backend.
const ESCRITO = /^\+?[0-9 ()-]+$/;

/**
 * El número sirve para avisar por WhatsApp. Sin +, solo un celular de
 * Colombia: 10 cifras que empiezan por 3, o esas mismas con su 57 delante.
 * Con +, el de otro país, en E.164 (8 a 15 cifras); el +57 tiene que ser
 * igual un celular. Ni un fijo ni diez cifras cualquiera.
 */
export function celularValido(valor: string): boolean {
  const escrito = valor.trim();
  if (escrito.length > 32 || !ESCRITO.test(escrito)) return false;
  const cifras = escrito.replace(/\D/g, '');
  if (/^(57)?3\d{9}$/.test(cifras)) return true;
  return escrito.startsWith('+') && !cifras.startsWith('57') && cifras.length >= 8 && cifras.length <= 15;
}

/**
 * Lo escrito, sin lo que no puede ir: fuera letras y cualquier + que no
 * sea el primero. Un celular de Colombia (sin + y empezando por 3) se
 * agrupa como se dicta, 300 123 4567, y no pasa de sus 10 cifras.
 */
function limpiar(valor: string): string {
  const mas = valor.trimStart().startsWith('+');
  const resto = valor.replace(/[^0-9 ()-]/g, '');
  if (mas) return `+${resto.trimStart()}`;
  const cifras = resto.replace(/\D/g, '');
  if (!cifras.startsWith('3')) return resto;
  return [cifras.slice(0, 3), cifras.slice(3, 6), cifras.slice(6, 10)].filter(Boolean).join(' ');
}

export class AvisoLanzamiento {
  readonly #form: HTMLFormElement;
  readonly #cta: HTMLButtonElement;
  readonly #pildora: HTMLElement;
  readonly #telefono: HTMLInputElement;
  readonly #acepto: HTMLInputElement;
  readonly #error: HTMLElement;
  readonly #listo: HTMLElement;
  readonly #boton: HTMLButtonElement;
  #temporizador = 0;

  constructor(form: HTMLFormElement, cta: HTMLButtonElement) {
    this.#form = form;
    this.#cta = cta;
    this.#pildora = form.querySelector<HTMLElement>('.aviso-pildora')!;
    this.#telefono = form.querySelector<HTMLInputElement>('input[name="telefono"]')!;
    this.#acepto = form.querySelector<HTMLInputElement>('input[name="acepto"]')!;
    this.#error = form.querySelector<HTMLElement>('.aviso-error')!;
    this.#listo = form.querySelector<HTMLElement>('.aviso-listo')!;
    this.#boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    this.#validar();
    this.#pintarBoton();
    // Sin nada escrito el botón es una × que deshace la apertura (también
    // con Enter: el envío implícito pulsa este mismo botón).
    this.#boton.addEventListener('click', e => {
      if (this.#boton.dataset.cerrar === undefined) return;
      e.preventDefault();
      this.#cerrar();
    });

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
      // Se limpia solo con el cursor al final, que es como se escribe un
      // número: en medio, reescribir el valor le movería el cursor.
      const campo = this.#telefono;
      if (campo.selectionStart === null || campo.selectionStart === campo.value.length) {
        const limpio = limpiar(campo.value);
        if (limpio !== campo.value) campo.value = limpio;
      }
      this.#validar();
      this.#pintarBoton();
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

  /** La validez del campo es la de `celularValido`: con ella el CSS apaga
      enviar (`:valid`) hasta que el número sirve. */
  #validar(): void {
    const valor = this.#telefono.value;
    this.#telefono.setCustomValidity(valor.trim() === '' || celularValido(valor) ? '' : MALO);
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
      this.#sacudir(mensaje === SIN_ACEPTAR ? this.#acepto.closest('label')! : this.#pildora);
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
        if (estado === 400) {
          this.#telefono.focus();
          this.#sacudir(this.#pildora);
        }
      });
  }

  /** Sacude lo que falló. Sin movimiento basta el mensaje y el filo coral. */
  #sacudir(elemento: HTMLElement): void {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    elemento.animate?.(SACUDIDA, { duration: 400, easing: 'ease-out' });
  }

  #pintarBoton(): void {
    const vacio = !this.#telefono.value.trim();
    this.#boton.toggleAttribute('data-cerrar', vacio);
    this.#boton.setAttribute('aria-label', vacio ? 'Cerrar' : 'Enviar mi número');
  }

  #confirmar(): void {
    this.#form.reset();
    this.#validar();
    this.#pintarBoton();
    this.#listo.textContent = LISTO;
    this.#estado('listo');
    this.#listo.focus();
    this.#temporizador = window.setTimeout(() => this.#cerrar(), DURA_LISTO);
  }
}
