"use client";

import { useEffect, useState } from "react";
import { labBgmPreview, labCurrent, labEnabled, labPreview, labSetBgm, labSetSound } from "./sfx";

type Name = "go" | "tap" | "nice" | "perfect" | "early" | "late" | "win" | "lose";
type Item = { id: string; name: string; group: string };
type Manifest = { sfx: Item[]; bgm: { id: string; name: string }[] };

const EVENTS: { key: Name; label: string }[] = [
  { key: "go", label: "시작" },
  { key: "tap", label: "누름" },
  { key: "nice", label: "좋은 기록" },
  { key: "perfect", label: "완벽" },
  { key: "early", label: "너무 일찍" },
  { key: "late", label: "너무 늦게" },
  { key: "win", label: "최종 성공" },
  { key: "lose", label: "최종 실패" },
];

// Test-only panel (shown with ?sound=1 on wide screens): pick a candidate for each event and the music, hear it right away in the game.
export default function SoundLab() {
  const [show, setShow] = useState(false);
  const [man, setMan] = useState<Manifest | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [bgm, setBgm] = useState("");
  const [playingBgm, setPlayingBgm] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!labEnabled()) return;
    setShow(true);
    const cur = labCurrent();
    setPick(cur.sfx as Record<string, string>);
    setBgm(cur.bgm ?? "");
    fetch("/sfx/lab/manifest.json")
      .then((r) => r.json())
      .then((m: Manifest) => setMan(m))
      .catch(() => setMan({ sfx: [], bgm: [] }));
  }, []);

  if (!show || !man || man.sfx.length === 0) return null; // no candidate list shipped (the public build) = no panel
  const groups = [...new Set(man.sfx.map((i) => i.group))];
  const urlOf = (id: string) => `/sfx/lab/${id}.mp3`;
  const nameOf = (id: string) => man.sfx.find((i) => urlOf(i.id) === id)?.name ?? "기본(확정본)";

  const choose = (key: Name, id: string) => {
    const url = id ? urlOf(id) : "";
    labSetSound(key, url);
    setPick((p) => {
      const n = { ...p };
      if (url) n[key] = url;
      else delete n[key];
      return n;
    });
    if (url) labPreview(url);
  };
  const copy = async () => {
    const lines = [
      ...EVENTS.map((e) => `${e.label}: ${pick[e.key] ? nameOf(pick[e.key]) : "기본(확정본)"}`),
      `배경음악: ${bgm ? (man.bgm.find((b) => b.id === bgm)?.name ?? bgm) : "없음"}`,
    ];
    const text = `소리 조합\n${lines.join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setMsg("조합을 복사했어요. 핏에게 붙여 주세요.");
    } catch {
      setMsg(text);
    }
  };
  const reset = () => {
    EVENTS.forEach((e) => labSetSound(e.key, ""));
    labSetBgm("");
    setPick({});
    setBgm("");
    setPlayingBgm(false);
    setMsg("기본으로 되돌렸어요.");
  };

  const sel = "w-full rounded-md border border-white/40 bg-black/40 px-1.5 py-1 text-[12px] font-semibold text-white";
  const btn = "shrink-0 rounded-md border border-white/50 bg-white/15 px-2 py-1 text-[12px] font-bold";
  return (
    <section className="rounded-2xl border border-white/30 bg-black/45 p-3 text-[12px] leading-snug">
      <p className="mb-2 text-[13px] font-black">소리 조합 (시험)</p>
      <div className="space-y-2">
        {EVENTS.map((e) => (
          <label key={e.key} className="block">
            <span className="mb-0.5 block opacity-80">{e.label}</span>
            <span className="flex gap-1">
              <select className={sel} value={pick[e.key] ? pick[e.key].replace("/sfx/lab/", "").replace(".mp3", "") : ""} onChange={(ev) => choose(e.key, ev.target.value)}>
                <option value="">기본(확정본)</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {man.sfx
                      .filter((i) => i.group === g)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <button type="button" className={btn} onClick={() => labPreview(pick[e.key] || `/sfx/${{ go: "01_go", tap: "02_tap", nice: "03_nice", perfect: "04_perfect", early: "05_early", late: "06_late", win: "07_win", lose: "08_lose" }[e.key]}/pick.mp3`)} aria-label={`${e.label} 듣기`}>
                ▶
              </button>
            </span>
          </label>
        ))}
        <label className="block">
          <span className="mb-0.5 block opacity-80">배경음악</span>
          <span className="flex gap-1">
            <select
              className={sel}
              value={bgm}
              onChange={(ev) => {
                labSetBgm(ev.target.value);
                setBgm(ev.target.value);
                setPlayingBgm(false);
              }}
            >
              <option value="">없음</option>
              {man.bgm.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={btn}
              onClick={() => {
                labBgmPreview(!playingBgm);
                setPlayingBgm(!playingBgm);
              }}
              aria-label="배경음악 듣기"
            >
              {playingBgm ? "■" : "▶"}
            </button>
          </span>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className={btn} onClick={copy}>
          조합 복사
        </button>
        <button type="button" className={btn} onClick={reset}>
          기본으로
        </button>
      </div>
      {msg && <p className="mt-2 whitespace-pre-line text-[11px] opacity-90">{msg}</p>}
    </section>
  );
}
