// Subscription mails (confirmation, then welcome). Pure functions (no env access) so it can be unit tested.
// Product decision: "we send you this game, and tell you when a new game is out". Do NOT promise a daily mail.
// TODO(legal): advertising label / sender identification for marketing mail is pending legal review. Not added on purpose.

import { C, esc, p, topStrip, bigButton, outlineButton, banner, shell, footerRow } from "./mail/parts.ts";

export type MailLang = "ko" | "en";

export type BuiltMail = { subject: string; text: string; html: string; headers?: Record<string, string> };

// Host is used inside links; anything but a plain host name falls back to the canonical one.
const HOST = /^[a-z0-9.-]+(?::[0-9]{1,5})?$/i;
export const CANONICAL_HOST = "memerush.superagents.run";
const safeHost = (h: string) => (HOST.test(h) ? h : CANONICAL_HOST);

// First mail, sent right after the subscribe request (at most once a day per inbox). It carries today's game link,
// which works without confirming, plus a "also get future news" button: confirming is only consent to later mail.
// The button opens a page with a POST button, so mail scanners that pre-open links do not confirm by themselves.
export function buildConfirmMail(opts: { lang: string; host: string; challengeId: string; confirmToken: string }): BuiltMail {
  const lang: MailLang = opts.lang === "ko" ? "ko" : "en";
  const base = `https://${safeHost(opts.host)}`;
  const gameUrl = `${base}/c/${encodeURIComponent(opts.challengeId)}`;
  const url = `${base}/api/subscribe/confirm?token=${encodeURIComponent(opts.confirmToken)}`;
  const t =
    lang === "ko"
      ? {
          subject: "Meme Rush 오늘의 게임이 도착했어요",
          hello: "요청하신 Meme Rush 오늘의 게임이 도착했어요.",
          play: "오늘의 게임 플레이 · 30초",
          news: "새 게임 소식도 받고 싶다면 아래 버튼을 눌러 주세요. 누르지 않으면 더 보내지 않아요.",
          go: "새 게임 메일로 받기",
          ignore: "직접 요청하지 않았다면 이 메일을 무시하세요.",
        }
      : {
          subject: "Your MemeRush game of the day",
          hello: "Here is today's MemeRush game link you asked for.",
          play: "Play today's game · 30s",
          news: "Want news about new games by mail too? Press the button below. Without it we send nothing more.",
          go: "Also get future news",
          ignore: "If you did not ask for this, ignore this mail.",
        };
  const text = `${t.hello}\n\n${t.play}: ${gameUrl}\n\n${t.news}\n${t.go}: ${url}\n\n${t.ignore}\n`;
  const html = shell(
    lang,
    t.subject,
    t.hello,
    topStrip() +
      banner(esc(gameUrl), "Meme Rush") +
      `<tr><td style="padding:20px;">` +
      `<p style="${p(18, C.cream, "font-weight:700;margin-bottom:16px;")}">${esc(t.hello)}</p>` +
      bigButton(esc(gameUrl), esc(t.play)) +
      `</td></tr>` +
      `<tr><td style="padding:20px;border-top:1px solid ${C.line};">` +
      `<p style="${p(14, C.soft, "margin-bottom:12px;")}">${esc(t.news)}</p>` +
      outlineButton(esc(url), esc(t.go)) +
      `</td></tr>` +
      footerRow(esc(t.ignore)),
  );
  return { subject: t.subject, text, html };
}

// The mail sent right after sign-up (single step since 사장님 10/31) and after a legacy confirmation. Carries RFC 8058 one-click unsubscribe headers; the same URL accepts the one-click POST.
export function buildWelcomeMail(opts: { lang: string; host: string; challengeId: string; unsubToken: string }): BuiltMail {
  const lang: MailLang = opts.lang === "ko" ? "ko" : "en";
  const base = `https://${safeHost(opts.host)}`;
  const gameUrl = `${base}/c/${encodeURIComponent(opts.challengeId)}`;
  const unsubUrl = `${base}/api/unsubscribe?token=${encodeURIComponent(opts.unsubToken)}`;
  const t =
    lang === "ko"
      ? {
          subject: "Meme Rush 오늘의 게임이 도착했어요",
          hello: "요청하신 Meme Rush 오늘의 게임이 도착했어요.",
          play: "오늘의 게임 플레이 · 30초",
          later: "새 게임이 나오면 메일로 알려드려요.",
          from: "MemeRush 드림",
          unsub: "수신거부",
        }
      : {
          subject: "Your MemeRush game of the day",
          hello: "Here is today's MemeRush game link you asked for.",
          play: "Play today's game · 30s",
          later: "We will mail you when a new game is out.",
          from: "From MemeRush",
          unsub: "Unsubscribe",
        };
  const contact = "memerush@superagents.run"; // 문의(CS) 주소. 발신 DoNotReply는 답장을 받지 않는다(사장님 10/31, 공정 카드 밈러시-슈퍼프로젝트 #155)
  const text = `${t.hello}\n\n${t.play}: ${gameUrl}\n\n${t.later}\n\n${t.from}\n${t.unsub}: ${unsubUrl}\n${lang === "ko" ? "문의" : "Contact"}: ${contact}\n`;
  const html = shell(
    lang,
    t.subject,
    t.hello,
    topStrip() +
      banner(esc(gameUrl), "Meme Rush") +
      `<tr><td style="padding:20px;">` +
      `<p style="${p(18, C.cream, "font-weight:700;margin-bottom:16px;")}">${esc(t.hello)}</p>` +
      bigButton(esc(gameUrl), esc(t.play)) +
      `<p style="${p(14, C.soft, "margin-top:16px;")}">${esc(t.later)}</p>` +
      `</td></tr>` +
      footerRow(`${esc(t.from)}<br><a href="${esc(unsubUrl)}" style="color:${C.foot};text-decoration:underline;">${esc(t.unsub)}</a> · ${lang === "ko" ? "문의" : "Contact"} ${contact}`),
  );
  return {
    subject: t.subject,
    text,
    html,
    headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}
