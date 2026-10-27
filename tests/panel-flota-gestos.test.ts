import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PanelFlota, VACIO } from '../src/panel-flota';

/**
 * Los gestos del panel de /empresas.html que `panel-flota.test.ts` no
 * pisa: las pestañas de estado con su hueco vacío, la X de la ficha y a
 * dónde va el foco al cerrarla, el botón de ocultar de la ficha y el ojo
 * de la barra. Todo se mira como lo ve quien usa el panel: qué texto sale,
 * qué fila se ve y qué elemento se queda con el foco.
 */

/** El panel tal cual está en la página, sin el resto. */
function montar(): HTMLElement {
  const html = readFileSync(resolve(process.cwd(), 'empresas.html'), 'utf8');
  const panel = html.match(/<div class="flota">[\s\S]*?(?=<div class="despacho-pie")/)?.[0];
  expect(panel, 'ya no está el panel en empresas.html').toBeTruthy();
  document.body.innerHTML = panel!;
  const raiz = document.querySelector<HTMLElement>('.flota')!;
  new PanelFlota(raiz);
  return raiz;
}

const tocar = (raiz: HTMLElement, selector: string): void => {
  raiz.querySelector<HTMLElement>(selector)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

/** Las placas de las filas que se ven, en su orden. */
const filasVisibles = (raiz: HTMLElement): string[] =>
  Array.from(raiz.querySelectorAll<HTMLElement>('.flota-fila'))
    .filter((f) => !f.hidden)
    .map((f) => f.dataset.bus!);

/** Las placas de los marcadores que el mapa deja a la vista. */
const marcadoresVisibles = (raiz: HTMLElement): string[] =>
  Array.from(raiz.querySelectorAll<HTMLElement>('.flota-bus'))
    .filter((m) => !m.classList.contains('es-fuera'))
    .map((m) => m.dataset.bus!)
    .sort();

const cifraPestana = (raiz: HTMLElement, estado: string): string =>
  raiz.querySelector(`[data-accion="estado"][data-estado="${estado}"] b`)!.textContent!;

const ficha = (raiz: HTMLElement): HTMLElement => raiz.querySelector<HTMLElement>('.flota-ficha')!;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('las pestañas de estado', () => {
  // Riesgo: una pestaña sin buses deja la lista en blanco sin decir por qué.
  it('una pestaña vacía dice qué falta y la cuenta baja a cero', () => {
    const raiz = montar();
    tocar(raiz, '[data-ruta="vivero"]');
    tocar(raiz, '[data-estado="ocultos"]');

    const vacio = raiz.querySelector<HTMLElement>('.flota-vacio')!;
    expect(filasVisibles(raiz)).toEqual([]);
    expect(marcadoresVisibles(raiz)).toEqual([]);
    expect(vacio.hidden).toBe(false);
    expect(vacio.textContent).toBe(VACIO.ocultos);
    expect(raiz.querySelector('.flota-cuenta')!.textContent).toBe('0');
  });

  // Riesgo: el aviso de vacío se queda puesto cuando la pestaña vuelve a tener buses.
  it('al volver a una pestaña con buses el aviso de vacío se va', () => {
    const raiz = montar();
    tocar(raiz, '[data-ruta="vivero"]');
    tocar(raiz, '[data-estado="ocultos"]');
    tocar(raiz, '[data-estado="sin-senal"]');

    expect(raiz.querySelector<HTMLElement>('.flota-vacio')!.hidden).toBe(true);
    expect(filasVisibles(raiz)).toEqual(['LMR826']);
    expect(raiz.querySelector('.flota-cuenta')!.textContent).toBe('1');
  });

  // Riesgo: dos pestañas marcadas a la vez, o el lector de pantalla oyendo la vieja.
  it('sólo la pestaña tocada queda marcada, también para el lector', () => {
    const raiz = montar();
    tocar(raiz, '[data-estado="linea"]');

    const pestanas = Array.from(raiz.querySelectorAll<HTMLElement>('[data-accion="estado"]'));
    expect(pestanas.filter((p) => p.getAttribute('aria-pressed') === 'true').map((p) => p.dataset.estado)).toEqual([
      'linea',
    ]);
    expect(pestanas.filter((p) => p.classList.contains('es-activa')).map((p) => p.dataset.estado)).toEqual([
      'linea',
    ]);
  });

  // Riesgo: las cifras de las pestañas cambian al cambiar de pestaña (son de la ruta, no del filtro).
  it('las cifras de las pestañas no se mueven al cambiar de pestaña', () => {
    const raiz = montar();
    const antes = ['todos', 'linea', 'ocultos', 'sin-senal'].map((e) => cifraPestana(raiz, e));
    tocar(raiz, '[data-estado="ocultos"]');
    const despues = ['todos', 'linea', 'ocultos', 'sin-senal'].map((e) => cifraPestana(raiz, e));
    expect(despues).toEqual(antes);
  });

  // Riesgo: el mapa enseña buses que la lista ya quitó con el filtro.
  it('el mapa quita los mismos buses que la lista', () => {
    const raiz = montar();
    tocar(raiz, '[data-estado="linea"]');
    expect(marcadoresVisibles(raiz)).toEqual([...filasVisibles(raiz)].sort());
    expect(filasVisibles(raiz)).toEqual(['SFA482', 'TUH513', 'WNP659']);
  });
});

describe('la X de la ficha', () => {
  // Riesgo: la ficha cerrada sigue en el recorrido del teclado.
  it('cierra la ficha, la saca del teclado y suelta el bus en la lista y el mapa', () => {
    const raiz = montar();
    tocar(raiz, '[data-accion="cerrar"]');

    expect(ficha(raiz).classList.contains('es-cerrada')).toBe(true);
    expect(ficha(raiz).hasAttribute('inert')).toBe(true);
    expect(raiz.querySelectorAll('.flota-fila.es-elegida')).toHaveLength(0);
    expect(raiz.querySelectorAll('.flota-bus.es-elegido')).toHaveLength(0);
  });

  // Riesgo: al cerrar, el foco se va al principio de la página y quien usa teclado pierde el sitio.
  it('el foco pasa a la fila del bus que se estaba viendo', () => {
    const raiz = montar();
    tocar(raiz, '.flota-fila[data-bus="TUH513"] .flota-fila-elegir');
    tocar(raiz, '[data-accion="cerrar"]');

    expect(document.activeElement).toBe(
      raiz.querySelector('.flota-fila[data-bus="TUH513"] [data-accion="elegir"]')
    );
  });

  // Riesgo: el foco cae en una fila escondida (bus de la otra ruta) y se pierde.
  it('si la fila del bus no se ve, el foco va a la píldora de la ruta que se mira', () => {
    const raiz = montar();
    tocar(raiz, '[data-ruta="vivero"]');
    tocar(raiz, '[data-accion="cerrar"]');

    expect(document.activeElement).toBe(raiz.querySelector('[data-accion="ruta"][data-ruta="vivero"]'));
  });

  // Riesgo: cambiar de ruta suelta el bus elegido (allá la ficha se queda con su ruta en el chip).
  it('cambiar de ruta no cierra la ficha del bus elegido', () => {
    const raiz = montar();
    tocar(raiz, '[data-ruta="vivero"]');
    expect(ficha(raiz).classList.contains('es-cerrada')).toBe(false);
    expect(ficha(raiz).querySelector('[data-ficha="placa"]')!.textContent).toBe('SFA482');
    expect(ficha(raiz).querySelector('[data-ficha="ruta"]')!.textContent).toBe('Tcherassi');
  });

  // Riesgo: con la ficha cerrada su botón de ocultar sigue actuando sobre el último bus.
  it('con la ficha cerrada su botón de ocultar no toca ningún bus', () => {
    const raiz = montar();
    tocar(raiz, '[data-accion="cerrar"]');
    const antes = Array.from(raiz.querySelectorAll('.flota-fila'), (f) => (f as HTMLElement).dataset.busEstado);
    tocar(raiz, '.flota-ocultar');
    const despues = Array.from(raiz.querySelectorAll('.flota-fila'), (f) => (f as HTMLElement).dataset.busEstado);
    expect(despues).toEqual(antes);
  });

  // Riesgo: tras cerrar, volver a elegir un bus no reabre la ficha.
  it('elegir otro bus después de cerrar vuelve a abrir la ficha con ése', () => {
    const raiz = montar();
    tocar(raiz, '[data-accion="cerrar"]');
    tocar(raiz, '.flota-bus[data-bus="DMV238"]');

    expect(ficha(raiz).classList.contains('es-cerrada')).toBe(false);
    expect(ficha(raiz).hasAttribute('inert')).toBe(false);
    expect(ficha(raiz).querySelector('[data-ficha="placa"]')!.textContent).toBe('DMV238');
    expect(ficha(raiz).querySelector('[data-ficha="estado"]')!.textContent).toBe('Sin señal');
  });
});

describe('ocultar y mostrar', () => {
  // Riesgo: el botón de la ficha y el interruptor de la fila cuentan cosas distintas.
  it('el botón de la ficha oculta el bus elegido y la fila se entera', () => {
    const raiz = montar();
    tocar(raiz, '.flota-ocultar');

    const fila = raiz.querySelector<HTMLElement>('.flota-fila[data-bus="SFA482"]')!;
    expect(fila.querySelector('[data-accion="visibilidad"]')!.getAttribute('aria-checked')).toBe('false');
    expect(fila.classList.contains('flota-fila--oculta')).toBe(true);
    expect(ficha(raiz).querySelector('[data-ficha="ocultar"]')!.textContent).toBe('Mostrar');
    expect(ficha(raiz).querySelector('[data-ficha="ocultar-icono"]')!.getAttribute('href')).toBe('#fi-mostrar');
    expect(ficha(raiz).querySelector('.flota-ocultar')!.classList.contains('es-mostrar')).toBe(true);
  });

  // Riesgo: ocultar y volver a mostrar deja el bus a medias (fila, mapa o cifras sin volver).
  it('ocultar y volver a mostrar deja el panel como estaba', () => {
    // happy-dom deja `class=""` al apagar una clase que no estaba; no es pintura.
    const sinClaseVacia = (html: string): string => html.replaceAll(' class=""', '');
    const raiz = montar();
    const antes = sinClaseVacia(raiz.outerHTML);
    tocar(raiz, '.flota-fila[data-bus="TUH513"] [data-accion="visibilidad"]');
    tocar(raiz, '.flota-fila[data-bus="TUH513"] [data-accion="visibilidad"]');
    expect(sinClaseVacia(raiz.outerHTML)).toBe(antes);
  });

  // Riesgo: el ojo de la barra ofrece «mostrar todos» cuando ya se ven todos.
  it('el ojo de la barra ofrece lo contrario de lo que hay en la flota entera', () => {
    const raiz = montar();
    const ojo = raiz.querySelector('[data-todos]')!;
    expect(ojo.getAttribute('href')).toBe('#fi-mostrar');

    tocar(raiz, '.flota-fila[data-bus="WNP659"] [data-accion="visibilidad"]');
    expect(ojo.getAttribute('href')).toBe('#fi-ocultar');

    // Ocultar uno de la otra ruta también cuenta: mira la flota, no la ruta.
    tocar(raiz, '[data-ruta="vivero"]');
    tocar(raiz, '.flota-fila[data-bus="KJT704"] [data-accion="visibilidad"]');
    expect(ojo.getAttribute('href')).toBe('#fi-mostrar');
  });

  // Riesgo: ocultar un bus en la pestaña «En línea» no lo saca de «Ocultos» ni cambia las cifras.
  it('ocultar un bus sube la cifra de «Ocultos» al momento', () => {
    const raiz = montar();
    expect(cifraPestana(raiz, 'ocultos')).toBe('1');
    tocar(raiz, '.flota-fila[data-bus="DMV238"] [data-accion="visibilidad"]');
    expect(cifraPestana(raiz, 'ocultos')).toBe('2');
    tocar(raiz, '[data-estado="ocultos"]');
    expect(filasVisibles(raiz)).toEqual(['DMV238', 'WNP659']);
  });
});

describe('toques que no son gestos', () => {
  // Riesgo: un clic en el fondo del panel cambia el estado o revienta.
  it('un toque fuera de cualquier botón no cambia nada', () => {
    const raiz = montar();
    const antes = raiz.outerHTML;
    tocar(raiz, '.flota-barra .flota-titulo');
    tocar(raiz, '.flota-cuenta');
    expect(raiz.outerHTML).toBe(antes);
  });

  // Riesgo: un `data-accion` desconocido (HTML nuevo sin guion) repinta o rompe el panel.
  it('una acción que el guion no conoce se ignora', () => {
    const raiz = montar();
    const extrano = document.createElement('button');
    extrano.dataset.accion = 'refrescar';
    raiz.querySelector('.flota-barra')!.append(extrano);
    const antes = raiz.outerHTML;
    extrano.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(raiz.outerHTML).toBe(antes);
  });

  // Riesgo: un botón con `data-accion` fuera del panel (otro bloque de la página) lo maneja el panel.
  it('un botón de fuera del panel no lo toca aunque se parezca', () => {
    const raiz = montar();
    const fuera = document.createElement('div');
    fuera.innerHTML = '<button data-accion="ruta" data-ruta="vivero">Vivero</button>';
    document.body.append(fuera);
    // El clic se lanza dentro del panel pero apunta a un botón de fuera:
    // el panel sólo obedece a los suyos.
    const evento = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(evento, 'target', { value: fuera.querySelector('button') });
    raiz.dispatchEvent(evento);
    expect(raiz.querySelector('[data-ruta="tcherassi"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(filasVisibles(raiz)).toEqual(['SFA482', 'TUH513', 'DMV238', 'WNP659']);
  });
});
