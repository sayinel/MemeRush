import "server-only";
import { execFile, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import statusFixture from "../_fixtures/status.json";
import picksFixture from "../_fixtures/picks.json";
import topicsFixture from "../_fixtures/topics.json";
import copiesFixture from "../_fixtures/card_candidates.json";
import imagesFixture from "../_fixtures/images.json";
import registeredFixture from "../_fixtures/registered.json";
import {
  type AdminState,
  type CopyCandidate,
  type HomeItem,
  type ImageCandidate,
  type PickKind,
  type PipelineStatus,
  type PipelineStep,
  type Picks,
  type Registered,
  type RunMode,
  type Source,
  type Topic,
} from "./types";
import { DATE_RANGE_DAYS, addDays, isIsoDate } from "./week";

// ADMIN_LOCAL=1 일 때만 어드민이 열린다(배포 환경에서 로컬 파일과 명령을 막는다).
export const adminEnabled = () => process.env.ADMIN_LOCAL === "1";

// web 폴더에서 실행한다고 본다(npm run dev / build 의 작업 폴더).
const WEB = process.cwd();
const DISC = path.resolve(WEB, "..", "tools", "discovery");
const PIPE = path.join(DISC, "out", "pipeline");
const OUT = path.join(DISC, "out");
const CONTENT = path.join(WEB, "content", "challenges");
const PIPE_REL = "out/pipeline";
export const IMAGE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.(png|jpe?g|webp|gif)$/i;
const AUTO_MS = 2500;

export class AdminError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// ---------- 읽기 도우미 ----------

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : d);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

