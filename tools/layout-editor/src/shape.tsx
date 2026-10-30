import { BaseBoxShapeUtil, HTMLContainer, T, type JsonObject, type RecordProps, type TLBaseShape } from "tldraw";
import { INK } from "../screens/types";

// One custom shape for every game element: a picture or an outlined Anton text. Position/size = tldraw box
// (top-left); the panel and the save file convert to game coordinates (center, hero = bottom).
export type GameElementShape = TLBaseShape<
  "game-element",
  {
    w: number;
    h: number;
    name: string;
    kind: string; // image | text | box
    src: string;
    text: string;
    font: number;
    def: JsonObject; // the element definition from screens/<id>.ts (colors, stroke, font family ...)
  }
>;

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    "game-element": GameElementShape["props"];
  }
}

export class GameElementUtil extends BaseBoxShapeUtil<GameElementShape> {
  static override type = "game-element" as const;
  static override props: RecordProps<GameElementShape> = {
    w: T.number,
    h: T.number,
    name: T.string,
    kind: T.string,
    src: T.string,
    text: T.string,
    font: T.number,
    def: T.jsonValue as never,
  };

  getDefaultProps(): GameElementShape["props"] {
    return { w: 100, h: 100, name: "", kind: "image", src: "", text: "", font: 40, def: {} };
  }

  override canEdit() {
    return false;
  }

  component(shape: GameElementShape) {
    const p = shape.props;
    const d = p.def as Record<string, string | number | undefined>;
    if (p.kind === "image") {
      return (
        <HTMLContainer>
          <img src={p.src} alt={p.name} draggable={false} style={{ width: p.w, height: p.h, objectFit: p.name === "__bg" || d.fit === "fill" ? "fill" : "contain", display: "block", pointerEvents: "none" }} />
        </HTMLContainer>
      );
    }
    if (p.name === "__bgcss") {
      return (
        <HTMLContainer>
          <div style={{ width: p.w, height: p.h, background: String(d.fill ?? "#29baf5"), pointerEvents: "none" }} />
        </HTMLContainer>
      );
    }
    const anton = (d.family ?? "anton") === "anton";
    const stroke = Number(d.stroke ?? 0);
    const pill = d.bg === "pill";
    const isBox = p.kind === "box" || pill;
    const align = String(d.align ?? "center");
    const parts = p.text.split(/\[\[(.*?)\]\]/);
    return (
      <HTMLContainer>
        <div
          style={{
            width: p.w,
            height: p.h,
            display: "flex",
            alignItems: "center",
            justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
            textAlign: align as "left" | "center" | "right",
            boxSizing: "border-box",
            padding: align === "left" && isBox ? "0 36px" : 0,
            fontFamily: anton ? '"Anton", Impact, "Arial Black", sans-serif' : '"Noto Sans KR", system-ui, sans-serif',
            fontWeight: Number(d.weight ?? 400),
            fontSize: p.font,
            lineHeight: anton ? 1.05 : 1.3,
            color: String(d.color ?? "#fff"),
            WebkitTextStroke: stroke ? `${stroke}px ${d.strokeColor ?? INK}` : undefined,
            paintOrder: "stroke fill",
            textShadow: d.shadow ? String(d.shadow) : undefined,
            pointerEvents: "none",
            overflow: "hidden",
            whiteSpace: p.h < p.font * 1.7 ? "nowrap" : "normal",
            ...(pill ? { background: "#1f4788", border: "4px solid #fff", borderRadius: p.h / 2 } : {}),
            ...(p.kind === "box"
              ? { background: String(d.fill ?? "transparent"), border: d.borderW ? `${d.borderW}px solid ${d.border ?? "#fff"}` : undefined, borderRadius: Number(d.radius ?? 0) }
              : {}),
          }}
        >
          <span>
            {parts.map((t, i) => (i % 2 ? <span key={i} style={{ color: "#ffd54a" }}>{t}</span> : t))}
          </span>
        </div>
      </HTMLContainer>
    );
  }

  getIndicatorPath(shape: GameElementShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}
