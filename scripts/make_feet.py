"""Footprint icons for the SafeTrack map (left/right, walk/run, light/dark).

Each foot points up (north); the map rotates it to the direction of travel.
Drawn at 4x and scaled down for smooth edges. Filled with the SafeTrack green
(theme primary, 2026-11-08); walking is a bare foot, running a shoe print.

    python scripts/make_feet.py assets/map
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 96
S = SIZE * 4

# (fill, outline): theme primary in light mode (#15803D) and dark mode (#3DDC84).
PALETTES = {
    "": {"walk": ("#15803D", "#FFFFFF"), "run": ("#15803D", "#FFFFFF")},
    "-d": {"walk": ("#3DDC84", "#0D2A1E"), "run": ("#3DDC84", "#0D2A1E")},
}


def px(x, y):
    return (x * S, y * S)


def ell(draw, cx, cy, rx, ry, fill):
    draw.ellipse([px(cx - rx, cy - ry), px(cx + rx, cy + ry)], fill=fill)


def bare_foot(draw, fill, grow=0.0):
    """A left bare foot: heel, arch on the inner (right) side, ball, five toes."""
    g = grow
    ell(draw, 0.47, 0.80, 0.115 + g, 0.125 + g, fill)  # heel
    # waist: narrow on the inner side (arch), wider on the outer side
    draw.polygon([px(0.36 - g, 0.78), px(0.335 - g, 0.50), px(0.60 + g, 0.47), px(0.535 + g, 0.62), px(0.58 + g, 0.78)], fill=fill)
    ell(draw, 0.47, 0.43, 0.165 + g, 0.155 + g, fill)  # ball
    toes = [(0.585, 0.205, 0.062), (0.485, 0.18, 0.047), (0.405, 0.195, 0.041), (0.34, 0.225, 0.036), (0.29, 0.27, 0.031)]
    for cx, cy, r in toes:
        ell(draw, cx, cy, r + g, r * 1.12 + g, fill)


def sneaker(draw, fill, grow=0.0):
    """A left running-shoe print: one long rounded sole, slightly curved."""
    g = grow
    ell(draw, 0.48, 0.78, 0.13 + g, 0.15 + g, fill)
    draw.polygon([px(0.35 - g, 0.78), px(0.33 - g, 0.40), px(0.64 + g, 0.36), px(0.60 + g, 0.78)], fill=fill)
    ell(draw, 0.485, 0.30, 0.165 + g, 0.20 + g, fill)


def tread(draw, cut):
    """Tread bars cut out of the sneaker print."""
    for y in (0.22, 0.31, 0.40, 0.49):
        draw.rounded_rectangle([px(0.37, y), px(0.61, y + 0.035)], radius=0.02 * S, fill=cut)
    for y in (0.72, 0.81):
        draw.rounded_rectangle([px(0.40, y), px(0.57, y + 0.035)], radius=0.02 * S, fill=cut)


def make(gait, side, suffix):
    fill, outline = PALETTES[suffix][gait]
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw_fn = bare_foot if gait == "walk" else sneaker

    # soft shadow, then the outline (grown shape), then the fill
    draw_fn(ImageDraw.Draw(shadow), (0, 0, 0, 70), grow=0.03)
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.02))
    img.alpha_composite(shadow, (0, int(S * 0.012)))
    draw_fn(ImageDraw.Draw(img), outline, grow=0.022)
    draw_fn(ImageDraw.Draw(img), fill)
    if gait == "run":
        tread(ImageDraw.Draw(img), outline)

    if side == "r":
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    img.save(OUT / f"foot-{gait}-{side}{suffix}.png")


for gait in ("walk", "run"):
    for side in ("l", "r"):
        for suffix in PALETTES:
            make(gait, side, suffix)
print("ok", sorted(p.name for p in OUT.glob("foot-*.png")))
