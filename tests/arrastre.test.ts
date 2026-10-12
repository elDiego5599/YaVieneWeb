import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { arrastrable } from '../src/arrastre';

/**
 * El gesto de agarrar y arrastrar el pin del mapa en vivo, sin mapa: qué
 * pasa al apoyar (feedback ya), cuánto hay que moverse antes de que sea
 * un arrastre (umbral), que el seguimiento no se pierda al salir del
 * elemento (captura) y cómo acaba (soltar o cancelar).
 */

let el: HTMLElement;
const capturas: number[] = [];

function evento(tipo: string, x: number, y: number, extra: Record<string, unknown> = {}): PointerEvent {
  const e = new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.assign(e, { pointerId: 1, isPrimary: true, ...extra });
  return e as unknown as PointerEvent;
}
const lanzar = (tipo: string, x: number, y: number, extra: Record<string, unknown> = {}): void => {
  el.dispatchEvent(evento(tipo, x, y, extra));
};

function opciones() {
  return {
    alAgarrar: vi.fn(),
    alMover: vi.fn(),
    alSoltar: vi.fn(),
    alCancelar: vi.fn()
  };
}

describe('arrastrable', () => {
  beforeEach(() => {
    capturas.length = 0;
    el = document.createElement('div');
    document.body.appendChild(el);
    // happy-dom no trae captura de puntero: se anota quién la pide.
    el.setPointerCapture = (id: number) => void capturas.push(id);
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Riesgo: el feedback espera a que se mueva o se suelte y el pin parece muerto.
  it('al apoyar avisa en el acto y captura el puntero', () => {
    const o = opciones();
    arrastrable(el, o);
    lanzar('pointerdown', 100, 100);
    expect(o.alAgarrar).toHaveBeenCalledTimes(1);
    expect(capturas).toEqual([1]);
    expect(o.alMover).not.toHaveBeenCalled();
  });

  // Riesgo: un temblor del dedo en un toque se lee como arrastre.
  it('bajo el umbral no es un arrastre', () => {
    const o = opciones();
    arrastrable(el, { ...o, umbral: 10 });
    lanzar('pointerdown', 100, 100);
    lanzar('pointermove', 106, 107);
    lanzar('pointerup', 106, 107);
    expect(o.alMover).not.toHaveBeenCalled();
    expect(o.alSoltar).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('al pasar el umbral sigue al puntero movimiento a movimiento', () => {
    const o = opciones();
    arrastrable(el, { ...o, umbral: 10 });
    lanzar('pointerdown', 100, 100);
    lanzar('pointermove', 112, 100);
    lanzar('pointermove', 130, 90);
    expect(o.alMover).toHaveBeenCalledTimes(2);
    const ultimo = o.alMover.mock.calls[1]![0] as PointerEvent;
    expect([ultimo.clientX, ultimo.clientY]).toEqual([130, 90]);
  });

  // Riesgo: tras comprometerse, volver cerca del origen congelaba el pin.
  it('una vez comprometido sigue aunque vuelva dentro del umbral', () => {
    const o = opciones();
    arrastrable(el, { ...o, umbral: 10 });
    lanzar('pointerdown', 100, 100);
    lanzar('pointermove', 120, 100);
    lanzar('pointermove', 101, 100);
    expect(o.alMover).toHaveBeenCalledTimes(2);
  });

  it('al soltar tras arrastrar lo dice, y deja de seguir', () => {
    const o = opciones();
    arrastrable(el, o);
    lanzar('pointerdown', 0, 0);
    lanzar('pointermove', 50, 0);
    lanzar('pointerup', 50, 0);
    expect(o.alSoltar).toHaveBeenCalledWith(expect.anything(), true);
    lanzar('pointermove', 90, 0);
    expect(o.alMover).toHaveBeenCalledTimes(1);
  });

  // Riesgo: el navegador se queda el gesto (scroll) y el pin queda a medias.
  it('si el navegador cancela, avisa del cancelo y no de soltar', () => {
    const o = opciones();
    arrastrable(el, o);
    lanzar('pointerdown', 0, 0);
    lanzar('pointermove', 50, 0);
    lanzar('pointercancel', 50, 0);
    expect(o.alCancelar).toHaveBeenCalledTimes(1);
    expect(o.alSoltar).not.toHaveBeenCalled();
  });

  // Riesgo: un segundo dedo o el botón derecho arrastran el pin.
  it('ignora el botón secundario y los punteros que no son el primario', () => {
    const o = opciones();
    arrastrable(el, o);
    lanzar('pointerdown', 0, 0, { button: 2 });
    lanzar('pointerdown', 0, 0, { isPrimary: false });
    expect(o.alAgarrar).not.toHaveBeenCalled();
  });

  it('ignora el movimiento de otro puntero mientras uno arrastra', () => {
    const o = opciones();
    arrastrable(el, o);
    lanzar('pointerdown', 0, 0);
    lanzar('pointermove', 50, 0, { pointerId: 2 });
    expect(o.alMover).not.toHaveBeenCalled();
  });

  // Riesgo: pointermove sin apoyar (el ratón pasando por encima) mueve el pin.
  it('sin apoyar antes, mover no hace nada', () => {
    const o = opciones();
    arrastrable(el, o);
    lanzar('pointermove', 50, 0);
    lanzar('pointerup', 50, 0);
    expect(o.alMover).not.toHaveBeenCalled();
    expect(o.alSoltar).not.toHaveBeenCalled();
  });

  // Riesgo: pointerId ya inválido hace que setPointerCapture lance y rompa el gesto.
  it('si la captura falla, el gesto sigue', () => {
    const o = opciones();
    el.setPointerCapture = () => {
      throw new Error('NotFoundError');
    };
    arrastrable(el, o);
    lanzar('pointerdown', 0, 0);
    lanzar('pointermove', 50, 0);
    expect(o.alAgarrar).toHaveBeenCalled();
    expect(o.alMover).toHaveBeenCalledTimes(1);
  });
});
