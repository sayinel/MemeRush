// Newsletter ("밈레터") mail renderer. Pure function, no dependencies, so node tests can import it directly.
// Email rules: table layout, every style inline (no <style> block), 600px wide, bulletproof button
// (table + a, 56px high), absolute image URLs with alt text, hidden preheader, min font 12px.

import { C, FONT, WB, IMG_BASE, esc, p, topStrip, bigButton, banner, shell, footerRow } from "./parts.ts";

export type NewsletterVars = {
  issueNo: string; // e.g. "#001"
  dateLabel: string; // e.g. "10.31 토"
  playUrl: string;
  unsubUrl: string;
  replyAddress: string; // e.g. "memerush@superagents.run"
  videoUrl: string;
  voteBaseUrl: string;
  subscriberRef?: string;
  lastResult?: { offLabel: string; rank: number };
};

export type Newsletter = { subject: string; preheader: string; html: string; text: string };

export const VOTE_CHOICES = [
  { key: "dalgona", label: "달고나 뽑기 챌린지" },
  { key: "ufo", label: "UFO 기지 착륙" },
  { key: "fishing", label: "타이밍 낚시" },
] as const;

const PREHEADER = "퇴근까지 5초. 버튼 누를 준비 됐죠?";

export { esc };

export function voteUrl(base: string, key: string, subscriberRef?: string): string {
  return `${base}?c=${key}${subscriberRef ? "&s=" + encodeURIComponent(subscriberRef) : ""}`;
}


function section(inner: string): string {
  return `<tr><td style="padding:20px;border-top:1px solid ${C.line};">${inner}</td></tr>`;
}

export function renderNewsletter(v: NewsletterVars): Newsletter {
  const subject = `밈레터 ${v.issueNo} 다음 게임 투표, 오늘 30초만 하고 가세요`;
  const play = esc(v.playUrl);
  const video = esc(v.videoUrl);

  const record = v.lastResult
    ? section(
        `<p style="${p(16, C.amber, "font-weight:800;margin-bottom:8px;")}">내 기록</p>` +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.card};border-radius:12px;"><tr>` +
          `<td style="padding:12px 14px;${p(14, C.cream)}">지난 판 <b style="color:${C.amber};">${esc(v.lastResult.offLabel)}</b></td>` +
          `<td align="right" style="padding:12px 14px;${p(14, C.cream)}">월드 랭킹 <b style="color:${C.amber};">${esc(v.lastResult.rank)}위</b></td>` +
          `</tr></table>`,
      )
    : "";

  const chips = VOTE_CHOICES.map(
    (c) =>
      `<tr><td style="padding-bottom:8px;"><a href="${esc(voteUrl(v.voteBaseUrl, c.key, v.subscriberRef))}" style="display:block;text-decoration:none;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid ${C.orange};border-radius:12px;"><tr>` +
      `<td height="48" style="height:48px;padding:0 14px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.cream};${WB}">${esc(c.label)}</td>` +
      `<td align="right" style="padding:0 14px;font-family:${FONT};font-size:15px;font-weight:800;color:${C.orange};">투표</td>` +
      `</tr></table></a></td></tr>`,
  ).join("");

  const html = shell(
    "ko",
    subject,
    PREHEADER,
    topStrip(` · 밈레터 ${esc(v.issueNo)}`, esc(v.dateLabel)) +
    banner(play, "Meme Rush 배너, 오늘의 퇴근 게임") +
    // greeting + main button
    `<tr><td style="padding:20px;">` +
    `<p style="${p(20, C.cream, "font-weight:700;margin-bottom:6px;")}">오늘의 퇴근 게임이 도착했어요</p>` +
    `<p style="${p(14, C.soft, "margin-bottom:16px;")}">퇴근까지 5초, 버튼 누를 준비 됐죠? 설치도 로그인도 없이 탭 한 번이면 첫 판이 시작돼요.</p>` +
    bigButton(play, "오늘의 게임 플레이 · 30초") +
    `<p style="${p(12, C.soft, "text-align:center;margin-top:8px;")}">탭 한 번 → 바로 첫 판 (메일 안에서는 게임이 실행되지 않아요)</p>` +
    `</td></tr>` +
    record +
    // video
    section(
      `<p style="${p(16, C.amber, "font-weight:800;margin-bottom:8px;")}">밈러시 30초 예고편</p>` +
        `<a href="${video}" style="display:block;text-decoration:none;"><img src="${IMG_BASE}/video-thumb.jpg" width="560" alt="밈러시 예고편, 눌러서 YouTube로 보기" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:12px;"></a>` +
        `<p style="${p(14, C.amber, "margin-top:8px;")}"><a href="${video}" style="color:${C.amber};text-decoration:underline;display:inline-block;line-height:44px;">YouTube에서 예고편 보기 →</a></p>`,
    ) +
    // vote
    section(
      `<p style="${p(16, C.amber, "font-weight:800;margin-bottom:4px;")}">다음 게임, 골라 주세요</p>` +
        `<p style="${p(14, C.cream, "margin-bottom:12px;")}">가장 많이 나온 게임을 다음 밈러시로 만들어요. 한 번 누르면 끝나요.</p>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${chips}</table>`,
    ) +
    // reply
    section(
      `<p style="${p(16, C.amber, "font-weight:800;margin-bottom:4px;")}">하고 싶은 게임이 따로 있나요?</p>` +
        `<p style="${p(14, C.cream)}">이 메일에 그냥 답장해 주세요. 게임 이름 한 줄이면 충분해요. 읽고 가장 많이 나온 게임부터 만들어요.</p>`,
    ) +
    // footer
    footerRow(
      `이 메일은 Meme Rush에서 &lsquo;새 게임 메일로 받기&rsquo;를 신청하셔서 보내 드렸어요.<br>` +
        `<a href="${esc(v.unsubUrl)}" style="color:${C.foot};text-decoration:underline;">수신취소</a> · 답장은 ${esc(v.replyAddress)} 로 받아요`,
    ),
  );

  const lines = [
    `MEME RUSH · 밈레터 ${v.issueNo} (${v.dateLabel})`,
    "",
    "오늘의 퇴근 게임이 도착했어요",
    "퇴근까지 5초, 버튼 누를 준비 됐죠? 설치도 로그인도 없이 탭 한 번이면 첫 판이 시작돼요.",
    `오늘의 게임 플레이 (30초): ${v.playUrl}`,
    "",
  ];
  if (v.lastResult) lines.push("내 기록", `지난 판 ${v.lastResult.offLabel} / 월드 랭킹 ${v.lastResult.rank}위`, "");
  lines.push("밈러시 30초 예고편", `YouTube에서 보기: ${v.videoUrl}`, "", "다음 게임, 골라 주세요", "가장 많이 나온 게임을 다음 밈러시로 만들어요. 한 번 누르면 끝나요.");
  for (const c of VOTE_CHOICES) lines.push(`- ${c.label}: ${voteUrl(v.voteBaseUrl, c.key, v.subscriberRef)}`);
  lines.push(
    "",
    "하고 싶은 게임이 따로 있나요?",
    "이 메일에 그냥 답장해 주세요. 게임 이름 한 줄이면 충분해요. 읽고 가장 많이 나온 게임부터 만들어요.",
    "",
    "이 메일은 Meme Rush에서 '새 게임 메일로 받기'를 신청하셔서 보내 드렸어요.",
    `수신취소: ${v.unsubUrl}`,
    `답장은 ${v.replyAddress} 로 받아요`,
  );

  return { subject, preheader: PREHEADER, html, text: lines.join("\n") };
}
