import { z } from "zod";
import day20261024 from "../../content/challenges/2026-10-24.json";

const caption = z.object({
  top: z.string().max(30),
  bottom: z.string().max(30),
  props: z.array(z.string()),
});

const challengeSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    frame: z.literal("timing_stop"),
    frameParams: z.object({
      rounds: z.number().int().min(1),
      targetMs: z.array(z.number().int().min(3000).max(7000)),
      visibleMs: z.number().int().positive(),
    }),
    seed: z.string(),
    meme: z.object({
      name: z.string(),
      context: z.object({ summary: z.string(), url: z.string() }),
      prompt: z.string(),
      theme: z.object({
        background: z.string(),
        player: z.string(),
        boss: z.string(),
        goal: z.string(),
        rounds: z.array(z.object({ label: z.string(), startLabel: z.string(), hider: z.string() })),
        resultBackgrounds: z.record(z.string(), z.string()).optional(),
      }),
      hope: z.string().max(30),
      win: caption,
      lose: caption.extend({ early: caption.optional(), late: caption.optional() }),
      share: z.string(),
    }),
  })
  .refine((c) => c.frameParams.targetMs.length === c.frameParams.rounds, "targetMs length must equal rounds")
  .refine((c) => c.meme.theme.rounds.length === c.frameParams.rounds, "theme.rounds length must equal rounds")
  .refine((c) => c.frameParams.targetMs.every((t) => c.frameParams.visibleMs < t), "visibleMs must be shorter than every target");

export type Challenge = z.infer<typeof challengeSchema>;

const challenges: Record<string, Challenge> = Object.fromEntries(
  [day20261024].map((raw) => {
    const c = challengeSchema.parse(raw);
    return [c.id, c];
  }),
);

export const CURRENT_CHALLENGE_ID = "2026-10-24";

export function getChallenge(id: string): Challenge | undefined {
  return challenges[id];
}

export function listChallengeIds(): string[] {
  return Object.keys(challenges);
}
