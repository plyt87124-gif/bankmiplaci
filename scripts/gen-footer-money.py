"""
Generates public/dekoracje/pieniadze-kontury.png: faint outlines of the real Polish banknotes and coins used as the
background of the footer (CSS mask in src/app/globals.css, class .footer-money).

SOURCE IMAGES (not committed - they belong to NBP; folder is git-ignored): the official images published by
Narodowy Bank Polski on https://nbp.pl/banknoty-i-monety/banknoty-obiegowe/ (fronts, 300 px wide, already marked
WZOR) and https://nbp.pl/banknoty-i-monety/monety-obiegowe/ (nine circulating coins). Put them in
materialy/nbp-wizerunki/ under the names listed below.

About NBP's "Dobre praktyki w zakresie reprodukcji wizerunkow banknotow i monet" (nbp.pl/banknoty-i-monety/
wykorzystanie-wizerunkow/): this follows what is possible of them - one side only, banknotes shown at ~50-60% of
their real size, source images at 300 px (< 72 dpi), the diagonal WZOR of the official images is kept, coins keep
their proportions. It does NOT satisfy the ban on using banknote images as a decoration/background; the site owner
decided to do it anyway (2026-10-29).

    python scripts/gen-footer-money.py
"""
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "..", "materialy", "nbp-wizerunki")
OUT = os.path.join(HERE, "..", "public", "dekoracje", "pieniadze-kontury.png")
W, H = 1000, 560

NOTES = {
    10: "10-zl-Awers-300x150.jpg",
    20: "20_em-2025_awers-300x150.jpg",
    50: "50-zl-300x150.jpg",
    100: "100-wzor-300x150.jpg",
    200: "200-front-300x150.jpg",
    500: "500-wzor-1-300x149.jpg",
}
# (file, real diameter in mm)
COINS = {
    "1gr": ("1-gr-rewers-copy.jpg", 15.5),
    "2gr": ("2-gr-rewers-copy.jpg", 17.5),
    "5gr": ("5-gr-awers-copy.jpg", 19.5),
    "10gr": ("10-gr-rewers-copy.jpg", 16.5),
    "20gr": ("20-gr-rewers-copy.jpg", 18.5),
    "50gr": ("50-gr-rewers-copy.jpg", 20.5),
    "1zl": ("1-zl-rewers-copy-1.jpg", 23.0),
    "2zl": ("2-zl-rewers-1.jpg", 21.5),
    "5zl": ("5-zl-rewers_ok-1.jpg", 24.0),
}
COIN_PX_PER_MM = 3.7


def edges(img, blur, gain, floor):
    """Bright lines on black: the edges of the picture."""
    g = ImageOps.autocontrast(img.convert("L"), cutoff=1).filter(ImageFilter.GaussianBlur(blur))
    e = g.filter(ImageFilter.FIND_EDGES)
    e = ImageOps.autocontrast(e, cutoff=0.5)
    return e.point(lambda v: max(0, min(255, int((v - floor) * gain))))


def place(canvas, piece, cx, cy, rot=0):
    """Add `piece` (L image) onto the canvas centred on (cx, cy), rotated."""
    if rot:
        piece = piece.rotate(rot, resample=Image.BICUBIC, expand=True)
    layer = Image.new("L", canvas.size, 0)
    layer.paste(piece, (int(cx - piece.width / 2), int(cy - piece.height / 2)))
    return ImageChops.lighter(canvas, layer)


def note(canvas, value, cx, cy, width, rot):
    img = Image.open(os.path.join(SRC, NOTES[value])).convert("RGB")
    h = round(width * img.height / img.width)
    img = img.resize((width, h), Image.LANCZOS)
    line = edges(img, 0.9, 3.6, 24)
    # the red diagonal WZOR of the official image: outline it too, at full strength, so the marking survives
    r, g, b = img.split()
    red = ImageChops.subtract(r, ImageChops.add(g, b, scale=2.0)).point(lambda v: 255 if v > 55 else 0)
    wzor = red.filter(ImageFilter.GaussianBlur(0.6)).filter(ImageFilter.FIND_EDGES).point(lambda v: min(255, v * 4))
    return place(canvas, ImageChops.lighter(line, wzor), cx, cy, rot)


def coin(canvas, key, cx, cy, rot=0):
    name, mm = COINS[key]
    d = round(mm * COIN_PX_PER_MM)
    img = Image.open(os.path.join(SRC, name)).convert("RGB").resize((d * 2, d * 2), Image.LANCZOS)
    e = edges(img, 1.6, 7.0, 10).resize((d, d), Image.LANCZOS)
    circle = Image.new("L", (d * 4, d * 4), 0)
    ImageDraw.Draw(circle).ellipse((d * 0.06, d * 0.06, d * 3.94, d * 3.94), fill=255)
    circle = circle.resize((d, d), Image.LANCZOS)
    e = ImageChops.multiply(e, circle)
    return place(canvas, e, cx, cy, rot)


canvas = Image.new("L", (W, H), 0)
# row 1
canvas = note(canvas, 500, 170, 112, 300, -4)
canvas = coin(canvas, "5zl", 388, 86, 12)
canvas = note(canvas, 20, 580, 100, 236, 4)
canvas = coin(canvas, "1gr", 746, 52)
canvas = note(canvas, 100, 872, 130, 262, -4)
# row 2
canvas = coin(canvas, "1zl", 70, 300, -8)
canvas = note(canvas, 50, 292, 340, 262, 3)
canvas = coin(canvas, "2zl", 492, 292, 20)
canvas = note(canvas, 200, 676, 350, 252, -4)
canvas = coin(canvas, "50gr", 838, 290, 0)
canvas = coin(canvas, "2gr", 936, 372, 30)
# row 3
canvas = coin(canvas, "5gr", 70, 500, 0)
canvas = note(canvas, 10, 250, 502, 226, -3)
canvas = coin(canvas, "20gr", 430, 490, 15)
canvas = coin(canvas, "10gr", 560, 518, 0)
canvas = coin(canvas, "1gr", 660, 480, 40)
canvas = note(canvas, 100, 830, 505, 226, 3)

# alpha mask: black with the edge strength as alpha, in few levels so that the PNG stays small
alpha = canvas.point(lambda v: (v // 12) * 12)
out = Image.merge("RGBA", (Image.new("L", (W, H), 0),) * 3 + (alpha,))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
out.save(OUT, optimize=True)
print("written", os.path.normpath(OUT), os.path.getsize(OUT) // 1024, "KB")
