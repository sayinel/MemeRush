# 조합판에서 사장님이 맞춘 배너 조각 위치(out/layout_banner_next_ep.json)를 읽어 banner_next_ep.png를 다시 만든다.
# 사용: python render_banner.py  (저장 파일이 없으면 layout_banner_next_ep.ts의 초기값으로 만든다)
import json, os, re, io
from PIL import Image, ImageDraw, ImageFont

here = os.path.dirname(os.path.abspath(__file__))
game = os.path.normpath(os.path.join(here, "..", "..", "web", "public", "game"))
lay_ts = os.path.normpath(os.path.join(here, "..", "..", "web", "src", "game", "layout_banner_next_ep.ts"))
saved = os.path.join(here, "out", "layout_banner_next_ep.json")

def initial():
    t = io.open(lay_ts, encoding="utf-8").read()
    out = {}
    for m in re.finditer(r"^\s{2}(\w+): \{ ([^}]*) \}", t, re.M):
        out[m.group(1)] = {k: float(v) for k, v in re.findall(r"(\w+): (-?[\d.]+)", m.group(2))}
    return out

L = initial()
if os.path.exists(saved):
    for k, v in json.load(open(saved, encoding="utf-8")).items():
        L.setdefault(k, {}).update(v)
plate = L["banner_plate"]
PW, PH = int(round(plate["w"])), int(round(plate["h"]))
ox, oy = plate["x"] - plate["w"] / 2, plate["y"] - plate["h"] / 2
img = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
base = Image.open(os.path.join(game, "banner_plate.png")).convert("RGBA").resize((PW, PH), Image.LANCZOS)
img.alpha_composite(base)

def paste(name, src):
    e = L[name]
    pic = Image.open(os.path.join(game, src)).convert("RGBA")
    w, h = int(round(e["w"])), int(round(e["h"]))
    pic.thumbnail((w, h), Image.LANCZOS)
    cx, cy = e["x"] - ox, e["y"] - oy
    img.alpha_composite(pic, (int(round(cx - pic.width / 2)), int(round(cy - pic.height / 2))))

def font(size, weight):
    f = ImageFont.truetype("C:/Windows/Fonts/NotoSansKR-VF.ttf", int(round(size)))
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f

def text(name, s, color, weight):
    e = L[name]
    d = ImageDraw.Draw(img)
    cx, cy = e["x"] - ox, e["y"] - oy
    left = cx - e["w"] / 2
    d.text((left, cy), s, font=font(e["font"], weight), fill=color, anchor="lm")

import sys
EN = "--lang" in sys.argv and sys.argv[sys.argv.index("--lang") + 1] == "en"
# 문구(2026-11-02 핏, 영어판 추가: 사장님 '화면은 영어'. 영어 문구는 초안이고 마야와 후킹 문구를 다듬는다)
COPY = {
    "ko": ("NEXT #002", "달고나 뽑기 2탄", "깨뜨리지 않고 따낼 수 있을까? ›"),
    "en": ("NEXT #002", "DALGONA CHALLENGE", "Can you carve it without cracking? ›"),
}["en" if EN else "ko"]

def fit_text(name, s, color, weight):
    """상자 너비(w)를 넘으면 글자 크기를 줄여 맞춘다(영어 문구가 한국어보다 길어서)."""
    e = L[name]
    size = e["font"]
    while size > 12 and ImageDraw.Draw(img).textlength(s, font=font(size, weight)) > e["w"]:
        size -= 1
    L[name] = dict(e, font=size)
    text(name, s, color, weight)

paste("banner_disc", "dalgona_disc_umbrella.png")
paste("banner_hero", "worker_oc_sweating.png")
fit_text("t_next", COPY[0], (254, 222, 37, 255), 900)
fit_text("t_name", COPY[1], (255, 255, 255, 255), 800)
fit_text("t_sub", COPY[2], (190, 215, 255, 255), 600)
img.save(os.path.join(game, "banner_next_ep_en.png" if EN else "banner_next_ep.png"))
print("rendered", "en" if EN else "ko", img.size)
