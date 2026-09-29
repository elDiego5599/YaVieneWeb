import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encajarEscena, encajeDe } from '../src/encaje';

/**
 * `encaje.ts` encoge la escena pegada de «Qué resuelve» y «Cómo funciona»
 * cuando no cabe en la ventana: con el zoom del navegador o en un portátil
 * de pantalla baja, lo que sobra por abajo de una escena pegada no se
 * alcanza de ninguna forma. Aquí no hay maquetador, así que el alto de la
 * escena se simula: una función del factor `--encaje`, como la que daría
 * el navegador al volver a maquetar en pequeño. Lo que se comprueba es lo
 * que ve quien mira: si la escena entra entera, y si se queda quieta.
 */

interface Marco {
  position?: string;
  paddingTop?: string;
  paddingBottom?: string;
  minHeight?: string;
}

/** Los cuadros pedidos que aún no han corrido, como los guarda el navegador. */
let cuadros: Map<number, FrameRequestCallback>;
let siguiente: number;
/** El aviso de cambio de tamaño que la escena registra. */
let vigias: { avisar: () => void; desconectado: boolean }[];
/** Las escenas montadas en cada prueba, para soltarlas al acabar. */
let soltar: (() => void)[] = [];

/** `encajarEscena`, apuntando cómo soltarla para que no escuche en la prueba siguiente. */
function encajar(caja: HTMLElement): () => void {
  const suelta = encajarEscena(caja);
  soltar.push(suelta);
  return suelta;
}

function correrCuadros(): void {
  const pendientes = [...cuadros.values()];
  cuadros.clear();
  for (const cb of pendientes) cb(performance.now());
}

/**
 * Una escena con su contenido. `alto(k)` es lo que mide el contenido en
 * pantalla con el factor `k` puesto; `natural` lo que mide sin encoger,
 * que es lo que el guion usa para notar que algo creció.
 */
function escena(
  marco: Marco,
  alto: (k: number) => number
): { escena: HTMLElement; dentro: HTMLElement; factor: () => string; medidas: () => number } {
  const caja = document.createElement('section');
  const dentro = document.createElement('div');
  caja.append(dentro);
  document.body.append(caja);

  const factorPuesto = (): number => Number.parseFloat(caja.style.getPropertyValue('--encaje')) || 1;
  let medidas = 0;
  dentro.getBoundingClientRect = () => {
    medidas += 1;
    return { height: alto(factorPuesto()) } as DOMRect;
  };
  Object.defineProperty(dentro, 'offsetHeight', { get: () => Math.round(alto(1)) });

  const estilo = {
    position: 'sticky',
    paddingTop: '0px',
    paddingBottom: '0px',
    minHeight: '800px',
    ...marco,
  };
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) =>
    el === caja ? (estilo as unknown as CSSStyleDeclaration) : original(el)
  );

  return {
    escena: caja,
    dentro,
    factor: () => caja.style.getPropertyValue('--encaje'),
    medidas: () => medidas,
  };
}

