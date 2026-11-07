#!/usr/bin/env python3
"""Favicon für Wrack Ikarus: Raumanzug-Helm mit cyanfarbenem Visier (16×16 Pixel-Art).
Schreibt nach public/: favicon.svg, favicon-32.png, favicon-48.png, apple-touch-icon.png (180×180).
Aufruf: python3 scripts/icons/make-icons.py   (braucht Pillow)"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public')

PAL = {
    'k': '#0b0e13',  # Umriss
    'w': '#ffffff', 'l': '#d7dde3', 'g': '#9aa6b2', 'd': '#56616e',
    'c': '#5fd3e6', 'C': '#227f92', 'v': '#b8f1fa',
    'a': '#ffb000', 'A': '#9a5d06',
}
HELM = [
    '.....kkkkkk.....',
    '...kklllllgkk...',
    '..klwwllllllgk..',
    '.klwllllllllggk.',
    '.kllkkkkkkkkkgk.',
    'klgkcccccccCCkgk',
    'kllkcvvccccCCkgk',
    'kalkcvcccccCCkdk',
    'kAlkccccccCCCkdk',
    'kllkcccccCCCCkdk',
    '.klgkkkkkkkkkdk.',
    '.kglllllllllddk.',
    '..kgdlllllllddk.',
    '..kkdddddddddk..',
    '.kddkkkkkkkkddk.',
    '.kkk........kkk.',
]
assert len(HELM) == 16 and all(len(r) == 16 for r in HELM)


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def sprite():
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(HELM):
        for x, ch in enumerate(row):
            if ch != '.':
                im.putpixel((x, y), rgb(PAL[ch]) + (255,))
    return im


def main():
    s = sprite()
    for n in (32, 48):
        s.resize((n, n), Image.NEAREST).save(os.path.join(OUT, f'favicon-{n}.png'))
    # Apple-Touch-Icon: dunkler Grund, Helm 9-fach, Warnstreifen unten
    bg = Image.new('RGBA', (180, 180), rgb('#0a0d12') + (255,))
    for x in range(180):
        for y in range(166, 180):
            if ((x + y) // 7) % 2 == 0:
                bg.putpixel((x, y), rgb('#ffb000') + (255,))
    big = s.resize((144, 144), Image.NEAREST)
    bg.alpha_composite(big, (18, 12))
    bg.convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))
    # SVG: ein Rechteck pro Pixel, scharf in jeder Größe
    rects = []
    for y, row in enumerate(HELM):
        x = 0
        while x < 16:
            ch = row[x]
            if ch == '.':
                x += 1
                continue
            w = 1
            while x + w < 16 and row[x + w] == ch:
                w += 1
            rects.append(f'<rect x="{x}" y="{y}" width="{w}" height="1" fill="{PAL[ch]}"/>')
            x += w
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">'
           + ''.join(rects) + '</svg>\n')
    open(os.path.join(OUT, 'favicon.svg'), 'w').write(svg)
    print('favicon.svg, favicon-32.png, favicon-48.png, apple-touch-icon.png geschrieben')


if __name__ == '__main__':
    main()
