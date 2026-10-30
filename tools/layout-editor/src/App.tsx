import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Tldraw, createShapeId, useValue, type Editor, type TLShapeId } from "tldraw";
import { PENDING, SCREENS } from "../screens";
import type { ElementDef, ScreenDef } from "../screens/types";
import { GameElementUtil, type GameElementShape } from "./shape";

const W = 720;
const H = 1280;
const shapeUtils = [GameElementUtil];
type Vals = { x: number; y: number; w: number; h: number; font?: number };
const r2 = (n: number) => Math.round(n * 100) / 100;

const isGE = (s: unknown): s is GameElementShape => !!s && (s as GameElementShape).type === "game-element";
const toGame = (s: GameElementShape): Vals => {
  const p = s.props;
  const out: Vals = { x: r2(s.x + p.w / 2), y: r2(p.anchor === "bottom" ? s.y + p.h : s.y + p.h / 2), w: r2(p.w), h: r2(p.h) };
  if (p.kind === "text") out.font = r2(p.font);
  return out;
};

function build(editor: Editor, screen: ScreenDef, values: Record<string, Vals>) {
  const bg = createShapeId("__bg");
  editor.createShape({
    id: bg,
    type: "game-element",
    x: 0,
    y: 0,
    isLocked: true,
    props: { w: W, h: H, name: "__bg", kind: "image", src: `/game/${screen.bg}`, text: "", color: "#fff", stroke: 0, font: 0, bg: "none", anchor: "center" },
  });
  for (const d of screen.elements) {
    const v = values[d.name];
    if (!v) continue;
    editor.createShape({
      id: createShapeId(d.name),
      type: "game-element",
      x: v.x - v.w / 2,
      y: d.anchor === "bottom" ? v.y - v.h : v.y - v.h / 2,
      props: {
        w: v.w,
        h: v.h,
        name: d.name,
        kind: d.kind,
        src: d.src ? `/game/${d.src}` : "",
        text: d.text ?? "",
        color: d.color ?? "#fff",
        stroke: d.stroke ?? 8,
        font: v.font ?? 40,
        bg: d.bg ?? "none",
        anchor: d.anchor ?? "center",
      },
    });
  }
}

function collect(editor: Editor, screen: ScreenDef) {
  const out: Record<string, Vals> = {};
  for (const d of screen.elements) {
    const s = editor.getShape(createShapeId(d.name));
    if (isGE(s)) out[d.name] = toGame(s);
  }
  return out;
}

