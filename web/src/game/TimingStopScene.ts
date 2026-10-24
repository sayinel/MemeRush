import * as Phaser from "phaser";
import type { Challenge } from "@/lib/challenge";
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

// Real art: map a meme.theme key (worker, boss, door, office, email_pile, ...) to a URL and it replaces the drawn shape.
const SPRITE_URLS: Record<string, string> = {};

const INTRO_MS = 2000;
const REACTION_MS = 3000;
const FINAL_MS = 3000;
const NICE_MS = 100;
// Server rejects measurements outside 1–15 s (docs/MVP_SCOPE.md §2 측정·검증).
const MIN_TAP_MS = 1000;
const MAX_TAP_MS = 15000;

const CLOCK = { x: 360, y: 450, w: 540, h: 190 };
const HOME = { x: 170, y: 830 };
const DOOR = { x: 600, y: 790 };
const FLOOR_Y = 925;
const CONFETTI_TINTS = [C.gold, C.hot, C.red, C.green, C.sky, C.white, C.mascot];

type Phase = "boot" | "intro" | "starting" | "play" | "reaction" | "submitting" | "final" | "done" | "error";
type Caption = { top: string; bottom: string };

function parseLabel(label: string): number {
  const [h = 0, m = 0, s = 0] = label.split(":").map(Number);
  return ((h * 60 + m) * 60 + s) * 1000;
}

