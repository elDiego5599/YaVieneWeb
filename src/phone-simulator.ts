/**
 * PhoneSimulator — el teléfono derecho, en escena fija con la C16.
 *
 * El mockup es una vitrina quieta, como el teléfono de al lado: sin guion,
 * sin bucle y sin interacción. Al arrancar se coloca una sola vez el estado
 * que en la app corresponde a ruta activa con aviso puesto —
 *
 *   pill "Ruta activa" sobre el nombre     → search_pill_bar.dart
 *   chip "2 buses cerca de tu punto"      → location_status_chip.dart
 *   hoja con distancia y "Aviso activado"  → eta_bottom_sheet.dart
 *   tarjeta "Ruta activa" y aviso flotantes → data-escena="route"/"notif"
 *
 * — y ahí se queda. Lo único vivo es la respiración del marco, que es CSS
 * (heroRespira) y no pasa por aquí.
 *
 * Nada de lo que muestra está inventado: la ruta y sus kilómetros salen de
 * rutas.json (vía PhoneMap), los buses son los dos demo del repo
 * (BUS-ABC123 y BUS-WFK042; bus_labels.dart les quita el «BUS-» y
 * deja la placa: ABC123 y WFK042) y el radio de aviso es el kilómetro
 * con el que arranca la rueda de rueda_distancia.dart.
 */

import { cifraViva, distanciaAviso, metrica } from './cifra-viva';
import type { PhoneMap } from './phone-map';
import type { RutaLanding } from './types';

interface EstadoBus {
  /**
   * Los dos buses demo del repo, por su placa: `busPlaca` (bus_labels.dart)
   * le quita el «BUS-» al id y deja las tres letras y los tres números.
   */
  placa: string;
  /** Posición sobre el recorrido, de 0 a 1. Quieta: nadie la mueve. */
  t: number;
}

/**
 * El chip de ubicación de la escena, calcado de location_status_chip.dart:
 * punto puesto y buses dentro del radio. Los otros estados de la app
 * (localizando, sin punto) los enseña el teléfono del paso 1.
 */
const CHIP = {
  icono: 'pin',
  texto: '2 buses cerca de tu punto',
  sub: 'Arrástralo para moverlo',
  accion: 'Quitar',
  suave: true
} as const;

export class PhoneSimulator {
  readonly #map: PhoneMap;
  readonly #raiz: HTMLElement;
  readonly #sheetEl: HTMLElement;
  readonly #vistas: HTMLElement[];
  /** El envoltorio que le da alto a la hoja. */
  readonly #vistasEl: HTMLElement;

  /**
   * Las dos tarjetas que flotan junto al teléfono. También las escribe el
   * guion: si se quedaran fijas dirían una ruta y una distancia que no son
   * las que se ven en la pantalla.
   */
  readonly #escena: HTMLElement | null;

  /** Las seis rutas de Sobusa, tal como las trae rutas.json. */
  readonly #rutas: RutaLanding[];

  /**
   * Punto de espera. No es un valor fijo: cada ruta cruza la ciudad por
   * otro lado, así que se busca el tramo que cae en el centro de lo que
   * se ve del mapa. Los buses llegan por detrás, que es como se acerca un
   * bus de verdad a una parada.
   */
  #pinT = 0.5;

  /**
   * Centro de la franja despejada del mapa, en fracciones de la pantalla:
   * por encima queda la píldora con su chip y por debajo la hoja.
   */
  readonly #miraX = 0.5;
  readonly #miraY = 0.44;

  /**
   * La distancia del aviso: la que trae la rueda de rueda_distancia.dart
   * sin nada guardado. La hoja la dice en su nota, «Te avisamos a 1,0 km».
   */
  readonly #radioAvisoM = 1000;

