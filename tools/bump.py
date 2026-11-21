"""Stamp a build number onto every module/CSS URL so browsers never use stale cached code.
usage: python3 tools/bump.py <build>"""
import re, sys, pathlib
build = sys.argv[1]
root = pathlib.Path(__file__).resolve().parent.parent
for f in (root / 'src').glob('*.js'):
    s = f.read_text()
    s2 = re.sub(r"(from '\./[a-zA-Z0-9_]+\.js)(\?v=[^']*)?'", rf"\1?v={build}'", s)
    if s2 != s: f.write_text(s2)
idx = root / 'index.html'
s = idx.read_text()
s = re.sub(r'src/main\.js(\?v=[^"]*)?"', f'src/main.js?v={build}"', s)
s = re.sub(r'src/style\.css(\?v=[^"]*)?"', f'src/style.css?v={build}"', s)
s = re.sub(r'<small id="build">[^<]*</small>', f'<small id="build">build {build}</small>', s)
idx.write_text(s)
print('stamped build', build)
