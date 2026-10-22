"""
Newsreader's ascender (hhea and OS/2 typo, 1470 of 2000 units) sits below the
marks on its capitals (İ, Ö, Ü, Ğ, É reach ~1742), and iOS clips text at the
ascender, so "İlerleme" rendered as "Ilerleme". This writes copies of the
weights the app uses with the ascender raised above those marks.

Run from the repo root after changing the bundled weights (needs fonttools):
    python3 scripts/fonts/patch-newsreader.py
"""

from pathlib import Path

from fontTools.ttLib import TTFont

ASCENT = 1800  # above the tallest Latin capital mark (1742), with a little room
WEIGHTS = ["400Regular", "400Regular_Italic", "500Medium"]
SOURCE = Path("node_modules/@expo-google-fonts/newsreader")
OUT = Path("assets/fonts")

for weight in WEIGHTS:
    name = f"Newsreader_{weight}.ttf"
    font = TTFont(SOURCE / weight / name)
    font["hhea"].ascent = ASCENT
    font["OS/2"].sTypoAscender = ASCENT
    font["OS/2"].usWinAscent = max(font["OS/2"].usWinAscent, ASCENT)
    font.save(OUT / name)
    print(f"{OUT / name}: ascent {ASCENT}")
