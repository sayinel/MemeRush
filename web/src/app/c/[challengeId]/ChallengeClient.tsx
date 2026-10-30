"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Challenge } from "@/lib/challenge";
import type { FinishResult } from "@/game/types";
import { fillCaption, pickCaption } from "@/game/captions";
import { captureSrc, useLang, type Lang, type Strings } from "@/lib/i18n";

const GameCanvas = dynamic(() => import("@/game/GameCanvas"), { ssr: false });

type League = { leagueId: string; ownerNickname: string; isOwner: boolean };
type Me = { nickname?: string; bestErrorMs?: number | null; globalRank?: number | null; leagues: League[] };
type Invite = { leagueId: string; ownerNickname: string; memberCount: number };
type FinishResponse = FinishResult & {
  bestErrorMs: number;
  isNewBest: boolean;
  globalRank: number;
  friendsRank: number | null;
};
type Row = { nickname: string; errorMs: number; rank: number; isMe?: boolean };
type Board = { rows: Row[]; myRank?: number | null; gapMs?: number | null };

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

// WRITING_GUIDE 4절: say what happened and what to do next; no error codes on screen.
function friendly(e: unknown): string {
  if (e instanceof ApiError && e.status === 400 && e.message.startsWith("nickname")) return "Pick a nickname, 1–20 letters.";
  return "That didn't save. Try again.";
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(3)}s`;

const resultKey = (r: FinishResult) => (r.outcome === "win" ? "win" : (r.outcomeVariant ?? "late"));

// Art from web/public/game/manifest.json (shared with the game). Missing keys fall back to code-drawn art,
// so new files from the art pipeline show up without code changes (docs/SIMON_REQUESTS.md 1-1절).
type Art = (key: string) => string | null;

function useArt(): Art {
  const [files, setFiles] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/game/manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, string>) => setFiles(m))
      .catch(() => setFiles({}));
  }, []);
  return useCallback((key: string) => (files[key] ? `/game/${files[key]}` : null), [files]);
}

// --- Service-screen building blocks (ADMIN_UX_GUIDE 4·5·9절) ---

const pillClass =
  "flex min-h-11 flex-1 items-center justify-center rounded-full border-[3px] border-white bg-navy px-4 font-title text-lg text-white shadow-[0_3px_0_var(--navy)] active:translate-y-[3px] active:shadow-none disabled:opacity-50";

type VideoState =
  | { kind: "making" }
  | { kind: "ready"; url: string; downloadUrl: string; file: File | null; shareUrl: string | null }
  | { kind: "failed"; cardUrl: string | null };

// Result video (MVP_SCOPE 6절 공유, 7절 영상): made as soon as the hub shows a best, previewed inline, then shared as
// a file or downloaded. The file and the public link are fetched up front: awaiting them inside the tap handler
// makes iOS drop the user gesture and reject navigator.share. If rendering fails, offer the result card instead.
// The parent keys this by the best record, so a new best remounts it and makes a new video.
// Not rendered since ranking v2 (the mock has no video block); kept for the share-video flow.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function VideoPanel({ challengeId, dailyNo, bestErrorMs }: { challengeId: string; dailyNo: string; bestErrorMs: number }) {
  const [state, setState] = useState<VideoState>({ kind: "making" });
  const text = `Meme Rush ${dailyNo} | ${seconds(bestErrorMs)} off\nCan you beat it?`;

  useEffect(() => {
    let live = true;
    // Public link: ref only, no league (AC-17).
    const link = api<{ url: string; referralId: string }>("/api/referrals", { method: "POST", body: { challengeId, invite: false } });
    api<{ url: string; downloadUrl: string; type: string }>("/api/videos", { method: "POST", body: { challengeId } })
      .then(async (v) => {
        const [file, ref] = await Promise.all([
          fetch(v.url)
            .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`))))
            .then((b) => new File([b], `meme-rush-${challengeId}.mp4`, { type: v.type }))
            .catch(() => null),
          link.catch(() => null),
        ]);
        if (live) setState({ kind: "ready", url: v.url, downloadUrl: v.downloadUrl, file, shareUrl: ref?.url ?? null });
      })
      .catch(async () => {
        const ref = await link.catch(() => null);
        if (live) setState({ kind: "failed", cardUrl: ref ? `/api/og/${ref.referralId}` : null });
      });
    return () => {
      live = false;
    };
  }, [challengeId]);

  const event = (type: string) => api("/api/events", { method: "POST", body: { type, challengeId } }).catch(() => {});

  if (state.kind === "making") {
    return <p className="py-3 text-center font-title text-lg text-ink-blue">Making your video…</p>;
  }
  if (state.kind === "failed") {
    return state.cardUrl ? (
      <a href={state.cardUrl} download={`meme-rush-${challengeId}.png`} className={pillClass}>
        Save result card
      </a>
    ) : null;
  }

  const file = state.file;
  const canShareFile = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  async function shareVideo() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: state.kind === "ready" && state.shareUrl ? `${text}\n${state.shareUrl}` : text });
      event("native_share_invoked");
    } catch {
      // Cancelled or refused: Save video stays available.
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <video src={state.url} playsInline muted autoPlay loop className="w-40 rounded-[14px] border-4 border-white shadow-[0_0_0_3px_var(--navy)]" />
      <div className="flex w-full gap-2">
        {canShareFile && (
          <button onClick={shareVideo} className={pillClass}>
            Share result
          </button>
        )}
        <a href={state.downloadUrl} download onClick={() => event("video_downloaded")} className={pillClass}>
          Save video
        </a>
      </div>
    </div>
  );
}

