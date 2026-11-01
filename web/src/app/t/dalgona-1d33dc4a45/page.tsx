import type { Metadata } from "next";
import DalgonaGame from "../../../game/DalgonaGame";

// 휴대폰 사전 시험용 비공개 주소(링크를 아는 사람만). 검색 제외, 어디에도 링크하지 않는다.
// /dev 경로는 운영 방어막에서 막혀 있어(404) 같은 시제품을 비밀 주소로 한 번 더 노출한다. 서버 연결 없음, 저장 없음.
export const metadata: Metadata = {
  title: "달고나 시험",
  robots: { index: false, follow: false },
};

export default function DalgonaPlaytestPage() {
  return <DalgonaGame />;
}
