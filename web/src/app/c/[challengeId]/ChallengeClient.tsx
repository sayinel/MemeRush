"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Challenge } from "@/lib/challenge";
import type { FinishResult } from "@/game/types";

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
const DAILY_NO = "#001";

const RESULT_LINE: Record<string, string> = { win: "Perfect.", early: "Too early.", late: "Too late." };
const resultKey = (r: FinishResult) => (r.outcome === "win" ? "win" : (r.outcomeVariant ?? "late"));

// --- Service-screen building blocks (SERVICE_SCREEN_GUIDE 4·5·9절) ---

function PrimaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-14 w-full rounded-full border-[3px] border-white bg-green font-title text-[22px] text-white shadow-[0_3px_0_var(--navy)] transition active:translate-y-[3px] active:shadow-none disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function TextLink({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="min-h-11 font-bold text-ink-blue underline underline-offset-4 disabled:opacity-50">
      {children}
    </button>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[22px] border-4 border-white bg-panel p-3 shadow-[0_0_0_3px_var(--navy)] ${className}`}>
      {children}
    </section>
  );
}

function RankBadge({ label, rank, tone }: { label: string; rank: number | null | undefined; tone: "gold" | "hot" }) {
  return (
    <div
      className={`flex h-24 w-24 -rotate-6 flex-col items-center justify-center rounded-full border-4 border-white shadow-[0_3px_0_var(--navy)] ${tone === "gold" ? "bg-gold" : "bg-hot"}`}
    >
      <span className="text-xs font-bold tracking-wide text-ink-blue">{label}</span>
      <span className="font-title text-3xl leading-none text-ink-blue">{rank != null ? `#${rank}` : "–"}</span>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-mascot font-title text-white">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Medal({ rank }: { rank: number }) {
  if (rank > 3) return <span className="w-8 text-center font-title text-lg text-ink-blue">{rank}</span>;
  const tone = rank === 1 ? "bg-gold text-[#7a5200]" : rank === 2 ? "bg-silver text-ink-blue" : "bg-bronze text-ink-blue";
  return (
    <span className="relative flex w-8 justify-center">
      {rank === 1 && <span className="absolute -top-3 text-sm">👑</span>}
      <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white font-title ${tone}`}>{rank}</span>
    </span>
  );
}

function RankRow({ row }: { row: Row }) {
  return (
    <li
      className={`flex items-center gap-2 rounded-[14px] border-[3px] border-white px-2 py-1.5 shadow-[0_0_0_2px_var(--panel)] ${row.isMe ? "bg-hot" : "bg-row"}`}
    >
      <Medal rank={row.rank} />
      <Avatar name={row.nickname} />
      <span className="min-w-0 flex-1 truncate font-bold text-ink-blue">
        {row.nickname}
        {row.isMe && <span className="ml-1 text-xs">▲ you</span>}
      </span>
      <span className="font-title text-lg text-ink-blue">{seconds(row.errorMs)}</span>
    </li>
  );
}

function Header() {
  return <p className="font-title text-sm tracking-widest text-white [text-shadow:0_2px_0_var(--navy)]">MEME RUSH · DAILY {DAILY_NO}</p>;
}

export default function ChallengeClient({
  challenge,
  refId,
  leagueToken,
}: {
  challenge: Challenge;
  refId: string | null;
  leagueToken: string | null;
}) {
  const [stage, setStage] = useState<"loading" | "intro" | "playing" | "result">("loading");
  const [me, setMe] = useState<Me>({ leagues: [] });
  const [invite, setInvite] = useState<Invite | null>(null);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const [last, setLast] = useState<FinishResponse | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [tab, setTab] = useState<"global" | "friends">("global");
  const [globalBoard, setGlobalBoard] = useState<Board>({ rows: [] });
  const [friendsBoard, setFriendsBoard] = useState<Board | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const attemptIdRef = useRef<string | null>(null);
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
    async (leagueId: string | null) => {
      const [g, f] = await Promise.all([
        api<Board>(`/api/leaderboard?challengeId=${challengeId}`),
        leagueId ? api<Board>(`/api/leagues/${leagueId}/leaderboard?challengeId=${challengeId}`) : Promise.resolve(null),
      ]);
      setGlobalBoard(g);
      setFriendsBoard(f);
      setTab(f ? "friends" : "global");
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
      api("/api/events", { method: "POST", body: { type: "challenge_link_opened", challengeId, ref: refId } }).catch(() => {});
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
        const { nickname: saved } = await api<{ nickname: string }>("/api/players", {
          method: "POST",
          body: { nickname },
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
      const text = `Meme Rush ${DAILY_NO} | ${best}\nCan you beat it?`;
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
      setNotice("Link copied. Send it to a friend.");
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
    const key = last ? resultKey(last) : "late";
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center bg-[#29BAF5]">
        <div className="h-dvh w-full max-w-[480px]">
          <GameCanvas challenge={challenge} beforeStart={beforeStart} onComplete={onComplete} onFinished={onFinished} playKey={playKey} />
        </div>
        {showCard && last && (
          <div className="absolute inset-x-4 bottom-6 mx-auto max-w-sm">
            <Panel className="text-center">
              {last.isNewBest && (
                <p className="mx-auto -mt-8 mb-2 w-fit rounded-full border-[3px] border-white bg-gold px-4 py-1 font-title text-lg text-[#7a5200] shadow-[0_3px_0_var(--navy)]">
                  New best
                </p>
              )}
              <p className="font-title text-xl text-ink-blue">{RESULT_LINE[key]}</p>
              <p className="score-number text-5xl">{seconds(last.errorMs)} off</p>
              <p className="mt-1 text-sm font-bold text-ink-blue">
                World #{last.globalRank}
                {last.friendsRank != null && ` · Friends #${last.friendsRank}`}
              </p>
              <div className="mt-4">
                <PrimaryButton onClick={retry}>Try again</PrimaryButton>
              </div>
              <div className="mt-2">
                <button onClick={seeMyRank} className="min-h-11 font-bold text-ink-blue underline underline-offset-4">
                  See my rank
                </button>
              </div>
            </Panel>
          </div>
        )}
      </main>
    );
  }

  if (stage === "intro") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-5 px-5 pb-28 pt-8 text-center">
        <Header />
        <h1 className="meme-caption text-[52px]">{challenge.title}</h1>
        <p className="max-w-xs text-base font-bold text-ink-blue">{challenge.meme.prompt}</p>
        {invite && (
          <p className="flex items-center gap-2 rounded-full border-[3px] border-white bg-hot px-4 py-1.5 font-bold text-ink-blue shadow-[0_3px_0_var(--navy)]">
            <Avatar name={invite.ownerNickname} />
            {invite.ownerNickname}&apos;s league · {invite.memberCount} in
          </p>
        )}
        <Panel className="w-full">
          <ol className="space-y-2">
            {challenge.meme.theme.rounds.map((r, i) => (
              <li
                key={r.label}
                className="flex items-center justify-between rounded-[14px] border-[3px] border-white bg-row px-4 py-2 shadow-[0_0_0_2px_var(--panel)]"
              >
                <span className="font-title text-lg text-ink-blue">
                  Round {i + 1} · {r.label}
                </span>
                <span className="font-title text-lg text-ink-blue">{(challenge.frameParams.targetMs[i] / 1000).toFixed(2)}s</span>
              </li>
            ))}
          </ol>
        </Panel>
        {!me.nickname && (
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="Your nickname"
            className="h-12 w-full rounded-full border-[3px] border-white bg-white px-5 text-center text-lg font-bold text-ink-blue shadow-[0_0_0_2px_var(--navy)] placeholder:text-[#245887]/60"
          />
        )}
        {error && <p className="rounded-[14px] bg-warn-bg px-3 py-2 text-sm font-bold text-warn-text">{error}</p>}
        <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md px-5 pb-5">
          <PrimaryButton onClick={start} disabled={busy || (!me.nickname && nickname.trim().length === 0)}>
            {needsJoin && invite ? `Join ${invite.ownerNickname}'s league & play` : "Play now"}
          </PrimaryButton>
        </div>
      </main>
    );
  }

  // Result hub
  const board = tab === "friends" ? friendsBoard : globalBoard;
  const myGlobalOutside = tab === "global" && me.globalRank != null && me.globalRank > 50;
  const gapText =
    friendsBoard?.gapMs != null
      ? friendsBoard.myRank === 1
        ? `${seconds(friendsBoard.gapMs)} ahead of #2`
        : `${seconds(friendsBoard.gapMs)} behind #1`
      : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 pb-28 pt-6">
      <header className="flex flex-col items-center gap-1 text-center">
        <Header />
        <p className="meme-caption meme-caption-sm text-3xl">{challenge.title}</p>
        <p className="score-number mt-2 text-6xl">{me.bestErrorMs != null ? `${seconds(me.bestErrorMs)} off` : "No record yet"}</p>
        <p className="text-sm font-bold text-ink-blue">{me.nickname}&apos;s best today</p>
      </header>

      <div className="flex justify-center gap-6">
        <RankBadge label="WORLD" rank={me.globalRank} tone="gold" />
        <RankBadge label="FRIENDS" rank={friendsBoard?.myRank} tone="hot" />
      </div>

      {needsJoin && invite && (
        <button
          onClick={() =>
            joinInvite()
              .then((id) => loadBoards(id))
              .catch((e) => setError(friendly(e)))
          }
          className="min-h-11 font-bold text-ink-blue underline underline-offset-4"
        >
          Join {invite.ownerNickname}&apos;s league
        </button>
      )}

      <Panel>
        <div className="mb-3 grid grid-cols-2 gap-2" role="tablist">
          {(["global", "friends"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-11 rounded-full border-[3px] border-white font-title text-lg shadow-[0_3px_0_var(--navy)] ${tab === t ? "bg-navy text-white" : "bg-row text-ink-blue"}`}
            >
              {t === "global" ? "Global" : "Friends"}
            </button>
          ))}
        </div>
        {tab === "friends" && !friendsBoard ? (
          <p className="p-4 text-center font-bold text-ink-blue">No friends here yet. Challenge one.</p>
        ) : (board?.rows.length ?? 0) === 0 ? (
          <p className="p-4 text-center font-bold text-ink-blue">No one here yet. Be the first.</p>
        ) : (
          <ol className="space-y-1.5">
            {board!.rows.map((r, i) => (
              <RankRow key={`${r.nickname}-${i}`} row={r} />
            ))}
            {myGlobalOutside && (
              <RankRow row={{ nickname: me.nickname ?? "", errorMs: me.bestErrorMs ?? 0, rank: me.globalRank!, isMe: true }} />
            )}
          </ol>
        )}
        {tab === "friends" && gapText && <p className="mt-2 text-center font-title text-lg text-ink-blue">{gapText}</p>}
      </Panel>

      {error && <p className="rounded-[14px] bg-warn-bg px-3 py-2 text-center text-sm font-bold text-warn-text">{error}</p>}
      {notice && <p className="text-center font-bold text-ink-blue">{notice}</p>}

      <div className="flex justify-center gap-8">
        <TextLink onClick={() => share(false)} disabled={busy}>
          Copy link
        </TextLink>
        <TextLink onClick={start} disabled={busy}>
          Play again
        </TextLink>
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md px-5 pb-5">
        <PrimaryButton onClick={() => share(true)} disabled={busy}>
          Challenge a Friend
        </PrimaryButton>
      </div>
    </main>
  );
}
