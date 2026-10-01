"""Recorta las dos tipografías al alfabeto del español (T7.7).

Los `.woff2` de `scripts/fuentes-origen/` son el subconjunto `latin` de
Google, sin tocar (ver `src/assets/fonts/LICENCIA.md`). Ese `latin` trae
268 y 285 glifos para cubrir el francés, el alemán, el islandés…: Å, Æ,
Ð, Þ, ß y compañía, que esta página no escribe. Con Lighthouse móvil las
dos fuentes eran 104 KB delante del LCP en la red lenta, y la portada se
quedaba en 2,6 s con un tope de 2,5.

Aquí se quedan las letras de `LETRAS` y nada más. `pyftsubset` no toca el
dibujo de las que quedan —mismos contornos, mismas instrucciones de
hinting, mismo kerning y mismas variantes (`--layout-features=*`)—: lo
que se ve es idéntico, sólo pesa menos. Los ejes variables (grosor y, en
Bricolage, tamaño óptico) siguen enteros.

`LETRAS` no es la lista de lo que hoy hay escrito, que dejaría fuera la
primera «Ü» que alguien escriba: es el español entero, mayúsculas
acentuadas incluidas, más la puntuación tipográfica. Si un texto trae una
letra que no está, `tests/tipografias.test.ts` lo dice leyendo el `cmap`
de los ficheros recortados; entonces se suma aquí y se vuelve a correr.

Uso:  python3 scripts/subconjunto_fuentes.py   (hace falta fonttools y brotli:
      pip install fonttools brotli)
"""

from pathlib import Path
import subprocess

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "scripts" / "fuentes-origen"
DESTINO = RAIZ / "src" / "assets" / "fonts"

LETRAS = (
    "".join(chr(c) for c in range(0x20, 0x7F))  # ASCII imprimible
    + " "  # espacio que no parte
    + "ÁÉÍÓÚÜÑáéíóúüñ¡¿«»ªº°·×±©®™€"
    + "–—‘’‚“”„…•‹›−"
)

for origen in sorted(ORIGEN.glob("*.woff2")):
    subprocess.run(
        [
            "pyftsubset",
            str(origen),
            f"--text={LETRAS}",
            "--layout-features=*",
            "--flavor=woff2",
            f"--output-file={DESTINO / origen.name}",
        ],
        check=True,
    )
    print(f"{origen.name}: {origen.stat().st_size} → {(DESTINO / origen.name).stat().st_size} bytes")
