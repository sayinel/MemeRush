"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
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

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(3)}s`;

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
        setError((e as Error).message);
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
    const leagues = [...me.leagues, { leagueId, ownerNickname: invite.ownerNickname, isOwner: false }];
    setMe((prev) => ({ ...prev, leagues }));
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
      setError((e as Error).message);
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

  async function seeResults() {
    setShowCard(false);
    await loadBoards(activeLeagueId).catch((e) => setError((e as Error).message));
    setStage("result");
  }

  async function share(invite: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await api<{ url: string; leagueId: string | null }>("/api/referrals", {
        method: "POST",
        body: { challengeId, invite },
      });
      const best = me.bestErrorMs != null ? seconds(me.bestErrorMs) : "";
      const text = `MemeRush · ${challenge.title} — ${best} off. Can you beat me?`;
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
          await navigator.share({ title: "MemeRush", text, url: res.url });
          api("/api/events", { method: "POST", body: { type: "native_share_invoked", challengeId } }).catch(() => {});
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(`${text} ${res.url}`);
      setNotice("Link copied!");
      api("/api/events", { method: "POST", body: { type: "challenge_link_copied", challengeId } }).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (stage === "loading") {
    return <main className="flex min-h-dvh items-center justify-center font-display text-3xl text-white">LOADING…</main>;
  }

  if (stage === "playing") {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center bg-[#29BAF5]">
        <div className="h-dvh w-full max-w-[480px]">
          <GameCanvas
            challenge={challenge}
            beforeStart={beforeStart}
            onComplete={onComplete}
            onFinished={onFinished}
            playKey={playKey}
          />
        </div>
        {showCard && last && (
          <div className="absolute inset-x-4 bottom-6 mx-auto max-w-sm rounded-[22px] border-4 border-white bg-panel p-5 text-center text-white shadow-[0_0_0_3px_var(--navy)]">
            <p className="font-display text-4xl">{seconds(last.errorMs)} OFF</p>
            <p className="mt-1 text-sm font-bold">
              {last.isNewBest ? "NEW BEST! " : `Best ${seconds(last.bestErrorMs)} · `}
              Global #{last.globalRank}
              {last.friendsRank != null && ` · Friends #${last.friendsRank}`}
            </p>
            <button
              onClick={retry}
              className="mt-4 h-12 w-full rounded-full border-[3px] border-white bg-green font-display text-xl text-white shadow-[0_3px_0_var(--navy)]"
            >
              RETRY
            </button>
            <button onClick={seeResults} className="mt-3 font-bold underline">
              See results
            </button>
          </div>
        )}
      </main>
    );
  }

  if (stage === "intro") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 p-6 text-center">
        <p className="text-xs font-bold tracking-widest text-white">MEMERUSH · DAILY #001</p>
        <h1 className="font-display text-5xl leading-none text-white [-webkit-text-stroke:2px_var(--navy)]">
          {challenge.title}
        </h1>
        <p className="text-lg font-semibold text-white">{challenge.meme.prompt}</p>
        {invite && (
          <p className="rounded-full border-[3px] border-white bg-hot px-4 py-1 text-sm font-bold">
            {invite.ownerNickname}&apos;s league · {invite.memberCount} playing
          </p>
        )}
        <ol className="w-full space-y-2">
          {challenge.meme.theme.rounds.map((r, i) => (
            <li key={r.label} className="rounded-[14px] border-[3px] border-white bg-row px-4 py-2 text-left font-semibold">
              ROUND {i + 1} · {r.label} · {(challenge.frameParams.targetMs[i] / 1000).toFixed(2)}s
            </li>
          ))}
        </ol>
        {!me.nickname && (
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="Your nickname"
            className="h-12 w-full rounded-full border-[3px] border-white px-5 text-center text-lg"
          />
        )}
        {error && <p className="text-sm font-bold text-red">{error}</p>}
        <button
          onClick={start}
          disabled={busy || (!me.nickname && nickname.trim().length === 0)}
          className="sticky bottom-4 h-14 w-full rounded-full border-[3px] border-white bg-green font-display text-2xl text-white shadow-[0_3px_0_var(--navy)] disabled:opacity-50"
        >
          {needsJoin ? "JOIN & PLAY" : "PLAY"}
        </button>
      </main>
    );
  }

  // Result hub
  const board = tab === "friends" ? friendsBoard : globalBoard;
  const myGlobalOutside = tab === "global" && me.globalRank != null && me.globalRank > 50;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-5">
      <header className="text-center">
        <p className="text-xs font-bold tracking-widest text-white">{challenge.title}</p>
        <p className="font-display text-5xl text-white [-webkit-text-stroke:2px_var(--navy)]">
          {me.bestErrorMs != null ? `${seconds(me.bestErrorMs)} OFF` : "NO RECORD YET"}
        </p>
        <p className="text-sm font-bold text-white">
          {me.nickname} · Global #{me.globalRank ?? "-"}
          {friendsBoard?.myRank != null && ` · Friends #${friendsBoard.myRank}`}
        </p>
      </header>

      {needsJoin && (
        <button
          onClick={() => joinInvite().then((id) => loadBoards(id)).catch((e) => setError((e as Error).message))}
          className="rounded-full border-[3px] border-white bg-hot py-2 font-bold"
        >
          Join {invite?.ownerNickname}&apos;s league
        </button>
      )}

      <section className="rounded-[22px] border-4 border-white bg-panel p-3 shadow-[0_0_0_3px_var(--navy)]">
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["global", "friends"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full border-2 border-white py-1 font-display text-lg ${tab === t ? "bg-navy text-white" : "bg-row text-ink-blue"}`}
            >
              {t === "global" ? "GLOBAL" : "FRIENDS"}
            </button>
          ))}
        </div>
        {tab === "friends" && !friendsBoard ? (
          <p className="p-4 text-center font-semibold text-white">Challenge a friend to start your league.</p>
        ) : (
          <ol className="space-y-1.5">
            {(board?.rows ?? []).map((r, i) => (
              <li
                key={`${r.nickname}-${i}`}
                className={`flex items-center justify-between rounded-[14px] border-2 border-white px-3 py-1.5 font-semibold ${r.isMe ? "bg-hot" : "bg-row"}`}
              >
                <span>
                  {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`} {r.nickname}
                </span>
                <span>{seconds(r.errorMs)}</span>
              </li>
            ))}
            {myGlobalOutside && (
              <li className="flex justify-between rounded-[14px] border-2 border-white bg-hot px-3 py-1.5 font-semibold">
                <span>#{me.globalRank} {me.nickname}</span>
                <span>{me.bestErrorMs != null && seconds(me.bestErrorMs)}</span>
              </li>
            )}
          </ol>
        )}
        {tab === "friends" && friendsBoard?.gapMs != null && (
          <p className="mt-2 text-center text-sm font-bold text-white">
            {friendsBoard.myRank === 1
              ? `You lead by ${seconds(friendsBoard.gapMs)}`
              : `${seconds(friendsBoard.gapMs)} behind #1`}
          </p>
        )}
      </section>

      {error && <p className="text-center text-sm font-bold text-red">{error}</p>}
      {notice && <p className="text-center text-sm font-bold text-white">{notice}</p>}

      <button
        onClick={() => share(true)}
        disabled={busy}
        className="sticky bottom-4 h-14 rounded-full border-[3px] border-white bg-green font-display text-2xl text-white shadow-[0_3px_0_var(--navy)] disabled:opacity-50"
      >
        CHALLENGE A FRIEND
      </button>
      <div className="flex justify-center gap-6 font-bold text-white underline">
        <button onClick={() => share(false)} disabled={busy}>
          Copy game link
        </button>
        <button onClick={start} disabled={busy}>
          Play again
        </button>
      </div>
    </main>
  );
}
