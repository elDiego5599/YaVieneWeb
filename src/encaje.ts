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
 * es que a menos factor, menos ocupa, así que el factor se busca en una
 * rejilla fija, midiendo, hasta dar con el mayor que cabe: todo dentro de
 * un mismo cuadro.
 *
 * Todo lo que hay dentro hereda el factor en `--encaje`, y de ahí lo lee
 * el poco código que mezcla píxeles de pantalla con píxeles del elemento
 * —el dedo de la demo, el tamaño de los marcadores del mapa.
 */

/** Hasta dónde se deja encoger. Por debajo de esto ya no se lee. */
const MINIMO = 0.5;

/**
 * Cuántos escalones tiene la rejilla donde se busca el factor.
 *
 * Son los que dejaban ocho cortes de bisección sobre [0.5, 1], la
 * búsqueda de antes: el escalón `i` vale `MINIMO + i · 0.5 / 256`, poco
 * menos de dos milésimas, y el factor que se pone es el escalón más alto
 * que cabe, redondeado hacia abajo a tres decimales. Con la misma
 * rejilla y la misma regla sale el mismo factor que daba la bisección,
 * hasta el último píxel; lo que cambia es cuántos escalones se prueban.
 */
const PASOS = 256;

/**
 * Cuántas pruebas se guían por la estimación antes de volver a partir el
 * margen por la mitad. Lo normal son dos; el tope está para que una
 * estimación que falle una y otra vez no recorra la rejilla de uno en uno.
 * Con él, el peor caso son trece maquetas —la del factor puesto, cuatro
 * guiadas y los ocho cortes— contra las diez fijas de la bisección; en la
 * página, de 375 a 1440 de ancho, han sido dos o tres más la primera.
 */
const GUIADAS = 4;

/** El factor del escalón `i`: el 0 es `MINIMO` y `PASOS`, el 1 justo. */
const escalon = (i: number): number => MINIMO + (i * (1 - MINIMO)) / PASOS;

/** El escalón en el que cae un factor, redondeando hacia abajo. */
const escalonDe = (k: number): number => Math.floor(((k - MINIMO) * PASOS) / (1 - MINIMO));

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

  /** El factor que hay puesto: sin nada escrito, el 1 del CSS. */
  const puesto = (): number =>
    Number.parseFloat(escena.style.getPropertyValue('--encaje')) || 1;

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
    // así que la respuesta sería la misma y buscarla cuesta maquetas.
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
      // factor mayor —eso es monótono—, y con eso basta para buscar el
      // mayor escalón de la rejilla que todavía cabe.
      //
      // Se buscaba partiendo el margen a ciegas: ocho cortes más las dos
      // puntas, diez maquetas de 13 a 22 ms cada una, casi toda la tarea
      // larga del arranque. La regla de tres no sirve de respuesta, pero
      // sí de puntería: el alto medido con el factor puesto dice por qué
      // escalón andará la respuesta, y cada prueba afina la siguiente con
      // su propio alto. Se prueba ese escalón y el de encima: si el de
      // abajo cabe y el de encima no, es la respuesta, y es la misma que
      // habría dado la bisección, porque ninguna de las dos se fía de la
      // cuenta, sólo de lo medido. Lo normal son dos maquetas.
      //
      // `cabe` es el escalón más alto que se sabe que cabe, y `sobra` el
      // más bajo que se sabe que no. Arrancan fuera de la rejilla por
      // arriba y en el 0 por abajo: si ni el 0 cabe la respuesta es el
      // tope, `MINIMO`, que es lo mismo que da el escalón 0, así que no
      // hace falta probarlo.
      let cabe = 0;
      let sobra = PASOS + 1;

      // La primera medida es la del factor que ya está puesto, sin
      // escribir nada: esa maqueta el navegador la iba a hacer de todos
      // modos. Si es el 1, además, ya dice de qué lado queda la rejilla
      // entera.
      let factor = puesto();
      let ocupa = dentro.getBoundingClientRect().height;
      if (factor === 1) {
        if (ocupa <= libre) cabe = PASOS;
        else sobra = PASOS;
      }

      for (let guiadas = 0; sobra - cabe > 1; guiadas += 1) {
        // Donde caería el factor si el alto propio no cambiara al encoger.
        let i = escalonDe(libre / (ocupa / factor));
        if (guiadas >= GUIADAS) i = Math.floor((cabe + sobra) / 2);
        else i = Math.min(Math.max(i, cabe + 1), sobra - 1);

        factor = Number(escalon(i).toFixed(3));
        ocupa = probar(escalon(i));
        if (ocupa <= libre) cabe = i;
        else sobra = i;
      }

      // Se redondea hacia abajo, nunca hacia arriba: la milésima que
      // sobra al redondear son píxeles de escena que se salen, y de una
      // escena pegada lo que se sale no se alcanza.
      const k = Math.floor(escalon(cabe) * 1000) / 1000;

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