async function readJson(file: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export function seoulToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function normSource(v: unknown): Source {
  const r = rec(v);
  return { name: str(r.name), url: str(r.url) };
}

function normTopics(raw: unknown): Topic[] {
  const list = Array.isArray(raw) ? raw : arr(rec(raw).topics);
  return list.map((t, i) => {
    const r = rec(t);
    return {
      rank: typeof r.rank === "number" ? r.rank : i + 1,
      name: str(r.name),
      score: typeof r.score === "number" ? r.score : Number(r.score) || 0,
      online: str(r.online),
      community: str(r.community),
      background: str(r.background),
      reactions: arr(r.reactions).map((x) => {
        const q = rec(x);
        return { mood: str(q.mood), summary: str(q.summary), where: str(q.where), source: normSource(q.source) };
      }),
      fading: str(r.fading),
      frame: str(r.frame),
      sources: arr(r.sources).map(normSource),
      sourceStatus: str(r.sourceStatus),
    };
  }).filter((t) => t.name);
}

function lines(v: unknown): string {
  if (typeof v === "string") return v;
  const r = rec(v);
  return [str(r.top), str(r.bottom)].filter(Boolean).join(" / ");
}

function normCopies(raw: unknown): CopyCandidate[] {
  const r = rec(raw);
  const list = Array.isArray(raw) ? raw : arr(r.candidates ?? r.share_candidates ?? r.shareCandidates ?? r.cards);
  return list
    .map((c) => {
      if (typeof c === "string") return { title: c, win: "", lose: "", share: "" };
      const x = rec(c);
      return {
        title: str(x.title) || str(x.name) || str(x.text) || str(x.share),
        win: lines(x.win),
        lose: lines(x.lose),
        share: str(x.share) || str(x.shareText),
      };
    })
    .filter((c) => c.title);
}

function normStatus(raw: unknown): PipelineStatus | null {
  const r = rec(raw);
  if (!Array.isArray(r.steps) || r.steps.length === 0) return null;
  const steps: PipelineStep[] = r.steps.map((s) => {
    const x = rec(s);
    const state = str(x.state);
    return {
      id: str(x.id),
      label: str(x.label),
      kind: x.kind === "human" ? "human" : "auto",
      state: state === "running" || state === "done" || state === "error" ? state : "waiting",
      startedAt: str(x.startedAt) || null,
      endedAt: str(x.endedAt) || null,
      artifact: str(x.artifact) || null,
      error: str(x.error) || null,
    };
  });
  return { date: str(r.date), meme: str(r.meme), current: str(r.current), steps };
}

function normPicks(raw: unknown): Picks {
  const r = rec(raw);
  const copy = Number(r.copy);
  return {
    topic: str(r.topic) || null,
    copy: Number.isInteger(copy) && copy > 0 ? copy : null,
    image: str(r.image) || null,
    publishDate: isIsoDate(r.publishDate) ? r.publishDate : null,
  };
}

function resolveDate(v: unknown, today: string): string | null {
  const s = str(v);
  if (/^[+-]\d+$/.test(s)) return addDays(today, Number(s));
  return isIsoDate(s) ? s : null;
}

function normRegistered(raw: unknown, today: string): Registered[] {
  const out: Registered[] = [];
  for (const x of arr(raw)) {
    const r = rec(x);
    const publishDate = resolveDate(r.publishDate, today);
    if (!publishDate) continue;
    out.push({
      title: str(r.title),
      image: str(r.image) || null,
      publishDate,
      status: str(r.status),
      topic: str(r.topic),
      frame: str(r.frame),
      createdAt: str(r.createdAt),
    });
  }
  return out;
}

/** 이미지 값(URL, 경로, 파일 이름)을 브라우저가 열 수 있는 주소로 바꾼다. */
export function imageUrl(v: string | null): string | null {
  if (!v) return null;
  if (v.startsWith("/") || /^https?:\/\//.test(v)) return v;
  const base = v.split(/[\\/]/).pop() ?? "";
  return IMAGE_NAME.test(base) ? `/api/admin/image?name=${encodeURIComponent(base)}` : null;
}

async function readImages(): Promise<ImageCandidate[]> {
  try {
    const names = await fs.readdir(path.join(PIPE, "images"));
    return names.filter((n) => IMAGE_NAME.test(n)).sort().map((name) => ({ name, url: `/api/admin/image?name=${encodeURIComponent(name)}` }));
  } catch {
    return [];
  }
}

async function readPublished(): Promise<{ date: string; title: string; image: string | null }[]> {
  try {
    const files = (await fs.readdir(CONTENT)).filter((f) => f.endsWith(".json"));
    const out: { date: string; title: string; image: string | null }[] = [];
    for (const f of files) {
      const r = rec(await readJson(path.join(CONTENT, f)));
      const id = str(r.id) || f.replace(/\.json$/, "");
      if (!isIsoDate(id)) continue;
      out.push({ date: id, title: str(r.title) || id, image: imageUrl(str(r.image) || str(r.hookImage) || null) });
    }
    return out;
  } catch {
    return [];
  }
}

// ---------- 샘플 모드: 서버 메모리의 모의 진행 ----------

type Sim = { status: PipelineStatus; picks: Picks; registered: Registered[] };
const g = globalThis as unknown as { __admSim?: Sim; __admRun?: ChildProcess | null; __admRunError?: string | null };

function freshSim(): Sim {
  const status = normStatus(statusFixture) as PipelineStatus;
  status.date = seoulToday();
  const s: Sim = { status, picks: normPicks(picksFixture), registered: g.__admSim?.registered ?? [] };
  return s;
}
const sim = (): Sim => (g.__admSim ??= freshSim());

function enter(s: Sim, i: number, t: number) {
  const steps = s.status.steps;
  if (i >= steps.length) {
    finishSim(s, t);
    return;
  }
  const st = steps[i];
  s.status.current = st.id;
  if (st.id === "schedule" && !s.picks.publishDate) st.state = "waiting";
  else if (st.kind === "auto") {
    st.state = "running";
    st.startedAt = new Date(t).toISOString();
  } else st.state = "waiting";
}

function finishSim(s: Sim, t: number) {
  const copies = normCopies(copiesFixture);
  const topic = normTopics(topicsFixture).find((x) => x.name === s.picks.topic);
  const image = (imagesFixture as ImageCandidate[]).find((x) => x.name === s.picks.image);
  s.registered.push({
    title: copies[(s.picks.copy ?? 1) - 1]?.title ?? "Untitled",
    image: image?.url ?? null,
    publishDate: s.picks.publishDate ?? seoulToday(),
    status: "reserved",
    topic: s.picks.topic ?? "",
    frame: topic?.frame ?? "",
    createdAt: new Date(t).toISOString(),
  });
}

function advance() {
  const s = sim();
  for (let guard = 0; guard < 20; guard++) {
    const i = s.status.steps.findIndex((x) => x.state === "running");
    if (i < 0) return;
    const st = s.status.steps[i];
    const end = Date.parse(st.startedAt ?? "") + AUTO_MS;
    if (Date.now() < end) return;
    st.state = "done";
    st.endedAt = new Date(end).toISOString();
    enter(s, i + 1, end);
  }
}

// ---------- 상태 ----------

export async function readState(): Promise<AdminState> {
  const today = seoulToday();
  const sampleParts: string[] = [];

  let status = normStatus(await readJson(path.join(PIPE, "status.json")));
  const isSim = status === null;
  if (isSim) {
    advance();
    status = sim().status;
    sampleParts.push("진행 상태");
  }

  const topicsRaw = await readJson(path.join(PIPE, "topics.json"));
  let topics = normTopics(topicsRaw);
  if (topics.length === 0) {
    topics = normTopics(topicsFixture);
    sampleParts.push("주제 후보");
  }

  const picks = isSim ? sim().picks : normPicks(await readJson(path.join(PIPE, "picks.json")));

  let copies = normCopies(await readJson(path.join(OUT, "card_candidates.json")));
  if (copies.length === 0) copies = normCopies(await readJson(path.join(OUT, "card.json"))).slice(0, 3);
  if (copies.length === 0) {
    copies = normCopies(copiesFixture);
    sampleParts.push("문구 후보");
  }

  let images = await readImages();
  if (images.length === 0) {
    images = imagesFixture as ImageCandidate[];
    sampleParts.push("이미지");
  }

  const regRaw = await readJson(path.join(PIPE, "registered.json"));
  let registered: Registered[];
  if (Array.isArray(regRaw)) registered = normRegistered(regRaw, today);
  else {
    registered = normRegistered(registeredFixture, today);
    sampleParts.push("예약 목록");
  }
  if (isSim) registered = [...registered, ...sim().registered];

  let published = await readPublished();
  if (published.length === 0) {
    published = [{ date: today, title: "Cut the Dalgona", image: "/mock/dalgona.jpg" }];
    sampleParts.push("발행 목록");
  }

  const byDate = new Map<string, HomeItem>();
  const sorted = [...registered].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const r of sorted) {
    byDate.set(r.publishDate, {
      date: r.publishDate,
      title: r.title,
      image: imageUrl(r.image),
      state: ["published", "발행됨", "발행"].includes(r.status) ? "published" : "reserved",
    });
  }
  for (const p of published) byDate.set(p.date, { date: p.date, title: p.title, image: p.image, state: "published" });
  const items = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    today,
    sample: sampleParts.length > 0,
    sampleParts,
    status: status as PipelineStatus,
    topics,
    picks,
    copies,
    images,
    registered,
    items,
    runError: g.__admRunError ?? null,
  };
}

