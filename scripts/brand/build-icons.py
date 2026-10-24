"""
The PageStreak icon: seven books on a shelf, the seventh (today, marigold) leaning
on the other six. The geometry below is the single source: this script writes the
SVG masters in assets/brand/ and every PNG the app ships (iOS light/dark/tinted app
icons, the iOS and Android splash logos, Android launcher icons, the in-app logo,
the favicon). Pillow draws at 4x and downsamples, so no SVG renderer is needed.

Run from the repo root after changing the icon (needs Pillow):
    python3 scripts/brand/build-icons.py
"""

from pathlib import Path

from PIL import Image, ImageCms, ImageDraw

# Folio palette (themes/colors.ts)
PALETTES = {
    "light": {"bg": "#1F5A3D", "book": "#F5F1E8", "today": "#D9A441"},
    "dark": {"bg": "#1B1A17", "book": "#EDE7DA", "today": "#E0AE4E"},
    # iOS tints this by luminance: today brightest, the shelf a step down
    "tinted": {"bg": "#000000", "book": "#A6A6A6", "today": "#FFFFFF"},
}

# On a 1024 grid. Books: (x, width, top, [(band top, band height), ...]), all standing on SHELF_Y.
SHELF_Y = 772
BOOKS = [
    (133, 84, 442, [(482, 14), (512, 14)]),
    (227, 64, 392, [(438, 14)]),
    (301, 96, 422, [(458, 14), (488, 14)]),
    (407, 72, 352, [(402, 14)]),
    (489, 88, 322, [(362, 14), (392, 14)]),
    (587, 68, 292, [(340, 14)]),
]
# Today's book stands at LEAN_X and tips left by LEAN_DEG about its bottom-left corner,
# until it rests on the sixth book.
LEAN_X, LEAN_W, LEAN_TOP, LEAN_BANDS, LEAN_DEG = 795, 100, 232, [(288, 18), (324, 18)], 16
SHELF = (109, SHELF_Y, 806, 30)  # x, y, width, height (fully rounded)
SPINE_RADIUS = 14
ICON_RADIUS = 0.2237  # iOS app-icon corner, as a share of the side

SCALE = 4
BRAND = Path("assets/brand")
IMAGES = Path("assets/images")
IOS = Path("ios/PageStreak/Images.xcassets")
ANDROID = Path("android/app/src/main/res")
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
# Untagged PNGs are drawn as Display P3 on iOS (the splash forest came out #005C3A), so tag every file sRGB
SRGB = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


# ---- SVG masters ----

def spine_path(x, w, top):
    r = SPINE_RADIUS
    return (f"M{x} {SHELF_Y} V{top + r} Q{x} {top} {x + r} {top} "
            f"H{x + w - r} Q{x + w} {top} {x + w} {top + r} V{SHELF_Y} Z")


def svg(palette, background=True):
    c = PALETTES[palette]
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">']
    if background:
        out.append(f'<rect width="1024" height="1024" fill="{c["bg"]}"/>')
    for x, w, top, bands in BOOKS:
        out.append(f'<path d="{spine_path(x, w, top)}" fill="{c["book"]}"/>')
        out += [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c["bg"]}"/>' for y, h in bands]
    out.append(f'<g transform="rotate({-LEAN_DEG} {LEAN_X} {SHELF_Y})">')
    out.append(f'<path d="{spine_path(LEAN_X, LEAN_W, LEAN_TOP)}" fill="{c["today"]}"/>')
    out += [f'<rect x="{LEAN_X}" y="{y}" width="{LEAN_W}" height="{h}" fill="{c["bg"]}"/>' for y, h in LEAN_BANDS]
    out.append("</g>")
    sx, sy, sw, sh = SHELF
    out.append(f'<rect x="{sx}" y="{sy}" width="{sw}" height="{sh}" rx="{sh // 2}" fill="{c["book"]}"/>')
    out.append("</svg>\n")
    return "\n".join(out)


# ---- Raster ----

def s(v):
    return round(v * SCALE)


def draw_book(draw, x, w, top, bands, fill, band_fill):
    draw.rounded_rectangle((s(x), s(top), s(x + w) - 1, s(SHELF_Y) - 1), radius=s(SPINE_RADIUS),
                           fill=fill, corners=(True, True, False, False))
    for y, h in bands:
        draw.rectangle((s(x), s(y), s(x + w) - 1, s(y + h) - 1), fill=band_fill)


