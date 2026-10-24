"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AdminState, PickKind, Topic } from "../_lib/types";
import { DATE_RANGE_DAYS, DOW, addDays, dowIndex, md } from "../_lib/week";

// 7단계. 사람 단계는 둥근 번호 칸, 자동 단계는 네모 칸.
const UI_STEPS = [
  { label: "주제 고르기", kind: "human" },
  { label: "틀·스토리 구성", kind: "auto" },
  { label: "문구 고르기", kind: "human" },
  { label: "이미지 제작", kind: "auto" },
  { label: "이미지 확정", kind: "human" },
  { label: "발행일 정하기", kind: "human" },
  { label: "배포·예약", kind: "auto" },
] as const;
// 화면 단계가 끝났다고 보는 파이프라인 단계. 6번(발행일)은 picks.publishDate 로 판단한다.
const GROUPS: string[][] = [["pick_topic"], ["cards"], ["pick_copy"], ["assets"], ["pick_image"], [], ["schedule", "publish"]];
const PREP = ["research", "pair", "brief"];
const WAIT_LABEL: Record<number, string> = { 1: "틀을 맞추고 스토리를 짜는 중", 3: "핏이 이미지를 만드는 중", 6: "배포하고 예약하는 중" };
const DONE_UI = 7;

type Derived = { ui: number; prepWait: boolean; errLabel: string | null; errText: string | null };

function derive(st: AdminState): Derived {
  const by = (id: string) => st.status.steps.find((s) => s.id === id);
  const err = st.status.steps.find((s) => s.state === "error");
  const prepWait = !PREP.every((id) => !by(id) || by(id)?.state === "done");
  const errInfo = { errLabel: err?.label ?? null, errText: err?.error ?? null };
  for (let i = 0; i < GROUPS.length; i++) {
    const complete = i === 5 ? !!st.picks.publishDate : GROUPS[i].every((id) => by(id)?.state === "done");
    if (!complete) return { ui: i, prepWait: i === 0 && prepWait, ...errInfo };
  }
  return { ui: DONE_UI, prepWait: false, errLabel: null, errText: null };
}

async function post<T = Record<string, unknown>>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "처리하지 못했어요. 다시 해 보세요.");
  return data as T;
}

const safeUrl = (u: string) => (/^https?:\/\//.test(u) ? u : null);

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="56" rx="34" ry="38" fill="#FF9F2E" stroke="#fff" strokeWidth="5" />
      <circle cx="38" cy="46" r="9" fill="#fff" />
      <circle cx="62" cy="46" r="9" fill="#fff" />
      <circle cx="40" cy="48" r="4" fill="#0F3A73" />
      <circle cx="60" cy="48" r="4" fill="#0F3A73" />
      <path d="M42 68q8 7 16 0" stroke="#0F3A73" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M46 80l4 10 4-10-4-4z" fill="#C93A52" />
    </svg>
  );
}