// ---------- 선택 기록 ----------

export function validatePick(kind: PickKind, value: unknown, st: AdminState): { arg: string; value: string | number } {
  if (kind === "topic") {
    if (typeof value !== "string" || value.startsWith("-") || !st.topics.some((t) => t.name === value)) throw new AdminError("고를 수 없는 주제예요.");
    return { arg: "--topic", value };
  }
  if (kind === "copy") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > st.copies.length) throw new AdminError("고를 수 없는 문구예요.");
    return { arg: "--copy", value: n };
  }
  if (kind === "image") {
    if (typeof value !== "string" || !IMAGE_NAME.test(value) || !st.images.some((i) => i.name === value)) throw new AdminError("고를 수 없는 이미지예요.");
    return { arg: "--image", value };
  }
  if (!isIsoDate(value) || value < st.today || value > addDays(st.today, DATE_RANGE_DAYS - 1)) throw new AdminError("고를 수 없는 날짜예요.");
  if (st.items.some((i) => i.date === value)) throw new AdminError("이미 게임이 있는 날이에요.", 409);
  return { arg: "--date", value };
}

const PY = process.env.ADMIN_PYTHON || "python";
const STEP_OF: Record<PickKind, string> = { topic: "pick_topic", copy: "pick_copy", image: "pick_image", date: "schedule" };

function short(s: string): string {
  const line = s.trim().split(/\r?\n/).filter(Boolean).pop() ?? "";
  return line.slice(0, 160);
}

function execPy(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // 쉘 문자열을 이어 붙이지 않는다. 인자는 배열로만 넘긴다.
    execFile(/*turbopackIgnore: true*/ PY, ["-m", "discovery", ...args], { cwd: DISC, timeout: 30_000, windowsHide: true }, (err, _out, stderr) => {
      if (err) reject(new AdminError(`명령을 실행하지 못했어요. ${short(stderr || err.message)}`, 500));
      else resolve();
    });
  });
}

