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
  { archivo: 'src/contact-form.ts', de: 'if (!this.#form.reportValidity()) return;', a: 'if (this.#form.reportValidity()) return;', que: 'validación del formulario' },
  { archivo: 'src/contact-form.ts', de: 'if (this.#enviando) return;', a: 'if (false) return;', que: 'doble envío' },
  { archivo: 'src/contact-form.ts', de: "if (typeof valor === 'string') salida[clave] = valor.trim();", a: "if (typeof valor === 'string') salida[clave] = valor;", que: 'espacios sobrantes en los campos' },
  { archivo: 'src/contact-form.ts', de: 'if (!respuesta.ok) throw new Error', a: 'if (respuesta.ok) throw new Error', que: 'respuesta de error del servidor' },
  { archivo: 'src/contact-form.ts', de: "if (!ventana) throw new Error('El navegador bloqueó la ventana de WhatsApp');", a: 'if (!ventana) return;', que: 'WhatsApp bloqueado por el navegador' },
  { archivo: 'src/contact-form.ts', de: 'ventana.opener = null;', a: 'void ventana;', que: 'la pestaña de WhatsApp sin opener' },
  { archivo: 'src/contact-form.ts', de: 'encodeURIComponent(texto)', a: 'texto', que: 'el mensaje de WhatsApp codificado' },
  { archivo: 'src/contact-form.ts', de: 'if (whatsapp) {', a: 'if (!whatsapp) {', que: 'el éxito cuenta por dónde salió' },
  { archivo: 'src/contact-form.ts', de: 'this.#enlaceReabrir().href = whatsapp;', a: 'this.#enlaceReabrir().href = \'\';', que: 'el enlace para abrir WhatsApp otra vez lleva el mensaje' },
  { archivo: 'src/panel-flota.ts', de: "raiz.toggleAttribute('inert', movil.matches)", a: "raiz.toggleAttribute('inert', false)", que: 'la maqueta del panel inerte en el teléfono' },
  { archivo: 'src/por-ruta.ts', de: 'return largo - a < RUIDO_ATRAS ? 0 : a;', a: 'return a;', que: 'el ruido del GPS en la ruta circular' },
  { archivo: 'src/por-ruta.ts', de: 'if (d < 0) return d > -RUIDO_ATRAS ? 0 : null;', a: 'if (d < 0) return null;', que: 'el ruido del GPS en la ruta abierta' },
  { archivo: 'src/por-ruta.ts', de: 'if (todos[0].desvio > DESVIO_PUNTO_MAXIMO) return null;', a: '', que: 'punto lejos de la ruta cae a línea recta' },
  { archivo: 'src/contact-form.ts', de: 'this.#boton.disabled = true;', a: 'this.#boton.disabled = false;', que: 'botón bloqueado mientras envía' },
  { archivo: 'src/contact-form.ts', de: "this.#error.hidden = mensaje === '';", a: 'this.#error.hidden = false;', que: 'el error vacío se esconde' },
  // La cifra viva de la hoja.
  { archivo: 'src/cifra-viva.ts', de: "const clase = valor < previo ? 'cifra-baja' : 'cifra-sube';", a: "const clase = valor > previo ? 'cifra-baja' : 'cifra-sube';", que: 'dirección del cambio de cifra' },
  { archivo: 'src/cifra-viva.ts', de: 'if (!NUMERO.test(antes) || !NUMERO.test(texto)) {', a: 'if (!NUMERO.test(texto)) {', que: 'de texto a número sin animar' },
  { archivo: 'src/cifra-viva.ts', de: 'if (cifra !== antes[i + corrimiento]) span.className = clase;', a: 'span.className = clase;', que: 'solo se anima el dígito que cambia' },
  { archivo: 'src/cifra-viva.ts', de: "if (redondos < 1000) return [String(redondos), 'm de ti'];", a: "if (redondos <= 1000) return [String(redondos), 'm de ti'];", que: 'metros o kilómetros' },
  { archivo: 'src/cifra-viva.ts', de: "return [(metros / 1000).toFixed(1).replace('.', ','), 'km de ti'];", a: "return [(metros / 1000).toFixed(1), 'km de ti'];", que: 'coma decimal' },
  // El encaje de la escena en pantallas bajas.
  { archivo: 'src/encaje.ts', de: 'const MINIMO = 0.5;', a: 'const MINIMO = 0.25;', que: 'factor mínimo' },
  { archivo: 'src/encaje.ts', de: "if (marco.position !== 'sticky') return;", a: 'if (false) return;', que: 'sin pegado no se encaja' },
  { archivo: 'src/encaje.ts', de: 'if (libre <= 0) return;', a: 'if (libre < 0) return;', que: 'hueco de cero' },
  { archivo: 'src/encaje.ts', de: 'if (libre === libreVisto && alto === altoVisto) return;', a: 'if (libre === libreVisto) return;', que: 'el contenido creció' },
  { archivo: 'src/encaje.ts', de: 'if (ocupa <= libre) cabe = PASOS;', a: 'if (ocupa < libre) cabe = PASOS;', que: 'cabe justo a tamaño completo' },
  { archivo: 'src/encaje.ts', de: 'if (ocupa <= libre) cabe = i;', a: 'if (ocupa < libre) cabe = i;', que: 'cabe justo en la búsqueda' },
  // El selector de empresa y ruta.
  { archivo: 'src/selector.ts', de: 'return PALETA_EMPRESA[suma % PALETA_EMPRESA.length];', a: 'return PALETA_EMPRESA[(suma + 1) % PALETA_EMPRESA.length];', que: 'color de la empresa' },
  { archivo: 'src/selector.ts', de: "if (palabras.length === 0) return '?';", a: "if (palabras.length === 0) return '';", que: 'iniciales de un nombre vacío' },
  { archivo: 'src/selector.ts', de: 'if (claves.length === 0) return palabras[0][0].toUpperCase();', a: 'if (claves.length === 0) return palabras[0].slice(0, 2).toUpperCase();', que: 'iniciales solo de conectores' },
  { archivo: 'src/selector.ts', de: 'if (claves.length === 1) return claves[0].slice(0, 2).toUpperCase();', a: 'if (claves.length > 1) return claves[0].slice(0, 2).toUpperCase();', que: 'iniciales de una palabra' },
  { archivo: 'src/selector.ts', de: 'return (claves[0][0] + claves[1][0]).toUpperCase();', a: 'return (claves[0][0] + claves[0][1]).toUpperCase();', que: 'iniciales de dos palabras' },
  { archivo: 'src/selector.ts', de: "const CONECTORES = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y']);", a: "const CONECTORES = new Set(['de', 'la', 'el', 'los', 'las', 'y']);", que: 'conectores que no cuentan' },
  { archivo: 'src/selector.ts', de: 'const CODIGO_RUTA = /^[A-Z]{0,2}\\d{1,3}[A-Z]?$/;', a: 'const CODIGO_RUTA = /^[A-Z]{0,2}\\d{1,2}[A-Z]?$/;', que: 'código de ruta de tres cifras' },
  { archivo: 'src/selector.ts', de: 'if (palabras.length < 2 || !CODIGO_RUTA.test(palabras[0])) return null;', a: 'if (!CODIGO_RUTA.test(palabras[0])) return null;', que: 'ruta que es solo código' },
  { archivo: 'src/selector.ts', de: "filas.forEach((fila, i) => fila.style.setProperty('--i', String(Math.min(i, 5))));", a: "filas.forEach((fila, i) => fila.style.setProperty('--i', String(Math.min(i, 4))));", que: 'tope del escalón de filas' },
  // Los tres teléfonos de «Cómo funciona».
  { archivo: 'src/paso-demo.ts', de: 'const METROS_POR_SEGUNDO = 58;', a: 'const METROS_POR_SEGUNDO = 29;', que: 'velocidad del guion' },
  { archivo: 'src/paso-demo.ts', de: 'const RADIO_GUARDADO_M = 800;', a: 'const RADIO_GUARDADO_M = 900;', que: 'distancia que guarda el guion' },
  { archivo: 'src/paso-demo.ts', de: 'const RUEDA_M = Array.from({ length: 26 }, (_, i) => 500 + i * 100);', a: 'const RUEDA_M = Array.from({ length: 25 }, (_, i) => 500 + i * 100);', que: 'la rueda llega a 3 km' },
  { archivo: 'src/paso-demo.ts', de: '      this.#radioM = RADIO_GUARDADO_M;\n', a: '', que: 'guardar cambia la distancia' },
  { archivo: 'src/paso-demo.ts', de: "fila.classList.toggle('is-elegida', j === i)", a: "fila.classList.toggle('is-elegida', j === 5)", que: 'la fila elegida sigue a la rueda' },
  { archivo: 'src/paso-demo.ts', de: '(0.85 + i * 0.22)', a: '(0.85 - i * 0.22)', que: 'cada bus a su velocidad' },
  { archivo: 'src/paso-demo.ts', de: 'const dt = Math.min(0.05, (ahora - this.#ultimo) / 1000);', a: 'const dt = (ahora - this.#ultimo) / 1000;', que: 'tope del salto entre cuadros' },
  { archivo: 'src/paso-demo.ts', de: 'if (ahora - this.#refresco < 420) return;', a: 'if (ahora - this.#refresco <= 420) return;', que: 'refresco cada 420 ms' },
  { archivo: 'src/paso-demo.ts', de: 'this.#avisoPuesto && metros <= this.#radioM);', a: 'metros <= this.#radioM);', que: 'tarjeta solo con el aviso armado' },
  { archivo: 'src/paso-demo.ts', de: 'return metros < 100 ? Math.max(10, Math.round(metros)) : Math.round(metros / 10) * 10;', a: 'return Math.round(metros / 10) * 10;', que: 'redondeo de la cifra' },
  { archivo: 'src/paso-demo.ts', de: 'const muyCerca = m < 300;', a: 'const muyCerca = m <= 300;', que: 'coral bajo 300 m' },
  // El hero.
  { archivo: 'src/phone-simulator.ts', de: "if (metros < 300) return 'var(--app-coral-accessible)';", a: "if (metros < 200) return 'var(--app-coral-accessible)';", que: 'coral del hero' },
  { archivo: 'src/phone-simulator.ts', de: 'const dentro = this.#avisoActivo && metros <= this.#radioAvisoM;', a: 'const dentro = metros <= this.#radioAvisoM;', que: 'aviso del hero solo armado' },
  { archivo: 'src/phone-simulator.ts', de: 'const metros = crudo < 100 ? Math.max(10, Math.round(crudo)) : Math.round(crudo / 10) * 10;', a: 'const metros = Math.round(crudo / 10) * 10;', que: 'redondeo del hero' },
  { archivo: 'src/phone-map.ts', de: 'const RADIO_CERCA_M = 2000;', a: 'const RADIO_CERCA_M = 3000;', que: 'radio de «cerca» del chip' },
  { archivo: 'src/phone-map.ts', de: "node.style.display = i < ts.length ? '' : 'none';", a: "node.style.display = '';", que: 'buses sobrantes escondidos' },
  { archivo: 'src/phone-map.ts', de: 'const clamped = Math.max(0, Math.min(1, t));', a: 'const clamped = t;', que: 'punto acotado al recorrido' },
  // El mapa en vivo de la portada.
  { archivo: 'src/mapa-vivo.ts', de: 'const RADIO_AVISO_M = 1000;', a: 'const RADIO_AVISO_M = 1500;', que: 'radio del aviso (mapa)' },
  { archivo: 'src/mapa-vivo.ts', de: 'Math.max(100, Math.round(m / 100) * 100);', a: 'Math.max(10, Math.round(m / 10) * 10);', que: 'redondeo a la centena' },
  { archivo: 'src/mapa-vivo.ts', de: 'm < 1000 ? `${redondear(m)} m`', a: 'm <= 1000 ? `${redondear(m)} m`', que: 'metros o kilómetros (mapa)' },
  { archivo: 'src/mapa-vivo.ts', de: 'if (evento.button !== 0) return;', a: 'if (false) return;', que: 'solo el botón principal mueve el punto' },
  { archivo: 'src/mapa-vivo.ts', de: 'evento.preventDefault();', a: 'void evento;', que: 'las flechas no desplazan la página' },
  { archivo: 'src/mapa-vivo.ts', de: 'if (d < minimo) {', a: 'if (d > minimo) {', que: 'el punto más cercano de la ruta' },
  { archivo: 'src/mapa-vivo.ts', de: 'const lejos = this.#buses.every(b => b.metros > RADIO_AVISO_M * 2.4);', a: 'const lejos = this.#buses.some(b => b.metros > RADIO_AVISO_M * 2.4);', que: 'todos lejos para reponer' },
  { archivo: 'src/mapa-vivo.ts', de: 'return delta > 0 && delta < 0.5;', a: 'return delta > 0;', que: 'bus que ya pasó' },
  { archivo: 'src/mapa-vivo.ts', de: 'const cerca = this.#buses.reduce((a, b) => (b.metros < a.metros ? b : a));', a: 'const cerca = this.#buses.reduce((a, b) => (b.metros > a.metros ? b : a));', que: 'la lectura habla del bus más cercano' },
  { archivo: 'src/mapa-vivo.ts', de: 'const dentro = cerca.metros <= RADIO_AVISO_M;', a: 'const dentro = cerca.metros < RADIO_AVISO_M / 2;', que: 'dentro del radio' },
  { archivo: 'src/mapa-vivo.ts', de: 'if (dentro && !this.#avisado) {', a: 'if (dentro) {', que: 'el aviso suena una vez' },
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
  { archivo: 'src/paso-foco.ts', de: 'const avance = recorrido <= 0 ? 0 : topar(-caja.top / recorrido, 0, 1);', a: 'const avance = recorrido <= 0 ? 0 : topar(caja.top / recorrido, 0, 1);', que: 'avance de los pasos' },
  { archivo: 'src/paso-foco.ts', de: 'const indice = Math.min(total - 1, Math.floor(bruto));', a: 'const indice = Math.floor(bruto);', que: 'último paso al final' },
  { archivo: 'src/paso-foco.ts', de: 'if (indice === this.#actual) return;', a: 'if (false) return;', que: 'avisar solo al cambiar de paso' },
  { archivo: 'src/paso-foco.ts', de: 'if (!this.#dentro || this.#pedido) return;', a: 'if (this.#pedido) return;', que: 'fuera de vista no mide' },
  { archivo: 'src/paso-foco.ts', de: 'const PARADA = 0.25;', a: 'const PARADA = 0;', que: 'el rodillo se detiene en cada paso' },
  { archivo: 'src/paso-foco.ts', de: 'const x = topar(bruto - 0.5, 0, total - 1);', a: 'const x = topar(bruto, 0, total - 1);', que: 'el paso queda en el foco a su mitad' },
  { archivo: 'src/paso-foco.ts', de: 'return n + t * t * (3 - 2 * t);', a: 'return n + Math.round(t);', que: 'entre paradas sigue al dedo' },
  { archivo: 'src/paso-foco.ts', de: "marca.classList.toggle('is-activa', i === indice);", a: "marca.classList.toggle('is-activa', false);", que: 'el botón del paso que manda' },
  { archivo: 'src/reposo.ts', de: "entrada.target.classList.toggle('en-reposo', !entrada.isIntersecting);", a: "entrada.target.classList.toggle('en-reposo', entrada.isIntersecting);", que: 'reposo fuera de vista' },
  { archivo: 'src/problema.ts', de: 'else if (entrada.intersectionRatio <= ASOMO_SALE) this.#rebobinar();', a: 'else if (entrada.intersectionRatio < 0) this.#rebobinar();', que: 'rebobinar al salir' },
  { archivo: 'src/problema.ts', de: "if (cara === 'claro' && !sinMovimiento()) this.#ceremonia();", a: "if (cara === 'claro') this.#ceremonia();", que: 'sin ceremonia con movimiento reducido' },
  { archivo: 'src/problema.ts', de: 'if (ancho <= NUCLEO_PX) return;', a: 'if (false) return;', que: 'ancho mínimo del estado' },
  // Las cifras de rutas.
  { archivo: 'src/rutas.ts', de: 'const km = rutas.reduce((suma, r) => suma + r.km, 0);', a: 'const km = rutas.reduce((suma, r) => Math.max(suma, r.km), 0);', que: 'kilómetros totales' },
  { archivo: 'src/rutas.ts', de: 'const terminales = new Set(rutas.flatMap(r => [r.terminalA, r.terminalB]));', a: 'const terminales = new Set(rutas.flatMap(r => [r.terminalA]));', que: 'terminales distintos' },
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