// --- Result screen v2 / ranking v2 (no card box; type and buttons on the backdrop) ---

function LangToggle({ lang, setLang, small }: { lang: Lang; setLang: (l: Lang) => void; small?: boolean }) {
  return (
    <div className={`rs-lang${small ? " rs-lang-sm" : ""}`} role="group" aria-label="Language">
      {(["ko", "en"] as const).map((l) => (
        <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// Email CTA (GAME_FLOW_SCENARIO 7절; screens_v2 input / wrong address / sent, screens_v3 save failed). Posts to the
// temporary /api/subscribe. The address is never logged.
function EmailScreen({
  t,
  lang,
  dailyNo,
  title,
  art,
  onAgain,
  onRank,
  onClose,
}: {
  t: Strings;
  lang: Lang;
  dailyNo: string;
  title: string;
  art: Art;
  onAgain: () => void;
  onRank: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"input" | "invalid" | "sending" | "failed" | "sent">("input");
  const [invalidMsg, setInvalidMsg] = useState("");
  const sprite = (key: string) => art(key) ?? `/game/${key}.png`;

  async function submit() {
    const v = email.trim();
    if (!v.includes("@")) {
      setInvalidMsg(t.emailNoAt);
      return setState("invalid");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setInvalidMsg(t.emailBad);
      return setState("invalid");
    }
    setState("sending");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: v, lang, src: captureSrc() }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  const bad = state === "invalid";
  const failed = state === "failed";
  /* eslint-disable @next/next/no-img-element */
  return (
    <div className="rs-email" role="dialog" aria-modal="true" data-testid="email-screen" data-state={state}>
      {state === "sent" ? (
        <>
          <div className="rs-cap" style={{ top: "30cqw", fontSize: "6.6cqw" }}>
            {t.emailSent}
          </div>
          <img className="rs-hero" style={{ bottom: "46cqw", width: "46cqw" }} src={sprite("worker_smug")} alt="" />
          <div className="rs-btns">
            <button className="rs-go" onClick={onAgain}>
              {t.emailAgain}
            </button>
            <button className="rs-go blue" onClick={onRank}>
              {t.seeRank}
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="rk-back" onClick={onClose}>
            ‹ {lang === "ko" ? "순위" : "Ranking"}
          </button>
          <div className="rs-cap" style={{ top: "9cqw", fontSize: "8.4cqw" }}>
            MEME RUSH <span style={{ color: "#ffd54a" }}>{dailyNo}</span>
          </div>
          {!failed && (
            <div className="rs-cap" style={{ top: "20cqw", fontSize: "5.2cqw" }}>
              {title}
            </div>
          )}
          <img
            className="rs-hero"
            style={{ bottom: failed ? "62cqw" : bad ? "66cqw" : "54cqw", width: failed ? "56cqw" : bad ? "38cqw" : "48cqw" }}
            src={sprite(failed ? "worker_facepalm" : "worker_sweating")}
            alt=""
          />
          {!failed && (
            <img
              src={sprite("email_pile")}
              alt=""
              style={{ position: "absolute", left: "6cqw", bottom: bad ? "66cqw" : "56cqw", width: "17cqw", transform: "rotate(-8deg)" }}
            />
          )}
          <form
            className="rs-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (state !== "sending") void submit();
            }}
          >
            {failed && <div className="rs-errl">{t.emailFailed}</div>}
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (bad) setState("input");
              }}
              placeholder={t.emailInput}
              aria-label={t.emailInput}
              aria-invalid={bad || failed}
              className={bad || failed ? "bad" : ""}
            />
            {bad && <div className="rs-errl">{invalidMsg}</div>}
            <button type="submit" className="rs-go" disabled={state === "sending"}>
              {state === "sending" ? t.emailSending : failed ? t.emailRetry : t.emailMe}
            </button>
            <p className="rk-help">{failed ? t.emailKeep : t.emailHelp}</p>
            {!failed && <p className="rs-legal">{t.emailLegal}</p>}
          </form>
        </>
      )}
    </div>
  );
  /* eslint-enable @next/next/no-img-element */
}

const VERDICT: Record<string, string> = { win: "PERFECT", early: "TOO EARLY", late: "TOO LATE" };

function ResultScreen({
  challenge,
  last,
  elapsed,
  roundCount,
  art,
  lang,
  setLang,
  t,
  onRetry,
  onRank,
}: {
  challenge: Challenge;
  last: FinishResponse;
  elapsed: number[];
  roundCount: number;
  art: Art;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Strings;
  onRetry: () => void;
  onRank: () => void;
}) {
  const key = resultKey(last);
  const win = key === "win";
  const heroKey = win ? "worker_smug" : key === "early" ? "worker_shocked" : "worker_crying";
  const cap = pickCaption(challenge, last);
  const played = { ...last, roundElapsedMs: elapsed };
  const bg = art("bg_office") ?? "/game/bg_office.webp";
  const hero = art(heroKey) ?? `/game/${heroKey}.png`;
  const duck = art("duck") ?? "/game/duck.png";
  const badge = `${last.isNewBest ? "NEW BEST · " : ""}WORLD #${last.globalRank}`;
  return (
    <div className="absolute inset-0 z-10" data-testid="result-screen">
      {/* eslint-disable @next/next/no-img-element */}
      <img className="rs-bg" src={bg} alt="" aria-hidden />
      <span className="rs-chip" style={{ left: "3cqw" }}>
        ROUND {roundCount}/{roundCount}
      </span>
      <LangToggle lang={lang} setLang={setLang} />
      <div className="rs-cap" style={{ top: "11cqw" }}>
        {fillCaption(challenge, cap.top, played)}
      </div>
      <div className="rs-verdict">
        <span className={`v ${win ? "win" : ""}`}>{VERDICT[key]}</span>
        <span className="s">{seconds(last.errorMs)} off</span>
        <span className="b">{badge}</span>
      </div>
      <img className="rs-hero" src={hero} alt="" />
      {!win && <img className="rs-duck" src={duck} alt="" />}
      {/* eslint-enable @next/next/no-img-element */}
      <div className="rs-cap" style={{ bottom: "38cqw", fontSize: "7.4cqw" }}>
        {fillCaption(challenge, cap.bottom, played)}
      </div>
      <div className="rs-btns">
        <button className="rs-go" onClick={onRetry}>
          {t.tryAgain}
        </button>
        <button className="rs-go blue" onClick={onRank}>
          {t.seeRank}
        </button>
      </div>
    </div>
  );
}

// --- PC layout (>=1024px): blurred office backdrop + info beside the 9:16 game box ---

function PlayBackdrop() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/game/bg_office.webp"
      alt=""
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full scale-[1.12] object-cover [filter:blur(14px)_brightness(.62)_saturate(1.1)]"
    />
  );
}

