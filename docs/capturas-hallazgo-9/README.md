# Hallazgo 9: el bus del mapa en vivo saltaba atrás

Para que el dueño apruebe el cambio antes de fusionarlo.

**Qué se ve.** Punto de espera a 700 m de la salida de la C16 (Granabastos),
puesto con las flechas. Zoom alrededor del punto, un cuadro cada 2 s,
22 s en total.

- **Antes** (`mapa-vivo-*-antes.png`): el bus de la derecha cruza el final del
  trazado y el mapa lo recoloca detrás del punto. A los 10 s y a los 20 s
  vuelve a estar donde estaba a los 0 s: salta atrás en bucle y nunca llega.
- **Después** (`mapa-vivo-*-despues.png`): el bus sigue por la calle, llega al
  punto (16–22 s) y lo pasa. La escena se repite sola cuando los dos buses ya
  pasaron el punto y están lejos (~70 s), como antes.

A 375 px (móvil) y 1440 px (escritorio). Nada más cambia: el arreglo toca
solo el paso de `t = 1` a `t = 0` en `src/mapa-vivo.ts`.
