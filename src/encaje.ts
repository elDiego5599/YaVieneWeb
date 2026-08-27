/**
 * Que la escena quepa en la ventana, sí o sí.
 *
 * Las dos secciones que se recorren —el problema y la solución— llevan
 * una escena pegada arriba. Mientras quepa en la pantalla no hay
 * problema; en cuanto es más alta que la ventana, el pegado deja fuera
 * todo lo que sobra por abajo y ese trozo no se puede alcanzar de
 * ninguna forma: ni bajando ni subiendo. Pasa con el zoom del navegador
 * —que encoge la ventana en píxeles de CSS pero no el texto— y con
 * cualquier portátil de pantalla baja.
 *
 * La solución es la que tomaría cualquiera: si no cabe, se encoge hasta
 * que quepa. `zoom` sirve justo para eso y no es lo mismo que un
 * `transform: scale()` —vuelve a maquetar en pequeño, así que el texto
 * sigue siendo texto nítido y no una foto reducida—.
 *
 * Y ahí está lo delicado: como vuelve a maquetar, encoger cambia el sitio
 * donde parten las líneas, y con él el alto natural de la escena. No hay
 * regla de tres que valga —esa cuenta dejó la escena temblando en los
 * teléfonos, saltando entre dos factores para siempre—. Lo único cierto
 * es que a menos factor, menos ocupa, así que el factor se busca por
 * bisección: se prueba, se mide y se parte el margen, todo dentro de un
 * mismo cuadro.
 *
 * Todo lo que hay dentro hereda el factor en `--encaje`, y de ahí lo lee
 * el poco código que mezcla píxeles de pantalla con píxeles del elemento
 * —el dedo de la demo, el tamaño de los marcadores del mapa.
 */

/** Hasta dónde se deja encoger. Por debajo de esto ya no se lee. */
const MINIMO = 0.5;

/**
 * Cuántas veces se parte el margen buscando el factor.
 *
 * Ocho cortes dejan el intervalo [0.5, 1] en medio milésimo, que es más
 * fino que los tres decimales con los que se escribe el factor.
 */
const CORTES = 8;

/**
 * El factor de encogido que arrastra un elemento.
 *
 * `--encaje` se hereda, así que cualquier hijo de la escena lo puede
 * preguntar sin saber quién lo puso. Fuera de una escena no hay nada
 * puesto y la respuesta es 1.
 */
export function encajeDe(el: Element): number {
  const valor = Number.parseFloat(getComputedStyle(el).getPropertyValue('--encaje'));
  return Number.isFinite(valor) && valor > 0 ? valor : 1;
}

