/**
 * ScrollEffects — aparición de las secciones al entrar en pantalla.
 *
 * La demo del teléfono no vive aquí: se reproduce sola en bucle desde
 * PhoneSimulator, sin depender del scroll ni del cursor.
 */

export class ScrollEffects {
  private readonly observer: IntersectionObserver | null = null;

  constructor(raiz: ParentNode = document) {
    const elementos = Array.from(raiz.querySelectorAll<HTMLElement>('.reveal'));
    if (elementos.length === 0) return;

    // Con las animaciones desactivadas todo llega ya visible: la aparición
    // es un adorno, nunca la única forma de ver el contenido.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const el of elementos) el.classList.add('is-visible');
      return;
    }

    this.observer = new IntersectionObserver(
      (entradas, observador) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          const el = entrada.target as HTMLElement;
          el.style.transitionDelay = `${el.dataset.revealDelay ?? 0}ms`;
          el.classList.add('is-visible');
          observador.unobserve(el);
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

    for (const el of elementos) this.observer.observe(el);
  }

  destroy(): void {
    this.observer?.disconnect();
  }
}
