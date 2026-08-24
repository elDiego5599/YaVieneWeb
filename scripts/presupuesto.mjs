/**
 * Presupuesto de peso de la landing.
 *
 * Una página se engorda de a poco: una fuente más aquí, una librería
 * allá, y para cuando se nota ya nadie sabe qué la engordó. Esto corta
 * el problema de raíz: si la build se pasa de los topes, la integración
 * continua falla y el commit que la engordó queda señalado.
 *
 * Los topes no son cifras redondas inventadas: son lo que pesa la build
 * de hoy más un margen. No están para que quepa lo que venga, están para
 * que engordar sea una decisión consciente y no un descuido.
 *
 *   node scripts/presupuesto.mjs
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = 'dist';
const KB = 1024;

/** Topes en KB. Medido el 24/08/2026 y redondeado hacia arriba. */
const TOPES = {
  'todo dist': 750,
  'JavaScript': 65,
  'CSS': 85,
  'primera visita': 600,
};

/** Lo que el navegador se baja de verdad al abrir la portada por primera
 *  vez. El resto de dist (las otras tres páginas, los subconjuntos
 *  latin-ext, la imagen para redes) no entra en esta cuenta porque en esa
 *  visita no se pide. */
const NO_ENTRA_EN_LA_PRIMERA_VISITA = [
  /^(privacidad|terminos|404|empresas)\.html$/,
  /latin-ext-[^/]*\.woff2$/,
  /^og\.png$/,
  /^logo\.svg$/,
  /^(hoja|404|accesibilidad)-[^/]*\.js$/,
  // El CSS de /empresas.html va en su propio fichero desde que salió del
  // índice común: la portada no lo pide. El de `accesibilidad` sí entra,
  // que ahí es donde el empaquetador dejó la hoja compartida.
  /^empresas-[^/]*\.(js|css)$/,
];

function recorrer(dir, base = '') {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    const rel = base ? `${base}/${nombre}` : nombre;
    const st = statSync(ruta);
    if (st.isDirectory()) salida.push(...recorrer(ruta, rel));
    else salida.push({ rel, bytes: st.size });
  }
  return salida;
}

let ficheros;
try {
  ficheros = recorrer(DIST);
} catch {
  console.error('✗ No hay carpeta dist/. Ejecuta `npm run build` antes.');
  process.exit(1);
}

const suma = (lista) => lista.reduce((a, f) => a + f.bytes, 0) / KB;

// La portada arrastra su CSS y su JS; el resto de ficheros de assets sólo
// cuenta si no está en la lista de exclusiones de arriba.
const primeraVisita = ficheros.filter(
  (f) => !NO_ENTRA_EN_LA_PRIMERA_VISITA.some((re) => re.test(f.rel.replace(/^assets\//, '')))
);

const medidas = {
  'todo dist': suma(ficheros),
  'JavaScript': suma(ficheros.filter((f) => extname(f.rel) === '.js')),
  'CSS': suma(ficheros.filter((f) => extname(f.rel) === '.css')),
  'primera visita': suma(primeraVisita),
};

let fallo = false;
console.log('\n  Presupuesto de peso\n  ' + '─'.repeat(46));
for (const [nombre, tope] of Object.entries(TOPES)) {
  const real = medidas[nombre];
  const pasa = real <= tope;
  if (!pasa) fallo = true;
  const pct = Math.round((real / tope) * 100);
  console.log(
    `  ${pasa ? '✓' : '✗'} ${nombre.padEnd(16)} ${real.toFixed(1).padStart(7)} KB  de ${String(tope).padStart(4)} KB  (${pct}%)`
  );
}

if (fallo) {
  console.log('\n  Los cinco ficheros más pesados de dist:');
  for (const f of [...ficheros].sort((a, b) => b.bytes - a.bytes).slice(0, 5)) {
    console.log(`    ${(f.bytes / KB).toFixed(1).padStart(8)} KB  ${f.rel}`);
  }
  console.log(
    '\n  Si el peso de más está justificado, sube el tope en\n' +
      '  scripts/presupuesto.mjs y explica en el commit por qué.\n'
  );
  process.exit(1);
}

console.log('  ' + '─'.repeat(46) + '\n  Todo dentro del presupuesto.\n');
