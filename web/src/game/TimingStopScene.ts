import { ROUND1_LAYOUT as R1 } from "./layout_round1";
import * as Phaser from "phaser";
import type { Challenge } from "@/lib/challenge";
import { fillCaption, formatClock, parseLabel, pickCaption } from "./captions";
import {
  GAME_HEIGHT as H,
  GAME_WIDTH as W,
  TIMING_STOP_SCENE_KEY,
  type FinishResult,
  type GameBridge,
  type TimingStopSceneData,
} from "./types";

// Color tokens from docs/GAME_SCREEN_GUIDE.md §3 (canvas, so plain numbers instead of CSS variables).
const C = {
  sky: 0x29baf5,
  skyLight: 0xb9e9fa,
  skyDeep: 0x0aa0fe,
  navy: 0x1f4788,
  ink: 0x141d24,
  white: 0xffffff,
  mascot: 0xec8323,
  mascotLight: 0xeaa43b,
  mascotLine: 0x804526,
  gold: 0xfede25,
  hot: 0xffc531,
  green: 0x17803f,
  red: 0xc93a52,
} as const;
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const FONT = '"Anton", Impact, "Arial Black", sans-serif';

// Real art: /game/manifest.json maps texture key -> file in /game/. Only listed files load; any missing key
// falls back to a code-drawn stand-in. Keys: {player}_{expression}, bg_{background}, {boss}_walk, {boss}_grab,
// timer_panel, door, email_pile, meeting_card, clock_button, banner_gold, trophy, star, duck.
const MANIFEST_KEY = "game_manifest";
const ASSET_BASE = "/game/";
type Expr = "deadpan" | "shocked" | "smug" | "crying" | "sweating" | "laughing" | "facepalm" | "proud" | "bored" | "dragged";

const INTRO_MS = 2000;
const REACTION_MS = 3000;
const FINAL_MS = 3000;
const GRABBED_MS = 3000; // boss drags the worker out of frame, then the result screen takes over
const NICE_MS = 100;
// Server rejects measurements outside 1–15 s (docs/MVP_SCOPE.md §2 측정·검증).
const MIN_TAP_MS = 1000;
const MAX_TAP_MS = 15000;

// Panel center; w/h are the digit-box size the code-drawn fallback uses.
const CLOCK = { x: R1.clock_panel.x, y: R1.clock_panel.y, w: R1.clock_digits.w, h: R1.clock_digits.h };
const HOME = { x: R1.hero.x, y: R1.hero.y - R1.hero.h * 0.1 }; // worker feet (sprite origin is 90% down the box) // worker feet
const BUTTON = { x: R1.button.x, y: R1.button.y };
const DOOR = { x: 640, y: 822 };
const FLOOR_Y = 955;
const CAP_TOP_Y = 245;
const CAP_BOTTOM_Y = 1132;
const RESULT_Y = 525;
const WORKER_PX = R1.hero.w; // displayed sprite box (sprites are square with feet near the bottom)

type Phase = "boot" | "intro" | "starting" | "play" | "reaction" | "submitting" | "final" | "done" | "error";
type Caption = { top: string; bottom: string };
type Pt = { x: number; y: number };

