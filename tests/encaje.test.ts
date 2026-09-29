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

  describe('la búsqueda del factor', () => {
    /**
     * La bisección que buscaba el factor antes, copiada tal cual: ocho
     * cortes sobre [0.5, 1] probando con tres decimales. Se queda aquí de
     * vara de medir: la búsqueda nueva tiene que dar el mismo factor,
     * milésima a milésima, porque un factor distinto es una escena que se
     * mueve.
     */
    function biseccion(alto: (k: number) => number, libre: number): string {
      const probar = (k: number): number => alto(Number(k.toFixed(3)));
      if (probar(1) <= libre) return '1.000';
      if (probar(0.5) > libre) return '0.500';
      let cabe = 0.5;
      let sobra = 1;
      for (let i = 0; i < 8; i += 1) {
        const medio = (cabe + sobra) / 2;
        if (probar(medio) <= libre) cabe = medio;
        else sobra = medio;
      }
      return (Math.floor(cabe * 1000) / 1000).toFixed(3);
    }

    /**
     * El alto en pantalla de una escena cuyo alto propio `H(k)` pasa por
     * estos puntos, en tramos rectos y partido en líneas enteras de 17 px:
     * al encoger, el texto se reparte en menos líneas y la escena ocupa
     * menos de lo que diría la regla de tres.
     */
    const curva =
      (puntos: [number, number][]) =>
      (k: number): number => {
        let i = 1;
        while (i < puntos.length - 1 && k > puntos[i]![0]) i += 1;
        const [k0, h0] = puntos[i - 1]!;
        const [k1, h1] = puntos[i]!;
        const propio = h0 + ((h1 - h0) * (k - k0)) / (k1 - k0);
        return Math.ceil(propio / 17) * 17 * k;
      };

    /**
     * Las formas medidas en Chromium con la escena de «Cómo funciona»
     * (alto en pantalla / factor, a varios factores) y dos de libro: la
     * recta y el salto de línea del temblor.
     */
    const curvas: Record<string, (k: number) => number> = {
      'Pixel 7': curva([[0.5, 892], [0.75, 913], [0.875, 944], [1, 944]]),
      '375 × 667': curva([[0.5, 798], [0.625, 818], [0.708, 818], [0.75, 848], [1, 868]]),
      '1440 × 900': curva([[0.5, 832], [0.75, 831], [0.875, 830], [1, 830]]),
      recta: (k) => 1000 * k,
      'salto de línea': (k) => (k > 0.87 ? 945 : 835) * k,
    };

    /** Encaja una escena con esa curva y ese hueco; dice qué factor puso y cuánto midió. */
    function encajarCon(alto: (k: number) => number, libre: number): { factor: string; medidas: number } {
      const e = escena({ minHeight: `${libre}px` }, alto);
      const suelta = encajarEscena(e.escena);
      const resultado = { factor: e.factor(), medidas: e.medidas() };
      suelta();
      e.escena.remove();
      return resultado;
    }

    // Riesgo: la búsqueda rápida da otro factor que la de antes y la escena se mueve un pelo en alguna pantalla.
    it('da el mismo factor que la bisección, hueco a hueco', () => {
      for (const [nombre, alto] of Object.entries(curvas)) {
        for (let libre = 300; libre <= 1000; libre += 1) {
          expect(encajarCon(alto, libre).factor, `${nombre} con ${libre} libres`).toBe(
            biseccion(alto, libre)
          );
        }
      }
    });

    // Riesgo: la tarea larga del arranque — cada prueba es una maqueta entera de la página, de 13 a 22 ms.
    it('con las escenas medidas le bastan cuatro maquetas, no diez', () => {
      // Los huecos que dejó cada ventana en Chromium. Allí, con el alto
      // de verdad, fueron tres, cuatro y tres contando la del factor puesto;
      // aquí las líneas de 17 px lo ponen algo más difícil.
      expect(encajarCon(curvas['Pixel 7']!, 753).medidas).toBeLessThanOrEqual(4);
      expect(encajarCon(curvas['375 × 667']!, 580).medidas).toBeLessThanOrEqual(4);
      expect(encajarCon(curvas['1440 × 900']!, 808).medidas).toBeLessThanOrEqual(4);
    });

    // Riesgo: una curva rara despista a la estimación y la búsqueda se alarga sin tope.
    it('en cualquier hueco tiene techo, y de media se queda en la mitad de la bisección', () => {
      for (const [nombre, alto] of Object.entries(curvas)) {
        let total = 0;
        let cuantos = 0;
        for (let libre = 300; libre <= 1000; libre += 1) {
          if (alto(1) <= libre) continue;
          const { medidas } = encajarCon(alto, libre);
          // La del factor puesto, cuatro guiadas y ocho cortes como mucho.
          expect(medidas, `${nombre} con ${libre} libres`).toBeLessThanOrEqual(13);
          total += medidas;
          cuantos += 1;
        }
        expect(total / cuantos, nombre).toBeLessThan(5);
      }
    });

    // Riesgo: al volver a buscar tras un cambio de ventana, arrancar del factor puesto da otra respuesta que arrancar del 1.
    it('al volver a buscar desde un factor ya puesto llega al mismo', () => {
      const alto = curvas['375 × 667']!;
      const e = escena({ minHeight: '580px' }, alto);
      encajar(e.escena);
      expect(e.factor()).toBe(biseccion(alto, 580));

      for (const libre of [700, 900, 450, 580]) {
        vi.mocked(window.getComputedStyle).mockImplementation(
          (el: Element) =>
            (el === e.escena
              ? { position: 'sticky', paddingTop: '0px', paddingBottom: '0px', minHeight: `${libre}px` }
              : {}) as unknown as CSSStyleDeclaration
        );
        window.dispatchEvent(new Event('resize'));
        correrCuadros();
        expect(e.factor(), `${libre} libres`).toBe(biseccion(alto, libre));
      }
    });
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
