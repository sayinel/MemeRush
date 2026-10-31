"use client";
import { useState } from "react";

type Choice = { key: string; label: string };
const btn = "flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#FF6A2B] px-4 text-lg font-extrabold text-[#140C09]";
const ghost = "flex min-h-11 items-center justify-center text-base text-[#FFB547] underline";

export default function VoteClient({ choice, choices, refId, todayUrl }: { choice: Choice | null; choices: Choice[]; refId: string; todayUrl: string }) {
  const [picked, setPicked] = useState<Choice | null>(choice);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit() {
    if (!picked) return;
    setState("busy");
    try {
      const r = await fetch("/api/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice: picked.key, ref: refId || undefined }),
      });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  const wrap = "mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center gap-4 bg-[#140C09] px-5 py-8 text-[#FFF3E6]";

  if (state === "done") {
    return (
      <main className={wrap}>
        <h1 className="text-3xl font-extrabold">투표했어요</h1>
        <p className="text-base text-[#C9B8A6]">{picked?.label}에 한 표 보탰어요. 결과는 다음 밈레터에서 알려 드릴게요.</p>
        <a className={btn} href={todayUrl}>오늘의 게임 플레이</a>
      </main>
    );
  }

  if (!picked) {
    return (
      <main className={wrap}>
        <h1 className="text-3xl font-extrabold">다음 게임, 골라 주세요</h1>
        <p className="text-base text-[#C9B8A6]">가장 많이 나온 게임을 다음 밈러시로 만들어요.</p>
        {choices.map((c) => (
          <button key={c.key} type="button" className="flex min-h-14 w-full items-center rounded-2xl border-2 border-[#FF6A2B] px-4 text-left text-lg font-bold" onClick={() => setPicked(c)}>
            {c.label}
          </button>
        ))}
      </main>
    );
  }

  return (
    <main className={wrap}>
      <h1 className="text-3xl font-extrabold">이 게임에 투표할까요?</h1>
      <p className="rounded-2xl bg-[#1E1410] px-4 py-4 text-xl font-bold text-[#FFB547]">{picked.label}</p>
      <button type="button" className={btn} onClick={submit} disabled={state === "busy"}>
        {state === "busy" ? "보내는 중" : "투표하기"}
      </button>
      {state === "error" && <p role="alert" className="text-base text-[#FFB547]">잠시 후 다시 눌러 주세요.</p>}
      <button type="button" className={ghost} onClick={() => setPicked(null)}>다른 게임 보기</button>
    </main>
  );
}
