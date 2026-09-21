import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { recomputeAllFlags } from "@/lib/rules";
import { rulePatchSchema, parseBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function ownRule(id: number, userId: string) {
  const r = await prisma.rule.findUnique({ where: { id } });
  return r && r.userId === userId ? r : null;
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/rules/[id]">) {
  const { id } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rule = await ownRule(Number(id), userId);
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const parsed = parseBody(rulePatchSchema, body);
  if (!parsed.ok) return NextResponse.json({ error: "Validation failed", errors: parsed.errors }, { status: 400 });
  const v = parsed.value;

  const data: Record<string, unknown> = {};
  for (const k of ["name", "description", "field", "operator", "value", "action", "message"] as const) {
    if (k in v) data[k] = v[k as keyof typeof v];
  }
  if (v.enabled !== undefined) data.enabled = v.enabled;
  if ("categoryId" in v) {
    let categoryId: number | null = null;
    if (v.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: v.categoryId } });
      if (cat && cat.userId === userId) categoryId = cat.id;
    }
    data.categoryId = categoryId;
  }
  const updated = await prisma.rule.update({ where: { id: Number(id) }, data });
  await recomputeAllFlags(userId);
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/rules/[id]">) {
  const { id } = await ctx.params;
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rule = await ownRule(Number(id), userId);
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.rule.delete({ where: { id: Number(id) } });
  await recomputeAllFlags(userId);
  return NextResponse.json({ ok: true });
}
