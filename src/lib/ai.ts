import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";

export type AIProvider = "anthropic" | "openai" | "openrouter" | "ollama";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

const ANTHROPIC_BASE = "https://api.anthropic.com";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5";

/**
 * Resolve which AI config to use for a user: their own BYOK settings if
 * present, else the server's ANTHROPIC_API_KEY fallback, else null.
 */
export async function resolveAIConfig(userId: string): Promise<AIConfig | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.aiProvider && user?.aiApiKey && user?.aiModel) {
    return {
      provider: user.aiProvider as AIProvider,
      apiKey: decrypt(user.aiApiKey),
      baseUrl: user.aiBaseUrl || defaultBaseUrl(user.aiProvider as AIProvider),
      model: user.aiModel,
    };
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    return { provider: "anthropic", apiKey: key, baseUrl: ANTHROPIC_BASE, model: ANTHROPIC_DEFAULT_MODEL };
  }
  return null;
}

export function defaultBaseUrl(provider: AIProvider): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "ollama":
      return "http://localhost:11434/v1";
    case "anthropic":
    default:
      return ANTHROPIC_BASE;
  }
}

/** True when AI is available to the server itself (server-key fallback). */
export function aiAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

type Message = { role: "user" | "assistant"; content: string | Anthropic.ContentBlockParam[] };

export async function callAI(config: AIConfig, messages: Message[], maxTokens: number): Promise<string> {
  if (config.provider === "anthropic") return callAnthropic(config, messages, maxTokens);
  return callOpenAICompatible(config, messages, maxTokens);
}

async function callAnthropic(config: AIConfig, messages: Message[], maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey: config.apiKey, baseURL: config.baseUrl });
  const res = await client.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    messages: messages.map((m): Anthropic.MessageParam => ({ role: m.role, content: m.content })),
  });
  return (res.content ?? [])
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function callOpenAICompatible(config: AIConfig, messages: Message[], maxTokens: number): Promise<string> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status} ${await res.text()}`);
  const json = await res.json() as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  // Find the first balanced, parseable JSON object by scanning for a `{`
  // and walking to its matching `}` (brace-depth balanced).
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] !== "{") continue;
    let depth = 0;
    for (let j = i; j < cleaned.length; j++) {
      const ch = cleaned[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = cleaned.slice(i, j + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break; // unbalanced inside; advance to next `{`
          }
        }
      }
    }
  }
  return null;
}

export interface ExtractedBill {
  merchant: string;
  date?: string;
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
  "merchant": string, "date": "YYYY-MM-DD"|null, "total": number|null, "subtotal": number|null,
  "tax": number|null, "currency": "USD"|string, "type": "expense"|"income",
  "categorySuggestion": string,
  "lineItems": [{"name": string, "qty": number|null, "price": number|null}]
}
If a field cannot be determined, use null. categorySuggestion should be a short category like "Groceries", "Utilities", "Dining", "Transport", "Subscriptions", "Shopping", "Health", "Travel".`;

export async function extractBillFromImage(userId: string, base64Image: string, mediaType: "image/png" | "image/jpeg" | "application/pdf"): Promise<ExtractedBill> {
  const config = await resolveAIConfig(userId);
  if (!config) throw new Error("AI not configured. Add an AI provider key in Settings, or set ANTHROPIC_API_KEY on the server.");

  const content: Anthropic.ContentBlockParam[] =
    mediaType === "application/pdf"
      ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Image } }]
      : [{ type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } }];
  content.push({ type: "text", text: EXTRACTION_PROMPT });

  let text: string;
  if (config.provider === "anthropic") {
    try {
      text = await callAnthropic(config, [{ role: "user", content }], 2048);
    } catch {
      text = "";
    }
  } else {
    const userMsg = (mediaType === "application/pdf" ? "(PDF document attached)" : "(image attached)") + "\n\n" + EXTRACTION_PROMPT;
    text = await callOpenAICompatible(config, [{ role: "user", content: userMsg }], 2048);
  }

  const parsed = extractJson(text) as ExtractedBill;
  return { ...(parsed ?? {}), rawText: text.slice(0, 4000) } as ExtractedBill;
}

export async function extractBillFromText(userId: string, text: string): Promise<ExtractedBill> {
  const config = await resolveAIConfig(userId);
  if (!config) throw new Error("AI not configured. Add an AI provider key in Settings, or set ANTHROPIC_API_KEY on the server.");
  const out = await callAI(config, [{ role: "user", content: `${EXTRACTION_PROMPT}\n\n--- DOCUMENT TEXT ---\n${text}` }], 2048);
  const parsed = extractJson(out) as ExtractedBill;
  return { ...(parsed ?? {}), rawText: text.slice(0, 4000) } as ExtractedBill;
}

export interface AIInsight {
  title: string;
  body: string;
  category?: string | null;
  potentialSavings?: number | null;
  severity: "info" | "warning" | "alert";
}

const REVIEW_SYSTEM = `You are a personal-finance analyst reviewing a user's transactions. Find concrete cost-saving opportunities: recurring charges, subscriptions, price creep, wasteful spending patterns, category budget overruns, and merchants with unusually high spend.
Return ONLY valid JSON: {"insights":[{"title":string,"body":string,"category":string|null,"potentialSavings":number|null,"severity":"info"|"warning"|"alert"}]}.
Be specific, cite merchant names and amounts. 3-8 insights. If nothing actionable, return an empty insights array.`;

export async function reviewTransactions(userId: string, summary: string): Promise<AIInsight[]> {
  const config = await resolveAIConfig(userId);
  if (!config) throw new Error("AI not configured. Add an AI provider key in Settings, or set ANTHROPIC_API_KEY on the server.");
  const out = await callAI(config, [{ role: "user", content: `${REVIEW_SYSTEM}\n\n--- TRANSACTIONS (summarized) ---\n${summary}` }], 2048);
  const parsed = extractJson(out) as { insights?: AIInsight[] };
  return Array.isArray(parsed?.insights) ? parsed.insights : [];
}
