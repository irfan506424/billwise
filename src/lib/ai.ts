import Anthropic from "@anthropic-ai/sdk";

// Latest Claude model IDs. Adjust as needed.
export const MODELS = {
  fast: "claude-haiku-4-5-20251001",
  balanced: "claude-sonnet-5",
  powerful: "claude-opus-4-8",
} as const;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!client) client = new Anthropic({ apiKey: key });
  return client;
}

export function aiAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface ExtractedBill {
  merchant: string;
  date?: string; // ISO
  total?: number;
  subtotal?: number;
  tax?: number;
  currency?: string;
  type?: "expense" | "income";
  lineItems?: { name: string; qty?: number; price?: number }[];
  categorySuggestion?: string;
  rawText?: string;
}

const EXTRACTION_PROMPT = `You are a receipt/bill OCR + structuring engine. From the provided document (image or text), extract structured data.
Return ONLY valid JSON (no markdown, no commentary) matching this shape:
{
  "merchant": string,
  "date": "YYYY-MM-DD" | null,
  "total": number | null,
  "subtotal": number | null,
  "tax": number | null,
  "currency": "USD" | string,
  "type": "expense" | "income",
  "categorySuggestion": string,
  "lineItems": [{"name": string, "qty": number|null, "price": number|null}]
}
If a field cannot be determined, use null. categorySuggestion should be a short category like "Groceries", "Utilities", "Dining", "Transport", "Subscriptions", "Shopping", "Health", "Travel".`;

export async function extractBillFromImage(base64Image: string, mediaType: "image/png" | "image/jpeg" | "application/pdf" = "image/jpeg"): Promise<ExtractedBill> {
  const c = getClient();
  if (!c) throw new Error("ANTHROPIC_API_KEY not set");
  const docBlock =
    mediaType === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64Image } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data: base64Image } };
  const msg = await c.messages.create({
    model: MODELS.balanced,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [docBlock, { type: "text", text: EXTRACTION_PROMPT }],
      },
    ],
  });
  return parseJsonResponse(msg, base64Image);
}

export async function extractBillFromText(text: string): Promise<ExtractedBill> {
  const c = getClient();
  if (!c) throw new Error("ANTHROPIC_API_KEY not set");
  const msg = await c.messages.create({
    model: MODELS.balanced,
    max_tokens: 2048,
    messages: [
      { role: "user", content: [{ type: "text", text: `${EXTRACTION_PROMPT}\n\n--- DOCUMENT TEXT ---\n${text}` }] },
    ],
  });
  return parseJsonResponse(msg, text);
}

function parseJsonResponse(msg: Anthropic.Message, fallbackRaw: string): ExtractedBill {
  const text = (msg.content ?? [])
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return { ...parsed, rawText: fallbackRaw.slice(0, 4000) } as ExtractedBill;
  } catch {
    return { merchant: "Unknown", rawText: text || fallbackRaw.slice(0, 4000) };
  }
}

export interface AIInsight {
  title: string;
  body: string;
  category?: string;
  potentialSavings?: number;
  severity: "info" | "warning" | "alert";
}

const REVIEW_SYSTEM = `You are a personal-finance analyst reviewing a user's transactions. Find concrete cost-saving opportunities: recurring charges, subscriptions, price creep, wasteful spending patterns, category budget overruns, and merchants with unusually high spend.
Return ONLY valid JSON: {"insights":[{"title":string,"body":string,"category":string|null,"potentialSavings":number|null,"severity":"info"|"warning"|"alert"}]}.
Be specific, cite merchant names and amounts. 3-8 insights. If nothing actionable, return an empty insights array.`;

export async function reviewTransactions(summary: string): Promise<AIInsight[]> {
  const c = getClient();
  if (!c) throw new Error("ANTHROPIC_API_KEY not set");
  const msg = await c.messages.create({
    model: MODELS.balanced,
    max_tokens: 2048,
    messages: [
      { role: "user", content: [{ type: "text", text: `${REVIEW_SYSTEM}\n\n--- TRANSACTIONS (summarized) ---\n${summary}` }] },
    ],
  });
  const text = (msg.content ?? [])
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed.insights) ? parsed.insights : [];
  } catch {
    return [];
  }
}
