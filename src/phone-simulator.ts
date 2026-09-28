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
 * (bus_labels.dart los nombra por su id: B-042 y B-055) y el radio de aviso
 * es el de proximity_alerts_provider.dart.
 */

import { cifraViva } from './cifra-viva';
import type { PhoneMap } from './phone-map';
import type { RutaLanding } from './types';
import {
  EMPRESA,
  VACIO_SELECT,
  carrilEmpresas,
  carrilRutas
} from './selector';

interface EstadoBus {
  /**
   * Los dos buses demo del repo. bus_labels.dart los nombra por su id:
   * "los buses demo (B-042, B-055) ya llevan su placa/interno como id".
   */
  placa: string;
  /** Posición sobre el recorrido, de 0 a 1. Quieta: nadie la mueve. */
  t: number;
}

/** Estados del chip de ubicación, calcados de location_status_chip.dart. */
const CHIPS: Record<
  'cerca',
  { icono: string; texto: string; sub: string; accion: string; suave: boolean }
> = {
  cerca: {
    icono: 'pin',
    texto: '2 buses cerca de tu punto',
    sub: 'Arrástralo para moverlo',
    accion: 'Quitar',
    suave: true
  }
} as const;

type ClaveChip = keyof typeof CHIPS;
type ClaveSelect = keyof typeof VACIO_SELECT;

export class PhoneSimulator {
  private readonly map: PhoneMap;
  private readonly raiz: HTMLElement;
  private readonly sheetEl: HTMLElement;
  private readonly vistas: HTMLElement[];
  /** El envoltorio cuyo alto se anima al cambiar de vista. */
  private readonly vistasEl: HTMLElement;

  /**
   * Las dos tarjetas que flotan junto al teléfono. También las escribe el
   * guion: si se quedaran fijas dirían una ruta y una distancia que no son
   * las que se ven en la pantalla.
   */
  private readonly escena: HTMLElement | null;

  /** Las seis rutas de Sobusa, tal como las trae rutas.json. */
  private readonly rutas: RutaLanding[];

  /**
   * Punto de espera. No es un valor fijo: cada ruta cruza la ciudad por
   * otro lado, así que se busca el tramo que cae en el centro de lo que
   * se ve del mapa. Los buses llegan por detrás, que es como se acerca un
   * bus de verdad a una parada.
   */
  private pinT = 0.5;

  /**
   * Centro de la franja despejada del mapa, en fracciones de la pantalla:
   * por encima queda la píldora con su chip y por debajo la hoja.
   */
  private readonly miraX = 0.5;
  private readonly miraY = 0.44;

  /** proximity_alerts_provider.dart: el aviso salta a 1 km. */
  private readonly radioAvisoM = 1000;

  /**
   * Los dos buses, quietos cada uno en su sitio: el B-042 a 940 m del
   * punto de espera —dentro del kilómetro, que es lo que enciende la
   * tarjeta flotante— y el B-055 más atrás. La hoja le sigue el rastro al
   * primero, como si el dedo lo hubiera tocado.
   */
  private readonly buses: EstadoBus[] = [
    { placa: 'B-042', t: 0 },
    { placa: 'B-055', t: 0 }
  ];

  /**
   * La ruta de la escena. C16 Calle 72 Uninorte es la que cruza el centro
   * de lo que se ve del mapa, así que se lee entera y con el punto de
   * espera bien puesto.
   */
  private static readonly RUTA_FIJA = 'R-106';

  /** Las vistas que la app dibuja como diálogo y no como hoja. */
  private static readonly VISTAS_SELECTOR = new Set(['selector', 'companies', 'routes']);

  /** Fracción de la ventana que se come el desvanecido de abajo. */
  private avisoActivo = false;
  /**
   * El bus al que la hoja le sigue el rastro, por su sitio en `buses`:
   * el B-042, como si el dedo lo hubiera tocado.
   */
  private busElegido: number | null = null;
  /** Lo que mide la tarjeta del selector; las listas se dibujan con ella. */
  private altoTarjeta = 0;
  /* Lo que decide si se ve el botón de volver a tu punto, igual que en
     map_recenter_button.dart: hace falta punto de espera y hace falta que
     el selector no esté ocupando la pantalla. */
  private pinPuesto = false;
  private enSelector = false;
  private rutaActual: RutaLanding;

