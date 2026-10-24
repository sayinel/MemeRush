# Maya's work on Meme Rush (hackathon day, 2026-10-24)

Maya is the CMO agent on Team Super Agent. This page lists what she produced for the Ambition for Korea hackathon, where each piece lives, and what is still unverified.

## 1. Positioning

Meme Rush is **the 100M-hit game service**: global hit memes and hit games, built into a new 30-second game every day and delivered through SNS. The production line is agentic. Agents run 8 of 11 steps; a person approves 3 things today (pick the pair, pick the caption, approve the art). The target is 1 approval a day. That target is a goal, not something built yet.

## 2. Deliverables

- **Pitch deck (2 slides, 16:9, PDF)**: problem, solution, market (TAM/SAM/SOM), target customer, spread strategy, agentic line, ask. Includes the official event logo band from the event kit. English and Korean versions.
- **Promo and pre-registration site**: temporary page at https://simplifier.co.kr/preview/memerush/ (noindex). Hero with CTA, trailer, pre-registration form (Tally, email only) at `/join/`.
- **README**: banner, one-line pitch, trailer GIF, how it works, four concept screens, run locally. Kept short on purpose after review.
- **Writing guide**: tone and copy rules, in [`WRITING_GUIDE.md`](WRITING_GUIDE.md).
- **UX guides**: the old site guide was reclassified as the Admin UX guide, and Maya's guide became the Service UX guide. See [`ADMIN_UX_GUIDE.md`](ADMIN_UX_GUIDE.md) and [`SERVICE_UX_GUIDE.md`](SERVICE_UX_GUIDE.md). Both are also in the Carvit MCP (`MEME_RUSH_ADMIN_UX_GUIDE`, `MEME_RUSH_SERVICE_UX_GUIDE`, index `MEME_RUSH_GUIDE_INDEX`).
- **Marketing strategy**: [`MARKETING_STRATEGY.md`](MARKETING_STRATEGY.md).
- **Market sizing research**: [`research/2026-10-24_market_sizing_research.md`](research/2026-10-24_market_sizing_research.md).

## 3. Market model used in the deck

- TAM about $8B (browser games, $7.8B to $9.2B for 2025).
- SAM about $0.75B: 68M US meme-native 18 to 34 year olds (136M US TikTok MAU x 50%, assumption) at $10.95 a year ($0.03 ad ARPDAU x 365, assumption).
- SOM: Year 1 $1.1M at 100K DAU, Year 3 $11M at 1M DAU. Both DAU figures are assumptions.
- Reference case: Wordle went from 90 to about 2M daily players in about 3 months (public reports, link not verified).

## 4. How the numbers were checked

Research ran through Gemini with web search. Every returned link was opened. Figures that could not be confirmed were dropped or marked unverified, for example one "browser games $11.3B" figure and a "NYT 10M DAU" claim. The remaining figures were cross-checked with a separate web search. Items labelled (A) in the deck are assumptions.

## 5. Open items

- Cost to produce one daily game is not measured yet.
- The Wordle growth source link is unverified.
- The English team name spelling ("SUPER AGENT") needs a check against the event registration.
- Pre-registration responses are in the Tally form; Maya checks them each session.
- The trailer on the site and in this README is a temporary mock. It will be replaced by the finished video from Fit.
- A single image of all characters is requested from Fit and will replace the two cast sheets.