/** Mide la escena y le pone el factor. Devuelve cómo soltarla. */
export function encajarEscena(escena: HTMLElement): () => void {
  const dentro = escena.firstElementChild as HTMLElement | null;
  if (!dentro) return () => {};

  let pedido = 0;
  /** Mientras se busca, la escena cambia de tamaño sola: no re-entrar. */
  let buscando = false;
  /** El hueco y el alto con los que se sacó el factor que hay puesto. */
  let libreVisto = -1;
  let altoVisto = -1;

  /**
   * Pone un factor y devuelve lo que ocupa la escena en pantalla con él.
   *
   * Leer la caja después de escribir obliga al navegador a rehacer la
   * maqueta en el acto, que es justo lo que hace falta: toda la búsqueda
   * ocurre dentro de un mismo cuadro y no se pinta ninguno de los
   * factores intermedios.
   */
  const probar = (k: number): number => {
    escena.style.setProperty('--encaje', k.toFixed(3));
    return dentro.getBoundingClientRect().height;
  };

  const medir = (): void => {
    pedido = 0;
    if (buscando) return;
    const marco = getComputedStyle(escena);
    // Sin pegado no hay nada que encajar: es lo que pasa con movimiento
    // reducido, donde la sección se lee de arriba abajo y nada se corta.
    if (marco.position !== 'sticky') return;

    // El alto libre no es la caja entera: arriba se reserva la franja de
    // la cabecera y abajo la de la barra de direcciones. Los dos son
    // relleno de la escena, así que se leen en píxeles de verdad y se
    // restan antes de dividir.
    const reserva =
      (Number.parseFloat(marco.paddingTop) || 0) +
      (Number.parseFloat(marco.paddingBottom) || 0);
    // Y se compara contra el alto que le dio el CSS, no contra
    // `window.innerHeight`: el CSS ya sabe de barras y el navegador no
    // siempre dice lo mismo. Si no lo resuelve, la ventana sirve.
    const declarado = Number.parseFloat(marco.minHeight);
    const pantalla =
      Number.isFinite(declarado) && declarado > 0 ? declarado : window.innerHeight;
    const libre = pantalla - reserva;
    if (libre <= 0) return;

    // Ni el hueco ni el contenido han cambiado desde la última búsqueda,
    // así que la respuesta sería la misma y buscarla cuesta diez maquetas.
    // `offsetHeight` vale aquí de detector de cambios y nada más —lo que
    // devuelva cada navegador con el zoom puesto da igual mientras sea
    // estable—, que es lo que hace falta cuando la barra de direcciones
    // del móvil dispara `resize` en cada tirón de scroll.
    const alto = dentro.offsetHeight;
    if (libre === libreVisto && alto === altoVisto) return;

    buscando = true;
    try {
      // Aquí estaba el temblor. La cuenta de antes era una regla de tres:
      // se medía el alto natural una vez —lo visto, deshecho el factor
      // puesto— y se daba por hecho que encoger a la mitad ocupaba la
      // mitad. No es verdad, y no por poco: al encoger, la caja se hace
      // más ancha en unidades propias y el texto vuelve a repartirse en
      // menos líneas, así que el alto natural CAMBIA con el factor. En un
      // teléfono de 390 medía 945 con el factor al 0.926 y 835 con el
      // 0.818, y cada medida pedía justo la otra: 0.926 → 0.818 → 0.926,
      // sin parar, cuadro tras cuadro. Eso es lo que se veía temblar.
      //
      // Lo que sí es cierto siempre es que ocupar más en pantalla pide un
      // factor mayor —eso es monótono—, y con eso basta para buscar por
      // bisección el mayor factor que todavía cabe. Nueve o diez maquetas
      // seguidas, todas en el mismo cuadro y ninguna pintada, y de ahí no
      // se mueve hasta que cambie el hueco o el contenido.
      let k: number;
      if (probar(1) <= libre) {
        k = 1;
      } else if (probar(MINIMO) > libre) {
        // Ni encogido del todo cabe. Se queda en el tope y lo que sobre
        // se sale: por debajo de esto ya no habría nada que leer.
        k = MINIMO;
      } else {
        let cabe = MINIMO;
        let sobra = 1;
        for (let i = 0; i < CORTES; i += 1) {
          const medio = (cabe + sobra) / 2;
          if (probar(medio) <= libre) cabe = medio;
          else sobra = medio;
        }
        // Se redondea hacia abajo, nunca hacia arriba: la milésima que
        // sobra al redondear son píxeles de escena que se salen, y de una
        // escena pegada lo que se sale no se alcanza.
        k = Math.floor(cabe * 1000) / 1000;
      }

      escena.style.setProperty('--encaje', k.toFixed(3));
      libreVisto = libre;
      altoVisto = dentro.offsetHeight;
    } finally {
      buscando = false;
    }
  };

  const pedir = (): void => {
    if (pedido) return;
    pedido = requestAnimationFrame(medir);
  };

  window.addEventListener('resize', pedir);
  // Las fuentes cambian el alto del texto al llegar, y llegan tarde.
  void document.fonts?.ready.then(pedir);

  // Y no sólo las fuentes: la escena crece después de la primera medida
  // por todo lo que llega tarde —el mosaico del mapa, una imagen, un
  // bloque que se despliega—. Con una medida sola el factor se quedaba
  // corto y lo que había crecido se salía por abajo sin forma de
  // alcanzarlo: así se cortaba el reloj en un teléfono. El observador
  // vuelve a medir cada vez que cambia el alto, y la búsqueda entera pasa
  // con el aviso desactivado, así que sus propios cambios no la llaman.
  const vigia = new ResizeObserver(pedir);
  vigia.observe(dentro);
  medir();

  return () => {
    if (pedido) cancelAnimationFrame(pedido);
    vigia.disconnect();
    window.removeEventListener('resize', pedir);
  };
}