function NumField({ label, value, onCommit, step = 1 }: { label: string; value: number; onCommit: (n: number) => void; step?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="row">
      <label>{label}</label>
      <input
        type="number"
        data-field={label}
        step={step}
        value={draft ?? String(r2(value))}
        onFocus={() => setDraft(String(r2(value)))}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onCommit(n);
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

function Panel({ editor, screen }: { editor: Editor; screen: ScreenDef }) {
  const sel = useValue("sel", () => editor.getOnlySelectedShape(), [editor]);
  const names = screen.elements.map((e) => e.name);
  const upd = (id: TLShapeId, patch: (s: GameElementShape) => Record<string, unknown>) => {
    const s = editor.getShape(id);
    if (isGE(s)) editor.updateShape({ id, type: "game-element", ...patch(s) } as never);
  };
  let body;
  if (isGE(sel) && !sel.props.name.startsWith("__")) {
    const g = toGame(sel);
    const id = sel.id;
    const bottom = sel.props.anchor === "bottom";
    body = (
      <>
        <h3 data-testid="sel-name">{sel.props.name}</h3>
        <NumField label="x" value={g.x} onCommit={(n) => upd(id, (s) => ({ x: n - s.props.w / 2 }))} />
        <NumField label="y" value={g.y} onCommit={(n) => upd(id, (s) => ({ y: bottom ? n - s.props.h : n - s.props.h / 2 }))} />
        <NumField label="w" value={g.w} onCommit={(n) => upd(id, (s) => ({ x: s.x + s.props.w / 2 - n / 2, props: { ...s.props, w: Math.max(1, n) } }))} />
        <NumField label="h" value={g.h} onCommit={(n) => upd(id, (s) => ({ y: bottom ? s.y + s.props.h - n : s.y + s.props.h / 2 - n / 2, props: { ...s.props, h: Math.max(1, n) } }))} />
        {sel.props.kind === "text" && (
          <>
            <NumField label="font" value={sel.props.font} onCommit={(n) => upd(id, (s) => ({ props: { ...s.props, font: Math.max(1, n) } }))} />
            <div className="row">
              <label>문구</label>
              <input type="text" value={sel.props.text} onChange={(e) => upd(id, (s) => ({ props: { ...s.props, text: e.target.value } }))} />
            </div>
          </>
        )}
        <div className="hint">x,y = {bottom ? "가로 중심, 세로 아래 끝(발바닥)" : "요소 중심"} (게임 좌표 720x1280). 화살표 키 1px, Shift+화살표 10px.</div>
      </>
    );
  } else {
    body = <div className="hint">요소를 클릭하면 이름과 좌표가 여기 나옵니다.</div>;
  }
  return (
    <div className="panel">
      {body}
      <div className="hint" style={{ marginTop: 18 }}>
        <b>요소 목록</b>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {names.map((n) => (
            <button key={n} onClick={() => editor.select(createShapeId(n))} style={{ fontSize: 11, padding: "2px 6px" }}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenEditor({ screen, picker }: { screen: ScreenDef; picker: React.ReactNode }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [status, setStatus] = useState("불러오는 중...");
  const [count, setCount] = useState(0);
  const [snap, setSnap] = useState(false);
  const [grid, setGrid] = useState(false);
  const [refs, setRefs] = useState<string[]>([]);
  const [refName, setRefName] = useState("");
  const [overlay, setOverlay] = useState(false);
  const [opacity, setOpacity] = useState(0.5);
  const started = useRef(false);

  const onMount = useCallback(
    (ed: Editor) => {
      if (started.current) return;
      started.current = true;
      (window as unknown as Record<string, unknown>).__editor = ed;
      (async () => {
        const [load, refList] = await Promise.all([fetch(`/api/load?screen=${screen.id}`).then((r) => r.json()), fetch("/api/refs").then((r) => r.json())]);
        const values: Record<string, Vals> = { ...load.initial, ...(load.saved ?? {}) };
        build(ed, screen, values);
        ed.clearHistory();
        setCount(screen.elements.filter((d) => ed.getShape(createShapeId(d.name))).length);
        setRefs(refList);
        setRefName(refList[0] ?? "");
        setStatus(load.saved ? "저장본을 불러왔습니다" : "layout_" + screen.id + ".ts 초기값");
        for (const ms of [50, 400]) {
          await new Promise((r) => setTimeout(r, ms));
          ed.zoomToBounds({ x: -60, y: -40, w: W + 120, h: H + 80 }, { immediate: true, inset: 0 });
        }
      })();
    },
    [screen],
  );

  useEffect(() => {
    if (!editor) return;
    editor.updateInstanceState({ isGridMode: grid });
  }, [editor, grid]);
  useEffect(() => {
    if (!editor) return;
    editor.user.updateUserPreferences({ isSnapMode: snap });
  }, [editor, snap]);

  // reference capture overlay: a locked, semi-transparent picture on top of everything
  useEffect(() => {
    if (!editor || !count) return;
    const id = createShapeId("__ref");
    if (editor.getShape(id)) editor.deleteShape(id);
    if (!overlay || !refName) return;
    editor.createShape({
      id,
      type: "game-element",
      x: 0,
      y: 0,
      isLocked: true,
      opacity,
      props: { w: W, h: H, name: "__ref", kind: "image", src: `/refs/${encodeURIComponent(refName)}`, text: "", color: "#fff", stroke: 0, font: 0, bg: "none", anchor: "center" },
    });
    editor.bringToFront([id]);
  }, [editor, overlay, refName, count]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editor) return;
    const id = createShapeId("__ref");
    if (editor.getShape(id)) editor.updateShape({ id, type: "game-element", opacity } as never);
  }, [editor, opacity]);

  const save = async () => {
    if (!editor) return;
    const data = collect(editor, screen);
    const res = await fetch(`/api/save?screen=${screen.id}`, { method: "POST", body: JSON.stringify(data) }).then((r) => r.json());
    setStatus(res.ok ? `저장됨 ${new Date().toLocaleTimeString("ko-KR")} (${res.count}개)` : "저장 실패: " + res.error);
  };

  return (
    <>
      <div className="bar">
        <b>MemeRush 위치 조정</b>
        {picker}
        <button onClick={save} data-testid="save">저장</button>
        <label><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />스냅</label>
        <label><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />그리드</label>
        <button className="plain" onClick={() => editor?.zoomToBounds({ x: -60, y: -40, w: W + 120, h: H + 80 }, { immediate: true, inset: 0 })}>화면 맞춤</button>
        <label>
          <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} disabled={!refs.length} />게임 캡처 겹쳐 보기
        </label>
        <select value={refName} onChange={(e) => setRefName(e.target.value)} disabled={!refs.length} style={{ maxWidth: 190 }}>
          {refs.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <span>투명도</span>
        <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} title="캡처 투명도" />
        <span data-testid="count">요소 {count}개</span>
        <span className="status" data-testid="status">{status}</span>
      </div>
      <div className="main">
        <div className="canvas" data-testid="canvas">
          <Tldraw hideUi shapeUtils={shapeUtils} onMount={onMount} autoFocus>
            <EditorGrab onEditor={setEditor} />
          </Tldraw>
        </div>
        {editor ? <Panel editor={editor} screen={screen} /> : <div className="panel" />}
      </div>
    </>
  );
}

import { useEditor } from "tldraw";
function EditorGrab({ onEditor }: { onEditor: (e: Editor) => void }) {
  const ed = useEditor();
  useEffect(() => onEditor(ed), [ed, onEditor]);
  return null;
}

export function App() {
  const [id, setId] = useState(SCREENS[0].id);
  const screen = SCREENS.find((s) => s.id === id) ?? SCREENS[0];
  const picker = (
    <select value={id} onChange={(e) => setId(e.target.value)} data-testid="screen-select">
      {SCREENS.map((s) => (
        <option key={s.id} value={s.id}>{s.id} ({s.label})</option>
      ))}
      {PENDING.map((p) => (
        <option key={p} value={p} disabled>{p} (준비 중)</option>
      ))}
    </select>
  );
  return (
    <div className="shell">
      <ScreenEditor key={screen.id} screen={screen} picker={picker} />
    </div>
  );
}

export type { ElementDef };
