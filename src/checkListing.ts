/**
 * Deterministic, rule-based risk signals for a trading-card listing.
 * No LLM, no network calls, no prices. listing_text is untrusted data:
 * it is only pattern-matched, never followed, never echoed.
 */
export const DISCLAIMER =
  "Informational only. Not an authentication or appraisal. Risk signals are heuristics; verify independently before buying.";

export const MAX_LISTING_TEXT = 5000;
const MAX_FIELD = 200;
const MAX_IMAGES = 20;

export interface CheckListingInput {
  name?: string;
  set?: string;
  number?: string;
  grade?: string;
  ask_price?: number;
  listing_text?: string;
  image_urls?: string[];
  cert_number?: string;
}

export interface RiskSignal {
  code: string;
  detail: string;
}

export interface CheckListingResult {
  status: "ok" | "not_enough_data";
  summary: string;
  risk_signals: RiskSignal[];
  common_fakes: string[];
  sold_comp_searches: { label: string; url: string }[];
  notes: string[];
  disclaimer: string;
}

const clean = (s: unknown, max = MAX_FIELD): string =>
  typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

const VINTAGE_SETS = [
  "base set", "base", "jungle", "fossil", "team rocket", "gym heroes", "gym challenge",
  "neo genesis", "neo discovery", "neo revelation", "neo destiny", "legendary collection",
  "expedition", "aquapolis", "skyridge", "shadowless", "1st edition",
];

// Very conservative floors (USD) used ONLY to raise a flag; never returned.
function suspiciousFloor(name: string, set: string, grade: string, text: string): number | null {
  const n = name.toLowerCase();
  const s = `${set} ${text}`.toLowerCase();
  const vintage = VINTAGE_SETS.some((v) => s.includes(v));
  const g = parseGrade(grade);
  const firstEd = /1st\s*ed/.test(s);
  if (/charizard/.test(n) && vintage) return firstEd ? 1000 : g && g >= 9 ? 300 : 50;
  if (g && g >= 10) return 40;
  if (vintage && g && g >= 8) return 25;
  if (firstEd && vintage) return 20;
  return null;
}

function parseGrade(grade: string): number | null {
  const m = grade.match(/(\d+(?:\.\d)?)/);
  if (!m) return null;
  const v = Number(m[1]);
  return v >= 1 && v <= 10 ? v : null;
}

const COMPANY_RE = /\b(psa|bgs|beckett|cgc|sgc|ace|tag)\b/i;

