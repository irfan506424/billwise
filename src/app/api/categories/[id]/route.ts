import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { toDecimal } from "@/lib/format";
import { categoryPatchSchema, parseBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function ownCategory(id: number, userId: string) {
  const c = await prisma.category.findUnique({ where: { id } });
  return c && c.userId === userId ? c : null;
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/categories/[id]">) {
  const { id } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cat = await ownCategory(Number(id), userId);
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseBody(categoryPatchSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });
  const v = parsed.value;

  const data: Record<string, unknown> = {};
  if (v.name !== undefined) data.name = v.name;
  if (v.color !== undefined) data.color = v.color;
  if (v.budget !== undefined) data.budget = toDecimal(v.budget);
  const updated = await prisma.category.update({ where: { id: Number(id) }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/categories/[id]">) {
  const { id } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cat = await ownCategory(Number(id), userId);
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.category.update({ where: { id: Number(id) }, data: { transactions: { set: [] } } });
  await prisma.category.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
