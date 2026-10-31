// Subscription mails (confirmation, then welcome). Pure functions (no env access) so it can be unit tested.
// Product decision: "we send you this game, and tell you when a new game is out". Do NOT promise a daily mail.
// TODO(legal): advertising label / sender identification for marketing mail is pending legal review. Not added on purpose.

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
          subject: "MemeRush 오늘의 게임 링크",
          hello: "요청하신 MemeRush 오늘의 게임 링크예요.",
          play: "오늘의 게임 하러 가기",
          news: "새 게임 소식도 메일로 받고 싶다면 아래 버튼을 눌러 주세요. 누르지 않으면 더 보내지 않아요.",
          go: "앞으로 소식도 받기",
          ignore: "직접 요청하지 않았다면 이 메일을 무시하세요.",
        }
      : {
          subject: "Your MemeRush game of the day",
          hello: "Here is today's MemeRush game link you asked for.",
          play: "Play today's game",
          news: "Want news about new games by mail too? Press the button below. Without it we send nothing more.",
          go: "Also get future news",
          ignore: "If you did not ask for this, ignore this mail.",
        };
  const text = `${t.hello}\n\n${t.play}: ${gameUrl}\n\n${t.news}\n${t.go}: ${url}\n\n${t.ignore}\n`;
  const html =
    `<!doctype html><html lang="${lang}"><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:0 auto;padding:16px">` +
    `<p>${t.hello}</p><p><a href="${gameUrl}" style="font-size:1.1rem;font-weight:bold">${t.play}</a></p>` +
    `<p>${t.news}</p><p><a href="${url}">${t.go}</a></p><p style="font-size:12px;color:#666">${t.ignore}</p></body></html>`;
  return { subject: t.subject, text, html };
}

// After confirmation. Carries RFC 8058 one-click unsubscribe headers; the same URL accepts the one-click POST.
export function buildWelcomeMail(opts: { lang: string; host: string; challengeId: string; unsubToken: string }): BuiltMail {
  const lang: MailLang = opts.lang === "ko" ? "ko" : "en";
  const base = `https://${safeHost(opts.host)}`;
  const gameUrl = `${base}/c/${encodeURIComponent(opts.challengeId)}`;
  const unsubUrl = `${base}/api/unsubscribe?token=${encodeURIComponent(opts.unsubToken)}`;
  const t =
    lang === "ko"
      ? {
          subject: "MemeRush 게임 링크를 보내드려요",
          hello: "구독해 주셔서 고마워요. 이 게임을 보내드려요.",
          play: "게임 하러 가기",
          later: "새 게임이 나오면 알려드려요.",
          from: "MemeRush 드림",
          unsub: "수신거부",
        }
      : {
          subject: "Your MemeRush game link",
          hello: "Thanks for subscribing. Here is the game.",
          play: "Play now",
          later: "We will let you know when a new game is out.",
          from: "From MemeRush",
          unsub: "Unsubscribe",
        };
  const text = `${t.hello}\n\n${t.play}: ${gameUrl}\n\n${t.later}\n\n${t.from}\n${t.unsub}: ${unsubUrl}\n`;
  const html =
    `<!doctype html><html lang="${lang}"><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:0 auto;padding:16px">` +
    `<p>${t.hello}</p><p><a href="${gameUrl}">${t.play}</a></p><p>${t.later}</p><p>${t.from}</p>` +
    `<p style="font-size:12px;color:#666"><a href="${unsubUrl}">${t.unsub}</a></p></body></html>`;
  return {
    subject: t.subject,
    text,
    html,
    headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}
