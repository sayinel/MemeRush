# -*- coding: utf-8 -*-
"""밈러시 에셋 색인 생성기: 이미지(manifest.json)·효과음(public/sfx)·틀(timing_stop)을 한 장의 목록으로 만든다.
사용: python tools/asset_index.py [--episode mr-001]   결과: docs/asset_index.json
사장님 2026-11-01: 에셋·틀 라이브러리는 슈퍼라이브러리에 합쳐 올리고, 밈러시 에피소드 태깅으로 따로도 찾을 수 있어야 한다.
태그 규칙은 docs/ASSET_LIBRARY.md. 새 에셋을 만들면 이 파일을 다시 돌리고 에피소드·출처를 채운다.
"""
import argparse, glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web", "public")
OUT = os.path.join(ROOT, "docs", "asset_index.json")


def image_tags(key: str) -> list[str]:
    tags = ["image"]
    if key.startswith("worker_"):
        tags += ["protagonist", "emotion:" + key.split("_", 1)[1]]
    elif key.startswith("boss_"):
        tags += ["boss", "pose:" + key.split("_", 1)[1]]
    elif key.startswith("bg_"):
        tags += ["background"]
    else:
        tags += ["prop"]
    return tags


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--episode", default="mr-001")
    a = ap.parse_args()
    items = []

    manifest = json.load(open(os.path.join(WEB, "game", "manifest.json"), encoding="utf-8"))
    for key, fname in manifest.items():
        items.append({"id": f"img:{key}", "kind": "image", "file": f"web/public/game/{fname}", "tags": image_tags(key),
                      "episodes": [a.episode], "source": "new", "reuse": "candidate"})

    for path in sorted(glob.glob(os.path.join(WEB, "sfx", "**", "*.mp3"), recursive=True)):
        rel = os.path.relpath(path, WEB).replace("\\", "/")
        name = rel.split("/")[1]
        is_bgm = name == "bgm"
        label = "bgm" if is_bgm else re.sub(r"^\d+_", "", name)
        items.append({"id": f"sfx:{label}", "kind": "bgm" if is_bgm else "sfx", "file": f"web/public/{rel}",
                      "tags": ["bgm" if is_bgm else "sfx", "event:" + label], "episodes": [a.episode],
                      "source": "see web/public/sfx/SOURCES.md", "reuse": "candidate"})

    items.append({"id": "frame:timing_stop", "kind": "frame", "file": "docs/GAME_FRAME_SPEC.md",
                  "tags": ["frame", "timing", "tap"], "episodes": [a.episode], "source": "new", "reuse": "candidate"})

    json.dump({"episode_default": a.episode, "count": len(items), "items": items}, open(OUT, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print("asset_index:", len(items), "items ->", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