function SideInfoLeft({ dailyNo, title }: { dailyNo: string; title: string }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 text-white lg:flex">
      <p className="meme-caption meme-caption-sm text-left text-4xl">MEME RUSH</p>
      <p className="font-title text-xl [text-shadow:0_2px_0_var(--navy)]">
        {dailyNo} {title}
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm font-bold leading-snug [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
        <li>Read the clock before it hides</li>
        <li>Tap at the target time</li>
        <li>Three rounds, lowest total error wins</li>
      </ol>
    </aside>
  );
}

function SideInfoRight({ challengeId, refresh, t, onEmail }: { challengeId: string; refresh: number; t: Strings; onEmail: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let live = true;
    api<Board>(`/api/leaderboard?challengeId=${challengeId}`)
      .then((b) => live && setRows(b.rows.slice(0, 5)))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [challengeId, refresh]);

  async function copyLink() {
    try {
      const ref = await api<{ url: string }>("/api/referrals", { method: "POST", body: { challengeId, invite: false } }).catch(() => null);
      await navigator.clipboard.writeText(ref?.url ?? window.location.href);
      setCopied(true);
      api("/api/events", { method: "POST", body: { type: "challenge_link_copied", challengeId } }).catch(() => {});
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard refused: leave the button as is.
    }
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
      {rows.length > 0 && (
        <section className="rounded-[22px] border-4 border-white bg-panel p-3 shadow-[0_0_0_3px_var(--navy)]">
          <h2 className="mb-2 font-title text-lg text-ink-blue">Today&apos;s ranking</h2>
          <ol className="space-y-1.5">
            {rows.map((r, i) => (
              <li key={`${r.nickname}-${i}`} className="flex items-center gap-2 rounded-[14px] bg-row px-2 py-1.5 text-sm font-bold text-ink-blue">
                <span className="w-5 text-center font-title">{r.rank}</span>
                <span className="min-w-0 flex-1 truncate">{r.nickname}</span>
                <span className="font-title">{seconds(r.errorMs)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <button
        onClick={copyLink}
        disabled={copied}
        className="min-h-11 rounded-full border-[3px] border-white bg-navy px-4 font-title text-base text-white shadow-[0_3px_0_var(--ink-blue)] active:translate-y-[3px] active:shadow-none disabled:bg-silver disabled:text-ink-blue"
      >
        {copied ? "Copied" : "Copy challenge link"}
      </button>
      {/* TODO(email CTA): placeholder only, opens the empty email screen; no email server yet. */}
      <button
        onClick={onEmail}
        className="min-h-11 rounded-full border-[3px] border-white bg-green px-4 font-title text-base text-white shadow-[0_3px_0_var(--navy)] active:translate-y-[3px] active:shadow-none"
      >
        {t.emailMe}
      </button>
    </aside>
  );
}

export default function ChallengeClient({
  challenge,
  dailyNo,
  refId,
  leagueToken,
}: {
  challenge: Challenge;
  dailyNo: string;
  refId: string | null;
  leagueToken: string | null;
}) {
  const [stage, setStage] = useState<"loading" | "intro" | "playing" | "result">("loading");
  const [me, setMe] = useState<Me>({ leagues: [] });
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [last, setLast] = useState<FinishResponse | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [globalBoard, setGlobalBoard] = useState<Board>({ rows: [] });
  const [elapsed, setElapsed] = useState<number[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const { lang, setLang, t } = useLang();
  const [notice, setNotice] = useState<string | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const art = useArt();
  const challengeId = challenge.id;

  const isMember = (leagueId: string | undefined, leagues: League[]) =>
    !!leagueId && leagues.some((l) => l.leagueId === leagueId);

  const pickLeague = useCallback(
    (leagues: League[], inv: Invite | null) =>
      (inv && isMember(inv.leagueId, leagues) ? inv.leagueId : null) ??
      leagues.find((l) => l.isOwner)?.leagueId ??
      leagues[0]?.leagueId ??
      null,
    [],
  );

  const loadBoards = useCallback(
    // Global list only (the Friends tab is gone); the league id is still accepted so callers stay as they were.
    async (leagueId?: string | null) => {
      void leagueId;
      setGlobalBoard(await api<Board>(`/api/leaderboard?challengeId=${challengeId}`));
    },
    [challengeId],
  );

  useEffect(() => {
    (async () => {
      try {
        const [m, inv] = await Promise.all([
          api<Me>(`/api/me?challengeId=${challengeId}`),
          leagueToken ? api<Invite>(`/api/leagues/invites/${leagueToken}`).catch(() => null) : Promise.resolve(null),
        ]);
        setMe(m);
        setInvite(inv);
        const leagueId = pickLeague(m.leagues, inv);
        setActiveLeagueId(leagueId);
        if (m.bestErrorMs != null) {
          await loadBoards(leagueId);
          setStage("result");
        } else {
          setStage("intro");
        }
      } catch (e) {
        setError(friendly(e));
        setStage("intro");
      }
      // ?src= (sns_kr, community_global ...) rides along as event meta; the events route already stores `meta`.
      const src = captureSrc();
      api("/api/events", {
        method: "POST",
        body: { type: "challenge_link_opened", challengeId, ref: refId, ...(src ? { meta: { src } } : {}) },
      }).catch(() => {});
    })();
  }, [challengeId, leagueToken, refId, pickLeague, loadBoards]);

  const needsJoin = !!invite && !isMember(invite.leagueId, me.leagues);

  async function joinInvite(): Promise<string | null> {
    if (!invite || !leagueToken) return activeLeagueId;
    const { leagueId } = await api<{ leagueId: string }>("/api/leagues/join", {
      method: "POST",
      body: { inviteToken: leagueToken },
    });
    setMe((prev) => ({ ...prev, leagues: [...prev.leagues, { leagueId, ownerNickname: invite.ownerNickname, isOwner: false }] }));
    setActiveLeagueId(leagueId);
    return leagueId;
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      if (!me.nickname) {
        // No nickname screen: a quiet "Player-XXXX" name (the server requires one; email is asked on the ranking CTA only).
        const auto = `Player-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const { nickname: saved } = await api<{ nickname: string }>("/api/players", {
          method: "POST",
          body: { nickname: auto },
        });
        setMe((prev) => ({ ...prev, nickname: saved }));
      }
      if (needsJoin) await joinInvite();
      setShowCard(false);
      setPlayKey((k) => k + 1);
      setStage("playing");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  const beforeStart = useCallback(async () => {
    const { attemptId } = await api<{ attemptId: string }>("/api/attempts", {
      method: "POST",
      body: { challengeId, ref: refId },
    });
    attemptIdRef.current = attemptId;
  }, [challengeId, refId]);

  const onComplete = useCallback(
    async (roundElapsedMs: number[]) => {
      const res = await api<FinishResponse>(`/api/attempts/${attemptIdRef.current}/finish`, {
        method: "POST",
        body: { roundElapsedMs, leagueId: activeLeagueId },
      });
      setLast(res);
      setElapsed(roundElapsedMs);
      setMe((prev) => ({ ...prev, bestErrorMs: res.bestErrorMs, globalRank: res.globalRank }));
      return res;
    },
    [activeLeagueId],
  );

  const onFinished = useCallback(() => setShowCard(true), []);

  function retry() {
    setShowCard(false);
    setPlayKey((k) => k + 1);
  }

  async function seeMyRank() {
    setShowCard(false);
    await loadBoards(activeLeagueId).catch((e) => setError(friendly(e)));
    setStage("result");
  }

  async function share(withInvite: boolean) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await api<{ url: string; leagueId: string | null }>("/api/referrals", {
        method: "POST",
        body: { challengeId, invite: withInvite },
      });
      // WRITING_GUIDE 6절: Wordle-style, no nickname, no target time.
      const best = me.bestErrorMs != null ? `${seconds(me.bestErrorMs)} off` : "";
      const text = `Meme Rush ${dailyNo} | ${best}\nCan you beat it?`;
      if (res.leagueId && res.leagueId !== activeLeagueId) {
        setActiveLeagueId(res.leagueId);
        setMe((prev) =>
          isMember(res.leagueId!, prev.leagues)
            ? prev
            : { ...prev, leagues: [...prev.leagues, { leagueId: res.leagueId!, ownerNickname: prev.nickname ?? "", isOwner: true }] },
        );
        await loadBoards(res.leagueId);
      }
      if (navigator.share) {
        try {
          await navigator.share({ title: "Meme Rush", text, url: res.url });
          api("/api/events", { method: "POST", body: { type: "native_share_invoked", challengeId } }).catch(() => {});
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(`${text}\n${res.url}`);
      setNotice(t.linkCopied);
      api("/api/events", { method: "POST", body: { type: "challenge_link_copied", challengeId } }).catch(() => {});
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  if (stage === "loading") {
    return <main className="flex min-h-dvh items-center justify-center font-title text-3xl text-white">Loading…</main>;
  }

  if (stage === "playing") {
    return (
      <main className="relative flex min-h-dvh items-center justify-center gap-8 overflow-hidden px-0 lg:px-6">
        <PlayBackdrop />
        <SideInfoLeft dailyNo={dailyNo} title={challenge.title} />
        <div className="play-box">
          <GameCanvas challenge={challenge} beforeStart={beforeStart} onComplete={onComplete} onFinished={onFinished} playKey={playKey} />
          {showCard && last && (
            <ResultScreen
              challenge={challenge}
              last={last}
              elapsed={elapsed}
              roundCount={challenge.frameParams.rounds}
              art={art}
              lang={lang}
              setLang={setLang}
              t={t}
              onRetry={retry}
              onRank={seeMyRank}
            />
          )}
          {emailOpen && (
            <EmailScreen
              t={t}
              lang={lang}
              dailyNo={dailyNo}
              title={challenge.title}
              art={art}
              onAgain={() => {
                setEmailOpen(false);
                void start();
              }}
              onRank={() => {
                setEmailOpen(false);
              }}
              onClose={() => setEmailOpen(false)}
            />
          )}
        </div>
        <SideInfoRight challengeId={challengeId} refresh={playKey + (last?.errorMs ?? 0)} t={t} onEmail={() => setEmailOpen(true)} />
      </main>
    );
  }

  if (stage === "intro") {
    // Intro (GAME_FLOW_SCENARIO 2절, screens_v2 title block): game name + today's game, the sweating hero, one start
    // button. No nickname field (a Player-XXXX name is made quietly on the first start), no explainer card.
    const hero = art("worker_sweating") ?? "/game/worker_sweating.png";
    const bg = art("bg_office") ?? "/game/bg_office.webp";
    return (
      <main className="relative flex min-h-dvh items-center justify-center gap-8 overflow-hidden px-0 lg:px-6">
        <PlayBackdrop />
        <SideInfoLeft dailyNo={dailyNo} title={challenge.title} />
        <div className="play-box" data-testid="intro-screen">
          {/* eslint-disable @next/next/no-img-element */}
          <img className="rs-bg" src={bg} alt="" aria-hidden />
          <LangToggle lang={lang} setLang={setLang} small />
          <div className="rs-cap" style={{ top: "9cqw", fontSize: "11cqw" }}>
            MEME RUSH <span style={{ color: "#ffd54a" }}>{dailyNo}</span>
          </div>
          <div className="rs-cap" style={{ top: "24cqw", fontSize: "7.4cqw" }}>
            {challenge.title}
          </div>
          <p className="rs-line" style={{ top: "36cqw" }}>
            {challenge.meme.prompt}
          </p>
          <div style={{ position: "absolute", left: "50%", bottom: "30cqw", width: "58cqw", transform: "translateX(-50%)" }}>
            <img className="anim-jitter" style={{ width: "100%" }} src={hero} alt="" />
          </div>
          {/* eslint-enable @next/next/no-img-element */}
          <div className="rs-btns">
            {error && <p className="rk-note">{error}</p>}
            <button className="rs-go" onClick={start} disabled={busy}>
              {needsJoin && invite ? `Join ${invite.ownerNickname}'s league & play` : t.playNow}
            </button>
          </div>
          {emailOpen && (
            <EmailScreen
              t={t}
              lang={lang}
              dailyNo={dailyNo}
              title={challenge.title}
              art={art}
              onAgain={() => {
                setEmailOpen(false);
                retry();
              }}
              onRank={() => {
                setEmailOpen(false);
                void seeMyRank();
              }}
              onClose={() => setEmailOpen(false)}
            />
          )}
        </div>
        <SideInfoRight challengeId={challengeId} refresh={playKey} t={t} onEmail={() => setEmailOpen(true)} />
      </main>
    );
  }

  // Ranking screen v2: Global list only, then the email CTA (placeholder) and share.
  const myNick = me.nickname ?? "";
  const rows = globalBoard.rows;
  const meInList = rows.some((r) => r.isMe || (!!myNick && r.nickname === myNick && r.errorMs === me.bestErrorMs));
  const myOutside = !meInList && me.globalRank != null && me.bestErrorMs != null;
  const bg = art("bg_office") ?? "/game/bg_office.webp";
  const trophy = art("trophy") ?? "/game/trophy.png";
  return (
    <main className="relative flex min-h-dvh items-center justify-center gap-8 overflow-hidden px-0 lg:px-6">
      <PlayBackdrop />
      <SideInfoLeft dailyNo={dailyNo} title={challenge.title} />
      <div className="play-box" data-testid="rank-screen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rs-bg" src={bg} alt="" aria-hidden />
        <div className="rk-wrap">
          <button className="rk-back" onClick={start} disabled={busy}>
            ‹ {t.tryAgain}
          </button>
          <LangToggle lang={lang} setLang={setLang} />
          <h1 className="rk-title">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={trophy} alt="" />
            WORLD RANKING
          </h1>
          <ul className="rk-list">
            {rows.length === 0 && <li>No one here yet. Be the first.</li>}
            {rows.map((r, i) => {
              const mine = r.isMe || (!!myNick && r.nickname === myNick && r.errorMs === me.bestErrorMs);
              return (
                <li key={`${r.nickname}-${i}`} className={mine ? "me" : ""}>
                  <b>{r.rank}</b>
                  <span className="n">{mine ? "You" : r.nickname}</span>
                  <em>{seconds(r.errorMs)}</em>
                </li>
              );
            })}
            {myOutside && (
              <li className="me">
                <b>{me.globalRank}</b>
                <span className="n">You</span>
                <em>{seconds(me.bestErrorMs!)}</em>
              </li>
            )}
          </ul>
          <div className="rk-bottom">
            {error && <p className="rk-note">{error}</p>}
            {notice && <p className="rk-note">{notice}</p>}
            <p className="rk-help">{t.emailHelp}</p>
            {/* TODO(email CTA): placeholder; opens the empty email screen and stores nothing (no email server yet). */}
            <button className="rs-go" onClick={() => setEmailOpen(true)}>
              {t.emailMe}
            </button>
            <button className="rs-go ghost" onClick={() => share(false)} disabled={busy}>
              {t.share}
            </button>
          </div>
        </div>
        {emailOpen && (
            <EmailScreen
              t={t}
              lang={lang}
              dailyNo={dailyNo}
              title={challenge.title}
              art={art}
              onAgain={() => {
                setEmailOpen(false);
                void start();
              }}
              onRank={() => {
                setEmailOpen(false);
              }}
              onClose={() => setEmailOpen(false)}
            />
          )}
      </div>
    </main>
  );
}
