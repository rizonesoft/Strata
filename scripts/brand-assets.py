#!/usr/bin/env python3
"""Build every Strata brand asset in assets/brand from the geometry in this file.

The mark, the palette and the layouts are defined once here and written out as SVG (text outlined to paths,
so no file depends on an installed font) and as PNG and ICO renders. Run it after changing anything below:

    python scripts/brand-assets.py

Needs Pillow and fontTools. The fonts are the committed files in assets/fonts (SIL Open Font License).
"""
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "brand"
FONTS = ROOT / "assets" / "fonts"

BEDROCK, TILE, SLATE, SILT, OCHRE, CHALK, STONE = (
    "#0E1420", "#1A2333", "#5B6B82", "#C9D3E0", "#E0A340", "#F5F6F8", "#8E9BB0")

# The mark on a 96 unit grid: (x, y, width, height, fill). The ochre band sits 10 units out of line.
BANDS = [(18, 19, 52, 8, SILT), (18, 31, 52, 12, SLATE), (28, 47, 52, 9, OCHRE), (18, 60, 52, 6, SLATE),
         (18, 70, 52, 8, STONE)]
BANDS_SMALL = [(16, 18, 54, 14, SILT), (26, 41, 54, 14, OCHRE), (16, 64, 54, 14, STONE)]  # 16 and 24 px
TRACKING = 0.14  # the wordmark's letter spacing, in em

# name -> (file, variation axes for fontTools, axis values for Pillow in the font's own axis order)
FACES = {
    "display": ("SpaceGrotesk-Variable.ttf", {"wght": 700}, [700.0]),
    "display-medium": ("SpaceGrotesk-Variable.ttf", {"wght": 500}, [500.0]),
    "body": ("Inter-Variable.ttf", {"opsz": 24, "wght": 400}, [24.0, 400.0]),
}
_instances = {}


def face(name):
    if name not in _instances:
        file, axes, _ = FACES[name]
        _instances[name] = instancer.instantiateVariableFont(TTFont(FONTS / file), axes)
    return _instances[name]


def num(value):
    return f"{value:.2f}".rstrip("0").rstrip(".")


def text_path(name, text, size, x, baseline, tracking=0.0):
    """The outlines of `text` as one SVG path, and the width it takes."""
    font = face(name)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    pen = SVGPathPen(glyphs, ntos=num)
    cursor = x
    for index, char in enumerate(text):
        glyph = glyphs[cmap[ord(char)]]
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, baseline)))
        cursor += glyph.width * scale + (tracking * size if index < len(text) - 1 else 0)
    return pen.getCommands(), cursor - x


def mark(x, y, size, tile=None, small=False, fill=None):
    """The mark as primitives; `tile` draws the rounded square behind it, `fill` makes it one colour."""
    unit = size / 96
    out: list = [("rect", x, y, size, size, 20 * unit, tile)] if tile else []
    radius = 0 if small else 2 * unit
    for bx, by, bw, bh, colour in (BANDS_SMALL if small else BANDS):
        out.append(("rect", x + bx * unit, y + by * unit, bw * unit, bh * unit, radius, fill or colour))
    return out


def svg(prims, width, height, title, background=None):
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(width)} {num(height)}" '
             f'width="{num(width)}" height="{num(height)}" role="img" aria-label="{title}">',
             f"<title>{title}</title>"]
    if background:
        parts.append(f'<rect width="{num(width)}" height="{num(height)}" fill="{background}"/>')
    for prim in prims:
        if prim[0] == "rect":
            _, x, y, w, h, r, fill = prim
            rx = f' rx="{num(r)}"' if r else ""
            parts.append(f'<rect x="{num(x)}" y="{num(y)}" width="{num(w)}" height="{num(h)}"{rx} fill="{fill}"/>')
        else:
            _, name, text, size, x, baseline, fill, tracking = prim
            parts.append(f'<path d="{text_path(name, text, size, x, baseline, tracking)[0]}" fill="{fill}"/>')
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def png(prims, width, height, background=None, scale=1, supersample=4):
    """Render the same primitives with Pillow, drawn `supersample` times larger and scaled down."""
    k = scale * supersample
    image = Image.new("RGBA", (round(width * k), round(height * k)), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for prim in prims:
        if prim[0] == "rect":
            _, x, y, w, h, r, fill = prim
            box = [x * k, y * k, (x + w) * k - 1, (y + h) * k - 1]
            draw.rounded_rectangle(box, radius=r * k, fill=fill) if r else draw.rectangle(box, fill=fill)
        else:
            _, name, text, size, x, baseline, fill, tracking = prim
            file, _, axes = FACES[name]
            font = ImageFont.truetype(str(FONTS / file), round(size * k))
            font.set_variation_by_axes(axes)
            cursor = x * k
            for char in text:
                draw.text((cursor, baseline * k), char, font=font, fill=fill, anchor="ls")
                cursor += font.getlength(char) + tracking * size * k
    return image.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)


