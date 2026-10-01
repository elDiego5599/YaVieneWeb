import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { metrica } from "../src/cifra-viva";
import { ROTULO, type BusEstado } from "../src/panel-flota";

/**
 * T6.8 · El glosario es uno, en dos copias.
 *
 * `src/glosario.json` es el mismo archivo que
 * `YaViene/ya_viene_core/lib/core/texto/glosario.json`. Ninguna CI trae el
 * otro repo, así que el eslabón es este hash, escrito igual en
 * `ya_viene_core/test/glosario_test.dart`: quien cambie una copia cambia el
 * hash en su prueba, y el mismo cambio queda por hacer en la otra. Con los
 * dos repos uno junto al otro, además, se comparan byte a byte.
 *
 * Aquí se ata lo que la web pinta: los rótulos del panel dibujado, el aviso
 * de la landing (sin placa, regla 12) y la cifra de la distancia.
 */
const HASH_GLOSARIO =
  "a504203047349505e763090f95f60db4bf595c9f9183dd5ca55463427bfe0b74";

const leer = (nombre: string): string =>
  readFileSync(resolve(process.cwd(), nombre), "utf8");
const crudo = leer("src/glosario.json");
const glosario = JSON.parse(crudo) as {
  estadosBus: Record<string, string>;
  aviso: { landing: string; app: string };
  distancia: { metros: string; kilometros: string; separadorDecimal: string };
};

describe("glosario (T6.8)", () => {
  it("es el del hash compartido con la app", () => {
    expect(createHash("sha256").update(crudo).digest("hex")).toBe(
      HASH_GLOSARIO,
    );
  });

  it("con la app al lado, las dos copias son idénticas", ({ skip }) => {
    const app = resolve(
      process.cwd(),
      "../YaViene/ya_viene_core/lib/core/texto/glosario.json",
    );
    if (!existsSync(app)) skip();
    expect(readFileSync(app, "utf8")).toBe(crudo);
  });

  it("el panel dibujado rotula los estados como la app de control", () => {
    // La app nombra los estados en camelCase (`BusEstado.sinSenal`); la web,
    // en kebab (`'sin-senal'`). Mismos cuatro, mismas palabras.
    const clave: Record<BusEstado, string> = {
      "en-linea": "enLinea",
      inactivo: "inactivo",
      "sin-senal": "sinSenal",
      oculto: "oculto",
    };
    const rotulos = Object.fromEntries(
      (Object.keys(ROTULO) as BusEstado[]).map((e) => [clave[e], ROTULO[e]]),
    );
    expect(rotulos).toEqual(glosario.estadosBus);
  });

  it("la landing avisa sin placa, con las palabras del glosario", () => {
    const { landing } = glosario.aviso;
    expect(leer("index.html")).toContain(`data-el="notif-title">${landing}<`);
    for (const archivo of ["src/phone-simulator.ts", "src/mapa-vivo.ts"]) {
      expect(leer(archivo), archivo).toContain(`'${landing}'`);
    }
    // Regla 12: la app dice ruta y placa; la landing, no.
    expect(landing).not.toBe(glosario.aviso.app);
    expect(landing).not.toContain("{placa}");
  });

  it("la cifra de la hoja escribe la distancia como la app", () => {
    const { metros, kilometros, separadorDecimal: coma } = glosario.distancia;
    expect(metrica(430)).toEqual(["430", `${metros} de ti`]);
    expect(metrica(1000)).toEqual([`1${coma}0`, `${kilometros} de ti`]);
    // La cifra grande guarda siempre su decimal (las frases lo sueltan en 10 km).
    expect(metrica(14408)).toEqual([`14${coma}4`, `${kilometros} de ti`]);
  });
});
