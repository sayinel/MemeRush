import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

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
        rounds: z.array(
          z.object({
            label: z.string(),
            // The scene parses this as a wall clock (h:mm:ss) and counts up from it.
            startLabel: z.string().regex(/^\d{1,2}:\d{2}:\d{2}$/, "startLabel must be a clock like 4:59:57"),
            hider: z.string(),
          }),
        ),
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

// Day files are read from disk so a file published by tools/discovery goes live without a code change.
// The id must match the file name (YYYY-MM-DD); next.config.ts traces the folder into every function.
const CONTENT_DIR = path.join(process.cwd(), "content/challenges");
const DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;

function loadChallenges(): Map<string, Challenge> {
  const entries = fs
    .readdirSync(CONTENT_DIR)
    .map((name) => DAY_FILE.exec(name)?.[1])
    .filter((id): id is string => !!id)
    .sort()
    .map((id) => {
      const c = challengeSchema.parse(JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, `${id}.json`), "utf8")));
      if (c.id !== id) throw new Error(`${id}.json has id ${c.id}`);
      return [id, c] as const;
    });
  if (!entries.length) throw new Error(`no day files in ${CONTENT_DIR}`);
  return new Map(entries);
}

const challenges = loadChallenges();
const ids = [...challenges.keys()]; // sorted by date

export function getChallenge(id: string): Challenge | undefined {
  return challenges.get(id);
}

export function listChallengeIds(): string[] {
  return ids;
}

// Daily number shown in the header and share text: #001 for the first published day.
export function dailyNo(id: string): string {
  return `#${String(ids.indexOf(id) + 1).padStart(3, "0")}`;
}

// Today's challenge by the Korean date: the latest day file not after today (the earliest if all are ahead).
export function currentChallengeId(now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
  return ids.findLast((id) => id <= today) ?? ids[0];
}
