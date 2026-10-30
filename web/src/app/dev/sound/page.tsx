"use client";

import { useState } from "react";
import { play, SOUND_NAMES } from "@/game/sfx";

// Sound review page: every effect on its own button, so the team can listen and say what to change.
const LABEL: Record<string, string> = {
  go: "라운드 시작",
  tap: "버튼 누름",
  nice: "좋은 기록(nice)",
  perfect: "완벽(perfect)",
  early: "너무 일찍(보스 경보)",
  late: "너무 늦게",
  win: "최종 성공",
  lose: "최종 실패",
};

export default function SoundLab() {
  const [last, setLast] = useState("");
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", color: "#fff" }}>
      <h1 style={{ fontSize: 22 }}>밈러시 효과음 듣기</h1>
      <p style={{ opacity: 0.85 }}>버튼을 눌러 하나씩 들어 보세요. 무음 모드이면 소리가 안 납니다. 지금 소리는 코드로 만든 간단한 시안입니다.</p>
      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {SOUND_NAMES.map((n) => (
          <button
            key={n}
            onClick={() => {
              play(n, true);
              setLast(LABEL[n]);
            }}
            style={{ padding: "14px 16px", fontSize: 17, borderRadius: 12, border: "2px solid #fff", background: "rgb(0 0 0 / 0.4)", color: "#fff" }}
          >
            ▶ {LABEL[n]}
          </button>
        ))}
      </div>
      <p style={{ marginTop: 16 }}>{last && `방금: ${last}`}</p>
      <p style={{ marginTop: 24 }}>
        <a href="/c/2026-10-25?lang=ko&sound=1" style={{ color: "#ffd93b" }}>게임에서 소리 켜고 해 보기 →</a>
      </p>
    </main>
  );
}
