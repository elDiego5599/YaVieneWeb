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
  "65ac0343916432e7685db56de8d9017ffeef5559a4974c68ab18498d7d55a221";

const leer = (nombre: string): string =>
  readFileSync(resolve(process.cwd(), nombre), "utf8");
const crudo = leer("src/glosario.json");
const glosario = JSON.parse(crudo) as {
  estadosBus: Record<string, string>;
  aviso: { texto: string };
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

  it("la landing avisa con las mismas palabras que la app", () => {
    const { texto } = glosario.aviso;
    expect(leer("src/phone-simulator.ts")).toContain(`'${texto}'`);
    // Un solo aviso en la app y en la landing (dueño, 2026-10-30): sin ruta,
    // placa ni distancia.
    expect(texto).toBe("Tu bus está cerca de ti");
    expect(texto).not.toContain("{");
  });

  it("la cifra de la hoja escribe la distancia como la app", () => {
    const { metros, kilometros, separadorDecimal: coma } = glosario.distancia;
    expect(metrica(430)).toEqual(["430", `${metros} de ti`]);
    expect(metrica(1000)).toEqual([`1${coma}0`, `${kilometros} de ti`]);
    // La cifra grande guarda siempre su decimal (las frases lo sueltan en 10 km).
    expect(metrica(14408)).toEqual([`14${coma}4`, `${kilometros} de ti`]);
  });
});