function formatClock(ms: number, withCs = true): string {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3600000);
  const m = Math.floor(total / 60000) % 60;
  const s = Math.floor(total / 1000) % 60;
  const base = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return withCs ? `${base}.${String(Math.floor(total / 10) % 100).padStart(2, "0")}` : base;
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
  private face!: Phaser.GameObjects.Text;
  private doorPanel!: Phaser.GameObjects.Container;
  private clockText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
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
    const t = this.challenge.meme.theme;
    const keys = [t.background, t.player, t.boss, t.goal, ...t.rounds.map((r) => r.hider)];
    for (const key of keys) {
      const url = SPRITE_URLS[key];
      if (url && !this.textures.exists(key)) this.load.image(key, url);
    }
  }

  create() {
    this.drawBackground();
    this.drawDoor();
    this.drawClock();
    this.drawWorker();
    this.drawHud();
    if (!this.textures.exists("__confetti")) {
      const g = this.make.graphics({}, false);
      g.fillStyle(C.white).fillRect(0, 0, 16, 10);
      g.generateTexture("__confetti", 16, 10);
      g.destroy();
    }

    // Measurement uses a native listener + performance timebase, never Phaser's clock.
    const canvas = this.game.canvas;
    canvas.style.touchAction = "manipulation";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    const detach = () => canvas.removeEventListener("pointerdown", this.onPointerDown);
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

    const card = this.add.container(-W, 650).setDepth(60);
    const band = this.add.rectangle(0, 0, W + 80, 280, C.navy, 0.94).setAngle(-3).setStrokeStyle(8, C.white);
    const title = this.txt(0, -60, `ROUND ${i + 1}`, 110, { color: hex(C.gold), stroke: hex(C.ink), strokeThickness: 12 });
    const label = this.txt(0, 50, rounds[i].label, 76, { strokeThickness: 10 });
    card.add([band, title, label]);
    if (i === 0) card.add(this.txt(0, 120, this.challenge.meme.prompt, 26, { strokeThickness: 5, wordWrap: { width: 640 } }));

    this.tweens.add({ targets: card, x: W / 2, duration: 380, ease: "Back.Out" });
    this.tweens.add({ targets: card, x: W * 1.6, delay: INTRO_MS - 300, duration: 300, ease: "Back.In" });
    this.time.delayedCall(INTRO_MS, () => {
      if (run !== this.run) return;
      card.destroy();
      if (i === 0) this.beginFirstRound();
      else this.startPlay(performance.now()); // rounds 2+ start when the intro card ends
    });
  }

  private beginFirstRound() {
    const run = this.run;
    this.phase = "starting";
    const wait = this.txt(W / 2, 650, "GET READY…", 64).setDepth(60);
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
    this.phase = "play";
    const target = this.startMs() + this.challenge.frameParams.targetMs[this.round];
    this.hint.setText(`TAP ANYWHERE AT ${formatClock(target, false)}`).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: this.hint, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
    // Nervous foot-tapping + sweat while waiting.
    this.tweens.add({ targets: this.worker, y: HOME.y - 14, duration: 140, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.face.setText("😰");
    const sweat = this.txt(HOME.x + 60, HOME.y - 70, "💦", 40, { strokeThickness: 0 }).setDepth(31);
    this.stageFx.push(sweat);
    this.tweens.add({ targets: sweat, y: HOME.y - 20, alpha: 0, duration: 700, repeat: -1 });
  }

  private showHider() {
    this.hiderShown = true;
    const key = this.challenge.meme.theme.rounds[this.round].hider;
    const h = this.makeHider(key);
    this.hider = h;
    const cover = () => this.clockText.setVisible(false);
    if (key === "boss") {
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

    // Stopped time revealed on the clock.
    this.clockText.setText(formatClock(this.startMs() + el)).setVisible(true).setColor(nice ? hex(C.gold) : hex(C.white));
    // Round error, small in the corner.
    const sign = err > 0 ? "+" : err < 0 ? "−" : "±";
    this.txt(W - 24, 40 + i * 42, `R${i + 1} ${sign}${(abs / 1000).toFixed(3)}s`, 30, {
      color: hex(nice ? C.gold : C.hot),
      strokeThickness: 6,
    })
      .setOrigin(1, 0.5)
      .setDepth(70);

    const h = this.hider;
    if (nice) {
      if (h) this.tweens.add({ targets: h, y: -400, angle: 30, duration: 300, ease: "Quad.In" });
      this.face.setText("😎");
      this.tweens.add({ targets: this.worker, x: 440, duration: 260, yoyo: true, hold: 900, ease: "Quad.Out" });
      this.popLabel("NICE! 👍", C.gold);
      this.burst(HOME.x + 120, HOME.y - 40, 30);
    } else if (err < 0) {
      if (h) this.tweens.add({ targets: h, y: -400, duration: 300, ease: "Quad.In" });
      this.face.setText("😃");
      this.tweens.add({
        targets: this.worker,
        x: DOOR.x - 150,
        duration: 380,
        ease: "Quad.Out",
        onComplete: () => {
          this.face.setText("😵");
          this.tweens.add({ targets: this.worker, angle: -100, y: HOME.y + 30, x: DOOR.x - 110, duration: 260, ease: "Back.Out" });
        },
      });
      this.popLabel("TOO EARLY", C.red);
    } else {
      // The hider drops into the worker's path and he runs straight into it.
      if (h) this.tweens.add({ targets: h, x: 450, y: 820, scale: h.scale * 0.45, angle: 0, duration: 260, ease: "Quad.In" });
      this.face.setText("😃");
      this.tweens.add({
        targets: this.worker,
        x: 330,
        delay: 200,
        duration: 220,
        ease: "Quad.In",
        onComplete: () => {
          this.face.setText("😖");
          this.cameras.main.shake(160, 0.012);
          this.tweens.add({ targets: this.worker, x: 230, angle: -18, duration: 300, ease: "Back.Out" });
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
    const wait = this.txt(W / 2, 650, "CHECKING…", 64).setDepth(60);
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
    const { meme } = this.challenge;
    const variant = result.outcome === "lose" ? result.outcomeVariant : null;
    const caption: Caption = result.outcome === "win" ? meme.win : (variant && meme.lose[variant]) || meme.lose;

    if (result.outcome === "win") this.finalWin();
    else if (variant === "early") this.finalGrabbed();
    else this.finalBuried();

    this.time.delayedCall(350, () => {
      if (run !== this.run) return;
      this.showCaption(this.fillTemplate(caption.top, result), 200);
      this.showCaption(this.fillTemplate(caption.bottom, result), 1110);
    });
    this.time.delayedCall(FINAL_MS, () => {
      if (run !== this.run) return;
      this.phase = "done";
      this.bridge.finished(result);
    });
  }

  private showError(retry: () => void) {
    this.phase = "error";
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(this.add.rectangle(W / 2, H / 2, W, H, C.ink, 0.78));
    overlay.add(this.txt(W / 2, H / 2 - 40, "CONNECTION PROBLEM", 60, { color: hex(C.hot) }));
    overlay.add(this.txt(W / 2, H / 2 + 40, "TAP TO RETRY", 48));
    this.retry = () => {
      overlay.destroy();
      retry();
    };
  }

  // ---------- final outcomes ----------

  private finalWin() {
    this.face.setText("😎");
    this.tweens.add({ targets: this.doorPanel, scaleX: 0.12, duration: 260, ease: "Quad.Out" });
    this.tweens.add({
      targets: this.worker,
      x: DOOR.x,
      angle: -14,
      delay: 200,
      duration: 520,
      ease: "Cubic.In",
      onComplete: () => {
        this.tweens.add({ targets: this.worker, scale: 0.5, alpha: 0, duration: 220 });
        this.tweens.add({ targets: this.doorPanel, scaleX: 1, delay: 240, duration: 200 });
        this.cameras.main.flash(220, 254, 222, 37);
        this.burst(DOOR.x, DOOR.y - 60, 90);
        const rain = this.add.particles(0, -20, "__confetti", {
          x: { min: 0, max: W },
          speedY: { min: 250, max: 520 },
          speedX: { min: -120, max: 120 },
          rotate: { min: 0, max: 360 },
          gravityY: 250,
          lifespan: 3200,
          quantity: 3,
          frequency: 25,
          tint: CONFETTI_TINTS,
        });
        rain.setDepth(80);
        this.time.delayedCall(1500, () => rain.stop());
      },
    });
  }

  private finalGrabbed() {
    const boss = this.makeBoss().setPosition(-260, HOME.y - 50).setScale(0.85).setDepth(32);
    this.stageFx.push(boss);
    this.face.setText("😃");
    this.tweens.add({ targets: this.worker, x: 400, duration: 360, ease: "Quad.Out" });
    this.tweens.add({
      targets: boss,
      x: 260,
      delay: 250,
      duration: 380,
      ease: "Quad.Out",
      onComplete: () => {
        this.face.setText("😫");
        this.cameras.main.shake(140, 0.01);
        const hand = this.txt(this.worker.x - 40, this.worker.y - 70, "✋", 70, { strokeThickness: 0 }).setDepth(40);
        this.stageFx.push(hand);
        this.tweens.add({ targets: this.worker, scaleX: 1.25, scaleY: 0.72, duration: 120, yoyo: true, repeat: 1 });
        this.tweens.add({ targets: [boss, this.worker, hand], x: "-=700", delay: 600, duration: 1100, ease: "Quad.In" });
      },
    });
  }

  private finalBuried() {
    this.face.setText("😃");
    this.tweens.add({ targets: this.worker, x: 330, duration: 300, ease: "Quad.Out" });
    const card = this.makeHider("meeting_card").setPosition(340, -300).setScale(0.5).setAngle(-30).setDepth(40);
    this.stageFx.push(card);
    this.tweens.add({
      targets: card,
      y: HOME.y - 120,
      angle: 8,
      delay: 250,
      duration: 360,
      ease: "Bounce.Out",
      onComplete: () => {
        this.face.setText("😭");
        this.cameras.main.shake(700, 0.02);
        this.tweens.add({ targets: this.worker, y: HOME.y + 30, scaleY: 0.8, duration: 300 });
        for (let k = 0; k < 16; k++) {
          const env = this.makeEnvelope(330 + Phaser.Math.Between(-150, 150), -100, Phaser.Math.Between(-40, 40));
          env.setScale(0.6).setDepth(41 + k);
          this.stageFx.push(env);
          this.tweens.add({
            targets: env,
            y: HOME.y + 40 - Math.floor(k / 4) * 45 + Phaser.Math.Between(-15, 15),
            delay: k * 60,
            duration: 420,
            ease: "Bounce.Out",
          });
        }
      },
    });
  }

  // ---------- drawing ----------

  private drawBackground() {
    const bg = this.challenge.meme.theme.background;
    if (this.textures.exists(bg)) {
      this.add.image(W / 2, H / 2, bg).setDisplaySize(W, H);
      return;
    }
    const g = this.add.graphics();
    g.fillGradientStyle(C.sky, C.sky, C.skyLight, C.skyLight, 1).fillRect(0, 0, W, FLOOR_Y);
    // Office windows.
    g.fillStyle(C.white, 0.22);
    for (let k = 0; k < 3; k++) g.fillRoundedRect(40 + k * 230, 620, 180, 200, 12);
    g.fillStyle(C.navy).fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    g.fillStyle(C.white).fillRect(0, FLOOR_Y, W, 6);
    this.txt(470, FLOOR_Y - 40, "🪴", 80, { strokeThickness: 0 });
  }

  private drawDoor() {
    const key = this.challenge.meme.theme.goal;
    const door = this.add.container(DOOR.x, DOOR.y).setDepth(5);
    if (this.textures.exists(key)) {
      door.add(this.add.image(0, 0, key).setDisplaySize(180, 300));
      this.doorPanel = this.add.container(0, 0);
      return;
    }
    const g = this.add.graphics();
    g.fillStyle(C.white).fillRoundedRect(-90, -150, 180, 300, 10);
    g.fillStyle(C.ink).fillRect(-78, -138, 156, 288);
    this.doorPanel = this.add.container(-78, 0);
    const panel = this.add.graphics();
    panel.fillStyle(C.mascotLine).fillRect(0, -138, 156, 288);
    panel.lineStyle(4, C.ink, 0.5).strokeRect(18, -110, 120, 90).strokeRect(18, 0, 120, 110);
    panel.fillStyle(C.gold).fillCircle(132, 10, 10);
    this.doorPanel.add(panel);
    const sign = this.add.rectangle(0, -190, 130, 48, C.green).setStrokeStyle(5, C.white);
    door.add([g, this.doorPanel, sign, this.txt(0, -190, "EXIT", 34, { strokeThickness: 0 })]);
  }

  private drawClock() {
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(C.white).fillRoundedRect(CLOCK.x - CLOCK.w / 2 - 10, CLOCK.y - CLOCK.h / 2 - 10, CLOCK.w + 20, CLOCK.h + 20, 34);
    g.fillStyle(C.ink).fillRoundedRect(CLOCK.x - CLOCK.w / 2, CLOCK.y - CLOCK.h / 2, CLOCK.w, CLOCK.h, 26);
    this.txt(CLOCK.x, CLOCK.y - CLOCK.h / 2 - 34, "🕔", 56, { strokeThickness: 0 }).setDepth(11);
    this.clockText = this.txt(CLOCK.x, CLOCK.y + 6, "", 104, { stroke: hex(C.navy), strokeThickness: 8 }).setDepth(11);
  }

  private drawWorker() {
    const key = this.challenge.meme.theme.player;
    this.worker = this.add.container(HOME.x, HOME.y).setDepth(30);
    this.face = this.txt(0, 4, "😰", 76, { strokeThickness: 0 });
    if (this.textures.exists(key)) {
      this.worker.add(this.add.image(0, 0, key).setDisplaySize(180, 180));
      this.face.setVisible(false);
    } else {
      const g = this.add.graphics();
      g.fillStyle(C.mascotLine).fillEllipse(-30, 80, 48, 24).fillEllipse(30, 80, 48, 24);
      g.fillStyle(C.white).fillCircle(0, 0, 80);
      g.fillStyle(C.mascot).fillCircle(0, 0, 70);
      g.lineStyle(5, C.mascotLine).strokeCircle(0, 0, 70);
      g.fillStyle(C.mascotLight).fillCircle(-28, -32, 16);
      this.worker.add(g);
    }
    this.worker.add(this.face);
  }

  private drawHud() {
    this.txt(24, 36, this.challenge.title, 30, { strokeThickness: 6 }).setOrigin(0, 0.5).setDepth(70);
    this.roundText = this.txt(24, 80, "", 36, { color: hex(C.gold), stroke: hex(C.navy), strokeThickness: 7 })
      .setOrigin(0, 0.5)
      .setDepth(70);
    this.hint = this.txt(W / 2, 1110, "", 44, { strokeThickness: 8 }).setDepth(70).setVisible(false);
  }

  private makeHider(key: string): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(20);
    if (this.textures.exists(key)) {
      c.add(this.add.image(0, 0, key).setDisplaySize(620, 280));
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
      g.fillStyle(C.white).fillRoundedRect(-320, -150, 640, 300, 24);
      g.lineStyle(6, C.ink).strokeRoundedRect(-310, -140, 620, 280, 20);
      g.fillStyle(C.red).fillRoundedRect(-310, -140, 620, 76, { tl: 20, tr: 20, bl: 0, br: 0 });
      c.add([
        g,
        this.txt(0, -102, "📅 MEETING INVITE", 38, { strokeThickness: 0 }),
        this.txt(0, 0, "QUICK SYNC?", 84, { color: hex(C.ink), strokeThickness: 0 }),
        this.txt(0, 88, "FRI · 5:00 PM · 2 HRS", 36, { color: hex(C.navy), strokeThickness: 0 }),
      ]);
    } else if (key === "boss") {
      const boss = this.makeBoss().setScale(1.7);
      c.add(boss);
    } else {
      const r = this.add.rectangle(0, 0, 620, 280, C.navy).setStrokeStyle(10, C.white);
      c.add([r, this.txt(0, 0, key.toUpperCase(), 60)]);
    }
    return c;
  }

  private makeEnvelope(x: number, y: number, angle: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setAngle(angle);
    const g = this.add.graphics();
    g.fillStyle(C.white).fillRoundedRect(-110, -68, 220, 136, 14);
    g.fillStyle(C.skyLight).fillRoundedRect(-100, -58, 200, 116, 8);
    g.lineStyle(5, C.mascotLine).strokeRoundedRect(-100, -58, 200, 116, 8);
    g.lineBetween(-100, -58, 0, 12).lineBetween(100, -58, 0, 12);
    g.fillStyle(C.red).fillCircle(86, -50, 20);
    c.add([g, this.txt(86, -50, "!", 30, { strokeThickness: 0 })]);
    return c;
  }

  private makeBoss(): Phaser.GameObjects.Container {
    // Local frame: head at y≈-190, body −130..130 (wide enough to cover the clock at 1.7x).
    const c = this.add.container(0, 0);
    const key = this.challenge.meme.theme.boss;
    if (this.textures.exists(key)) {
      c.add(this.add.image(0, -60, key).setDisplaySize(340, 400));
      return c;
    }
    const g = this.add.graphics();
    g.fillStyle(C.white).fillRoundedRect(-175, -140, 350, 280, 34);
    g.fillStyle(C.ink).fillRoundedRect(-165, -130, 330, 260, 28);
    g.fillStyle(C.white).fillTriangle(-50, -130, 50, -130, 0, -40);
    g.fillStyle(C.red).fillTriangle(-14, -110, 14, -110, 0, 10);
    g.fillStyle(C.white).fillCircle(0, -190, 72);
    g.fillStyle(C.mascotLight).fillCircle(0, -190, 62);
    g.lineStyle(5, C.mascotLine).strokeCircle(0, -190, 62);
    c.add([g, this.txt(0, -186, "😠", 80, { strokeThickness: 0 })]);
    return c;
  }

  // ---------- helpers ----------

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

  private popLabel(text: string, color: number) {
    const t = this.txt(W / 2, 650, text, 110, { color: hex(color), strokeThickness: 12 }).setDepth(65).setScale(0.3);
    this.stageFx.push(t);
    this.tweens.add({ targets: t, scale: 1, duration: 320, ease: "Back.Out" });
    this.tweens.add({ targets: t, alpha: 0, y: 600, delay: REACTION_MS - 600, duration: 400 });
  }

  private showCaption(text: string, y: number) {
    const t = this.txt(W / 2, y, text.toUpperCase(), 80, {
      strokeThickness: 12,
      wordWrap: { width: W - 60, useAdvancedWrap: true },
    })
      .setDepth(90)
      .setScale(0.6);
    this.stageFx.push(t);
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: "Back.Out" });
  }

  private burst(x: number, y: number, count: number) {
    const p = this.add.particles(x, y, "__confetti", {
      speed: { min: 250, max: 650 },
      angle: { min: 200, max: 340 },
      rotate: { min: 0, max: 360 },
      gravityY: 900,
      lifespan: 1600,
      tint: CONFETTI_TINTS,
      emitting: false,
    });
    p.setDepth(80);
    this.stageFx.push(p);
    p.explode(count);
  }

  private fillTemplate(s: string, result: FinishResult): string {
    const { frameParams, meme } = this.challenge;
    const errs = this.elapsed.map((e, i) => Math.abs(e - frameParams.targetMs[i]));
    // Highlight round: most accurate on win, worst on lose (docs/MEME_GAME_DESIGN.md §5).
    const pick = errs.reduce((best, e, i) => ((result.outcome === "win" ? e < errs[best] : e > errs[best]) ? i : best), 0);
    const stop = this.elapsed[pick] ?? 0;
    const stopLabel = formatClock(parseLabel(meme.theme.rounds[pick].startLabel) + stop);
    const rounds = meme.theme.rounds;
    return s
      .replaceAll("{result}", `${(result.errorMs / 1000).toFixed(3)}s off`)
      .replaceAll("{stopLabel}", stopLabel)
      .replaceAll("{nearLabel}", rounds[rounds.length - 1].startLabel);
  }

  private startMs() {
    return parseLabel(this.challenge.meme.theme.rounds[this.round].startLabel);
  }

  private stopWaiting() {
    this.tweens.killTweensOf([this.worker, this.hint]);
    this.hint.setVisible(false);
    this.worker.y = HOME.y;
    for (const fx of this.stageFx) fx.destroy();
    this.stageFx = [];
  }

  private resetStage() {
    this.stopWaiting();
    this.worker.setPosition(HOME.x, HOME.y).setAngle(0).setScale(1).setAlpha(1);
    this.face.setText("😰");
    this.doorPanel.setScale(1);
    this.hider?.destroy();
    this.hider = null;
    this.clockText.setVisible(true).setColor(hex(C.white));
  }
}
