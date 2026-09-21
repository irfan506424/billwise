import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { toDecimal } from "@/lib/format";
import { applyRulesToTransaction } from "@/lib/rules";

export const dynamic = "force-dynamic";

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const found = Object.keys(row).find((rk) => rk.toLowerCase().trim() === k.toLowerCase());
    if (found && row[found] != null && String(row[found]).trim() !== "") return String(row[found]).trim();
  }
  return undefined;
}

function parseDate(s?: string): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  const text = await file.text();

  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const rows = parsed.data.filter((r) => Object.keys(r).length > 0);
  let imported = 0;
  const skipped: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const merchant = pick(row, ["merchant", "description", "name", "payee", "details"]) ?? "Unknown";
    const amountStr = pick(row, ["amount", "value", "debit", "credit", "transaction amount"]);
    if (!amountStr) {
      skipped.push(i + 2);
      continue;
    }
    const amount = toDecimal(amountStr.replace(/[^0-9.\-]/g, ""));
    const date = parseDate(pick(row, ["date", "transaction date", "posted date", "time"]));
    const catName = pick(row, ["category", "type", "tag"]);

    let categoryId: number | null = null;
    if (catName) {
      const cat = await prisma.category.upsert({
        where: { userId_name: { userId, name: catName } },
        update: {},
        create: { name: catName, userId },
      });
      categoryId = cat.id;
    }

    const tx = await prisma.transaction.create({
      data: {
        merchant,
        description: pick(row, ["memo", "notes", "description"]) ?? null,
        amount: Math.abs(amount),
        type: "expense",
        date,
        source: "csv",
        userId,
        categoryId,
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
    imported++;
  }

  return NextResponse.json({ imported, skippedRows: skipped, total: rows.length });
}
