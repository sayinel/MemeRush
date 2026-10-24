import type { Metadata } from "next";
import { Jua, Noto_Sans_KR } from "next/font/google";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { adminEnabled } from "./_lib/data";
import "./admin.css";

// 한글 글자 모양(ADMIN_UX_GUIDE 4절): 제목·버튼은 Jua, 설명·칩은 Noto Sans KR 500~700.
const juaKr = Jua({ weight: "400", preload: false, variable: "--font-jua-kr" });
const notoKr = Noto_Sans_KR({ weight: ["500", "700"], preload: false, variable: "--font-noto-kr" });

export const metadata: Metadata = {
  title: "Meme Rush 어드민",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // 요청마다 확인한다. 빌드 때 값이 굳어 버리지 않게 한다.
  await connection();
  if (!adminEnabled()) notFound();
  return (
    <div lang="ko" className={`adm ${juaKr.variable} ${notoKr.variable}`}>
      <div className="wrap">{children}</div>
    </div>
  );
}