  /**
   * Los dos buses, quietos cada uno en su sitio: el ABC123 a 940 m del
   * punto de espera —dentro del kilómetro, que es lo que enciende la
   * tarjeta flotante— y el WFK042 más atrás. La hoja le sigue el rastro al
   * primero, como si el dedo lo hubiera tocado.
   */
  readonly #buses: EstadoBus[] = [
    { placa: 'ABC123', t: 0 },
    { placa: 'WFK042', t: 0 }
  ];

  /**
   * La ruta de la escena. C16 Calle 72 Uninorte es la que cruza el centro
   * de lo que se ve del mapa, así que se lee entera y con el punto de
   * espera bien puesto.
   */
  static readonly #RUTA_FIJA = 'R-106';

  /** Si el aviso está armado: con él y el bus dentro del km sale la tarjeta. */
  #avisoActivo = false;
  /**
   * El bus al que la hoja le sigue el rastro, por su sitio en `buses`:
   * el ABC123, como si el dedo lo hubiera tocado.
   */
  #busElegido: number | null = null;
  /* Lo que decide si se ve el botón de volver a tu punto, igual que en
     map_recenter_button.dart: hace falta punto de espera. La otra
     condición de la app, que el selector no ocupe la pantalla, aquí se
     cumple siempre: el hero no lo abre. */
  #pinPuesto = false;
  #rutaActual: RutaLanding;

  constructor(map: PhoneMap, raiz: HTMLElement) {
    this.#map = map;
    this.#raiz = raiz;
    /* Escena fija del hero: sin subtítulos y con los textos centrados,
       para que la tarjeta no se lea saturada. Ver phone-simulator.css. */
    this.#raiz.classList.add('es-fija');
    this.#sheetEl = this.#pedir('sheet');
    this.#vistasEl = this.#pedir('views');
    this.#vistas = Array.from(raiz.querySelectorAll<HTMLElement>('.sheet-view'));
    this.#escena = raiz.closest<HTMLElement>('.hero-scene');
    this.#rutas = map.rutas;
    const arranque = this.#rutas.findIndex(r => r.id === PhoneSimulator.#RUTA_FIJA);
    this.#rutaActual = this.#rutas[arranque === -1 ? 0 : arranque];
    this.#escenaFija();
  }

  /**
   * Coloca la escena una sola vez y no vuelve: ruta C16 dibujada, punto de
   * espera puesto, píldora en "Ruta activa", hoja con la distancia del
   * ABC123 y el aviso armado, y las dos tarjetas flotantes encendidas. Sin
   * relojes ni cuadros: lo que se ve al cargar es lo que se ve siempre.
   */
  #escenaFija(): void {
    this.#map.setRoute(this.#rutaActual.id);
    this.#pinT = this.#map.tVisible(this.#miraX, this.#miraY);
    this.#map.setPin(this.#pinT);
    this.#map.showRoute(true);
    this.#mostrarPin(true);

    const largo = this.#map.metrosDeRuta;
    if (largo) {
      const fijos = [940, 2200];
      this.#buses.forEach((b, i) => {
        b.t = (this.#pinT - (fijos[i] ?? 2000) / largo + 1) % 1;
      });
      this.#empujarBuses();
    }
    this.#map.showBuses(true);

    this.#busElegido = 0;
    this.#map.setBusElegido(0);
    this.#setPildora(this.#rutaActual);
    this.#ponerChip();
    this.#sheetEl.classList.remove('hidden-sheet');
    this.#mostrarVista('eta');
    this.#setAviso(true);
    // `_Nota.distancia` de eta_bottom_sheet.dart: la nota del iPhone con el
    // aviso puesto, con su «Cambiar» al filo (fijo en el HTML).
    this.#setDetalle(`Te avisamos a ${distanciaAviso(this.#radioAvisoM)}`);
    this.#actualizarEta();
  }

  /**
   * El alto de la hoja, el de la vista puesta. `.sheet-views` lo anima al
   * pasar de la hoja vacía, que es la que trae el HTML, a la de distancia.
   */
  #ajustarAlto(): void {
    const activa = this.#vistas.find(v => v.classList.contains('active'));
    if (!activa) return;
    this.#vistasEl.style.height = `${activa.offsetHeight}px`;
  }

  /* ---------- Utilidades ---------- */

  #el(nombre: string): HTMLElement | null {
    return this.#raiz.querySelector<HTMLElement>(`[data-el="${nombre}"]`);
  }

  #pedir(nombre: string): HTMLElement {
    const nodo = this.#el(nombre);
    if (!nodo) throw new Error(`Falta [data-el="${nombre}"] en el mockup`);
    return nodo;
  }

  #texto(nombre: string, valor: string): void {
    const nodo = this.#el(nombre);
    if (nodo) nodo.textContent = valor;
  }

  #escenaTexto(nombre: string, valor: string): void {
    const nodo = this.#escena?.querySelector<HTMLElement>(`[data-escena="${nombre}"]`);
    if (nodo) nodo.textContent = valor;
  }

  /** Enciende una vista de la hoja y le da su alto. */
  #mostrarVista(vista: string): void {
    for (const v of this.#vistas) v.classList.toggle('active', v.dataset.view === vista);
    this.#refrescarRecentrar();
    this.#ajustarAlto();
  }

  /* ---------- Superficies de la app ---------- */

  /** El punto de espera, y con él la diana para volver a él. */
  #mostrarPin(visible: boolean): void {
    this.#pinPuesto = visible;
    this.#map.showPin(visible);
    this.#refrescarRecentrar();
  }

  /**
   * El botón de volver a tu punto: se ve cuando hay punto al que volver.
   * Es la condición de la app sin el "preparando el mapa" —aquí el mosaico
   * ya está pintado— ni el selector encima, que el hero no abre.
   */
  #refrescarRecentrar(): void {
    this.#el('recentrar')?.classList.toggle('is-on', this.#pinPuesto);
  }

  /**
   * Píldora de búsqueda como search_pill_bar.dart con ruta: la etiqueta
   * «Ruta activa» sobre el nombre (_rutaActiva). Sin ruta —la pregunta y
   * «Toca para buscar tu ruta»— es como la trae el HTML, antes del
   * JavaScript.
   */
  #setPildora(ruta: RutaLanding): void {
    this.#texto('pill-title', ruta.nombre);
    this.#el('pill-etiqueta')?.removeAttribute('hidden');
    this.#el('pill-sub')?.setAttribute('hidden', '');
    this.#el('pill-der')?.classList.add('es-cerrar');
    this.#escenaTexto('route-name', ruta.nombre);
    this.#escena?.querySelector('[data-escena="route"]')?.classList.add('is-on');
  }

  #ponerChip(): void {
    this.#texto('chip-text', CHIP.texto);
    const pista = this.#el('chip-sub');
    if (pista) {
      pista.textContent = CHIP.sub;
      pista.hidden = false;
    }
    const accion = this.#el('chip-action');
    if (accion) {
      accion.textContent = CHIP.accion;
      accion.hidden = false;
      // "Quitar" solo deshace: va en gris. El verde queda para la acción
      // que propone algo ("Usar GPS"), como en location_status_chip.dart.
      accion.classList.toggle('app-chip-action--suave', CHIP.suave);
    }
    // El atributo, no la propiedad: los íconos son SVG y `hidden` es de
    // `HTMLElement`. Como propiedad no llega al documento y en pantalla
    // manda lo que dejó escrito el HTML.
    for (const nodo of this.#raiz.querySelectorAll<HTMLElement>('[data-icono]')) {
      if (nodo.dataset.grupo === 'chip') {
        nodo.toggleAttribute('hidden', nodo.dataset.icono !== CHIP.icono);
      }
    }
  }

  /* ---------- Tarjeta flotante ---------- */

  /**
   * La tarjeta flotante es la notificación de la app. Aparece cuando
   * aparecería de verdad: con el aviso armado y el bus ya dentro de su
   * distancia.
   *
   * Una sola línea y una sola idea: «Tu bus está cerca de ti». Sin
   * placa: el pasajero ya sabe cuál espera —acaba de elegirlo—, y el
   * nombre entero partía la tarjeta en dos renglones; el metraje
   * tampoco, que la hoja del teléfono lo está dando justo debajo en
   * grande. Es la misma tarjeta del paso 3 y de la sección del mapa, y
   * las tres dicen exactamente esto.
   */
  #notificacion(metros: number): void {
    const dentro = this.#avisoActivo && metros <= this.#radioAvisoM;
    const tarjeta = this.#escena?.querySelector('[data-escena="notif"]');
    if (dentro) {
      this.#escenaTexto(
        'notif-title',
        'Tu bus está cerca de ti'
      );
    }
    tarjeta?.classList.toggle('is-on', dentro);
  }

  /** Línea de detalle de la hoja; vacía se esconde, como en la app. */
  #setDetalle(texto: string): void {
    const nodo = this.#el('eta-sub');
    if (!nodo) return;
    // El texto va junto a la baldosa del ícono, no encima de ella.
    this.#texto('eta-sub-texto', texto);
    nodo.hidden = texto === '';
    this.#ajustarAlto();
  }

  /**
   * Botón de aviso. El texto vive en su propio nodo para no borrar el
   * ícono, que cambia de campana a visto bueno igual que en la app.
   */
  #setAviso(puesto: boolean): void {
    this.#avisoActivo = puesto;
    this.#el('alert-btn')?.classList.toggle('active', puesto);
    this.#texto('alert-label', puesto ? 'Aviso activado' : 'Avisarme cuando esté cerca');
    for (const nodo of this.#raiz.querySelectorAll<HTMLElement>('[data-grupo="aviso"]')) {
      nodo.toggleAttribute('hidden', nodo.dataset.icono !== (puesto ? 'visto' : 'campana'));
    }
  }

  /* ---------- Distancia (espeja colorDeDistancia; la cifra, metrica()) ---------- */

  #colorUrgencia(metros: number): string {
    if (metros < 300) return 'var(--app-coral-accessible)';
    if (metros < this.#radioAvisoM) return 'var(--app-warn-accessible)';
    return 'var(--app-primary-accessible)';
  }

  /**
   * Metros que le faltan a un bus para llegar al pin, sobre el recorrido y
   * no en línea recta: el bus tiene que pasar por la vía, no cruzar por
   * encima de las manzanas.
   */
  #metrosHastaPin(bus: EstadoBus): number | null {
    const largo = this.#map.metrosDeRuta;
    if (!largo) return null;
    return ((this.#pinT - bus.t + 1) % 1) * largo;
  }

  /**
   * Pinta el número una sola vez, redondeado a la decena para que se lea.
   */
  #actualizarEta(): void {
    if (this.#busElegido === null) return;
    const bus = this.#buses[this.#busElegido];
    const crudo = bus === undefined ? null : this.#metrosHastaPin(bus);
    if (bus === undefined || crudo === null) return;

    const metros = crudo < 100 ? Math.max(10, Math.round(crudo)) : Math.round(crudo / 10) * 10;
    const [valor, unidad] = metrica(metros);

    // eta_bottom_sheet.dart (`_Placa`): encima de la distancia va «BUS» y
    // la placa en blanco; la ruta ya la nombra la píldora de arriba.
    this.#texto('eta-placa', bus.placa);

    // Con distancia en pantalla y sin aviso puesto, la app no muestra
    // detalle: el número ya lo dice todo.
    if (!this.#avisoActivo) this.#setDetalle('');

    const cifra = this.#el('eta-value');
    if (cifra) cifraViva(cifra, valor, metros);
    this.#texto('eta-unit', unidad);
    this.#notificacion(metros);
    // El número lleva la urgencia en su color (`colorCifra` en la app);
    // la franja que la repetía encima ya no existe.
    const numero = this.#el('eta-value');
    if (numero) numero.style.color = this.#colorUrgencia(metros);
  }

  /* ---------- Buses quietos sobre la ruta real ---------- */

  #empujarBuses(): void {
    this.#map.setBuses(this.#buses.map(b => b.t));
  }
}