export async function applyPick(kind: PickKind, value: unknown): Promise<void> {
  const st = await readState();
  const v = validatePick(kind, value, st);
  const isSim = st.sampleParts.includes("진행 상태");
  if (isSim) {
    const s = sim();
    const idx = s.status.steps.findIndex((x) => x.id === STEP_OF[kind]);
    const step = s.status.steps[idx];
    if (!step || step.state !== "waiting" || s.status.steps.slice(0, idx).some((x) => x.state !== "done")) {
      throw new AdminError("지금은 고를 수 없는 단계예요.", 409);
    }
    const now = Date.now();
    if (kind === "date") {
      s.picks.publishDate = v.value as string;
      enter(s, idx, now);
      return;
    }
    if (kind === "topic") {
      s.picks.topic = v.value as string;
      s.status.meme = v.value as string;
    } else if (kind === "copy") s.picks.copy = v.value as number;
    else s.picks.image = v.value as string;
    step.state = "done";
    step.endedAt = new Date(now).toISOString();
    enter(s, idx + 1, now);
    return;
  }
  const arg = kind === "image" ? `${PIPE_REL}/images/${v.value}` : String(v.value);
  await execPy(["pick", "--out", PIPE_REL, v.arg, arg]);
}

// ---------- 실행 ----------

export async function applyRun(mode: RunMode): Promise<{ message: string }> {
  const st = await readState();
  const isSim = st.sampleParts.includes("진행 상태");

  if (mode === "reimage") {
    if (isSim) {
      const s = sim();
      const a = s.status.steps.findIndex((x) => x.id === "assets");
      const p = s.status.steps.findIndex((x) => x.id === "pick_image");
      if (s.status.steps[p]?.state !== "waiting") throw new AdminError("지금은 다시 요청할 수 없어요.", 409);
      s.picks.image = null;
      s.status.steps[p].state = "waiting";
      s.status.steps.slice(a, p).forEach((x) => (x.state = "waiting"));
      enter(s, a, Date.now());
      return { message: "이미지를 다시 만들고 있어요." };
    }
    // 실행기에 되돌리기 명령이 아직 없어서 요청만 파일로 남긴다.
    await fs.mkdir(PIPE, { recursive: true });
    await fs.writeFile(path.join(PIPE, "reimage_request.json"), JSON.stringify({ requestedAt: new Date().toISOString(), meme: st.status.meme }, null, 2));
    return { message: "다시 요청을 기록했어요. 핏이 새 이미지를 올리면 이 화면에 나타나요." };
  }

  const complete = st.status.steps.every((x) => x.state === "done");
  if (isSim) {
    if (mode === "new" && complete) {
      g.__admSim = freshSim();
      return { message: "새 등록을 시작했어요." };
    }
    return { message: "이어서 진행해요." };
  }

  if (g.__admRun && g.__admRun.exitCode === null) return { message: "이미 진행 중이에요." };
  const date = isIsoDate(st.status.date) ? st.status.date : st.today;
  const meme = st.picks.topic ?? st.status.meme;
  const memeOk = meme && !meme.startsWith("-") && meme.length <= 120 && (st.topics.some((t) => t.name === meme) || meme === st.status.meme);
  const fresh = mode === "new" && complete;
  const args = ["-m", "discovery", "pipeline", ...(memeOk && !fresh ? ["--meme", meme] : []), "--date", fresh ? st.today : date, "--out", PIPE_REL, ...(fresh ? [] : ["--resume"])];
  g.__admRunError = null;
  // 백그라운드 실행. 끝나면 status.json 이 바뀌고, 화면은 2초마다 그것을 읽는다.
  const child = execFile(/*turbopackIgnore: true*/ PY, args, { cwd: DISC, windowsHide: true }, (err, _out, stderr) => {
    g.__admRun = null;
    if (err) g.__admRunError = `파이프라인이 멈췄어요. ${short(stderr || err.message)}`;
  });
  g.__admRun = child;
  return { message: "진행을 시작했어요." };
}

export async function readImageFile(name: string): Promise<{ data: Buffer; type: string } | null> {
  if (!IMAGE_NAME.test(name)) return null;
  try {
    const data = await fs.readFile(path.join(PIPE, "images", name));
    const ext = name.split(".").pop()?.toLowerCase();
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
    return { data, type };
  } catch {
    return null;
  }
}
