// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
  Dos cosas que no se ven leyendo un workflow y que no deberían volver a
  pasar:

  1. Sin un bloque `permissions:`, el token que GitHub le presta a la corrida
     lleva los permisos por omisión del repositorio —que incluyen escritura—,
     y ese token se lo pasa a código de terceros.
  2. `uses: algo@v5` trae lo que el dueño de esa acción tenga puesto hoy en
     esa etiqueta. Una etiqueta se mueve; un commit no. Clavado al SHA, lo que
     corre mañana es lo mismo que se revisó hoy, y subirlo es un cambio
     visible en el repositorio y no un silencio. Al lado del SHA va la versión
     legible, que también se exige aquí: sin ella nadie sabe qué está clavado
     sin ir a preguntárselo a GitHub.

  Se lee el texto tal cual, sin analizador de YAML: no hay dependencia que
  agregar y lo que se exige es visible en el archivo.
*/

const carpeta = join(process.cwd(), '.github', 'workflows');
const workflows = readdirSync(carpeta).filter((n) => n.endsWith('.yml') || n.endsWith('.yaml'));

describe('los workflows no le dan más de lo necesario a nadie', () => {
  it('hay workflows que revisar', () => {
    expect(workflows.length, `ningún workflow en ${carpeta}`).toBeGreaterThan(0);
  });

  for (const nombre of workflows) {
    const texto = readFileSync(join(carpeta, nombre), 'utf8');

    it(`${nombre}: declara los permisos del token`, () => {
      expect(texto, 'falta el bloque `permissions:` en la raíz').toMatch(/^permissions:$/m);
      expect(texto, 'los permisos deben dar solo lectura de contenidos').toMatch(
        /^ {2}contents: read$/m
      );
    });

    it(`${nombre}: cada acción va clavada a un commit`, () => {
      const usos = [...texto.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(?:\s+#\s*(\S+))?\s*$/gm)];
      expect(usos.length, 'ningún `uses:`: ¿cambió el formato del archivo?').toBeGreaterThan(0);
      for (const [, accion, version] of usos) {
        expect(accion, `${accion} no está clavado a un SHA de 40 caracteres`).toMatch(
          /@[0-9a-f]{40}$/
        );
        expect(version ?? '', `${accion} no dice al lado qué versión es ese commit`).toMatch(/^v\d/);
      }
    });
  }
});