function Dialog(props: { title: string; body: string; okLabel: string; onOk: () => void; onClose: () => void; opener: HTMLElement | null }) {
  const { title, body, okLabel, onOk, onClose, opener } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    heading.current?.focus(); // 열리면 포커스는 제목으로
    return () => opener?.focus(); // 닫히면 연 버튼으로
  }, [opener]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      const els = Array.from(box.current?.querySelectorAll<HTMLElement>("button") ?? []);
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === heading.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div className="adm-dlg-bg" onKeyDown={onKeyDown} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="adm-dlg" role="dialog" aria-modal="true" aria-labelledby="adm-dlg-title" ref={box}>
        <h2 id="adm-dlg-title" tabIndex={-1} ref={heading}>
          {title}
        </h2>
        <p>{body}</p>
        <div className="row">
          <button type="button" className="btn sec" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn" onClick={onOk}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TopicRow({ t, on, onPick }: { t: Topic; on: boolean; onPick: () => void }) {
  const detId = `topic-det-${t.rank}`;
  return (
    <li className={`opt ${on ? "on" : ""}`}>
      {t.sources.length === 0 && <div className="warnbox">출처가 하나도 없어요. 확인된 근거가 아니에요.</div>}
      <button type="button" className="opt-head" aria-pressed={on} aria-expanded={on} aria-controls={detId} onClick={onPick}>
        <span className="rk">{t.rank}</span>
        <div style={{ minWidth: 0 }}>
          <div className="tt">{t.name}</div>
          <div className="meta">
            <b>온라인</b> {t.online || "-"}
            <br />
            <b>커뮤니티</b> {t.community || "-"}
          </div>
          <div className="bar" aria-hidden="true">
            <i style={{ width: `${Math.max(0, Math.min(100, t.score))}%` }} />
          </div>
          {t.sources.length === 1 && <span className="chip warn">단일 출처</span>}
          {t.sourceStatus && <span className="chip">{t.sourceStatus}</span>}
        </div>
        <div className="sc">
          {t.score}
          <small>밈 점수</small>
        </div>
      </button>
      {on && (
        <div className="det" id={detId}>
          <p>
            <b>배경</b> {t.background || "-"}
          </p>
          <p>
            <b>사람들 반응</b>
          </p>
          {t.reactions.length > 0 ? (
            <ul>
              {t.reactions.map((r, i) => (
                <li key={i}>
                  {r.mood && <b>{r.mood}</b>} {r.summary} {r.where && `(${r.where})`}{" "}
                  {safeUrl(r.source.url) ? (
                    <a className="alink" href={safeUrl(r.source.url) ?? undefined} target="_blank" rel="noreferrer">
                      {r.source.name || "출처"}
                    </a>
                  ) : (
                    r.source.name
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>저장된 반응이 없어요.</p>
          )}
          <p>
            <b>식는 신호</b> {t.fading || "-"}
          </p>
          <p>
            <b>어울리는 틀</b> {t.frame || "-"}
          </p>
          <p>
            <b>출처</b>{" "}
            {t.sources.length === 0
              ? "없음"
              : t.sources.map((s, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    {safeUrl(s.url) ? (
                      <a className="alink" href={safeUrl(s.url) ?? undefined} target="_blank" rel="noreferrer">
                        {s.name || s.url}
                      </a>
                    ) : (
                      s.name
                    )}
                  </span>
                ))}
          </p>
        </div>
      )}
    </li>
  );
}

type Dlg = { kind: "schedule" | "reimage"; opener: HTMLElement | null } | null;

export default function NewClient({ fresh }: { fresh: boolean }) {
  const [data, setData] = useState<AdminState | null>(null);
  const [booting, setBooting] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<{ ui: number } | null>(null);
  const [topicIdx, setTopicIdx] = useState(0);
  const [copyIdx, setCopyIdx] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [dlg, setDlg] = useState<Dlg>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/state", { cache: "no-store" });
      if (!res.ok) throw new Error("state");
      setData((await res.json()) as AdminState);
      setLoadErr(false);
    } catch {
      setLoadErr(true);
    }
  }, []);

  // 처음 한 번 읽고, 이후 2초마다 진행을 갱신한다.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (fresh) {
        await post("/api/admin/run", { mode: "new" }).catch(() => undefined);
        window.history.replaceState(null, "", "/admin/new");
      }
      await refresh();
      if (alive) setBooting(false);
    })();
    const id = setInterval(() => {
      if (alive) void refresh();
    }, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [fresh, refresh]);

  const d = data ? derive(data) : null;
  const ui = d?.ui ?? 0;
  const pendingOn = !!pending && ui <= pending.ui;
  const shown = pendingOn && pending ? Math.min(pending.ui + 1, 6) : ui;
  const isAuto = ui < DONE_UI && UI_STEPS[ui].kind === "auto";
  const waiting = booting || !data || !d || pendingOn || d.prepWait || isAuto;
  const hasErr = !!d?.errLabel && !pendingOn;

  async function submit(kind: PickKind, value: string | number, fromUi: number) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await post("/api/admin/pick", { kind, value });
      await post("/api/admin/run", { mode: "resume" });
      setPending({ ui: fromUi });
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function run(mode: "resume" | "reimage") {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ message?: string }>("/api/admin/run", { mode });
      setNotice(r.message ?? null);
      setPending(null);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const topics = data?.topics ?? [];
  const items = data?.items ?? [];
  const occupied = new Map(items.map((i) => [i.date, i.state]));

  // 단계마다 주 CTA 하나. 상단(우상단)과 하단(우측)에 같은 문구로 둔다.
  let cta: { label: string; disabled: boolean; onClick: (el: HTMLElement) => void } | null = null;
  if (data && !waiting && !hasErr) {
    if (ui === 0) cta = { label: "이 주제로 만들기", disabled: busy || !topics[topicIdx], onClick: () => void submit("topic", topics[topicIdx].name, 0) };
    if (ui === 2) cta = { label: "이 문구로 정하기", disabled: busy || !data.copies[copyIdx], onClick: () => void submit("copy", copyIdx + 1, 2) };
    if (ui === 4) cta = { label: "이 이미지로 확정하기", disabled: busy || !image, onClick: () => void submit("image", image as string, 4) };
    if (ui === 5) cta = { label: "발행일 정하기", disabled: busy || !date, onClick: (el) => setDlg({ kind: "schedule", opener: el }) };
  }
  if (data && hasErr) cta = { label: "다시 시도하기", disabled: busy, onClick: () => void run("resume") };

  const c = cta;
  const ctaButtons = (suffix: string) =>
    c && (
      <button type="button" className="btn" disabled={c.disabled} data-cta={suffix} onClick={(e) => c.onClick(e.currentTarget)}>
        {c.label}
      </button>
    );

  const done = data && ui === DONE_UI ? data : null;

  // ----- 본문 -----
  let body: ReactNode = null;
  if (waiting && !hasErr) {
    const label = booting || !data ? "불러오는 중" : d?.prepWait ? "주제 후보를 모으는 중" : isAuto ? WAIT_LABEL[ui] : "선택을 저장하는 중";
    body = (
      <div className="screen wait" aria-live="polite">
        <Logo />
        <h2>{label}</h2>
        <div className="when">자동으로 진행 중이에요. 끝나면 다음 단계로 넘어가요.</div>
      </div>
    );
  } else if (hasErr && d) {
    body = (
      <div className="screen">
        <h2>{d.errLabel} 단계에서 멈췄어요</h2>
        <div className="errbox">{d.errText ?? "원인을 알 수 없어요."} 다시 시도해 보세요.</div>
      </div>
    );
  } else if (done) {
    const pd = done.picks.publishDate;
    const reg = done.registered.find((r) => r.publishDate === pd) ?? done.registered[done.registered.length - 1];
    const pubDate = reg?.publishDate ?? pd ?? "";
    const title = reg?.title || done.copies[(done.picks.copy ?? 1) - 1]?.title || "-";
    const topicName = reg?.topic || done.picks.topic || done.status.meme;
    const topic = done.topics.find((t) => t.name === topicName);
    const img = done.items.find((i) => i.date === pubDate)?.image ?? null;
    const published = reg ? ["published", "발행됨", "발행"].includes(reg.status) : false;
    body = (
      <div className="screen done-card">
        <h2>게임이 등록됐어요</h2>
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="후킹 이미지" />
        )}
        <dl className="kv">
          <dt>타이틀</dt>
          <dd>{title}</dd>
          <dt>주제</dt>
          <dd>
            {topicName || "-"}
            {topic ? ` (밈 점수 ${topic.score})` : ""}
          </dd>
          <dt>틀</dt>
          <dd>{reg?.frame || topic?.frame || "-"}</dd>
          <dt>발행일</dt>
          <dd>{pubDate ? `${md(pubDate)} ${published ? "발행" : "예약"}` : "-"}</dd>
          <dt>상태</dt>
          <dd>
            <span className={`chip ${published ? "pub" : "res"}`}>{published ? "발행됨" : "예약"}</span>
            홈 목록에서 확인할 수 있어요
          </dd>
        </dl>
      </div>
    );
  } else if (data && ui === 0) {
    body = (
      <div className="screen">
        <h2>오늘의 주제 후보 5</h2>
        {data.sampleParts.includes("주제 후보") && <div className="warnbox">샘플 자료입니다. 점수와 출처는 시연용이고 대조하지 않았어요.</div>}
        {topics.length === 0 ? (
          <div className="warnbox">주제 후보가 없어요. 조사가 끝났는지 확인해 주세요.</div>
        ) : (
          <ul className="opts">
            {topics.map((t, i) => (
              <TopicRow key={t.rank} t={t} on={i === topicIdx} onPick={() => setTopicIdx(i)} />
            ))}
          </ul>
        )}
      </div>
    );
  } else if (data && ui === 2) {
    body = (
      <div className="screen">
        <h2>문구를 골라요</h2>
        <p className="meta">자동으로 만든 후보예요. 하나만 고르면 됩니다.</p>
        {data.sampleParts.includes("문구 후보") && <div className="warnbox">샘플 자료입니다. 실제 후보 파일이 아직 없어요.</div>}
        <ul className="opts">
          {data.copies.map((c, i) => (
            <li key={i} className={`opt ${i === copyIdx ? "on" : ""}`}>
              <button type="button" className="opt-head" aria-pressed={i === copyIdx} onClick={() => setCopyIdx(i)}>
                <span className="rk">{"ABCDEFGHI"[i] ?? i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="tt">{c.title}</div>
                  <div className="meta">
                    {c.win && <>성공: {c.win}<br /></>}
                    {c.lose && <>실패: {c.lose}<br /></>}
                    {c.share && <>공유: {c.share}</>}
                  </div>
                </div>
                <span />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (data && ui === 4) {
    body = (
      <div className="screen">
        <h2>후킹 이미지를 확정해요</h2>
        <p className="meta">텔레그램 미리보기에 크게 보이는 이미지예요.</p>
        {data.sampleParts.includes("이미지") && <div className="warnbox">샘플 자료입니다. 실제 이미지 폴더가 아직 비어 있어요.</div>}
        <div className="imgs">
          {data.images.map((im, i) => (
            <button key={im.name} type="button" className="imgbtn" aria-pressed={image === im.name} onClick={() => setImage(im.name)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt={`시안 ${i + 1}`} />
            </button>
          ))}
        </div>
      </div>
    );
  } else if (data && ui === 5) {
    const days = Array.from({ length: DATE_RANGE_DAYS }, (_, i) => addDays(data.today, i));
    body = (
      <div className="screen">
        <h2>언제 발행할까요?</h2>
        <p className="meta">비어 있는 날만 고를 수 있어요.</p>
        <div className="dates">
          {days.map((day) => {
            const o = occupied.get(day);
            return (
              <button key={day} type="button" className="dt" aria-pressed={date === day} disabled={!!o} onClick={() => setDate(day)}>
                {DOW[dowIndex(day)]} {md(day)}
                <small>{o ? (o === "published" ? "발행됨" : "예약") : day === data.today ? "오늘" : "비어 있음"}</small>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const title = done ? "등록 완료" : "게임 등록";

  return (
    <main className="board">
      <div className="top">
        <h1>{title}</h1>
        <div className="acts">
          {data?.sample && <span className="sample">샘플 자료</span>}
          {done ? (
            <>
              <span className="okmark" aria-hidden="true">✓</span>
              <Link className="btn" href="/admin">
                홈으로 이동
              </Link>
            </>
          ) : (
            <>
              <Link className="link" href="/admin">
                취소
              </Link>
              {ctaButtons("top")}
            </>
          )}
        </div>
      </div>

      {(err || data?.runError || loadErr) && (
        <div className="errbox" role="alert">
          {err ?? data?.runError ?? "상태를 불러오지 못했어요. 개발 서버가 켜져 있는지 확인해 주세요."}
        </div>
      )}
      {notice && (
        <div className="notice" aria-live="polite">
          {notice}
        </div>
      )}

      <ol className="steps" aria-label="등록 단계">
        {UI_STEPS.map((s, i) => (
          <li
            key={s.label}
            className={`st ${s.kind === "auto" ? "auto" : ""} ${(done ? true : i < shown) ? "done" : ""} ${!done && i === shown ? "on" : ""}`}
            aria-current={!done && i === shown ? "step" : undefined}
            aria-label={`${i + 1}단계 ${s.label} ${s.kind === "auto" ? "자동" : "직접"}`}
          >
            <i aria-hidden="true">{done || i < shown ? "✓" : i + 1}</i>
            <span className="lb" aria-hidden="true">
              {s.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="legend">
        둥근 칸은 직접 고르는 단계, 네모 칸은 자동 단계예요.
        {!done && ` 지금은 ${shown + 1}/7 ${UI_STEPS[Math.min(shown, 6)].label}.`}
      </p>

      {body}

      <div className="bar-b">
        <div className="bar-in">
          {data && ui === 4 && !waiting && !hasErr && (
            <button type="button" className="link" disabled={busy} onClick={(e) => setDlg({ kind: "reimage", opener: e.currentTarget })}>
              다시 만들어 달라고 하기
            </button>
          )}
          {done ? (
            <Link className="btn" href="/admin">
              홈으로 이동
            </Link>
          ) : (
            ctaButtons("bottom")
          )}
        </div>
      </div>

      {dlg?.kind === "schedule" && date && (
        <Dialog
          title={`${md(date)} 발행을 예약할까요?`}
          body="예약하면 어드민 홈 목록에 들어가요. 예약한 뒤에 바꾸는 기능은 아직 없어요."
          okLabel="예약하기"
          opener={dlg.opener}
          onClose={() => setDlg(null)}
          onOk={() => {
            setDlg(null);
            void submit("date", date, 5);
          }}
        />
      )}
      {dlg?.kind === "reimage" && (
        <Dialog
          title="이미지를 다시 만들까요?"
          body="핏에게 다시 만들어 달라고 요청하고 이미지 제작 단계로 돌아가요."
          okLabel="다시 요청하기"
          opener={dlg.opener}
          onClose={() => setDlg(null)}
          onOk={() => {
            setDlg(null);
            setImage(null);
            void run("reimage");
          }}
        />
      )}
    </main>
  );
}