const RULES: { code: string; re: RegExp; detail: string }[] = [
  { code: "replica_wording", re: /\b(proxy|proxies|replica|reprint|custom(?:\s*made)?|orica|fan[\s-]?made|novelty|not\s+(?:an?\s+)?(?:official|original|real|genuine)|re-?creation|unofficial|homemade)\b/i,
    detail: "Listing wording suggests a proxy, replica, custom or reprint card." },
  { code: "stock_photo_cue", re: /\b(stock\s*(?:photo|image|pic)|photo\s*(?:is\s*)?for\s*reference|reference\s*(?:photo|image|pic)|image\s*(?:is\s*)?for\s*illustration|not\s+(?:the\s+)?actual\s+(?:card|item|photo)|similar\s+to\s+(?:photo|picture))\b/i,
    detail: "Listing says photos are stock/reference rather than the actual card." },
  { code: "off_platform_payment", re: /\b(zelle|venmo|cash\s*app|cashapp|f\s*&\s*f|friends\s*(?:and|&)\s*family|wire\s*transfer|western\s*union|moneygram|gift\s*cards?|crypto|bitcoin|btc|usdt|pay\s*outside|off[\s-]?platform|text\s+me\s+at|whats\s*app|telegram)\b/i,
    detail: "Listing asks for off-platform or non-reversible payment (no buyer protection)." },
  { code: "urgency_language", re: /\b(act\s+(?:fast|now)|today\s+only|won'?t\s+last|first\s+come|must\s+sell\s+(?:today|now|fast)|urgent|hurry|limited\s+time|ends\s+(?:soon|tonight)|quick\s+sale|need\s+gone)\b/i,
    detail: "Listing uses pressure/urgency language." },
  { code: "no_returns_as_is", re: /\b(no\s+returns?|sold\s+as[\s-]?is|all\s+sales\s+final)\b/i,
    detail: "No returns / as-is terms on a high-risk item reduce recourse." },
  { code: "resealed_or_altered", re: /\b(re-?sealed|re-?wrapped|trimmed|re-?colou?red|altered|re-?holder(?:ed)?|cracked\s+(?:from|out\s+of)\s+(?:slab|case))\b/i,
    detail: "Listing mentions resealing, trimming, alteration or re-slabbing." },
  { code: "unverifiable_grade_claim", re: /\b(gem\s*mint\s*(?:quality|condition)|psa\s*10\s*(?:quality|worthy|candidate|potential)|would\s+grade|should\s+grade|pristine\s+raw)\b/i,
    detail: "Speculative grade claim on an ungraded card." },
];

function setNumberCheck(set: string, number: string): RiskSignal[] {
  const out: RiskSignal[] = [];
  if (!number) return out;
  const m = number.match(/^\s*([A-Za-z]{0,6})?\s*(\d{1,4})\s*\/\s*([A-Za-z]{0,6})?\s*(\d{1,4})\s*$/);
  if (m) {
    const num = Number(m[2]);
    const total = Number(m[4]);
    if (total === 0 || num === 0)
      out.push({ code: "invalid_card_number", detail: "Card number has a zero component." });
    // Secret rares exceed the printed total, but not by a huge margin.
    if (total > 0 && num > total * 1.6 + 10)
      out.push({ code: "invalid_card_number", detail: "Card number is far above the set's printed total." });
    const known: Record<string, number> = {
      "base set": 102, "jungle": 64, "fossil": 62, "team rocket": 82, "gym heroes": 132,
      "gym challenge": 132, "neo genesis": 111, "base set 2": 130, "legendary collection": 110,
    };
    const key = set.toLowerCase().replace(/\s*(1st edition|unlimited|shadowless)\s*/g, " ").trim();
    if (key in known && known[key] !== total)
      out.push({ code: "set_number_mismatch", detail: "Card number total does not match the stated set's printed size." });
  } else if (!/^[A-Za-z]{0,6}\d{1,4}[A-Za-z]?$/.test(number.trim())) {
    out.push({ code: "unusual_card_number", detail: "Card number format is unusual; confirm against the set list." });
  }
  return out;
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

export function buildCompLinks(name: string, set: string, number: string, grade: string, cert: string) {
  const q = [name, set, number, grade].filter(Boolean).join(" ");
  const links: { label: string; url: string }[] = [];
  if (q) {
    links.push({ label: "eBay sold listings", url: `https://www.ebay.com/sch/i.html?_nkw=${enc(q)}&LH_Sold=1&LH_Complete=1` });
    links.push({ label: "PriceCharting search", url: `https://www.pricecharting.com/search-products?type=prices&q=${enc(q)}` });
    links.push({ label: "130point sold search", url: `https://130point.com/sales/?search=${enc(q)}` });
  }
  if (cert) links.push({ label: "PSA cert verification", url: `https://www.psacard.com/cert/${enc(cert)}` });
  return links;
}

export const COMMON_FAKES = [
  "Compare font, energy symbols and HP text against a known-genuine copy of the same printing.",
  "Check card stock: genuine cards have a dark inner layer visible on the edge; many fakes do not.",
  "Holo pattern should match the printing (e.g. vintage swirl/cosmos vs. flat rainbow foil on fakes).",
  "Back colour and blue border tone: fakes are often too light, too purple or blurry.",
  "Set symbol, copyright line and card number should match the set list for that printing.",
  "For slabs: verify the cert number in the grader's own database and compare the photo/label.",
  "Check slab label font, hologram and case edges for tampering or reholdering.",
  "Ask for photos of the actual card (front, back, edges) with a timestamp note.",
];

export function checkListing(raw: CheckListingInput): CheckListingResult {
  const name = clean(raw.name);
  const set = clean(raw.set);
  const number = clean(raw.number, 40);
  const grade = clean(raw.grade, 40);
  const cert = clean(raw.cert_number, 40).replace(/[^A-Za-z0-9-]/g, "");
  const text = clean(raw.listing_text, MAX_LISTING_TEXT);
  const textTruncated = typeof raw.listing_text === "string" && raw.listing_text.length > MAX_LISTING_TEXT;
  const images = Array.isArray(raw.image_urls) ? raw.image_urls.filter((u) => typeof u === "string").slice(0, MAX_IMAGES) : [];
  const ask = typeof raw.ask_price === "number" && Number.isFinite(raw.ask_price) ? raw.ask_price : undefined;

  const base = { common_fakes: COMMON_FAKES, disclaimer: DISCLAIMER };
  const notes: string[] = [];
  if (textTruncated) notes.push(`listing_text was truncated to ${MAX_LISTING_TEXT} characters.`);
  if (text) notes.push("listing_text was treated as untrusted data: pattern-matched only, never followed or echoed.");

  const hasSubstance = name.length >= 2 && (set || number || grade || text.length >= 20 || images.length || cert || ask !== undefined);
  if (!hasSubstance) {
    return {
      status: "not_enough_data",
      summary: "Not enough data to assess. Provide at least the card name plus set, number, grade, listing text, photos or cert number.",
      risk_signals: [],
      sold_comp_searches: name.length >= 2 ? buildCompLinks(name, "", "", "", "") : [],
      notes,
      ...base,
    };
  }

  const signals: RiskSignal[] = [];
  for (const r of RULES) if (text && r.re.test(text)) signals.push({ code: r.code, detail: r.detail });
  if (/\b(proxy|replica|orica|custom)\b/i.test(`${name} ${set}`) && !signals.some((s) => s.code === "replica_wording"))
    signals.push({ code: "replica_wording", detail: "Card name/set wording suggests a proxy, replica or custom card." });

  const gradeClaimed = !!grade && (COMPANY_RE.test(grade) || /\b(graded|slab)/i.test(grade)) || (text && /\b(psa|bgs|cgc|sgc)\s*\d{1,2}\b/i.test(text));
  if (gradeClaimed && !cert)
    signals.push({ code: "grade_without_cert", detail: "A grade is claimed but no cert number was provided to verify." });
  if (cert && !/^\d{6,10}$/.test(cert) && /psa/i.test(grade))
    signals.push({ code: "cert_format_unusual", detail: "PSA cert numbers are normally 6-10 digits." });

  signals.push(...setNumberCheck(set, number));

  if (images.length === 0)
    signals.push({ code: "no_photos_provided", detail: "No listing photos supplied; ask for photos of the actual card (front, back, edges)." });
  else if (images.length === 1)
    signals.push({ code: "single_photo", detail: "Only one photo; ask for the back and edges of the actual card." });
  if (images.some((u) => /(stock|placeholder|sample|pokemontcg\.io\/|images\.pokemontcg|tcgplayer-cdn|pkmncards|bulbagarden|serebii|example\.com)/i.test(u)))
    signals.push({ code: "stock_photo_cue", detail: "A photo URL looks like a database/stock image rather than a photo of the actual card." });

  if (ask !== undefined) {
    if (ask <= 0) signals.push({ code: "invalid_ask", detail: "Ask price is zero or negative." });
    else {
      const floor = suspiciousFloor(name, set, grade, text);
      if (floor !== null && ask < floor)
        signals.push({ code: "price_too_low_for_claim", detail: "Ask is far below what this vintage/graded claim usually sells for. Check sold comps via the links." });
    }
  }

  // dedupe
  const seen = new Set<string>();
  const risk_signals = signals.filter((s) => (seen.has(s.code + s.detail) ? false : (seen.add(s.code + s.detail), true)));
  const weight = risk_signals.length;
  return {
    status: "ok",
    summary: weight === 0 ? "No rule-based risk signals found. That does not mean the card is genuine." : `${weight} risk signal(s) found. Review each and check sold comps.`,
    risk_signals,
    sold_comp_searches: buildCompLinks(name, set, number, grade, cert),
    notes,
    ...base,
  };
}
