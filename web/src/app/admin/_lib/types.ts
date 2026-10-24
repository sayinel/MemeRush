// 어드민 화면과 API가 함께 쓰는 모양. 파일 계약은 파이프라인 실행기(tools/discovery)와 같다.

export type Source = { name: string; url: string };
export type Reaction = { mood: string; summary: string; where: string; source: Source };

export type Topic = {
  rank: number;
  name: string;
  score: number;
  online: string;
  community: string;
  background: string;
  reactions: Reaction[];
  fading: string;
  frame: string;
  sources: Source[];
  sourceStatus: string;
};

export type StepState = "waiting" | "running" | "done" | "error";
export type PipelineStep = {
  id: string;
  label: string;
  kind: "auto" | "human";
  state: StepState;
  startedAt: string | null;
  endedAt: string | null;
  artifact: string | null;
  error: string | null;
};
export type PipelineStatus = { date: string; meme: string; current: string; steps: PipelineStep[] };

export type Picks = { topic: string | null; copy: number | null; image: string | null; publishDate: string | null };

export type CopyCandidate = { title: string; win: string; lose: string; share: string };
export type ImageCandidate = { name: string; url: string };

export type Registered = {
  title: string;
  image: string | null;
  publishDate: string;
  status: string;
  topic: string;
  frame: string;
  createdAt: string;
};

export type HomeItem = {
  date: string;
  title: string;
  image: string | null;
  state: "published" | "reserved";
};

export type AdminState = {
  today: string;
  /** 홈에 보여 줄 주의 월요일(ADMIN_WEEK_START) */
  weekStart: string;
  /** 샘플 자료를 하나라도 썼으면 true */
  sample: boolean;
  sampleParts: string[];
  status: PipelineStatus;
  topics: Topic[];
  picks: Picks;
  copies: CopyCandidate[];
  images: ImageCandidate[];
  registered: Registered[];
  items: HomeItem[];
  runError: string | null;
};

export const PICK_KINDS = ["topic", "copy", "image", "date"] as const;
export type PickKind = (typeof PICK_KINDS)[number];
export const RUN_MODES = ["resume", "new", "reimage"] as const;
export type RunMode = (typeof RUN_MODES)[number];
