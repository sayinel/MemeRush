import type { Metadata } from "next";
import HookClient from "./HookClient";
import { normalizeFrom } from "@/lib/next_hook";

// 다음 편 예고 + 이메일 훅 페이지. 검색에 나오지 않게 noindex.
export const metadata: Metadata = {
  title: "MemeRush NEXT",
  robots: { index: false, follow: false },
};

export default async function NextPage({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.from) ? sp.from[0] : sp.from;
  return <HookClient from={normalizeFrom(raw)} />;
}
