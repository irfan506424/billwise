import { NextRequest, NextResponse } from "next/server";
import { extractBillFromImage, extractBillFromText } from "@/lib/ai";
import { toDecimal } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { applyRulesToTransaction } from "@/lib/rules";

export const dynamic = "force-dynamic";

function detectMediaType(name: string, bytes: Uint8Array): "image/png" | "image/jpeg" | "application/pdf" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "image/png"; // placeholder, handled below
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x25 && bytes[1] === 0x50) return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  return "image/jpeg";
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const text = form.get("text") as string | null;
  const save = form.get("save") === "true";

  let extracted;
  try {
    if (file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (file.name.toLowerCase().endsWith(".txt") || (text && !file.size)) {
        const t = text ?? new TextDecoder().decode(bytes);
        extracted = await extractBillFromText(userId, t);
      } else {
        const mediaType = detectMediaType(file.name, bytes);
        const base64 = Buffer.from(bytes).toString("base64");
        extracted = await extractBillFromImage(userId, base64, mediaType);
      }
    } else if (text) {
      extracted = await extractBillFromText(userId, text);
    } else {
      return NextResponse.json({ error: "Provide a file or text." }, { status: 400 });
    }
  } catch (e) {
    // extract throws "AI not configured. …" when neither the user's BYOK key nor the server key is set
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  if (!save) return NextResponse.json({ extracted });

  const tx = await prisma.transaction.create({
    data: {
      merchant: extracted.merchant || "Unknown",
      description: null,
      amount: toDecimal(extracted.total ?? 0),
      currency: extracted.currency ?? "USD",
      type: extracted.type ?? "expense",
      date: extracted.date ? new Date(extracted.date) : new Date(),
      source: "ocr",
      rawText: extracted.rawText ?? null,
      lineItems: extracted.lineItems ? JSON.stringify(extracted.lineItems) : null,
      tax: extracted.tax != null ? toDecimal(extracted.tax) : null,
      userId,
    },
    include: { category: true, labels: true },
  });
  await applyRulesToTransaction(tx.id, userId, {
    merchant: tx.merchant,
    description: tx.description,
    amount: tx.amount,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    labelNames: tx.labels.map((l) => l.name),
  });
  return NextResponse.json({ extracted, saved: tx }, { status: 201 });
}
