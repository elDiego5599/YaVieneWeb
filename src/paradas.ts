/**
 * Saber en qué parada va el lector.
 *
 * Tres cosas dependen de eso: el nodo de la parada, que se enciende al
 * llegar; el rótulo del margen, que se pone verde con él; y el letrero de
 * la isla, que dice el número y el nombre de la parada actual como el
 * cartel de destino de un bus.
 *
 * Lo mira un `IntersectionObserver` con la raíz recortada a una banda
 * estrecha en mitad de la ventana: la parada actual es la que cruza esa
 * banda, no la que más se ve. Con «la que más se ve» dos secciones altas
 * se disputan el turno a mitad de camino y el letrero parpadea entre las
 * dos; con la banda hay siempre una sola respuesta y cambia justo cuando
 * el titular de la siguiente pasa por el medio de la pantalla.
 *
 * Nada de esto es necesario para leer la página: sin guion el riel y los
 * nodos se ven igual, el letrero dice la primera parada y los enlaces
 * llevan a donde llevan.
 */

/** Marcar una parada como alcanzada, y con ella todas las anteriores. */
const encender = (secciones: HTMLElement[], hasta: number): void => {
  secciones.forEach((seccion, i) => {
    const marca = seccion.querySelector<HTMLElement>('.parada');
    if (marca) marca.classList.toggle('es-pasada', i <= hasta);
  });
};

export function encenderParadas(raiz: ParentNode = document): void {
  const secciones = Array.from(raiz.querySelectorAll<HTMLElement>('[data-parada]'));
  if (secciones.length === 0) return;

  const numero = raiz.querySelector<HTMLElement>('[data-parada-numero]');
  const nombre = raiz.querySelector<HTMLElement>('[data-parada-nombre-actual]');
  const enlaces = Array.from(raiz.querySelectorAll<HTMLAnchorElement>('.letrero-parada'));

  let actual = -1;

  const marcar = (i: number): void => {
    if (i === actual) return;
    actual = i;
    const seccion = secciones[i];
    const num = seccion.dataset.parada ?? '';
    const nom = seccion.dataset.paradaNombre ?? '';

    if (numero) numero.textContent = num;
    if (nombre) nombre.textContent = nom;

    for (const enlace of enlaces) {
      /*
        `aria-current="location"` y no `page`: el lector no ha cambiado de
        página, está en un punto de esta. Es lo que dice la especificación
        para un paso marcado dentro de un recorrido.
      */
      if (enlace.getAttribute('href') === `#${seccion.id}`) {
        enlace.setAttribute('aria-current', 'location');
      } else {
        enlace.removeAttribute('aria-current');
      }
    }

    encender(secciones, i);
  };

  const vigia = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        const i = secciones.indexOf(entrada.target as HTMLElement);
        if (i >= 0) marcar(i);
      }
    },
    /*
      La banda: del 45 % al 50 % del alto de la ventana. Sale de recortar la
      raíz por arriba y por abajo, y es estrecha a propósito —cinco puntos
      porcentuales— para que sólo quepa una sección dentro.
    */
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );

  for (const seccion of secciones) vigia.observe(seccion);
}
