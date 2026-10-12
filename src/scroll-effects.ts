/**
 * ScrollEffects — aparición de las secciones al entrar en pantalla.
 *
 * La escena fija del teléfono no vive aquí: se coloca una sola vez desde
 * PhoneSimulator, sin depender del scroll ni del cursor.
 */

/**
 * Recoger la aparición cuando ya ha terminado, y dejar el elemento como si
 * nunca hubiera pasado por aquí.
 *
 * `.reveal` es un préstamo, no una propiedad del elemento: sirve para
 * entrar y estorba a partir de ahí. Estorba en tres cosas.
 *
 * La capa. El CSS le pone `will-change: opacity, transform` para que el
 * navegador le prepare una capa antes de moverlo, pero `will-change` es
 * una promesa a futuro —«esto va a cambiar»— y deja de ser verdad en
 * cuanto la aparición acaba. Con las nueve piezas de la sección de rutas
 * eso son nueve capas de compositor vivas para siempre, y en las que
 * llevan texto —las fichas son botones— una capa permanente puede además
 * cambiar cómo se dibujan las letras.
 *
 * El retraso. El escalonado se escribe en `style.transitionDelay`, que es
 * inline y por tanto le gana a todo. Si se queda puesto, una ficha con 70
 * ms de turno tarda 70 ms en responder al ratón el resto de la visita.
 *
 * Y la transición. `animations.css` se carga después de `components.css`,
 * así que el `transition` de `.reveal` —dos décimas largas de `opacity` y
 * `transform`— le gana al de cualquier componente con la misma
 * especificidad. Mientras la clase siga puesta, el hover de las fichas de
 * ruta no transiciona nada: el borde, el fondo, la sombra y el saltito
 * cambian de golpe porque ninguno está en la lista que manda. Quitarla
 * devuelve a cada componente su propia lista, y no hace falta escribir
 * ningún selector más específico para pelearla.
 *
 * Quitar las dos clases no descoloca nada: sin `.reveal` el elemento vale
 * lo que valga de suyo, que es opaco y sin desplazar — exactamente donde
 * lo deja `.is-visible`.
 *
 * Se hace al terminar y no antes: retirar la capa en el mismo fotograma en
 * que se pone `is-visible` sería quitarla justo cuando hace falta. El
 * oyente se quita a mano en vez de con `once` porque hay elementos que
 * transicionan más cosas que la aparición, así que el primer
 * `transitionend` que llegue puede no ser el suyo; con `once` ese primero
 * se llevaría el oyente por delante. Se espera al de `opacity`, que es el
 * que marca el final, y se comprueba que venga de este elemento y no de un
 * hijo.
 */
const retirarAparicion = (el: HTMLElement): void => {
  const alTerminar = (ev: TransitionEvent): void => {
    if (ev.target !== el || ev.propertyName !== 'opacity') return;
    el.removeEventListener('transitionend', alTerminar);
    el.style.willChange = 'auto';
    el.style.transitionDelay = '';
    el.classList.remove('reveal', 'is-visible');
  };
  el.addEventListener('transitionend', alTerminar);
};

export class ScrollEffects {
  readonly #observer: IntersectionObserver | null = null;

  constructor(raiz: ParentNode = document) {
    const elementos = Array.from(raiz.querySelectorAll<HTMLElement>('.reveal'));
    if (elementos.length === 0) return;

    // Con las animaciones desactivadas todo llega ya visible: la aparición
    // es un adorno, nunca la única forma de ver el contenido.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const el of elementos) el.classList.add('is-visible');
      return;
    }

    this.#observer = new IntersectionObserver(
      (entradas, observador) => {
        for (const entrada of entradas) {
          const el = entrada.target as HTMLElement;

          if (!entrada.isIntersecting) {
            /*
              Lo que ya quedó por encima de la ventana no va a entrar
              nunca: un observador avisa cuando algo cruza el borde, y
              esto lo cruzó antes de que hubiera nadie mirando. Pasa al
              abrir un enlace directo —un enlace de la barra apunta a
              `#como-funciona`— y al volver atrás, que el navegador restaura el
              scroll. Sin esto la cabecera de la sección se queda en
              `opacity: 0` para siempre y ahí no hay animación que
              valga: hay un hueco en blanco.

              No se anima, se pone y ya. Animar algo que está fuera de la
              pantalla es gastar el efecto donde no lo ve nadie.
            */
            if (entrada.boundingClientRect.bottom < 0) {
              el.style.willChange = 'auto';
              el.classList.remove('reveal');
              observador.unobserve(el);
            }
            continue;
          }

          el.style.transitionDelay = `${el.dataset.revealDelay ?? 0}ms`;
          el.classList.add('is-visible');
          observador.unobserve(el);
          retirarAparicion(el);
        }
      },
      /*
        Basta con que asome por encima del último décimo de pantalla. Con
        un umbral por fracción del elemento —un 15%, pongamos— una tarjeta
        más alta que la ventana no llega nunca a ese porcentaje y se queda
        invisible para siempre; pasa con el zoom del navegador puesto.
      */
      { threshold: 0, rootMargin: '0px 0px -10% 0px' }
    );

    for (const el of elementos) this.#observer.observe(el);
  }
}

/**
 * La entrada de la escena del hero.
 *
 * No pasa por el observador de arriba a propósito. El hero está arriba
 * del todo por definición, pero sus piezas más bajas —los buses del
 * carril de abajo— caen por debajo del margen del observador, así que
 * con IntersectionObserver tres de los cuatro buses se quedaban
 * invisibles hasta que alguien hiciera scroll. Aquí no hay nada que
 * esperar: la escena se enciende al cargar y cada pieza espera su turno.
 *
 * Con el movimiento desactivado el CSS ya deja las piezas visibles de
 * salida (`opacity: 1 !important`), así que no hace falta ramificar:
 * esto sólo les pone la clase y no se nota ninguna transición.
 */
export const entrarEscena = (raiz: ParentNode = document): void => {
  const piezas = Array.from(raiz.querySelectorAll<HTMLElement>('.escena-entra'));
  if (piezas.length === 0) return;

  // Dos cuadros de margen: si se encienden en el mismo en que se pintan,
  // el navegador no llega a ver el estado inicial y no hay transición
  // que animar —las piezas aparecerían de golpe.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      for (const pieza of piezas) {
        pieza.style.transitionDelay = `${pieza.dataset.revealDelay ?? 0}ms`;
        pieza.classList.add('is-visible');
      }
    });
  });
};