def glyph(palette, background=True):
    """The icon at 1024 px: full-bleed square, or the books alone on transparent."""
    c = PALETTES[palette]
    size = s(1024)
    img = Image.new("RGBA", (size, size), c["bg"] if background else (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for x, w, top, bands in BOOKS:
        draw_book(draw, x, w, top, bands, c["book"], c["bg"])
    lean = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_book(ImageDraw.Draw(lean), LEAN_X, LEAN_W, LEAN_TOP, LEAN_BANDS, c["today"], c["bg"])
    # PIL rotates counter-clockwise for positive angles: the top tips left
    lean = lean.rotate(LEAN_DEG, resample=Image.BICUBIC, center=(s(LEAN_X), s(SHELF_Y)))
    img.alpha_composite(lean)
    sx, sy, sw, sh = SHELF
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((s(sx), s(sy), s(sx + sw) - 1, s(sy + sh) - 1), radius=s(sh / 2), fill=c["book"])
    return img.resize((1024, 1024), Image.LANCZOS)


def rounded(img):
    """The icon with transparent iOS-style corners (for in-app and splash use)."""
    big = img.resize((s(1024), s(1024)), Image.LANCZOS)
    mask = Image.new("L", big.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big.width - 1, big.height - 1), radius=round(big.width * ICON_RADIUS), fill=255)
    big.putalpha(mask)
    return big.resize((1024, 1024), Image.LANCZOS)


def circle(img):
    big = img.resize((s(1024), s(1024)), Image.LANCZOS)
    mask = Image.new("L", big.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big.width - 1, big.height - 1), fill=255)
    big.putalpha(mask)
    return big.resize((1024, 1024), Image.LANCZOS)


def padded(img, share):
    """img scaled to `share` of a transparent square of the same size, centred."""
    inner = round(1024 * share)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    canvas.alpha_composite(img.resize((inner, inner), Image.LANCZOS), ((1024 - inner) // 2,) * 2)
    return canvas


def save(img, path, size=None, opaque=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    if opaque:
        img = img.convert("RGB")  # App Store icons must not have an alpha channel
    if path.suffix == ".webp":
        img.save(path, "WEBP", lossless=True, icc_profile=SRGB)
    else:
        img.save(path, optimize=True, icc_profile=SRGB)
    print(path)


def main():
    BRAND.mkdir(exist_ok=True)
    for palette in PALETTES:
        name = "icon.svg" if palette == "light" else f"icon-{palette}.svg"
        (BRAND / name).write_text(svg(palette))
        print(BRAND / name)

    light, dark, tinted = (glyph(p) for p in ("light", "dark", "tinted"))
    logo = rounded(light)

    # iOS app icon (Contents.json lists the dark and tinted appearances)
    appicon = IOS / "AppIcon.appiconset"
    save(light, appicon / "App-Icon-1024x1024@1x.png", opaque=True)
    save(dark, appicon / "App-Icon-Dark-1024x1024@1x.png", opaque=True)
    save(tinted, appicon / "App-Icon-Tinted-1024x1024@1x.png", opaque=True)

    # Expo config and in-app images
    save(light, IMAGES / "icon.png", opaque=True)
    save(logo, IMAGES / "Logo.png")
    save(logo, IMAGES / "favicon.png", size=48)

    # Android adaptive foreground: the books alone inside the 66 dp safe circle,
    # on the forest background colour (app.json / colors.xml iconBackground)
    foreground = padded(glyph("light", background=False), 0.66)
    save(foreground, IMAGES / "adaptive-icon.png")
    for density, factor in DENSITIES.items():
        mipmap = ANDROID / f"mipmap-{density}"
        save(foreground, mipmap / "ic_launcher_foreground.webp", size=round(108 * factor))
        save(logo, mipmap / "ic_launcher.webp", size=round(48 * factor))
        save(circle(light), mipmap / "ic_launcher_round.webp", size=round(48 * factor))

    # Splash logos (on the paper splash background)
    for scale, size in ((1, 200), (2, 400), (3, 600)):
        suffix = "" if scale == 1 else f"@{scale}x"
        save(logo, IOS / "SplashScreenLogo.imageset" / f"image{suffix}.png", size=size)
    splash = padded(logo, 0.66)
    for density, factor in DENSITIES.items():
        save(splash, ANDROID / f"drawable-{density}" / "splashscreen_logo.png", size=round(288 * factor))


if __name__ == "__main__":
    main()
