import "server-only";

// Cloudflare D1 implementation of the same query-builder subset the API routes use on Supabase / localdb:
// from/select(count,head)/insert/update/upsert(ignoreDuplicates) + eq/lt/in/is/order/limit/single/maybeSingle,
// the best_attempts view and rpc("attempt_server_elapsed_ms"). Two embedded selects are resolved by hand
// (leagues.owner, league_members.leagues). Errors carry code "23505" for unique violations (as Postgres does).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
export type D1Like = {
  prepare(sql: string): { bind(...v: unknown[]): { all(): Promise<{ results?: Row[] }>; first(): Promise<Row | null> } };
};

const JSON_COLS = new Set(["round_elapsed_ms", "round_error_ms", "meta"]);
const IDENT = /^[a-z_][a-z0-9_]*$/;
const id = (s: string) => {
  if (!IDENT.test(s)) throw new Error(`bad identifier ${s}`);
  return s;
};

function parseRow(r: Row): Row {
  for (const c of JSON_COLS) {
    if (typeof r[c] === "string") {
      try {
        r[c] = JSON.parse(r[c]);
      } catch {
        /* keep raw */
      }
    }
  }
  return r;
}
const toDb = (v: unknown) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v === undefined ? null : v);

type Result = { data: any; error: { message: string; code?: string } | null; count?: number };

class Query implements PromiseLike<Result> {
  private where: string[] = [];
  private args: unknown[] = [];
  private orders: string[] = [];
  private max: number | null = null;
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private values: Row = {};
  private mode: "many" | "single" | "maybe" = "many";
  private head = false;
  private wantCount = false;
  private ignoreDup = false;
  private cols = "*";
  private embed = "";
  constructor(private db: D1Like, private table: string) {}

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") {
      this.wantCount = opts?.count === "exact";
      this.head = !!opts?.head;
      const s = (cols ?? "*").trim();
      if (s.includes("(")) {
        this.embed = s;
        this.cols = "*";
      } else this.cols = s === "*" ? "*" : s.split(",").map((c) => id(c.trim())).join(", ");
    }
    return this; // after insert/update: RETURNING * is always used
  }
  insert(v: Row) {
    this.op = "insert";
    this.values = v;
    return this;
  }
  upsert(v: Row, o?: { ignoreDuplicates?: boolean }) {
    this.op = "upsert";
    this.ignoreDup = !!o?.ignoreDuplicates;
    this.values = v;
    return this;
  }
  update(v: Row) {
    this.op = "update";
    this.values = v;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(c: string, v: unknown) {
    this.where.push(`${id(c)} = ?`);
    this.args.push(v);
    return this;
  }
  lt(c: string, v: number) {
    this.where.push(`${id(c)} < ?`);
    this.args.push(v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.where.push(vs.length ? `${id(c)} in (${vs.map(() => "?").join(",")})` : "0");
    this.args.push(...vs);
    return this;
  }
  is(c: string, v: null) {
    this.where.push(`${id(c)} is null`);
    void v;
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) {
    this.orders.push(`${id(c)} ${o?.ascending === false ? "desc" : "asc"}`);
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

  private whereSql() {
    return this.where.length ? ` where ${this.where.join(" and ")}` : "";
  }

  private async run(): Promise<Result> {
    const t = id(this.table);
    let rows: Row[] = [];
    let count: number | undefined;
    if (this.op === "select") {
      if (this.head || this.wantCount) {
        const c = await this.db.prepare(`select count(*) as n from ${t}${this.whereSql()}`).bind(...this.args).first();
        count = Number(c?.n ?? 0);
        if (this.head) return { data: null, error: null, count };
      }
      let sql = `select ${this.cols} from ${t}${this.whereSql()}`;
      if (this.orders.length) sql += ` order by ${this.orders.join(", ")}`;
      if (this.max !== null) sql += ` limit ${Math.max(0, Math.floor(this.max))}`;
      rows = ((await this.db.prepare(sql).bind(...this.args).all()).results ?? []).map(parseRow);
      if (this.embed) await this.resolveEmbeds(rows);
    } else if (this.op === "delete") {
      if (!this.where.length) throw new Error("delete without filter");
      rows = ((await this.db.prepare(`delete from ${t}${this.whereSql()} returning *`).bind(...this.args).all()).results ?? []).map(parseRow);
    } else if (this.op === "update") {
      const keys = Object.keys(this.values).map(id);
      const sql = `update ${t} set ${keys.map((k) => `${k} = ?`).join(", ")}${this.whereSql()} returning *`;
      rows = ((await this.db.prepare(sql).bind(...Object.values(this.values).map(toDb), ...this.args).all()).results ?? []).map(parseRow);
    } else {
      const v: Row = { ...this.values };
      const noId = this.table === "events" || this.table === "league_members";
      if (!noId && v.id === undefined) v.id = crypto.randomUUID();
      if (this.table === "attempts") v.started_at ??= new Date().toISOString();
      if (this.table !== "league_members" && this.table !== "attempts") v.created_at ??= new Date().toISOString();
      const keys = Object.keys(v).map(id);
      const verb = this.op === "upsert" && this.ignoreDup ? "insert or ignore" : "insert";
      const sql = `${verb} into ${t} (${keys.join(", ")}) values (${keys.map(() => "?").join(", ")}) returning *`;
      rows = ((await this.db.prepare(sql).bind(...Object.values(v).map(toDb)).all()).results ?? []).map(parseRow);
    }
    return this.shape(rows, count);
  }

  // leagues: owner:players!owner_id(nickname) ; league_members: leagues(owner_id, owner:players!owner_id(nickname))
  private async resolveEmbeds(rows: Row[]) {
    const owner = async (ownerId: string) => (await this.db.prepare("select nickname from players where id = ?").bind(ownerId).first()) ?? null;
    if (this.table === "leagues" && this.embed.includes("owner:")) {
      for (const r of rows) r.owner = await owner(r.owner_id);
    } else if (this.table === "league_members" && this.embed.includes("leagues(")) {
      for (const r of rows) {
        const l = await this.db.prepare("select owner_id from leagues where id = ?").bind(r.league_id).first();
        r.leagues = l ? { owner_id: l.owner_id, owner: await owner(l.owner_id) } : null;
      }
    }
  }

  private shape(rows: Row[], count?: number): Result {
    if (this.mode === "single") return rows.length === 1 ? { data: rows[0], error: null, count } : { data: null, error: { message: "expected one row" } };
    if (this.mode === "maybe") return { data: rows[0] ?? null, error: null, count };
    return { data: rows, error: null, count };
  }

  then<T1 = Result, T2 = never>(ok?: ((v: Result) => T1 | PromiseLike<T1>) | null, bad?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    const p = this.run().catch((e: Error): Result => ({
      data: null,
      error: { message: e.message, code: /UNIQUE constraint failed/i.test(e.message) ? "23505" : undefined },
    }));
    return p.then(ok, bad) as Promise<T1 | T2>;
  }
}

export function d1Db(db: D1Like) {
  return {
    from: (table: string) => new Query(db, table),
    rpc: async (fn: string, args: { p_attempt?: string }): Promise<Result> => {
      if (fn !== "attempt_server_elapsed_ms") return { data: null, error: { message: `rpc ${fn} not supported` } };
      const a = await db.prepare("select started_at from attempts where id = ?").bind(args.p_attempt).first();
      return a ? { data: Date.now() - new Date(a.started_at as string).getTime(), error: null } : { data: null, error: { message: "no attempt" } };
    },
  };
}
