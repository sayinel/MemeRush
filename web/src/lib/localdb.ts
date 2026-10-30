import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// LOCAL TEST STAND-IN for Supabase (no keys, no network). Used by supabaseAdmin() only when SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are missing AND (NODE_ENV != production OR LOCAL_PLAY=1). It implements just the query
// methods the API routes use: from/select(count,head)/insert/update + eq/lt/in/is/order/limit/single/maybeSingle, the
// best_attempts view and rpc("attempt_server_elapsed_ms"). Nested selects (league owner join) return plain rows.
// State lives in memory and in web/.data/localdb.json (gitignored).

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

const FILE = path.join(process.cwd(), ".data", "localdb.json");
const tables: Record<string, Row[]> = {};
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    Object.assign(tables, JSON.parse(fs.readFileSync(FILE, "utf8")));
  } catch {
    seed();
  }
}

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(tables));
  } catch {
    // Read-only disk: memory-only is fine for a local stand-in.
  }
}

// A few fictional players so the ranking is not empty (test data).
function seed() {
  const now = new Date().toISOString();
  tables.players = [];
  tables.attempts = [];
  for (const [nick, ms] of [["Calm Toast", 21], ["Lucky Fox", 34], ["Quiet Owl", 90], ["Brave Moth", 144], ["Sleepy Duck", 310]] as const) {
    const id = randomUUID();
    tables.players.push({ id, session_token: randomUUID(), nickname: nick, created_at: now });
    tables.attempts.push({ id: randomUUID(), player_id: id, challenge_id: "2026-10-25", started_at: now, finished_at: now, error_ms: ms });
  }
}

function view(name: string): Row[] {
  load();
  if (name !== "best_attempts") return (tables[name] ??= []);
  const best = new Map<string, Row>();
  for (const a of tables.attempts ?? []) {
    if (a.finished_at == null || typeof a.error_ms !== "number") continue;
    const key = `${a.player_id}|${a.challenge_id}`;
    const cur = best.get(key);
    if (!cur || (a.error_ms as number) < (cur.error_ms as number)) best.set(key, a);
  }
  return [...best.values()].map((a) => ({
    ...a,
    nickname: (tables.players ?? []).find((p) => p.id === a.player_id)?.nickname ?? "",
  }));
}

class Query implements PromiseLike<{ data: unknown; error: { message: string } | null; count?: number }> {
  private filters: Filter[] = [];
  private orders: [string, boolean][] = [];
  private max = Infinity;
  private op: "select" | "insert" | "update" = "select";
  private values: Row = {};
  private mode: "many" | "single" | "maybe" = "many";
  private head = false;
  private wantCount = false;
  private returning = false;
  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") {
      this.wantCount = opts?.count === "exact";
      this.head = !!opts?.head;
    } else this.returning = true;
    return this;
  }
  insert(v: Row) {
    this.op = "insert";
    this.values = v;
    return this;
  }
  update(v: Row) {
    this.op = "update";
    this.values = v;
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  lt(c: string, v: number) {
    this.filters.push((r) => typeof r[c] === "number" && (r[c] as number) < v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[c]));
    return this;
  }
  is(c: string, v: null) {
    this.filters.push((r) => (v === null ? r[c] == null : r[c] === v));
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) {
    this.orders.push([c, o?.ascending !== false]);
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  private run() {
    const rows = view(this.table);
    const match = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[];
    if (this.op === "insert") {
      const row: Row = { id: randomUUID(), created_at: new Date().toISOString(), ...this.values };
      if (this.table === "attempts") row.started_at ??= new Date().toISOString();
      rows.push(row);
      save();
      out = [row];
    } else if (this.op === "update") {
      out = rows.filter(match);
      for (const r of out) Object.assign(r, this.values);
      save();
    } else {
      out = rows.filter(match);
      for (const [c, asc] of [...this.orders].reverse()) {
        out.sort((a, b) => {
          const x = a[c] as number | string;
          const y = b[c] as number | string;
          return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
        });
      }
      const count = out.length;
      if (this.head) return { data: null, error: null, count };
      out = out.slice(0, this.max);
      return this.shape(out, count);
    }
    return this.shape(out, out.length);
  }
  private shape(out: Row[], count: number) {
    const err = (m: string) => ({ data: null, error: { message: m } });
    if (this.mode === "single") return out.length === 1 ? { data: out[0], error: null, count } : err("expected one row");
    if (this.mode === "maybe") return { data: out[0] ?? null, error: null, count };
    return { data: out, error: null, count };
  }
  then<T1, T2>(ok?: ((v: ReturnType<Query["run"]>) => T1 | PromiseLike<T1>) | null, bad?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok as never, bad as never) as Promise<T1 | T2>;
  }
}

export function localDb() {
  return {
    from: (table: string) => new Query(table),
    rpc: async (fn: string, args: { p_attempt?: string }) => {
      if (fn !== "attempt_server_elapsed_ms") return { data: null, error: { message: `rpc ${fn} not supported locally` } };
      const a = view("attempts").find((r) => r.id === args.p_attempt);
      return a ? { data: Date.now() - new Date(a.started_at as string).getTime(), error: null } : { data: null, error: { message: "no attempt" } };
    },
  };
}
