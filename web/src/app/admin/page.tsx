import Link from "next/link";
import { connection } from "next/server";
import { readState } from "./_lib/data";
import { DOW, addDays, md, weekOf } from "./_lib/week";

export const dynamic = "force-dynamic";

const NEW_HREF = "/admin/new?fresh=1";

export default async function AdminHome() {
  await connection();
  const st = await readState();
  const byDate = new Map(st.items.map((i) => [i.date, i]));
  const weeks = [
    { name: "이번 주", days: weekOf(st.today) },
    { name: "다음 주", days: weekOf(addDays(st.today, 7)) },
  ];

  return (
    <main className="board">
      <div className="top">
        <h1>Meme Rush 어드민</h1>
        <div className="acts">
          {st.sample && <span className="sample">샘플 자료</span>}
          <Link className="btn" href={NEW_HREF}>
            게임 등록
          </Link>
        </div>
      </div>
      <p className="sub">요일별 발행과 예약이에요. 후킹 이미지, 타이틀, 발행일이 보입니다.</p>
      {weeks.map((w) => (
        <section key={w.name} aria-label={w.name}>
          <h2 className="weekname">{w.name}</h2>
          <div className="list" role="list">
            {w.days.map((d, i) => {
              const it = byDate.get(d);
              return (
                <div key={d} role="listitem" className={`day ${d === st.today ? "today" : ""}`}>
                  <div className="dow">
                    <b>{DOW[i]}</b>
                    <span>
                      {md(d)}
                      {d === st.today ? " 오늘" : ""}
                    </span>
                  </div>
                  <div className="cell">
                    {it ? (
                      <>
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="thumb" src={it.image} alt={`${it.title} 후킹 이미지`} />
                        ) : (
                          <div className="empty">비어 있음</div>
                        )}
                        <div>
                          <div className="tt">{it.title}</div>
                          <div className="when">
                            <span className={`chip ${it.state === "published" ? "pub" : "res"}`}>{it.state === "published" ? "발행됨" : "예약"}</span>
                            {md(it.date)} {it.state === "published" ? "발행" : "예약"}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="empty">비어 있음</div>
                        <div className="when">아직 게임이 없어요</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="bar-b">
        <div className="bar-in">
          <Link className="btn" href={NEW_HREF}>
            게임 등록
          </Link>
        </div>
      </div>
    </main>
  );
}