function starPoints(cx: number, cy: number, outer: number, inner: number, n: number, rot = -Math.PI / 2): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k < n * 2; k++) {
    const r = k % 2 ? inner : outer;
    const a = rot + (k * Math.PI) / n;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export class TimingStopScene extends Phaser.Scene {
  private challenge!: Challenge;
  private bridge!: GameBridge;
  private run = 0;
  private phase: Phase = "boot";
  private round = 0;
  private roundStart = 0;
  private hiderShown = false;
  private elapsed: number[] = [];
  private retry: (() => void) | null = null;

  private worker!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Image;
  private bodyScale = 1;
  private doorPanel!: Phaser.GameObjects.Container;
  private clockGroup!: Phaser.GameObjects.Container;
  private clockText!: Phaser.GameObjects.Text;
  private button!: Phaser.GameObjects.Container;
  private buttonCap!: Phaser.GameObjects.Container;
  private roundText!: Phaser.GameObjects.Text;
  private capTop!: Phaser.GameObjects.Text;
  private capBottom!: Phaser.GameObjects.Text;
  private hider: Phaser.GameObjects.Container | null = null;
  private stageFx: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(TIMING_STOP_SCENE_KEY);
  }

  init(data: TimingStopSceneData) {
    // The scene instance survives restart(), so reset every per-play field here.
    this.challenge = data.challenge;
    this.bridge = data.bridge;
    this.run += 1;
    this.phase = "boot";
    this.round = 0;
    this.roundStart = 0;
    this.hiderShown = false;
    this.elapsed = [];
    this.retry = null;
    this.hider = null;
    this.stageFx = [];
  }

  preload() {
    const queue = (manifest: Record<string, string> | undefined) => {
      for (const [key, file] of Object.entries(manifest ?? {})) {
        if (!this.textures.exists(key)) this.load.image(key, `${ASSET_BASE}${file}`);
      }
    };
    if (this.cache.json.exists(MANIFEST_KEY)) {
      queue(this.cache.json.get(MANIFEST_KEY));
      return;
    }
    // Files added while the loader runs join the same load, so create() still waits for every listed image.
    this.load.once(`filecomplete-json-${MANIFEST_KEY}`, (_key: string, _type: string, data: Record<string, string>) => queue(data));
    this.load.json(MANIFEST_KEY, `${ASSET_BASE}manifest.json`);
  }

  create() {
    this.makeTextures();
    this.drawBackground();
    this.drawDoor();
    this.drawButton();
    this.drawClock();
    this.drawWorker();
    this.drawHud();

    // Measurement uses a native listener + performance timebase, never Phaser's clock.
    const canvas = this.game.canvas;
    canvas.style.touchAction = "manipulation";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("keydown", this.onKeyDown);
    const detach = () => {
      canvas.removeEventListener("pointerdown", this.onPointerDown);
      window.removeEventListener("keydown", this.onKeyDown);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, detach);
    this.events.once(Phaser.Scenes.Events.DESTROY, detach);

    this.startIntro(0);
  }

  update() {
    if (this.phase !== "play") return;
    const el = performance.now() - this.roundStart;
    if (!this.hiderShown) {
      this.clockText.setText(formatClock(this.startMs() + el));
      if (el >= this.challenge.frameParams.visibleMs) this.showHider();
    }
    if (el >= MAX_TAP_MS) this.recordTap(this.roundStart + MAX_TAP_MS);
  }

  // ---------- input ----------

  private onPointerDown = (e: PointerEvent) => {
    const now = performance.now();
    // event.timeStamp shares performance.now()'s timebase and marks the actual press; fall back if it looks off.
    const t = e.timeStamp > 0 && e.timeStamp <= now ? e.timeStamp : now;
    if (!e.isPrimary) return;
    if (this.phase === "play") this.recordTap(t);
    else if (this.phase === "error" && this.retry) {
      const retry = this.retry;
      this.retry = null;
      retry();
    }
  };

  // PC: Space / Enter stop the clock like a tap.
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat || (e.code !== "Space" && e.code !== "Enter")) return;
    if (this.phase !== "play") return;
    const t = performance.now();
    if (e.code === "Space") e.preventDefault();
    this.recordTap(e.timeStamp > 0 && e.timeStamp <= t ? e.timeStamp : t);
  };

  private recordTap(t: number) {
    if (this.phase !== "play") return;
    const el = Math.round(t - this.roundStart);
    if (el < MIN_TAP_MS) return;
    this.elapsed[this.round] = el;
    this.phase = "reaction";
    this.playReaction(el);
  }

  // ---------- flow ----------

  private startIntro(i: number) {
    const run = this.run;
    this.phase = "intro";
    this.round = i;
    this.hiderShown = false;
    this.resetStage();
    const rounds = this.challenge.meme.theme.rounds;
    this.roundText.setText(`ROUND ${i + 1}/${rounds.length}`);
    this.clockText.setText(formatClock(this.startMs()));
    const target = this.startMs() + this.challenge.frameParams.targetMs[i];
    // The label already carries its take number ("TAKE 1: ..."), and the ROUND n/N chip is top left: no "ROUND n:" prefix.
    this.capTop.setY(R1.caption_top.y);
    this.setCaption(this.capTop, rounds[i].label, R1.caption_top.font);
    this.capBottom.setY(R1.tap_at.y);
    this.setCaption(this.capBottom, `TAP AT ${formatClock(target, false)}`, R1.tap_at.font);

    this.setFace("laughing");
    this.tweens.add({ targets: this.worker, y: HOME.y - 26, duration: 180, yoyo: true, repeat: 3, ease: "Quad.Out" });
    this.squash(1.12, 0.88, 180, 3);

    // Short ribbon in the free area right of the hero (the hero sits left, the stop button lower right); the
    // description goes in the gap between the top caption and the clock, so nothing covers the face or the button.
    const card = this.makeBanner(i === 0 ? "GET READY" : "NEXT TAKE", 380, {
      size: R1.ribbon_label.font,
      x: R1.ribbon_label.x - R1.ribbon.x,
      y: R1.ribbon_label.y - R1.ribbon.y,
      fit: { w: R1.ribbon.w, h: R1.ribbon.h },
    })
      .setPosition(W + 400, R1.ribbon.y)
      .setDepth(25);
    let prompt: Phaser.GameObjects.Text | null = null;
    if (i === 0) {
      prompt = this.txt(R1.prompt_text.x, R1.prompt_text.y, this.challenge.meme.prompt, R1.prompt_text.font, { strokeThickness: 6, wordWrap: { width: R1.prompt_text.w }, align: "center" }).setDepth(60).setAlpha(0);
      this.tweens.add({ targets: prompt, alpha: 1, duration: 300 });
    }
    this.tweens.add({ targets: card, x: R1.ribbon.x, duration: 380, ease: "Back.Out" });
    this.tweens.add({ targets: card, x: W * 1.6, delay: INTRO_MS - 300, duration: 300, ease: "Back.In" });
    this.time.delayedCall(INTRO_MS, () => {
      if (run !== this.run) return;
      card.destroy();
      prompt?.destroy();
      if (i === 0) this.beginFirstRound();
      else this.startPlay(performance.now()); // rounds 2+ start when the intro card ends
    });
  }

  private beginFirstRound() {
    const run = this.run;
    this.phase = "starting";
    const wait = this.txt(W / 2, 680, "GET READY…", 64, { strokeThickness: 12 }).setDepth(60);
    this.bridge.beforeStart().then(
      () => {
        const t = performance.now(); // round 1 starts when the server attempt exists
        if (run !== this.run) return;
        wait.destroy();
        this.startPlay(t);
      },
      () => {
        if (run !== this.run) return;
        wait.destroy();
        this.showError(() => this.beginFirstRound());
      },
    );
  }

  private startPlay(t: number) {
    this.roundStart = t;
    // Read-only timing marker for automated QA (performance.now() timebase); nothing in the game reads it.
    (window as unknown as { __mrRound?: { start: number; index: number } }).__mrRound = { start: t, index: this.round };
    this.phase = "play";
    // Nervous foot-tapping, wobble and sweat while waiting.
    this.setFace("sweating");
    this.resetWorkerTweens();
    this.tweens.add({ targets: this.worker, y: HOME.y - 12, duration: 140, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({ targets: this.body, angle: { from: -3, to: 3 }, duration: 110, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: this.capBottom, scale: 1.05, duration: 450, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    for (let k = 0; k < 2; k++) {
      const x = HOME.x + (k ? 120 : -120);
      const drop = this.add.image(x, HOME.y - 270, "__drop").setDepth(31).setScale(0.9);
      this.stageFx.push(drop);
      this.tweens.add({ targets: drop, y: HOME.y - 200, x: x + (k ? 24 : -24), alpha: 0, delay: k * 350, duration: 700, repeat: -1 });
    }
  }

  private showHider() {
    this.hiderShown = true;
    const key = this.challenge.meme.theme.rounds[this.round].hider;
    const h = this.makeHider(key);
    this.hider = h;
    // A tap can land while the hider is still flying in; then the reaction owns the clock.
    const cover = () => this.phase === "play" && this.clockText.setVisible(false);
    if (key === this.challenge.meme.theme.boss) {
      h.setPosition(W + 400, CLOCK.y - 20);
      this.tweens.add({ targets: h, x: CLOCK.x, duration: 320, ease: "Quad.Out", onComplete: cover });
      this.tweens.add({ targets: h, angle: { from: -4, to: 4 }, duration: 110, yoyo: true, repeat: 2 });
    } else if (key === "meeting_card") {
      h.setPosition(CLOCK.x, -250).setAngle(-25);
      this.tweens.add({ targets: h, y: CLOCK.y, angle: 4, duration: 300, ease: "Back.Out", onComplete: cover });
    } else {
      h.setPosition(CLOCK.x, -250);
      this.tweens.add({ targets: h, y: CLOCK.y, duration: 300, ease: "Bounce.Out", onComplete: cover });
    }
  }

  private playReaction(el: number) {
    const run = this.run;
    const i = this.round;
    const err = el - this.challenge.frameParams.targetMs[i];
    const abs = Math.abs(err);
    const nice = abs <= NICE_MS;
    this.stopWaiting();
    this.hiderShown = true;
    this.setCaption(this.capBottom, "");

    // Tap: slam the big red button.
    this.pressButton();
    this.squash(1.2, 0.8, 90, 0);

    // Stopped time revealed on the clock.
    this.clockText.setText(formatClock(this.startMs() + el)).setVisible(true).setColor(nice ? hex(C.gold) : hex(C.white));
    // Round error, small pill in the corner.
    const sign = err > 0 ? "+" : err < 0 ? "−" : "±";
    const n = this.challenge.frameParams.rounds;
    this.pill(W - 97 - (n - 1 - i) * 162, 52, 154, `R${i + 1} ${sign}${(abs / 1000).toFixed(3)}s`, nice ? C.gold : C.hot, false);

    const h = this.hider;
    if (h) this.tweens.killTweensOf(h);
    if (nice) {
      if (h) this.tweens.add({ targets: h, y: -400, angle: 30, duration: 300, ease: "Quad.In" });
      this.setFace("proud");
      this.tweens.add({ targets: this.worker, x: HOME.x + 40, y: HOME.y - 30, duration: 200, yoyo: true, hold: 700, ease: "Quad.Out" });
      this.starburst(480, 640, "NICE");
    } else if (err < 0) {
      if (h) this.tweens.add({ targets: h, y: -400, duration: 300, ease: "Quad.In" });
      this.setFace("facepalm");
      this.tweens.add({
        targets: this.worker,
        x: DOOR.x - 150,
        duration: 380,
        ease: "Quad.Out",
        onComplete: () => {
          // Slips right in front of the door.
          this.tweens.add({ targets: this.worker, angle: -80, x: DOOR.x - 120, y: HOME.y - 10, duration: 260, ease: "Back.Out" });
          this.squash(1.15, 0.85, 120, 0);
        },
      });
      this.popLabel("TOO EARLY", C.red);
    } else {
      // The hider drops into the worker's path and he runs straight into it.
      if (h) this.tweens.add({ targets: h, x: 470, y: 800, scale: h.scale * 0.45, angle: 0, duration: 260, ease: "Quad.In" });
      this.setFace("shocked");
      this.tweens.add({
        targets: this.worker,
        x: 300,
        delay: 200,
        duration: 220,
        ease: "Quad.In",
        onComplete: () => {
          this.cameras.main.shake(160, 0.012);
          this.squash(0.8, 1.15, 110, 1);
          this.tweens.add({ targets: this.worker, x: 210, angle: -16, duration: 300, ease: "Back.Out" });
        },
      });
      this.popLabel("TOO LATE", C.red);
    }

    this.time.delayedCall(REACTION_MS, () => {
      if (run !== this.run) return;
      if (i + 1 < this.challenge.frameParams.rounds) this.startIntro(i + 1);
      else this.submit();
    });
  }

  private submit() {
    const run = this.run;
    this.phase = "submitting";
    this.resetStage();
    this.setFace("bored");
    const wait = this.txt(W / 2, 680, "CHECKING…", 64, { strokeThickness: 12 }).setDepth(60);
    this.tweens.add({ targets: wait, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    this.bridge.complete([...this.elapsed]).then(
      (result) => {
        if (run !== this.run) return;
        wait.destroy();
        this.playFinal(result);
      },
      () => {
        if (run !== this.run) return;
        wait.destroy();
        this.showError(() => this.submit());
      },
    );
  }

  private playFinal(result: FinishResult) {
    const run = this.run;
    this.phase = "final";
    this.capTop.setY(CAP_TOP_Y);
    this.capBottom.setY(CAP_BOTTOM_Y);
    const caption: Caption = pickCaption(this.challenge, result);

    this.setCaption(this.capTop, "");
    this.setCaption(this.capBottom, "");
    this.tweens.add({ targets: this.clockGroup, y: CLOCK.y - 60, alpha: 0, scale: 0.6, duration: 220, ease: "Quad.In" });
    this.tweens.add({ targets: this.button, alpha: 0, scale: 0.4, duration: 200, ease: "Quad.In" });

    if (result.outcome === "win") this.finalWin(result);
    else if (result.outcomeVariant === "early") this.finalGrabbed(result);
    else this.finalBuried(result);

    // early (grabbed): the trailer lines "NOT SO FAST." then "BACK TO YOUR DESK" replace the card captions.
    const grabbed = result.outcome !== "win" && result.outcomeVariant === "early";
    if (grabbed) {
      this.time.delayedCall(250, () => {
        if (run === this.run) this.setCaption(this.capTop, "NOT SO FAST.");
      });
    } else {
      this.time.delayedCall(350, () => {
        if (run !== this.run) return;
        this.setCaption(this.capTop, this.fillTemplate(caption.top, result));
        this.time.delayedCall(450, () => {
          if (run !== this.run) return;
          this.setCaption(this.capBottom, this.fillTemplate(caption.bottom, result));
        });
      });
    }
    this.time.delayedCall(grabbed ? GRABBED_MS : FINAL_MS, () => {
      if (run !== this.run) return;
      this.phase = "done";
      this.bridge.finished(result);
    });
  }

  private showError(retry: () => void) {
    this.phase = "error";
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(this.add.rectangle(W / 2, H / 2, W, H, C.ink, 0.78));
    overlay.add(this.txt(W / 2, H / 2 - 40, "CONNECTION PROBLEM", 60, { color: hex(C.hot), strokeThickness: 12 }));
    overlay.add(this.txt(W / 2, H / 2 + 40, "TAP TO RETRY", 48, { strokeThickness: 10 }));
    this.retry = () => {
      overlay.destroy();
      retry();
    };
  }

  // ---------- final outcomes ----------

  private finalWin(result: FinishResult) {
    this.setFace("smug");
    this.tweens.add({ targets: this.worker, x: 250, scale: 1.12, duration: 320, ease: "Back.Out" });
    this.squash(1.12, 0.9, 200, 3);
    this.cameras.main.flash(220, 254, 222, 37);

    const banner = this.makeBanner("PERFECT", 360).setPosition(W / 2, -120).setDepth(70);
    this.stageFx.push(banner);
    this.tweens.add({ targets: banner, y: 365, delay: 120, duration: 420, ease: "Back.Out" });
    for (const side of [-1, 1]) {
      const s = this.add.image(W / 2 + side * 270, 350, this.tex("star", "__star")).setDepth(71).setScale(0);
      this.stageFx.push(s);
      this.tweens.add({ targets: s, scale: 0.75, angle: side * 20, delay: 420, duration: 300, ease: "Back.Out" });
    }
    this.bigNumber(result, C.gold, C.navy);

    const trophy = this.makeTrophy().setPosition(530, 845).setDepth(32).setScale(0);
    this.stageFx.push(trophy);
    this.tweens.add({ targets: trophy, scale: 1, delay: 450, duration: 360, ease: "Back.Out" });
    this.tweens.add({ targets: trophy, angle: { from: -6, to: 6 }, delay: 800, duration: 500, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  }

  // One composite sprite (boss + worker, drag_combo.png, already facing left) runs in from the right and drags
  // the worker off the left edge. Height ~40% of the screen; the art keeps the 1.5x boss/worker ratio.
  private finalGrabbedCombo(result: FinishResult, run: number) {
    this.bigNumber(result, C.red, C.white);
    this.worker.setAlpha(0); // the worker is part of the composite (resetStage restores him)
    const img = this.add.image(W + 420, FLOOR_Y + 30, "drag_combo").setOrigin(0.5, 1).setDepth(40);
    img.setScale((H * 0.4) / img.height);
    this.stageFx.push(img);
    this.tweens.add({ targets: img, y: "-=14", duration: 170, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({ targets: img, angle: { from: -2, to: 2 }, duration: 170, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: img, x: -420, duration: 2600, delay: 200, ease: "Sine.InOut" });
    this.time.delayedCall(900, () => {
      if (run === this.run) this.setCaption(this.capBottom, "BACK TO YOUR DESK");
    });
  }

  // Boss art path: the boss walks right (flipped art, pointing ahead) and holds the worker by the scruff with a
  // code-drawn arm; the worker trails behind on the left, leaning back with his feet off the floor.
  private finalGrabbedArt(result: FinishResult, run: number) {
    this.bigNumber(result, C.red, C.white);
    if (this.textures.exists("door")) {
      this.stageFx.push(this.add.image(DOOR.x + 40, DOOR.y, "door").setDisplaySize(170, 290).setDepth(20));
    }
    const BOSS_H = Math.round(WORKER_PX * 1.5);
    const boss = this.makeBoss(true, BOSS_H, true).setPosition(-300, FLOOR_Y + 15).setDepth(32).setScale(-1, 1);
    this.stageFx.push(boss);
    const arm = this.add.graphics().setDepth(36);
    this.stageFx.push(arm);
    this.setFace("shocked");
    this.tweens.add({ targets: this.worker, x: 240, duration: 300, ease: "Quad.Out" });
    // Arm from the boss's rear shoulder to the worker's scruff (elbow bent), fist at the end.
    const drawArm = () => {
      const sx = boss.x - 95;
      const sy = boss.y - BOSS_H * 0.5;
      const ex = this.worker.x + 12;
      const ey = this.worker.y - 262;
      const mx = (sx + ex) / 2;
      const my = Math.max(sy, ey) + 35; // elbow sags below the line
      arm.clear();
      for (const [w, col] of [[40, 0xffffff], [28, 0x14181c]] as const) {
        arm.lineStyle(w, col, 1).beginPath().moveTo(sx, sy).lineTo(mx, my).lineTo(ex, ey).strokePath();
      }
      arm.fillStyle(0xffffff).fillCircle(ex, ey, 34);
      arm.fillStyle(0x9aa0a8).fillCircle(ex, ey, 26);
    };
    arm.setVisible(false);
    this.tweens.add({
      targets: boss,
      x: 540,
      delay: 250,
      duration: 650,
      ease: "Quad.Out",
      onComplete: () => {
        if (run !== this.run) return;
        this.cameras.main.shake(140, 0.01);
        arm.setVisible(true);
        drawArm();
        // Hoisted: leans back, feet off the floor, flailing a little.
        this.tweens.add({ targets: this.worker, angle: -12, y: HOME.y - 28, duration: 220, ease: "Quad.Out" });
        this.time.delayedCall(450, () => {
          if (run !== this.run) return;
          this.setCaption(this.capBottom, "BACK TO YOUR DESK");
          this.tweens.add({ targets: this.body, angle: { from: -5, to: 5 }, duration: 90, yoyo: true, repeat: -1 });
          this.tweens.add({ targets: boss, y: "-=10", duration: 160, yoyo: true, repeat: -1 });
          this.tweens.add({ targets: [boss, this.worker], x: "+=780", duration: 1400, ease: "Sine.In", onUpdate: drawArm });
        });
      },
    });
  }

  private finalGrabbed(result: FinishResult) {
    const run = this.run;
    if (this.textures.exists("drag_combo")) return this.finalGrabbedCombo(result, run);
    if (this.textures.exists(`${this.challenge.meme.theme.boss}_grab`)) return this.finalGrabbedArt(result, run);
    this.bigNumber(result, C.red, C.white);
    const hasArt = this.textures.exists(`${this.challenge.meme.theme.boss}_grab`);
    // Exit door waits on the right (trailer scene); boss and worker leave through it, past the screen edge.
    if (this.textures.exists("door")) {
      const door = this.add.image(DOOR.x + 40, DOOR.y, "door").setDisplaySize(170, 290).setDepth(20);
      this.stageFx.push(door);
    }
    // The boss reads ~1.5x the worker's height (worker box is WORKER_PX tall); feet on the floor line.
    const boss = this.makeBoss(true, hasArt ? Math.round(WORKER_PX * 1.5) : 400, hasArt).setPosition(-300, FLOOR_Y + 15).setDepth(32);
    if (hasArt) boss.setScale(-1, 1); // flipped: the pointing arm faces the direction of travel (right, toward the worker and the door)
    this.stageFx.push(boss);
    this.setFace("shocked");
    this.tweens.add({ targets: this.worker, x: 420, duration: 360, ease: "Quad.Out" });
    this.tweens.add({
      targets: boss,
      x: hasArt ? 150 : 250,
      delay: 250,
      duration: 380,
      ease: "Quad.Out",
      onComplete: () => {
        if (run !== this.run) return;
        this.cameras.main.shake(140, 0.01);
        // With real art the boss's own arm holds the worker, so the stand-in hand is hidden.
        const hand = this.makeHand().setPosition(this.worker.x - 40, this.worker.y - 300).setDepth(40).setVisible(!hasArt);
        this.stageFx.push(hand);
        this.squash(1.25, 0.72, 120, 1);
        // Held by the scruff: tilted, flailing while dragged right, off the screen edge (~1.4 s).
        this.time.delayedCall(450, () => {
          if (run !== this.run) return;
          this.setCaption(this.capBottom, "BACK TO YOUR DESK");
          this.tweens.add({ targets: this.worker, angle: hasArt ? 8 : 22, duration: 200, ease: "Quad.Out" }); // the art is already tilted
          this.tweens.add({ targets: this.body, angle: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: -1 });
          this.tweens.add({ targets: [boss, this.worker, hand], x: "+=820", duration: 1400, ease: "Sine.In" });
        });
      },
    });
  }

  private finalBuried(result: FinishResult) {
    this.bigNumber(result, C.red, C.white);
    this.setFace("shocked");
    this.tweens.add({ targets: this.worker, x: 280, duration: 300, ease: "Quad.Out" });
    const card = this.makeHider("meeting_card").setPosition(300, -300).setScale(0.45).setAngle(-30).setDepth(40);
    this.stageFx.push(card);
    this.tweens.add({
      targets: card,
      y: HOME.y - 300,
      angle: 8,
      delay: 250,
      duration: 360,
      ease: "Bounce.Out",
      onComplete: () => {
        this.cameras.main.shake(500, 0.02);
        this.tweens.add({ targets: card, x: 560, y: 900, angle: 40, scale: 0.3, duration: 320, ease: "Quad.In" });
        // Crying close-up: zoom in, speed lines behind, poof where the card landed.
        this.setFace("crying");
        const cx = 290;
        const cy = 800;
        const lines = this.add.graphics().setDepth(25).setAlpha(0);
        this.stageFx.push(lines);
        lines.fillStyle(C.ink, 0.85);
        for (let k = 0; k < 36; k++) {
          const a = (k / 36) * Math.PI * 2 + (k % 3) * 0.04;
          const r0 = 300 + (k % 4) * 30;
          const p = (r: number, d: number) => ({ x: cx + Math.cos(a + d) * r, y: cy + Math.sin(a + d) * r });
          const a1 = p(r0, 0);
          const b = p(1100, 0.022);
          const c = p(1100, -0.022);
          lines.fillTriangle(a1.x, a1.y, b.x, b.y, c.x, c.y);
        }
        this.tweens.add({ targets: lines, alpha: 1, duration: 200 });
        this.tweens.add({ targets: this.worker, x: cx, y: HOME.y + 110, scale: 1.8, duration: 320, ease: "Back.Out" });
        this.tweens.add({ targets: this.body, angle: { from: -2, to: 2 }, delay: 320, duration: 90, yoyo: true, repeat: -1 });

        const poof = this.makePoof().setPosition(560, 850).setDepth(45).setScale(0.3);
        this.stageFx.push(poof);
        this.tweens.add({ targets: poof, scale: 1, duration: 300, ease: "Back.Out" });
        const duck = this.makeDuck().setPosition(590, 700).setDepth(46).setScale(0);
        this.stageFx.push(duck);
        this.tweens.add({ targets: duck, scale: 0.9, delay: 300, duration: 300, ease: "Back.Out" });
        this.tweens.add({ targets: duck, angle: { from: -12, to: 12 }, delay: 600, duration: 260, yoyo: true, repeat: -1 });
      },
    });
  }

  // ---------- drawing ----------

  private makeTextures() {
    // Small reusable textures, generated once per game (they survive scene restarts).
    const gen = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({}, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    gen("__drop", 40, 56, (g) => {
      g.fillStyle(C.white).fillCircle(20, 36, 18).fillTriangle(4, 30, 36, 30, 20, 0);
      g.fillStyle(C.sky).fillCircle(20, 36, 13).fillTriangle(9, 32, 31, 32, 20, 8);
      g.fillStyle(C.white, 0.8).fillCircle(15, 36, 4);
    });
    gen("__star", 128, 128, (g) => {
      g.fillStyle(C.white).fillPoints(starPoints(64, 66, 62, 30, 5), true);
      g.fillStyle(C.gold).fillPoints(starPoints(64, 66, 52, 24, 5), true);
      g.lineStyle(3, C.mascotLine).strokePoints(starPoints(64, 66, 52, 24, 5), true);
      g.fillStyle(C.white, 0.55).fillEllipse(54, 52, 14, 22);
    });
    gen("__worker", 533, 533, (g) => {
      g.fillStyle(C.white).fillEllipse(266, 290, 380, 400);
      g.fillStyle(C.mascotLine).fillEllipse(206, 470, 80, 36).fillEllipse(326, 470, 80, 36);
      g.fillStyle(C.mascot).fillEllipse(266, 290, 350, 370);
      g.lineStyle(6, C.mascotLine).strokeEllipse(266, 290, 350, 370);
      g.fillStyle(C.mascotLight).fillEllipse(196, 190, 60, 40);
      g.fillStyle(C.ink).fillCircle(216, 260, 14).fillCircle(316, 260, 14);
      g.fillStyle(C.red).fillTriangle(250, 360, 282, 360, 266, 440);
    });
  }

  private drawBackground() {
    const bg = `bg_${this.challenge.meme.theme.background}`;
    if (this.textures.exists(bg)) {
      this.add.image(W / 2, H / 2, bg).setDisplaySize(W, H);
      return;
    }
    const g = this.add.graphics();
    g.fillGradientStyle(C.skyDeep, C.skyDeep, C.skyLight, C.skyLight, 1).fillRect(0, 0, W, H);

    // Soft radial rays from behind the clock, turning slowly (transform only, no per-frame redraw).
    const rays = this.add.graphics({ x: CLOCK.x, y: CLOCK.y }).setDepth(1);
    rays.fillStyle(C.white, 0.13);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const b = a + Math.PI / 20;
      rays.fillTriangle(0, 0, Math.cos(a) * 1500, Math.sin(a) * 1500, Math.cos(b) * 1500, Math.sin(b) * 1500);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 60000, repeat: -1 });

    // Puffy clouds.
    for (const [x, y, s] of [
      [90, 300, 1],
      [650, 600, 0.8],
      [70, 720, 0.7],
      [600, 160, 0.6],
    ]) {
      const cloud = this.makeCloud(s).setPosition(x, y).setDepth(2);
      this.tweens.add({ targets: cloud, x: x + 24, duration: 5000 + y * 4, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }

    // Sparkles.
    for (const [x, y] of [
      [170, 560],
      [560, 270],
      [640, 470],
      [70, 470],
    ]) {
      const s = this.add.image(x, y, this.tex("star", "__star")).setScale(0.32).setDepth(3);
      this.tweens.add({ targets: s, scale: 0.42, alpha: 0.6, duration: 700 + x, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }

    // Cloud bank floor.
    const f = this.add.graphics().setDepth(4);
    f.fillStyle(C.skyLight);
    for (let x = -40; x <= W + 40; x += 110) f.fillCircle(x + 50, FLOOR_Y + 10, 78);
    f.fillStyle(C.white);
    for (let x = -40; x <= W + 40; x += 90) f.fillCircle(x, FLOOR_Y + 46 + (x % 3) * 6, 70 + (x % 4) * 6);
    f.fillGradientStyle(C.white, C.white, C.skyLight, C.skyLight, 1).fillRect(0, FLOOR_Y + 70, W, H - FLOOR_Y - 70);
  }

  private makeCloud(s: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setScale(s);
    const g = this.add.graphics();
    const puffs: [number, number, number][] = [
      [0, 0, 56],
      [-62, 18, 42],
      [62, 14, 46],
      [-28, -30, 44],
      [30, -36, 50],
    ];
    g.fillStyle(C.skyLight);
    for (const [x, y, r] of puffs) g.fillCircle(x, y + 10, r);
    g.fillStyle(C.white);
    for (const [x, y, r] of puffs) g.fillCircle(x, y, r);
    g.fillRect(-100, 10, 200, 40);
    c.add(g);
    return c;
  }

  private drawDoor() {
    const key = this.challenge.meme.theme.goal;
    const door = this.add.container(DOOR.x, DOOR.y).setDepth(5);
    // The paper-confetti sprite is retired (result-v2): a day file that still names it as the goal shows no goal object.
    if (key === "confetti_star") {
      this.doorPanel = this.add.container(0, 0);
      return;
    }
    if (this.textures.exists(key)) {
      door.add(this.add.image(0, 0, key).setDisplaySize(170, 290));
      this.doorPanel = this.add.container(0, 0);
      return;
    }
    const g = this.add.graphics();
    g.fillStyle(C.white).fillRoundedRect(-82, -138, 164, 274, 18);
    g.fillStyle(C.navy).fillRoundedRect(-72, -128, 144, 256, 12);
    this.doorPanel = this.add.container(-66, 0);
    const panel = this.add.graphics();
    panel.fillStyle(C.mascotLine).fillRoundedRect(0, -122, 132, 248, 8);
    panel.lineStyle(4, C.ink, 0.45).strokeRoundedRect(16, -100, 100, 80, 8).strokeRoundedRect(16, 0, 100, 100, 8);
    panel.fillStyle(C.white, 0.12).fillRect(8, -116, 18, 236);
    panel.fillStyle(C.gold).fillCircle(112, 10, 10);
    this.doorPanel.add(panel);
    const sign = this.add.graphics();
    sign.fillStyle(C.white).fillRoundedRect(-62, -200, 124, 50, 14);
    sign.fillStyle(C.green).fillRoundedRect(-56, -194, 112, 38, 10);
    door.add([g, this.doorPanel, sign, this.txt(0, -175, "EXIT", 30, { strokeThickness: 0 })]);
  }

  private drawButton() {
    const c = this.add.container(BUTTON.x, BUTTON.y).setDepth(28);
    this.button = c;
    if (this.textures.exists("clock_button")) {
      const img = this.add.image(0, 0, "clock_button").setOrigin(0.5, 0.85);
      this.fitImage(img, R1.button.w, R1.button.h); // contain, like the Figma frame
      c.setY(BUTTON.y + (0.85 - 0.5) * img.displayHeight); // BUTTON is the art's box center; the sprite origin sits 85% down
      this.buttonCap = this.add.container(0, 0, [img]);
      c.add(this.buttonCap);
      return;
    }
    const base = this.add.graphics();
    base.fillStyle(C.ink, 0.18).fillEllipse(0, 14, 210, 40);
    base.fillStyle(C.white).fillEllipse(0, 0, 196, 76);
    base.fillStyle(C.navy).fillEllipse(0, 0, 182, 62);
    base.lineStyle(4, C.ink).strokeEllipse(0, 0, 182, 62);
    const cap = this.add.graphics();
    cap.fillStyle(C.white).fillEllipse(0, -44, 158, 78).fillRect(-79, -44, 158, 30).fillEllipse(0, -14, 158, 70);
    cap.fillStyle(C.red).fillEllipse(0, -14, 142, 56).fillRect(-71, -44, 142, 30);
    cap.fillStyle(C.ink, 0.25).fillEllipse(0, -14, 142, 56);
    cap.fillStyle(C.red).fillEllipse(0, -44, 142, 62);
    cap.lineStyle(4, C.ink).strokeEllipse(0, -44, 142, 62);
    cap.fillStyle(C.white, 0.55).fillEllipse(-26, -54, 54, 16);
    this.buttonCap = this.add.container(0, 0, [cap]);
    c.add([base, this.buttonCap]);
  }

  private drawClock() {
    this.clockGroup = this.add.container(CLOCK.x, CLOCK.y).setDepth(10);
    const { w, h } = CLOCK;
    if (this.textures.exists("timer_panel")) {
      this.clockGroup.add(this.fitImage(this.add.image(0, 0, "timer_panel"), R1.clock_panel.w, R1.clock_panel.h));
    } else {
      const g = this.add.graphics();
      g.fillStyle(C.ink, 0.2).fillRoundedRect(-w / 2 - 14, -h / 2 - 2, w + 28, h + 28, 44);
      g.fillStyle(C.white).fillRoundedRect(-w / 2 - 16, -h / 2 - 16, w + 32, h + 32, 46);
      g.fillStyle(C.hot).fillRoundedRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, 40);
      g.fillStyle(C.gold).fillRoundedRect(-w / 2 - 8, -h / 2 - 8, w + 16, h / 2 + 8, { tl: 40, tr: 40, bl: 0, br: 0 });
      g.lineStyle(3, C.mascotLine).strokeRoundedRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, 40);
      g.fillStyle(C.navy).fillRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 28);
      g.lineStyle(4, C.mascotLine).strokeRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 28);
      g.fillStyle(C.white, 0.1).fillRoundedRect(-w / 2 + 16, -h / 2 + 14, w - 32, h / 2 - 18, 22);
      this.clockGroup.add(g);
    }
    for (const [side, st] of [[-1, R1.star_left], [1, R1.star_right]] as const) {
      const s = this.add.image(st.x - CLOCK.x, st.y - CLOCK.y, this.tex("star", "__star")).setDisplaySize(st.w, st.h).setAngle(side * 14);
      this.clockGroup.add(s);
    }
    this.clockText = this.txt(R1.clock_digits.x - CLOCK.x, R1.clock_digits.y - CLOCK.y, "", R1.clock_digits.font, { color: hex(C.gold), stroke: hex(C.ink), strokeThickness: 10 });
    this.clockGroup.add(this.clockText);
  }

  private drawWorker() {
    this.worker = this.add.container(HOME.x, HOME.y).setDepth(30);
    const shadow = this.add.ellipse(0, 4, 210, 30, C.ink, 0.18);
    const key = `${this.challenge.meme.theme.player}_sweating`;
    this.body = this.add.image(0, 0, this.textures.exists(key) ? key : "__worker").setOrigin(0.5, 0.9);
    this.bodyScale = WORKER_PX / this.body.width;
    this.body.setScale(this.bodyScale);
    this.worker.add([shadow, this.body]);
  }

  private drawHud() {
    this.roundText = this.pill(R1.badge_round.x, R1.badge_round.y, R1.badge_round.w, "", C.white, false, R1.badge_round.font);
    const cap = (y: number) =>
      this.txt(W / 2, y, "", 80, { strokeThickness: 16 })
        .setShadow(0, 6, hex(C.ink), 0, true, true)
        .setDepth(90);
    this.capTop = cap(CAP_TOP_Y);
    this.capBottom = cap(CAP_BOTTOM_Y);
  }

  private makeHider(key: string): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(20);
    const { boss } = this.challenge.meme.theme;
    const art = key === boss ? `${boss}_walk` : key;
    if (key !== boss && this.textures.exists(art)) {
      c.add(this.add.image(0, 0, art).setDisplaySize(620, 280));
      return c;
    }
    if (key === "email_pile") {
      for (let k = 0; k < 9; k++) {
        const x = -220 + (k % 3) * 220 + Phaser.Math.Between(-20, 20);
        const y = -75 + Math.floor(k / 3) * 75 + Phaser.Math.Between(-10, 10);
        c.add(this.makeEnvelope(x, y, Phaser.Math.Between(-14, 14)));
      }
    } else if (key === "meeting_card") {
      const g = this.add.graphics();
      g.fillStyle(C.ink, 0.2).fillRoundedRect(-326, -140, 652, 310, 30);
      g.fillStyle(C.white).fillRoundedRect(-330, -160, 660, 320, 30);
      g.fillStyle(C.red).fillRoundedRect(-314, -144, 628, 78, { tl: 20, tr: 20, bl: 0, br: 0 });
      g.lineStyle(5, C.mascotLine).strokeRoundedRect(-314, -144, 628, 288, 20);
      g.fillStyle(C.white, 0.25).fillRect(-300, -136, 600, 20);
      c.add([
        g,
        this.txt(0, -104, "MEETING INVITE", 40, { strokeThickness: 0 }),
        this.txt(0, 0, "QUICK SYNC?", 92, { color: hex(C.ink), strokeThickness: 0 }),
        this.txt(0, 92, `TODAY · ${this.meetingTime()} · 2 HRS`, 38, { color: hex(C.navy), strokeThickness: 0 }),
      ]);
    } else if (key === boss) {
      c.add(this.makeBoss(false).setScale(1.7));
    } else {
      const g = this.add.graphics();
      g.fillStyle(C.white).fillRoundedRect(-320, -150, 640, 300, 30);
      g.fillStyle(C.navy).fillRoundedRect(-306, -136, 612, 272, 22);
      c.add([g, this.txt(0, 0, key.toUpperCase(), 60)]);
    }
    return c;
  }

  private makeEnvelope(x: number, y: number, angle: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setAngle(angle);
    const g = this.add.graphics();
    g.fillStyle(C.white).fillRoundedRect(-112, -70, 224, 140, 16);
    g.fillStyle(C.skyLight).fillRoundedRect(-100, -58, 200, 116, 8);
    g.lineStyle(5, C.mascotLine).strokeRoundedRect(-100, -58, 200, 116, 8);
    g.lineBetween(-100, -58, 0, 12).lineBetween(100, -58, 0, 12);
    g.fillStyle(C.white).fillCircle(86, -50, 24);
    g.fillStyle(C.red).fillCircle(86, -50, 18);
    g.fillStyle(C.white, 0.6).fillCircle(80, -56, 5);
    c.add(g);
    return c;
  }

  // Sized by HEIGHT (art may change canvas ratio). feetAnchor: image bottom sits at the container origin.
  private makeBoss(grab: boolean, height = 400, feetAnchor = false): Phaser.GameObjects.Container {
    // Local frame: head at y≈-190, body −130..130 (wide enough to cover the clock at 1.7x).
    const c = this.add.container(0, 0);
    const key = `${this.challenge.meme.theme.boss}_${grab ? "grab" : "walk"}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(0, feetAnchor ? 0 : -60, key);
      img.setOrigin(0.5, feetAnchor ? 1 : 0.5).setScale(height / img.height);
      c.add(img);
      return c;
    }
    const g = this.add.graphics();
    g.fillStyle(C.white).fillRoundedRect(-175, -140, 350, 280, 40);
    g.fillStyle(C.ink).fillRoundedRect(-163, -128, 326, 256, 32);
    g.fillStyle(C.white, 0.08).fillRoundedRect(-150, -118, 60, 236, 24);
    g.fillStyle(C.white).fillTriangle(-50, -128, 50, -128, 0, -40);
    g.fillStyle(C.red).fillTriangle(-14, -110, 14, -110, 0, 10);
    if (grab) {
      // Arm reaching over the worker's head.
      g.fillStyle(C.white).fillRoundedRect(100, -236, 190, 56, 28);
      g.fillStyle(C.ink).fillRoundedRect(108, -228, 174, 40, 20);
    }
    g.fillStyle(C.white).fillCircle(0, -190, 76);
    g.fillStyle(C.mascotLight).fillCircle(0, -190, 64);
    g.lineStyle(5, C.mascotLine).strokeCircle(0, -190, 64);
    g.fillStyle(C.white, 0.4).fillEllipse(-26, -222, 28, 16);
    // Angry face.
    g.lineStyle(8, C.ink).lineBetween(-40, -222, -10, -208).lineBetween(40, -222, 10, -208);
    g.fillStyle(C.ink).fillCircle(-22, -192, 8).fillCircle(22, -192, 8);
    g.lineStyle(6, C.ink).beginPath().arc(0, -146, 22, Math.PI * 1.15, Math.PI * 1.85).strokePath();
    c.add(g);
    return c;
  }

  private makeHand(): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(C.white).fillCircle(0, 0, 40);
    g.fillStyle(C.mascotLight).fillCircle(0, 0, 32);
    g.lineStyle(4, C.mascotLine).strokeCircle(0, 0, 32).lineBetween(-12, -30, -12, -6).lineBetween(8, -30, 8, -6);
    return this.add.container(0, 0, [g]);
  }

  private makeBanner(text: string, w: number, lab?: { size: number; x: number; y: number; fit?: { w: number; h: number } }): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const label = this.txt(lab?.x ?? 0, lab?.y ?? 2, text, lab?.size ?? 66, { color: hex(C.white), stroke: hex(C.mascotLine), strokeThickness: 12 });
    if (this.textures.exists("banner_gold")) {
      const art = this.add.image(0, 0, "banner_gold");
      if (lab?.fit) this.fitImage(art, lab.fit.w, lab.fit.h);
      else art.setDisplaySize(w + 160, 170);
      c.add([art, label]);
      return c;
    }
    const g = this.add.graphics();
    const tail = (s: number): Pt[] => [
      { x: s * (w / 2 - 10), y: -22 },
      { x: s * (w / 2 + 70), y: -22 },
      { x: s * (w / 2 + 42), y: 18 },
      { x: s * (w / 2 + 70), y: 58 },
      { x: s * (w / 2 - 10), y: 58 },
    ];
    for (const s of [-1, 1]) {
      g.lineStyle(14, C.white).strokePoints(tail(s), true);
      g.fillStyle(C.hot).fillPoints(tail(s), true);
      g.lineStyle(3, C.mascotLine).strokePoints(tail(s), true);
    }
    g.fillStyle(C.white).fillRoundedRect(-w / 2 - 8, -60, w + 16, 120, 26);
    g.fillStyle(C.hot).fillRoundedRect(-w / 2, -52, w, 104, 20);
    g.fillStyle(C.gold).fillRoundedRect(-w / 2, -52, w, 56, { tl: 20, tr: 20, bl: 0, br: 0 });
    g.lineStyle(3, C.mascotLine).strokeRoundedRect(-w / 2, -52, w, 104, 20);
    g.fillStyle(C.white, 0.4).fillRoundedRect(-w / 2 + 14, -44, w - 28, 14, 7);
    c.add([g, label]);
    return c;
  }

  private makeTrophy(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    if (this.textures.exists("trophy")) {
      c.add(this.add.image(0, 0, "trophy").setDisplaySize(220, 220));
      return c;
    }
    const g = this.add.graphics();
    const bowl = (x: number, y: number, bw: number, bh: number) =>
      g.fillRoundedRect(x, y, bw, bh, { tl: 12, tr: 12, bl: bw / 2.2, br: bw / 2.2 });
    g.lineStyle(26, C.white).strokeCircle(-70, -40, 30).strokeCircle(70, -40, 30);
    g.fillStyle(C.white);
    bowl(-80, -102, 160, 140);
    g.fillRect(-24, 20, 48, 50).fillRoundedRect(-66, 52, 132, 50, 14);
    g.lineStyle(12, C.hot).strokeCircle(-70, -40, 30).strokeCircle(70, -40, 30);
    g.fillStyle(C.gold);
    bowl(-70, -92, 140, 124);
    g.fillStyle(C.hot).fillRect(-14, 28, 28, 34);
    g.fillStyle(C.mascotLine).fillRoundedRect(-58, 58, 116, 38, 10);
    g.fillStyle(C.gold).fillRect(-30, 68, 60, 16);
    g.fillStyle(C.white, 0.5).fillRoundedRect(-52, -82, 18, 70, 9);
    // Smug little face.
    g.lineStyle(5, C.mascotLine).lineBetween(-30, -40, -12, -38).lineBetween(12, -38, 30, -40);
    g.beginPath().arc(4, -26, 18, Math.PI * 0.15, Math.PI * 0.8).strokePath();
    c.add(g);
    return c;
  }

  private makeDuck(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    if (this.textures.exists("duck")) {
      c.add(this.add.image(0, 0, "duck").setDisplaySize(200, 200));
      return c;
    }
    const g = this.add.graphics();
    g.fillStyle(C.white).fillEllipse(0, 20, 172, 122).fillCircle(42, -46, 52);
    g.fillStyle(C.mascot).fillEllipse(90, -40, 52, 24).fillEllipse(-20, 80, 40, 16).fillEllipse(24, 80, 40, 16);
    g.lineStyle(4, C.mascotLine).strokeEllipse(0, 20, 156, 106).strokeCircle(42, -46, 40);
    g.beginPath().arc(-10, 20, 36, Math.PI * 0.1, Math.PI * 0.9).strokePath();
    // Dizzy eyes.
    g.lineStyle(3, C.ink).strokeCircle(32, -52, 10).strokeCircle(32, -52, 4).strokeCircle(58, -52, 10).strokeCircle(58, -52, 4);
    c.add(g);
    return c;
  }

  private makePoof(): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    const puffs: [number, number, number][] = [
      [0, 0, 70],
      [-70, 20, 52],
      [70, 16, 56],
      [-36, -50, 54],
      [40, -56, 60],
      [-4, 50, 56],
    ];
    g.fillStyle(C.skyLight);
    for (const [x, y, r] of puffs) g.fillCircle(x, y + 10, r);
    g.fillStyle(C.white);
    for (const [x, y, r] of puffs) g.fillCircle(x, y, r - 4);
    const word = this.txt(0, -120, "POOF", 52, { color: hex(C.gold), strokeThickness: 10 }).setAngle(-10);
    return this.add.container(0, 0, [g, word]);
  }

  // ---------- helpers ----------

  private tex(key: string, fallback: string) {
    return this.textures.exists(key) ? key : fallback;
  }

  private setFace(expr: Expr) {
    const key = `${this.challenge.meme.theme.player}_${expr}`;
    if (this.textures.exists(key)) {
      this.body.setTexture(key);
      this.body.setScale(WORKER_PX / this.body.width); // faces may differ in canvas size (dragged is 700x800)
    }
  }

  private squash(sx: number, sy: number, duration: number, repeat: number) {
    const s = this.bodyScale;
    this.tweens.add({ targets: this.body, scaleX: s * sx, scaleY: s * sy, duration, yoyo: true, repeat, ease: "Quad.Out" });
  }

  private pressButton() {
    this.tweens.killTweensOf(this.buttonCap);
    this.buttonCap.setPosition(0, 0).setScale(1);
    this.tweens.add({ targets: this.buttonCap, y: 14, scaleY: 0.82, duration: 70, yoyo: true, hold: 60, ease: "Quad.Out" });
  }

  // Scale an image to fit inside w x h keeping its aspect (Figma "fit").
  private fitImage(img: Phaser.GameObjects.Image, w: number, h: number) {
    return img.setScale(Math.min(w / img.width, h / img.height));
  }

  private pill(x: number, y: number, w: number, text: string, color: number, fx = true, font = 28) {
    const g = this.add.graphics({ x, y }).setDepth(70);
    g.fillStyle(C.white).fillRoundedRect(-w / 2, -24, w, 48, 24);
    g.fillStyle(C.navy).fillRoundedRect(-w / 2 + 4, -20, w - 8, 40, 20);
    g.fillStyle(C.white, 0.12).fillRoundedRect(-w / 2 + 12, -16, w - 24, 12, 6);
    const t = this.txt(x, y + 1, text, font, { color: hex(color), strokeThickness: 6 }).setDepth(71);
    if (fx) this.stageFx.push(g, t);
    return t;
  }

  private txt(x: number, y: number, text: string, size: number, style: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    return this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color: hex(C.white),
        stroke: hex(C.ink),
        strokeThickness: 8,
        align: "center",
        resolution: 2,
        ...style,
      })
      .setOrigin(0.5);
  }

  // Meme caption: white Anton, thick black outline, shrinks to fit one line, wraps only as a last resort.
  private setCaption(t: Phaser.GameObjects.Text, text: string, size = 80) {
    this.tweens.killTweensOf(t);
    const max = W - 56;
    t.setWordWrapWidth(null).setFontSize(size).setText(text.toUpperCase()).setScale(1).setVisible(text.length > 0);
    if (!text) return;
    if (t.width > max) t.setFontSize(Math.max(54, Math.floor((size * max) / t.width)));
    if (t.width > max) t.setWordWrapWidth(max, true);
    t.setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 280, ease: "Back.Out" });
  }

  private popLabel(text: string, color: number) {
    const t = this.txt(W / 2, 650, text, 110, { color: hex(color), stroke: hex(C.white), strokeThickness: 14 })
      .setShadow(0, 8, hex(C.ink), 0, true, true)
      .setDepth(65)
      .setScale(0.3);
    this.stageFx.push(t);
    this.tweens.add({ targets: t, scale: 1, duration: 320, ease: "Back.Out" });
    this.tweens.add({ targets: t, alpha: 0, y: 600, delay: REACTION_MS - 600, duration: 400 });
  }

  private starburst(x: number, y: number, text: string) {
    const g = this.add.graphics();
    g.fillStyle(C.white).fillPoints(starPoints(0, 0, 150, 104, 14), true);
    g.fillStyle(C.gold).fillPoints(starPoints(0, 0, 136, 94, 14), true);
    g.lineStyle(4, C.mascotLine).strokePoints(starPoints(0, 0, 136, 94, 14), true);
    const t = this.txt(0, 4, text, 84, { strokeThickness: 14 }).setAngle(-8);
    const c = this.add.container(x, y, [g, t]).setDepth(65).setScale(0.2);
    this.stageFx.push(c);
    this.tweens.add({ targets: c, scale: 1, duration: 300, ease: "Back.Out" });
    this.tweens.add({ targets: g, angle: 30, duration: REACTION_MS });
    this.tweens.add({ targets: c, alpha: 0, scale: 1.2, delay: REACTION_MS - 500, duration: 300 });
  }

  private bigNumber(result: FinishResult, color: number, stroke: number) {
    const t = this.txt(W / 2, RESULT_Y, `${(result.errorMs / 1000).toFixed(3)}s`, 160, {
      color: hex(color),
      stroke: hex(stroke),
      strokeThickness: 16,
    })
      .setShadow(0, 10, hex(C.ink), 0, true, true)
      .setDepth(75)
      .setScale(0.2);
    this.stageFx.push(t);
    this.tweens.add({ targets: t, scale: 1, delay: 250, duration: 380, ease: "Back.Out" });
  }

  private fillTemplate(s: string, result: FinishResult): string {
    return fillCaption(this.challenge, s, { ...result, roundElapsedMs: this.elapsed });
  }

  // The meeting lands exactly on the last round's target time (h:mm), so it reads right for any day file.
  private meetingTime() {
    const { frameParams, meme } = this.challenge;
    const last = meme.theme.rounds.length - 1;
    return formatClock(parseLabel(meme.theme.rounds[last].startLabel) + frameParams.targetMs[last], false).slice(0, -3);
  }

  private startMs() {
    return parseLabel(this.challenge.meme.theme.rounds[this.round].startLabel);
  }

  private resetWorkerTweens() {
    this.tweens.killTweensOf([this.worker, this.body]);
    this.worker.y = HOME.y;
    this.body.setAngle(0).setScale(this.bodyScale);
  }

  private stopWaiting() {
    this.resetWorkerTweens();
    this.tweens.killTweensOf(this.capBottom);
    this.capBottom.setScale(1);
    for (const fx of this.stageFx) fx.destroy();
    this.stageFx = [];
  }

  private resetStage() {
    this.stopWaiting();
    this.worker.setPosition(HOME.x, HOME.y).setAngle(0).setScale(1).setAlpha(1);
    this.setFace("sweating");
    this.doorPanel.setScale(1);
    this.hider?.destroy();
    this.hider = null;
    this.tweens.killTweensOf(this.clockGroup);
    this.clockGroup.setPosition(CLOCK.x, CLOCK.y).setAlpha(1).setScale(1);
    this.tweens.killTweensOf(this.button);
    this.button.setAlpha(1).setScale(1);
    this.clockText.setVisible(true).setColor(hex(C.gold));
  }
}