describe('encajarEscena', () => {
  beforeEach(() => {
    cuadros = new Map();
    siguiente = 1;
    vigias = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = siguiente++;
      cuadros.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => cuadros.delete(id));
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private readonly registro: { avisar: () => void; desconectado: boolean };
        constructor(cb: () => void) {
          this.registro = { avisar: cb, desconectado: false };
          vigias.push(this.registro);
        }
        observe(): void {}
        disconnect(): void {
          this.registro.desconectado = true;
        }
      }
    );
  });

  afterEach(() => {
    for (const suelta of soltar) suelta();
    soltar = [];
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  // Riesgo: una escena que ya cabe se encoge igual y el texto sale pequeño sin motivo.
  it('si la escena cabe, se queda a tamaño completo', () => {
    const { escena: caja, factor } = escena({}, (k) => 600 * k);
    encajar(caja);
    expect(factor()).toBe('1.000');
  });

  // Riesgo: con el zoom del navegador la escena pegada se sale por abajo y ese trozo no se alcanza.
  it('si no cabe, se encoge al mayor factor con el que entra entera', () => {
    // 800 de alto declarado menos 60 + 40 de franjas: quedan 700 libres.
    const { escena: caja, factor } = escena({ paddingTop: '60px', paddingBottom: '40px' }, (k) => 1000 * k);
    encajar(caja);
    const k = Number(factor());
    expect(1000 * k).toBeLessThanOrEqual(700);
    expect(k).toBeGreaterThan(0.69);
  });

  // Riesgo: el factor se redondea hacia arriba y la última línea queda medio píxel fuera.
  it('el factor se escribe con tres decimales y nunca por encima del que cabe', () => {
    const { escena: caja, factor } = escena({ minHeight: '777px' }, (k) => 1000 * k);
    encajar(caja);
    expect(factor()).toMatch(/^0\.\d{3}$/);
    expect(1000 * Number(factor())).toBeLessThanOrEqual(777);
  });

  // Riesgo: el temblor de los teléfonos — al encoger las líneas se reparten distinto y una regla de tres salta entre dos factores sin parar.
  it('con un alto que cambia al volver a maquetar, encuentra un factor y se queda quieto', () => {
    // Por encima de 0,87 el texto parte en una línea más: 945 contra 835.
    const alto = (k: number): number => (k > 0.87 ? 945 : 835) * k;
    const { escena: caja, factor, medidas } = escena({ minHeight: '780px' }, alto);
    encajar(caja);
    const primero = factor();
    expect(alto(Number(primero))).toBeLessThanOrEqual(780);
    expect(Number(primero)).toBeGreaterThan(0.86);

    // La barra del móvil dispara `resize` en cada tirón de scroll.
    const antes = medidas();
    for (let i = 0; i < 5; i += 1) {
      window.dispatchEvent(new Event('resize'));
      correrCuadros();
    }
    expect(factor()).toBe(primero);
    expect(medidas()).toBe(antes);
  });

  // Riesgo: en una pantalla diminuta se encoge hasta lo ilegible.
  it('si ni encogida del todo cabe, se queda en la mitad y no baja más', () => {
    const { escena: caja, factor } = escena({}, (k) => 3000 * k);
    encajar(caja);
    expect(factor()).toBe('0.500');
  });

  // Riesgo: con movimiento reducido la sección no va pegada y aun así se encoge.
  it('sin pegado (movimiento reducido) no toca la escena', () => {
    const { escena: caja, factor, medidas } = escena({ position: 'static' }, (k) => 3000 * k);
    encajar(caja);
    expect(factor()).toBe('');
    expect(medidas()).toBe(0);
  });

  // Riesgo: si el CSS no resuelve el alto, la cuenta sale NaN y la escena se queda sin factor.
  it('si el CSS no da alto, se mide contra la ventana', () => {
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
    const { escena: caja, factor } = escena({ minHeight: 'auto', paddingTop: '', paddingBottom: '' }, (k) => 1000 * k);
    encajar(caja);
    const k = Number(factor());
    expect(1000 * k).toBeLessThanOrEqual(600);
    expect(k).toBeGreaterThan(0.59);
  });

  // Riesgo: franjas más altas que la pantalla dan un hueco negativo y la escena desaparece.
  it('si las franjas no dejan hueco, no encoge a cero', () => {
    const { escena: caja, factor } = escena(
      { minHeight: '100px', paddingTop: '60px', paddingBottom: '60px' },
      (k) => 1000 * k
    );
    encajar(caja);
    expect(factor()).toBe('');
  });

  // Riesgo: una escena sin contenido revienta el arranque de toda la página.
  it('una escena vacía no hace nada y se suelta sin fallar', () => {
    const caja = document.createElement('section');
    document.body.append(caja);
    const suelta = encajar(caja);
    expect(caja.style.getPropertyValue('--encaje')).toBe('');
    expect(() => suelta()).not.toThrow();
  });

  // Riesgo: algo que llega tarde (el mapa, una imagen) hace crecer la escena y lo nuevo se corta.
  it('si el contenido crece después, vuelve a medir y encoge', () => {
    let natural = 600;
    const { escena: caja, factor } = escena({}, (k) => natural * k);
    encajar(caja);
    expect(factor()).toBe('1.000');

    natural = 1000;
    vigias[0]!.avisar();
    correrCuadros();
    const k = Number(factor());
    expect(1000 * k).toBeLessThanOrEqual(800);
    expect(k).toBeGreaterThan(0.79);
  });

  // Riesgo: al girar el teléfono el hueco cambia y la escena se queda con el factor viejo.
  it('si la ventana cambia de alto, busca de nuevo', () => {
    const { escena: caja, factor } = escena({ minHeight: '800px' }, (k) => 1000 * k);
    encajar(caja);
    expect(Number(factor())).toBeLessThanOrEqual(0.8);

    // El espía devuelve siempre el mismo estilo: se cambia en él.
    (window.getComputedStyle(caja) as unknown as Marco).minHeight = '1200px';
    window.dispatchEvent(new Event('resize'));
    correrCuadros();
    expect(factor()).toBe('1.000');
  });

  // Riesgo: una ráfaga de avisos en el mismo cuadro repite la búsqueda entera varias veces.
  it('varios avisos en el mismo cuadro piden una sola medida', () => {
    const { escena: caja } = escena({}, (k) => 1000 * k);
    encajar(caja);
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    vigias[0]!.avisar();
    expect(cuadros.size).toBe(1);
  });

  // Riesgo: al soltar la escena siguen vivos el oyente y el observador, y miden una escena que ya no está.
  it('al soltarla cancela la medida pendiente y deja de escuchar', () => {
    const { escena: caja } = escena({}, (k) => 1000 * k);
    const suelta = encajar(caja);
    window.dispatchEvent(new Event('resize'));
    expect(cuadros.size).toBe(1);

    suelta();
    expect(cuadros.size).toBe(0);
    expect(vigias[0]!.desconectado).toBe(true);
    window.dispatchEvent(new Event('resize'));
    expect(cuadros.size).toBe(0);
  });

  // Riesgo: las fuentes llegan tarde, cambian el alto del texto y nadie vuelve a medir.
  it('cuando llegan las fuentes pide otra medida', async () => {
    let listas!: () => void;
    const ready = new Promise<void>((r) => (listas = r));
    Object.defineProperty(document, 'fonts', { value: { ready }, configurable: true });
    try {
      const { escena: caja } = escena({}, (k) => 600 * k);
      encajar(caja);
      expect(cuadros.size).toBe(0);
      listas();
      await ready;
      await Promise.resolve();
      expect(cuadros.size).toBe(1);
    } finally {
      delete (document as unknown as { fonts?: unknown }).fonts;
    }
  });
});

describe('encajeDe', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const con = (valor: string): number => {
    const el = document.createElement('div');
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => valor,
    } as unknown as CSSStyleDeclaration);
    return encajeDe(el);
  };

  // Riesgo: fuera de una escena el dedo de la demo divide por un factor vacío y sale NaN.
  it('fuera de una escena el factor es 1', () => {
    expect(con('')).toBe(1);
  });

  // Riesgo: el dedo cae fuera del botón cuando la escena va encogida.
  it('dentro de una escena devuelve el factor heredado', () => {
    expect(con(' 0.75')).toBe(0.75);
  });

  // Riesgo: un valor roto (cero, negativo o texto) hace dividir por cero o dar la vuelta al dedo.
  it('un factor roto se lee como 1', () => {
    expect(con('0')).toBe(1);
    expect(con('-0.5')).toBe(1);
    expect(con('grande')).toBe(1);
    expect(con('Infinity')).toBe(1);
  });
});