  constructor(map: PhoneMap, raiz: HTMLElement) {
    this.map = map;
    this.raiz = raiz;
    /* Escena fija del hero: sin subtítulos y con los textos centrados,
       para que la tarjeta no se lea saturada. Ver phone-simulator.css. */
    this.raiz.classList.add('es-fija');
    this.sheetEl = this.pedir('sheet');
    this.vistasEl = this.pedir('views');
    this.vistas = Array.from(raiz.querySelectorAll<HTMLElement>('.sheet-view'));
    this.escena = raiz.closest<HTMLElement>('.hero-scene');
    this.rutas = map.rutas;
    const arranque = this.rutas.findIndex(r => r.id === PhoneSimulator.RUTA_FIJA);
    this.rutaActual = this.rutas[arranque === -1 ? 0 : arranque];
    this.pintarRutas();
    this.pintarEmpresas();
    this.escenaFija();
  }

  /**
   * Coloca la escena una sola vez y no vuelve: ruta C16 dibujada, punto de
   * espera puesto, píldora en "Ruta activa", hoja con la distancia del
   * B-042 y el aviso armado, y las dos tarjetas flotantes encendidas. Sin
   * relojes ni cuadros: lo que se ve al cargar es lo que se ve siempre.
   */
  private escenaFija(): void {
    this.map.setRoute(this.rutaActual.id);
    this.pinT = this.map.tVisible(this.miraX, this.miraY);
    this.map.setPin(this.pinT);
    this.map.showRoute(true);
    this.mostrarPin(true);

    const largo = this.map.metrosDeRuta;
    if (largo) {
      const fijos = [940, 2200];
      this.buses.forEach((b, i) => {
        b.t = (this.pinT - (fijos[i] ?? 2000) / largo + 1) % 1;
      });
      this.empujarBuses();
    }
    this.map.showBuses(true);

    this.busElegido = 0;
    this.map.setBusElegido(0);
    this.setPildora(this.rutaActual);
    this.setChip('cerca');
    this.setSelector(true, this.rutaActual);
    this.reiniciarFichas();
    this.sheetEl.classList.remove('hidden-sheet');
    this.mostrarVista('eta');
    this.setAviso(true);
    this.setDetalle('Puedes cambiar de aplicación; no cierres Ya Viene del todo');
    this.actualizarEta();
  }

  /**
   * La lista de rutas se arma con los datos, no a mano en el HTML: nombre y
   * "terminalA ↔ terminalB", igual que _routeSubtitle() del selector.
   */
  private pintarRutas(): void {
    this.el('route-list')?.replaceChildren(carrilRutas(this.rutas));
  }

  /**
   * La lista de empresas, también con los datos y no a mano: la insignia
   * lleva las iniciales y el color que le sacaría el selector a cada
   * nombre. El id que alimenta ese color es el nombre en minúsculas, que
   * es como está el de Sobusa.
   */
  private pintarEmpresas(): void {
    this.el('company-list')?.replaceChildren(carrilEmpresas());
  }

  /**
   * El alto de la hoja, animado. Es el AnimatedSize del selector: sin él
   * la hoja cambia de tamaño de golpe en cada paso y el mockup se siente
   * armado a cortes en vez de manejado por alguien.
   *
   * Dentro del selector no cambia: route_selector_sheet.dart mide la
   * tarjeta principal una sola vez —`_cardHeight`— y dibuja las dos listas
   * con esa misma altura, así que el diálogo se queda quieto mientras se
   * entra y se sale de ellas. Aquí igual: se guarda lo que midió la vista
   * del selector, que es siempre la primera que se abre, y las listas la
   * heredan.
   */
  private ajustarAlto(): void {
    const activa = this.vistas.find(v => v.classList.contains('active'));
    if (!activa) return;
    const vista = activa.dataset.view ?? '';
    if (vista === 'selector') this.altoTarjeta = activa.offsetHeight;
    const alto =
      PhoneSimulator.VISTAS_SELECTOR.has(vista) && this.altoTarjeta > 0
        ? this.altoTarjeta
        : activa.offsetHeight;
    this.vistasEl.style.height = `${alto}px`;
  }

