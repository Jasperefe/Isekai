"""Recolor outfit base-color textures for Jasper and Victory.

usage: recolor.py <src_png> <out_png> <scheme> [size]
schemes: jasper (green -> navy), victory (browns -> blue/gold/white)
"""
import sys
import numpy as np
from PIL import Image


def rgb_to_hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1); mn = a.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r); gg = m & (mx == g) & ~rr; bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = ((b - r)[gg] / d[gg]) + 2
    h[bb] = ((r - g)[bb] / d[bb]) + 4
    h = h * 60
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def hsv_to_rgb(h, s, v):
    c = v * s
    hp = (h % 360) / 60
    x = c * (1 - np.abs(hp % 2 - 1))
    z = np.zeros_like(h)
    conds = [(hp < 1), (hp < 2), (hp < 3), (hp < 4), (hp < 5), (hp >= 5)]
    rgbs = [(c, x, z), (x, c, z), (z, c, x), (z, x, c), (x, z, c), (c, z, x)]
    r = np.select(conds, [t[0] for t in rgbs]); g = np.select(conds, [t[1] for t in rgbs]); b = np.select(conds, [t[2] for t in rgbs])
    mm = v - c
    return np.stack([r + mm, g + mm, b + mm], -1)


def main():
    src, out, scheme = sys.argv[1], sys.argv[2], sys.argv[3]
    size = int(sys.argv[4]) if len(sys.argv) > 4 else 1024
    im = Image.open(src).convert("RGB").resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    h, s, v = rgb_to_hsv(a)
    nh, ns, nv = h.copy(), s.copy(), v.copy()
    if scheme == "jasper":
        green = (h > 60) & (h < 170) & (s > 0.18)
        nh[green] = 222
        ns[green] = np.clip(s[green] * 0.85, 0, 0.75)
        nv[green] = v[green] * 0.72
    elif scheme == "victory":
        warm = (h < 60) | (h > 330)
        dark = warm & (v < 0.36) & (s > 0.2)          # dark brown cloth -> soft royal blue
        mid = warm & (v >= 0.36) & (s > 0.32)         # tan / leather -> gold
        light = (s <= 0.32) & (v > 0.5)               # cream -> clean white
        # Smooth out worn-leather blotches: blend each pixel's brightness with a blurred version.
        from PIL import ImageFilter
        vb = np.asarray(Image.fromarray((v * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255
        cloth = dark | mid
        vs = 0.25 * v + 0.75 * vb
        nh[cloth] = 214
        ns[cloth] = 0.42
        nv[cloth] = np.clip(0.42 + (vs[cloth] - 0.3) * 0.9, 0.3, 0.8)
        ns[light] = s[light] * 0.25; nv[light] = np.clip(v[light] * 1.12, 0, 1)
    rgb = hsv_to_rgb(nh, ns, nv)
    Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(out)


if __name__ == "__main__":
    main()
