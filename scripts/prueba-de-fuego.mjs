/**
 * Prueba de fuego: rompe la web a propósito y mira si la suite lo nota.
 *
 * Que las pruebas pasen no dice que cuiden algo: una prueba que nunca falla
 * tampoco falla cuando el código se rompe. Aquí cada mutación es un error
 * creíble en una pieza que se ve o que importa —un `<` que pasa a `<=`, un
 * umbral que cambia, un chequeo que desaparece—; se aplica sobre `src/` (o
 * `vite.config.ts`), se corre Vitest entero y se deshace. Si la suite sigue
 * en verde con el error puesto, esa mutación «sobrevive» y falta una prueba.
 *
 * Uso:
 *   node scripts/prueba-de-fuego.mjs              # todas (≈20 s cada una)
 *   node scripts/prueba-de-fuego.mjs --solo=3,7   # solo esas (el número de la lista)
 *
 * Se niega a correr con cambios sin commitear en lo que muta, para que
 * deshacer sea siempre volver al archivo tal como estaba. Una corrida sin
 * el resumen de Vitest («Test Files») no cuenta como muerte: así un comando
 * roto no se disfraza de suite que detecta todo.
 * `tests/prueba-de-fuego.test.ts` vigila que cada mutación siga aplicando.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const MUTACIONES = [
  // El formulario de empresas: lo único de la web que manda datos.
  { archivo: 'src/contact-form.ts', de: 'if (malos.length > 0) {', a: 'if (malos.length < 0) {', que: 'validación del formulario' },
  { archivo: 'src/contact-form.ts', de: "campo.value.trim() === ''", a: "campo.value === ''", que: 'espacios solos cuentan como vacío' },
  { archivo: 'src/contact-form.ts', de: "getAttribute('aria-invalid') === 'true'", a: "getAttribute('aria-invalid') !== 'true'", que: 'el campo marcado se revisa al escribir' },
  { archivo: 'src/contact-form.ts', de: 'if (this.#enviando) return;', a: 'if (false) return;', que: 'doble envío' },
  { archivo: 'src/contact-form.ts', de: "if (typeof valor === 'string') salida[clave] = valor.trim();", a: "if (typeof valor === 'string') salida[clave] = valor;", que: 'espacios sobrantes en los campos' },
  { archivo: 'src/contact-form.ts', de: 'if (!respuesta.ok) throw new Error', a: 'if (respuesta.ok) throw new Error', que: 'respuesta de error del servidor' },
  { archivo: 'src/contact-form.ts', de: "if (!ventana) throw new Error('El navegador bloqueó la ventana de WhatsApp');", a: 'if (!ventana) return;', que: 'WhatsApp bloqueado por el navegador' },
  { archivo: 'src/contact-form.ts', de: 'ventana.opener = null;', a: 'void ventana;', que: 'la pestaña de WhatsApp sin opener' },
  { archivo: 'src/contact-form.ts', de: 'encodeURIComponent(texto)', a: 'texto', que: 'el mensaje de WhatsApp codificado' },
  { archivo: 'src/contact-form.ts', de: 'if (porWhatsApp) {', a: 'if (!porWhatsApp) {', que: 'el éxito cuenta por dónde salió' },
  { archivo: 'src/contact-form.ts', de: 'this.#boton.disabled = true;', a: 'this.#boton.disabled = false;', que: 'botón bloqueado mientras envía' },
  { archivo: 'src/contact-form.ts', de: "this.#error.hidden = mensaje === '';", a: 'this.#error.hidden = false;', que: 'el error vacío se esconde' },
  // La cifra viva de la hoja.
  { archivo: 'src/cifra-viva.ts', de: "const clase = valor < previo ? 'cifra-baja' : 'cifra-sube';", a: "const clase = valor > previo ? 'cifra-baja' : 'cifra-sube';", que: 'dirección del cambio de cifra' },
  { archivo: 'src/cifra-viva.ts', de: 'if (!NUMERO.test(antes) || !NUMERO.test(texto)) {', a: 'if (!NUMERO.test(texto)) {', que: 'de texto a número sin animar' },
  { archivo: 'src/cifra-viva.ts', de: 'if (cifra !== antes[i + corrimiento]) span.className = clase;', a: 'span.className = clase;', que: 'solo se anima el dígito que cambia' },
  { archivo: 'src/cifra-viva.ts', de: "if (redondos < 1000) return [String(redondos), 'm de ti'];", a: "if (redondos <= 1000) return [String(redondos), 'm de ti'];", que: 'metros o kilómetros' },
  { archivo: 'src/cifra-viva.ts', de: "return [(metros / 1000).toFixed(1).replace('.', ','), 'km de ti'];", a: "return [(metros / 1000).toFixed(1), 'km de ti'];", que: 'coma decimal' },
  // El hero.
  { archivo: 'src/phone-simulator.ts', de: "if (metros < 300) return 'var(--app-coral-accessible)';", a: "if (metros < 200) return 'var(--app-coral-accessible)';", que: 'coral del hero' },
  { archivo: 'src/phone-simulator.ts', de: 'const dentro = this.#avisoActivo && metros <= this.#radioAvisoM;', a: 'const dentro = metros <= this.#radioAvisoM;', que: 'aviso del hero solo armado' },
  { archivo: 'src/phone-simulator.ts', de: 'const metros = crudo < 100 ? Math.max(10, Math.round(crudo)) : Math.round(crudo / 10) * 10;', a: 'const metros = Math.round(crudo / 10) * 10;', que: 'redondeo del hero' },
  { archivo: 'src/phone-map.ts', de: 'const RADIO_CERCA_M = 2000;', a: 'const RADIO_CERCA_M = 3000;', que: 'radio de «cerca» del chip' },
  { archivo: 'src/phone-map.ts', de: "node.style.display = i < ts.length ? '' : 'none';", a: "node.style.display = '';", que: 'buses sobrantes escondidos' },
  { archivo: 'src/phone-map.ts', de: 'const clamped = Math.max(0, Math.min(1, t));', a: 'const clamped = t;', que: 'punto acotado al recorrido' },
  // El panel de flota dibujado.
  { archivo: 'src/panel-flota.ts', de: "if (!bus.visible) return 'oculto';", a: "if (!bus.visible && false) return 'oculto';", que: 'oculto manda sobre el resto' },
  { archivo: 'src/panel-flota.ts', de: 'return bus.online && !bus.isGhost;', a: 'return bus.online;', que: 'en línea sin fantasmas' },
  { archivo: 'src/panel-flota.ts', de: 'return !bus.online || bus.isGhost;', a: 'return !bus.online;', que: 'sin señal con fantasmas' },
  { archivo: 'src/panel-flota.ts', de: 'this.#vacio.hidden = enLista.size > 0;', a: 'this.#vacio.hidden = true;', que: 'estado vacío de la lista' },
  { archivo: 'src/panel-flota.ts', de: 'if (placa) this.#bus(placa).visible = !this.#bus(placa).visible;', a: 'if (placa) this.#bus(placa).visible = false;', que: 'ocultar y volver a mostrar' },
  { archivo: 'src/panel-flota.ts', de: "this.#buses.every((b) => b.visible) ? '#fi-ocultar' : '#fi-mostrar'", a: "this.#buses.some((b) => b.visible) ? '#fi-ocultar' : '#fi-mostrar'", que: 'ícono de «todos»' },
  { archivo: 'src/panel-flota.ts', de: 'const fila = this.#filas.find((f) => f.dataset.bus === this.#elegido && !f.hidden);', a: 'const fila = this.#filas.find((f) => f.dataset.bus === this.#elegido);', que: 'foco al cerrar la ficha' },
  // Navegación, apariciones y reposo.
  { archivo: 'src/nav-island.ts', de: 'const MARGEN_MS = 120;', a: 'const MARGEN_MS = 60;', que: 'margen de cierre de la isla' },
  { archivo: 'src/nav-island.ts', de: 'window.scrollY <= 4', a: 'window.scrollY < 4', que: 'cabecera fundida arriba' },
  { archivo: 'src/scroll-effects.ts', de: 'if (entrada.boundingClientRect.bottom < 0) {', a: 'if (entrada.boundingClientRect.bottom > 0) {', que: 'lo que ya quedó arriba no se anima' },
  { archivo: 'src/scroll-effects.ts', de: "if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {", a: 'if (false) {', que: 'movimiento reducido sin apariciones' },
  { archivo: 'src/scroll-effects.ts', de: "if (ev.target !== el || ev.propertyName !== 'opacity') return;", a: 'if (ev.target !== el) return;', que: 'retirar al terminar la opacidad' },
  { archivo: 'src/reposo.ts', de: "entrada.target.classList.toggle('en-reposo', !entrada.isIntersecting);", a: "entrada.target.classList.toggle('en-reposo', entrada.isIntersecting);", que: 'reposo fuera de vista' },
  { archivo: 'src/problema.ts', de: 'else if (entrada.intersectionRatio <= ASOMO_SALE) this.#rebobinar();', a: 'else if (entrada.intersectionRatio < 0) this.#rebobinar();', que: 'rebobinar al salir' },
  { archivo: 'src/problema.ts', de: 'if (!sinMovimiento()) this.#esperarAQueAsome();', a: 'this.#esperarAQueAsome();', que: 'sin cambio solo con movimiento reducido' },
  { archivo: 'src/problema.ts', de: "this.#estado.style.setProperty('--recorte', `${Math.max(0, sobra / 2)}px`);", a: "this.#estado.style.setProperty('--recorte', `${Math.max(0, sobra)}px`);", que: 'el recorte de la píldora, la mitad a cada lado' },
  { archivo: 'src/problema.ts', de: 'x: e.offsetLeft + (celda?.offsetLeft ?? 0),', a: 'x: e.offsetLeft,', que: 'la píldora se mide desde el escenario, no desde su celda' },
  { archivo: 'src/escenario-red.ts', de: "pieza = recta === 1 ? 'tronco' : recta === rectas ? 'bajada' : 'viga';", a: "pieza = recta === 0 ? 'tronco' : recta === rectas ? 'bajada' : 'viga';", que: 'el árbol crece por piezas: la primera recta es el tronco' },
  { archivo: 'src/escenario-red.ts', de: 'l - o[i - 1] > MISMO_PUESTO', a: 'l - o[i - 1] > 0', que: 'dos avisos simétricos llegan a la vez aunque la píldora caiga en medio píxel' },
  // Lo que escribe la construcción.
  { archivo: 'vite.config.ts', de: "const ruta = ctx.path === '/index.html' ? '/' : ctx.path;", a: 'const ruta = ctx.path;', que: 'canonical de la portada' },
  { archivo: 'vite.config.ts', de: "sitio = String(config.env.VITE_SITE_URL ?? '').replace(/\\/+$/, '');", a: "sitio = String(config.env.VITE_SITE_URL ?? '');", que: 'barra final del dominio' },
  { archivo: 'vite.config.ts', de: "if (endpoint && !endpoint.startsWith('/')) {", a: 'if (false) {', que: 'endpoint externo contra el CSP' },
  { archivo: 'vite.config.ts', de: 'if (!conectar.includes(origen)) {', a: 'if (false) {', que: 'origen fuera de connect-src' },
  { archivo: 'vite.config.ts', de: "`    <priority>${ruta === '/' ? '1.0' : '0.3'}</priority>\\n` +", a: "`    <priority>0.5</priority>\\n` +", que: 'prioridad del sitemap' },
];

function correrSuite() {
  const r = spawnSync('npx', ['vitest', 'run'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const salida = `${r.stdout}${r.stderr}`;
  if (!salida.includes('Test Files')) return 'error';
  return r.status === 0 ? 'pasa' : 'falla';
}

function main() {
  const archivos = [...new Set(MUTACIONES.map((m) => m.archivo))];
  const sucio = spawnSync('git', ['status', '--porcelain', '--', ...archivos], { cwd: ROOT, encoding: 'utf8' });
  if (sucio.status !== 0 || sucio.stdout.trim()) {
    console.error('Hay cambios sin commitear en lo que se muta: la prueba de fuego no corre así.');
    process.exit(2);
  }
  const solo = process.argv.find((a) => a.startsWith('--solo='))?.slice(7).split(',').map(Number);
  const elegidas = MUTACIONES.map((m, i) => ({ ...m, n: i + 1 })).filter((m) => !solo || solo.includes(m.n));

  let original = null;
  let ruta = null;
  const deshacer = () => { if (ruta && original !== null) writeFileSync(ruta, original); };
  for (const senal of ['SIGINT', 'SIGTERM']) process.on(senal, () => { deshacer(); process.exit(130); });

  const sobreviven = [];
  const rotas = [];
  for (const m of elegidas) {
    ruta = join(ROOT, m.archivo);
    original = readFileSync(ruta, 'utf8');
    if (original.split(m.de).length !== 2) throw new Error(`#${m.n} no aplica: «${m.de}» no está una sola vez en ${m.archivo}`);
    const inicio = Date.now();
    try {
      writeFileSync(ruta, original.replace(m.de, m.a));
      const r = correrSuite();
      const s = ((Date.now() - inicio) / 1000).toFixed(0);
      const rotulo = { pasa: 'SOBREVIVE', falla: 'muere    ', error: 'NO CORRIÓ' }[r];
      console.log(`${rotulo}  #${String(m.n).padStart(2)}  ${m.que}  (${s} s)`);
      if (r === 'pasa') sobreviven.push(m);
      if (r === 'error') rotas.push(m);
    } finally {
      deshacer();
      original = null;
    }
  }
  const muertas = elegidas.length - sobreviven.length - rotas.length;
  console.log(`\n${muertas} de ${elegidas.length} mutaciones las detecta la suite.`);
  for (const m of sobreviven) console.log(`  sobrevive #${m.n} ${m.archivo}: ${m.que}`);
  for (const m of rotas) console.log(`  no corrió #${m.n} ${m.archivo}: ${m.que}`);
  if (sobreviven.length || rotas.length) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