  /* ---------- Utilidades ---------- */

  private el(nombre: string): HTMLElement | null {
    return this.raiz.querySelector<HTMLElement>(`[data-el="${nombre}"]`);
  }

  private pedir(nombre: string): HTMLElement {
    const nodo = this.el(nombre);
    if (!nodo) throw new Error(`Falta [data-el="${nombre}"] en el mockup`);
    return nodo;
  }

  private texto(nombre: string, valor: string): void {
    const nodo = this.el(nombre);
    if (nodo) nodo.textContent = valor;
  }

  private escenaTexto(nombre: string, valor: string): void {
    const nodo = this.escena?.querySelector<HTMLElement>(`[data-escena="${nombre}"]`);
    if (nodo) nodo.textContent = valor;
  }

  /**
   * Cambia de vista y, con ella, de superficie. Las tres vistas del
   * selector no son contenido dentro de la hoja de distancia: en la app
   * son un diálogo encima del mapa, con su Material blanco y su velo. Por
   * eso el vestido y el velo se deciden aquí y no repartidos por el guion
   * —una sola línea que decidir, y nunca se quedan puestos de más.
   */
  private mostrarVista(vista: string): void {
    for (const v of this.vistas) v.classList.toggle('active', v.dataset.view === vista);
    const enSelector = PhoneSimulator.VISTAS_SELECTOR.has(vista);
    this.sheetEl.classList.toggle('es-selector', enSelector);
    this.el('scrim')?.classList.toggle('is-on', enSelector);
    // Y con el selector arriba se aparta también el grupo de la cabecera,
    // que es el gesto en espejo de la hoja: cabecera_flotante.dart.
    this.enSelector = enSelector;
    this.el('topbar')?.classList.toggle('esta-apartada', enSelector);
    this.refrescarRecentrar();
    this.ajustarAlto();
  }

  /**
   * Los dos huecos del selector y el botón de abajo. Vacío el hueco va
   * apagado y sin subtítulo; puesto se enciende. El botón espera a la
   * ruta: hasta que la haya es el disabled del ElevatedButton, con su
   * texto y su gris.
   */
  private setSelector(empresa: boolean, ruta: RutaLanding | null): void {
    this.setSelect('empresa', empresa ? EMPRESA.nombre : null, EMPRESA.sub, !empresa);
    this.setSelect(
      'ruta',
      ruta ? ruta.nombre : null,
      ruta ? `${ruta.terminalA} ↔ ${ruta.terminalB}` : '',
      empresa && ruta === null
    );
    const boton = this.el('launch');
    if (!boton) return;
    // El botón nunca está muerto: dice el paso que falta y, cuando ya no
    // falta ninguno, se pone verde y promete lo que va a pasar.
    boton.textContent = ruta
      ? 'Ver buses en vivo'
      : empresa
        ? 'Elegir ruta'
        : 'Elegir empresa';
    boton.classList.toggle('is-lista', ruta !== null);
  }

  /**
   * Un peldaño del selector: la ficha que se toca y, a su izquierda, el
   * nodo del riel —hueco, con punto verde si es el que toca ahora, o
   * relleno con su palomita cuando ya está resuelto—.
   */
  private setSelect(
    cual: ClaveSelect,
    titulo: string | null,
    sub: string,
    actual: boolean
  ): void {
    const hecho = titulo !== null;
    const vacio = VACIO_SELECT[cual];
    this.el(`sel-${cual}`)?.classList.toggle('is-activa', hecho);
    this.texto(`sel-${cual}-title`, titulo ?? vacio.titulo);
    this.texto(`sel-${cual}-sub`, hecho ? sub : vacio.sub);
    const paso = this.el(`paso-${cual}`);
    if (!paso) return;
    const nodo = paso.querySelector('.escalon-nodo');
    nodo?.classList.toggle('is-hecho', hecho);
    nodo?.classList.toggle('is-actual', actual);
    for (const linea of paso.querySelectorAll('.escalon-linea.is-visible')) {
      linea.classList.toggle('is-hecho', hecho);
    }
  }

