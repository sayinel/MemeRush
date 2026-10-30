import { BaseBoxShapeUtil, HTMLContainer, T, type RecordProps, type TLBaseShape } from "tldraw";
import { INK } from "../screens/types";

// One custom shape for every game element: a picture or an outlined Anton text. Position/size = tldraw box
// (top-left); the panel and the save file convert to game coordinates (center, hero = bottom).
export type GameElementShape = TLBaseShape<
  "game-element",
  {
    w: number;
    h: number;
    name: string;
    kind: string; // image | text
    src: string;
    text: string;
    color: string;
    stroke: number;
    font: number;
    bg: string; // none | pill
    anchor: string; // center | bottom
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
    color: T.string,
    stroke: T.number,
    font: T.number,
    bg: T.string,
    anchor: T.string,
  };

  getDefaultProps(): GameElementShape["props"] {
    return { w: 100, h: 100, name: "", kind: "image", src: "", text: "", color: "#ffffff", stroke: 8, font: 40, bg: "none", anchor: "center" };
  }

  override canEdit() {
    return false;
  }

  component(shape: GameElementShape) {
    const p = shape.props;
    if (p.kind === "image") {
      return (
        <HTMLContainer>
          <img src={p.src} alt={p.name} draggable={false} style={{ width: p.w, height: p.h, objectFit: p.name === "__bg" ? "fill" : "contain", display: "block", pointerEvents: "none" }} />
        </HTMLContainer>
      );
    }
    const pill = p.bg === "pill";
    return (
      <HTMLContainer>
        <div
          style={{
            width: p.w,
            height: p.h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            boxSizing: "border-box",
            fontFamily: '"Anton", Impact, "Arial Black", sans-serif',
            fontSize: p.font,
            lineHeight: 1.08,
            color: p.color,
            WebkitTextStroke: `${p.stroke}px ${INK}`,
            paintOrder: "stroke fill",
            strokeLinejoin: "round",
            pointerEvents: "none",
            ...(pill ? { background: "#1f4788", border: "4px solid #fff", borderRadius: p.h / 2, boxShadow: "0 0 0 0" } : {}),
          }}
        >
          <span>{p.text}</span>
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
