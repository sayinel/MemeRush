# usage: python compare.py <verifyDir>  -> per element: best (dx,dy) shift of the editor frame vs the game capture and residual diff
import json, re, sys, pathlib
import numpy as np
from PIL import Image
here = pathlib.Path(__file__).parent
vdir = pathlib.Path(sys.argv[1])
REF = {"round1": "countdown", "countdown": "countdown", "final_grabbed": "final_early"}
def layout(lid):
    txt = (here.parent.parent / "web/src/game" / f"layout_{lid}.ts").read_text(encoding="utf8")
    out = {}
    for m in re.finditer(r"^\s*(\w+): \{ (.*?) \}", txt, re.M):
        d = dict(kv.split(": ") for kv in m.group(2).split(", "))
        out[m.group(1)] = {k: float(v) for k, v in d.items()}
    return out
res = {}
for f in sorted(vdir.glob("frame_*.png")):
    sid = f.stem[6:]
    ref = here / "refs" / f"game_{REF.get(sid, sid)}.png"
    if not ref.exists():
        continue
    E = np.asarray(Image.open(f).convert("L"), dtype=np.float32)
    G = np.asarray(Image.open(ref).convert("L").resize((720, 1280)), dtype=np.float32)
    lay = layout("round1" if sid == "countdown" else sid)
    rows = []
    for n, v in lay.items():
        x0, y0 = int(v["x"] - v["w"] / 2), int(v["y"] - v["h"] / 2)
        if sid in ("play", "final_grabbed", "round1", "countdown") and n in ("hero", "drag_combo"):
            y0 = int(v["y"] - v["h"])
        x1, y1 = x0 + int(v["w"]), y0 + int(v["h"])
        x0, y0, x1, y1 = max(x0, 14), max(y0, 14), min(x1, 706), min(y1, 1266)
        if x1 - x0 < 8 or y1 - y0 < 8:
            continue
        best = (1e9, 0, 0)
        for dy in range(-14, 15, 2):
            for dx in range(-14, 15, 2):
                a = E[y0:y1, x0:x1]; b = G[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
                if a.shape != b.shape: continue
                d = float(np.abs(a - b).mean())
                if d < best[0]: best = (d, dx, dy)
        base = float(np.abs(E[y0:y1, x0:x1] - G[y0:y1, x0:x1]).mean())
        rows.append((n, round(base, 1), best[1], best[2], round(best[0], 1)))
    res[sid] = rows
    print(f"== {sid}")
    for n, base, dx, dy, d in sorted(rows, key=lambda r: -max(abs(r[2]), abs(r[3])))[:4]:
        print(f"   {n:16s} diff {base:5.1f}  best-shift dx={dx:+d} dy={dy:+d} (resid {d})")
json.dump(res, open(vdir / "compare.json", "w"))