def wordmark(x, baseline, size, fill):
    return ("text", "display", "STRATA", size, x, baseline, fill, TRACKING)


def stack(right, top, heights, gap, width, colours, offset_index, offset):
    """The bands that run off the right edge of a banner."""
    out, y = [], top
    for index, (h, colour) in enumerate(zip(heights, colours)):
        shift = offset if index == offset_index else 0
        out.append(("rect", right - width - shift, y, width + shift + 8, h, 4, colour))
        y += h + gap
    return out


def social():
    prims: list = mark(80, 191, 88, tile=TILE) + [wordmark(192, 269, 96, CHALK)]
    prims.append(("text", "display-medium", "Digital forensics, layer by layer.", 40, 80, 350, CHALK, 0))
    prims.append(("text", "body", "Drill through file systems, shadow copies and unallocated space,", 22, 80,
                  411, SILT, 0))
    prims.append(("text", "body", "and rebuild what happened.", 22, 80, 444, SILT, 0))
    prims += stack(1280, 131, [46, 70, 52, 34, 46, 60], 14, 360, [SILT, SLATE, OCHRE, SLATE, STONE, "#2A364A"], 2, 72)
    return prims


def banner():
    prims: list = mark(72, 92, 136, tile=TILE) + [wordmark(248, 165, 76, CHALK)]
    prims.append(("text", "body", "Digital forensics, layer by layer.", 24, 248, 212, SILT, 0))
    prims += stack(1280, 84, [22, 34, 26, 16, 22], 8, 260, [SILT, SLATE, OCHRE, SLATE, STONE], 2, 48)
    return prims


def lockup(fill):
    size = 48
    width = text_path("display", "STRATA", size, 0, 0, TRACKING)[1]
    return mark(0, 0, 64) + [wordmark(84, 32 + 0.35 * size, size, fill)], 84 + width, 64


def write(name, data):
    path = OUT / name
    path.write_bytes(data.encode("utf-8")) if isinstance(data, str) else data.save(path)
    print(f"wrote {path.relative_to(ROOT).as_posix()}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    write("strata-icon.svg", svg(mark(0, 0, 96, tile=BEDROCK), 96, 96, "Strata icon"))
    write("strata-icon-small.svg", svg(mark(0, 0, 96, tile=BEDROCK, small=True), 96, 96, "Strata icon, small"))
    write("strata-mark.svg", svg(mark(0, 0, 96), 96, 96, "Strata mark"))
    write("strata-mark-mono.svg", svg(mark(0, 0, 96, fill="currentColor"), 96, 96, "Strata mark, one colour"))
    for suffix, fill in (("", BEDROCK), ("-light", CHALK)):
        width = text_path("display", "STRATA", 48, 0, 0, TRACKING)[1]
        write(f"strata-wordmark{suffix}.svg", svg([wordmark(0, 40.8, 48, fill)], width, 48, "Strata"))
        prims, w, h = lockup(fill)
        write(f"strata-lockup{suffix}.svg", svg(prims, w, h, "Strata"))
    write("social-preview.svg", svg(social(), 1280, 640, "Strata: digital forensics, layer by layer", BEDROCK))
    write("social-preview.png", png(social(), 1280, 640, BEDROCK, supersample=2).convert("RGB"))
    write("readme-banner.svg", svg(banner(), 1280, 320, "Strata: digital forensics, layer by layer", BEDROCK))
    write("readme-banner.png", png(banner(), 1280, 320, BEDROCK, supersample=2).convert("RGB"))
    renders = {}
    for size in (16, 24, 32, 48, 64, 128, 256, 512):
        renders[size] = png(mark(0, 0, 96, tile=BEDROCK, small=size < 32), 96, 96, scale=size / 96, supersample=8)
        if size != 24:
            write(f"strata-icon-{size}.png", renders[size])
    ico = OUT / "strata.ico"
    renders[256].save(ico, format="ICO", append_images=[renders[s] for s in (16, 24, 32, 48, 64, 128)],
                      sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
    print(f"wrote {ico.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
