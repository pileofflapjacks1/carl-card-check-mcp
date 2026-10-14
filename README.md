# carl-card-check-mcp

A free MCP server with one tool, **`check_listing`**. It returns deterministic, rule-based **risk signals** for a trading-card (Pokémon-focused) listing, a common-fakes checklist, and links to sold-comp searches.

> **Informational only. Not an authentication or appraisal.** Every response carries this disclaimer.

## What it does
- `check_listing(name, set?, number?, grade?, ask_price?, listing_text?, image_urls?, cert_number?)`
- Returns `status` (`ok` | `not_enough_data`), `summary`, `risk_signals[]` (`code` + `detail`), `common_fakes[]`, `sold_comp_searches[]`, `notes[]`, `disclaimer`.
- Rules (no LLM, no network): proxy/replica/custom/orica wording; stock-photo or no-actual-photo cues; grade claimed without a cert number; set/number mismatch; off-platform payment (Zelle, F&F, wire, gift cards, crypto); urgency language; no-returns/as-is; resealed/trimmed/altered; and an ask that is far too low for a vintage/graded claim (flag only).
- Sold-comp links are **built as URLs only and never fetched**: eBay sold listings, PriceCharting search, 130point search, plus PSA cert verification when a cert is given.

## What it does NOT do
- It does **not** authenticate, grade, or appraise cards, and never says a card is "authentic" or "fake".
- It does **not** return prices (see below).
- It does **not** fetch anything over the network.
- It does **not** identify cards (yet; see below).

## No-prices policy
The tool never returns a price, market value or comp figure. Your `ask_price` is used only internally to decide whether to raise `price_too_low_for_claim`, and it is never echoed back. Tests enforce this.

## Untrusted input
`listing_text` is treated as untrusted data. It is capped at 5,000 characters, only pattern-matched, never followed as instructions, and never echoed (including any URLs it contains). A prompt-injection test is included.

## Card identification is deferred
An `identify_card` tool was planned on the pokemontcg.io API. It is deferred because pokemontcg.io is officially deprecated ("The Pokémon TCG API is deprecated. Please migrate your application to Scrydex.", docs.pokemontcg.io, checked Oct 14, 2026) and was returning intermittent 500/502 errors. Its successor, Scrydex, needs a paid plan, and its terms require prior written authorization for commercial redistribution. This repo makes no pokemontcg.io or Scrydex calls.

## Local run
```bash
npm install
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run stdio      # MCP over stdio (for local MCP clients)
npx wrangler dev   # local streamable-HTTP endpoint at http://localhost:8787/mcp
```

## Deploy to Cloudflare Workers (NOT done; for Joe)
Nothing has been deployed and no Cloudflare account has been created.
1. `npx wrangler login` (Cloudflare free plan: 100,000 requests/day).
2. `npx wrangler deploy`
3. Point MCP clients at `https://carl-card-check-mcp.<your-subdomain>.workers.dev/mcp`.

No secrets or environment variables are required.

## License
MIT