  /* ---------- Superficies de la app ---------- */

  /** El punto de espera, y con él la diana para volver a él. */
  private mostrarPin(visible: boolean): void {
    this.pinPuesto = visible;
    this.map.showPin(visible);
    this.refrescarRecentrar();
  }

  /**
   * El botón de volver a tu punto: se ve cuando hay punto al que volver y
   * el selector no está encima. Es la misma condición de la app, sin el
   * "preparando el mapa" —aquí el mosaico ya está pintado antes de que
   * arranque el guion—.
   */
  private refrescarRecentrar(): void {
    this.el('recentrar')?.classList.toggle(
      'is-on',
      this.pinPuesto && !this.enSelector
    );
  }

  /**
   * Píldora de búsqueda como search_pill_bar.dart: con ruta, la etiqueta
   * «Ruta activa» sobre el nombre (_rutaActiva); sin ella, la pregunta y
   * «Toca para buscar tu ruta» debajo.
   */
  private setPildora(ruta: RutaLanding | null): void {
    this.texto('pill-title', ruta ? ruta.nombre : '¿Qué bus esperas?');
    this.el('pill-etiqueta')?.toggleAttribute('hidden', ruta === null);
    this.el('pill-sub')?.toggleAttribute('hidden', ruta !== null);
    this.el('pill-der')?.classList.toggle('es-cerrar', ruta !== null);
    if (ruta) this.escenaTexto('route-name', ruta.nombre);
    this.escena?.querySelector('[data-escena="route"]')?.classList.toggle('is-on', ruta !== null);
  }

  private setChip(clave: ClaveChip): void {
    const chip = CHIPS[clave];
    this.texto('chip-text', chip.texto);
    const pista = this.el('chip-sub');
    if (pista) {
      pista.textContent = chip.sub;
      pista.hidden = chip.sub === '';
    }
    const accion = this.el('chip-action');
    if (accion) {
      accion.textContent = chip.accion;
      accion.hidden = chip.accion === '';
      // "Quitar" solo deshace: va en gris. El verde queda para la acción
      // que propone algo ("Fijar"), como en location_status_chip.dart.
      accion.classList.toggle('app-chip-action--suave', chip.suave);
    }
    // El atributo, no la propiedad: los íconos son SVG y `hidden` es de
    // `HTMLElement`. Como propiedad no llega al documento y en pantalla
    // manda lo que dejó escrito el HTML.
    for (const nodo of this.raiz.querySelectorAll<HTMLElement>('[data-icono]')) {
      if (nodo.dataset.grupo === 'chip') {
        nodo.toggleAttribute('hidden', nodo.dataset.icono !== chip.icono);
      }
    }
  }

  /* ---------- Tarjeta flotante ---------- */

  /**
   * La tarjeta flotante es la notificación de la app. Aparece cuando
   * aparecería de verdad: con el aviso armado y el bus ya dentro del
   * kilómetro.
   *
   * Una sola línea y una sola idea: «Tu bus está cerca de ti». Sin
   * placa: el pasajero ya sabe cuál espera —acaba de elegirlo—, y el
   * nombre entero partía la tarjeta en dos renglones; el metraje
   * tampoco, que la hoja del teléfono lo está dando justo debajo en
   * grande. Es la misma tarjeta del paso 3 y de la sección del mapa, y
   * las tres dicen exactamente esto.
   */
  private notificacion(metros: number): void {
    const dentro = this.avisoActivo && metros <= this.radioAvisoM;
    const tarjeta = this.escena?.querySelector('[data-escena="notif"]');
    if (dentro) {
      this.escenaTexto(
        'notif-title',
        'Tu bus está cerca de ti'
      );
    }
    tarjeta?.classList.toggle('is-on', dentro);
  }

  /** Línea de detalle de la hoja; vacía se esconde, como en la app. */
  private setDetalle(texto: string): void {
    const nodo = this.el('eta-sub');
    if (!nodo) return;
    nodo.textContent = texto;
    nodo.hidden = texto === '';
    this.ajustarAlto();
  }

  /**
   * Botón de aviso. El texto vive en su propio nodo para no borrar el
   * ícono, que cambia de campana a visto bueno igual que en la app.
   */
  private setAviso(puesto: boolean): void {
    this.avisoActivo = puesto;
    this.el('alert-btn')?.classList.toggle('active', puesto);
    this.texto('alert-label', puesto ? 'Aviso activado' : 'Avisarme cuando esté cerca');
    for (const nodo of this.raiz.querySelectorAll<HTMLElement>('[data-grupo="aviso"]')) {
      nodo.toggleAttribute('hidden', nodo.dataset.icono !== (puesto ? 'visto' : 'campana'));
    }
  }

  private reiniciarFichas(): void {
    this.setAviso(false);
    for (const ficha of this.raiz.querySelectorAll<HTMLElement>('[data-ruta]')) {
      ficha.classList.toggle('is-activa', ficha.dataset.ruta === this.rutaActual.id);
    }
  }

  /* ---------- Distancia (espeja _metricParts/_urgencyColor) ---------- */

  private partesMetrica(metros: number): [string, string] {
    if (metros < 1000) return [Math.round(metros).toString(), 'm de ti'];
    return [(metros / 1000).toFixed(1), 'km de ti'];
  }

  private colorUrgencia(metros: number): string {
    if (metros < 300) return 'var(--app-coral-accessible)';
    if (metros < this.radioAvisoM) return 'var(--app-warn-accessible)';
    return 'var(--app-primary-accessible)';
  }

  /**
   * Metros que le faltan a un bus para llegar al pin, sobre el recorrido y
   * no en línea recta: el bus tiene que pasar por la vía, no cruzar por
   * encima de las manzanas.
   */
  private metrosHastaPin(bus: EstadoBus): number | null {
    const largo = this.map.metrosDeRuta;
    if (!largo) return null;
    return ((this.pinT - bus.t + 1) % 1) * largo;
  }

  /**
   * Pinta el número una sola vez, redondeado a la decena para que se lea.
   */
  private actualizarEta(): void {
    if (this.busElegido === null) return;
    const bus = this.buses[this.busElegido];
    const crudo = bus === undefined ? null : this.metrosHastaPin(bus);
    if (bus === undefined || crudo === null) return;

    const metros = crudo < 100 ? Math.max(10, Math.round(crudo)) : Math.round(crudo / 10) * 10;
    const [valor, unidad] = this.partesMetrica(metros);

    // eta_bottom_sheet.dart (busTitulo): encima de la distancia va "Bus" y
    // la placa; la ruta ya la nombra la píldora de arriba.
    this.texto('eta-route', `Bus ${bus.placa}`);

    // Con distancia en pantalla y sin aviso puesto, la app no muestra
    // detalle: el número ya lo dice todo.
    if (!this.avisoActivo) this.setDetalle('');

    const cifra = this.el('eta-value');
    if (cifra) cifraViva(cifra, valor, metros);
    this.texto('eta-unit', unidad);
    this.notificacion(metros);
    // La franja y el número llevan el mismo color: en la app los dos
    // salen de `stripColor`, no solo la franja.
    const urgencia = this.colorUrgencia(metros);
    const barra = this.el('eta-bar');
    if (barra) barra.style.background = urgencia;
    const numero = this.el('eta-value');
    if (numero) numero.style.color = urgencia;
  }

  /* ---------- Buses quietos sobre la ruta real ---------- */

  private empujarBuses(): void {
    this.map.setBuses(this.buses.map(b => b.t));
  }
}
