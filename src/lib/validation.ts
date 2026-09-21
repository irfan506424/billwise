import { z } from "zod";

const amount = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Number.isNaN(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a number" });
    return z.NEVER;
  }
  return n;
});

export const transactionCreateSchema = z.object({
  merchant: z.string().trim().min(1).max(200),
  description: z.string().max(500).nullish(),
  amount: amount,
  currency: z.string().trim().max(8).default("USD"),
  type: z.enum(["expense", "income"]).default("expense"),
  date: z.string().optional(),
  source: z.enum(["manual", "ocr", "csv", "email"]).default("manual"),
  rawText: z.string().max(20000).nullish(),
  lineItems: z.array(z.object({ name: z.string(), qty: z.number().nullish(), price: z.number().nullish() })).nullish(),
  tax: amount.nullish(),
  categoryId: z.number().int().positive().nullish(),
  labels: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
});

export const transactionPatchSchema = z.object({
  merchant: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(500).nullish(),
  amount: amount.optional(),
  currency: z.string().trim().max(8).optional(),
  type: z.enum(["expense", "income"]).optional(),
  date: z.string().optional(),
  source: z.enum(["manual", "ocr", "csv", "email"]).optional(),
  rawText: z.string().max(20000).nullish(),
  lineItems: z.array(z.object({ name: z.string(), qty: z.number().nullish(), price: z.number().nullish() })).nullish(),
  tax: amount.nullish(),
  categoryId: z.number().int().positive().nullish(),
  labels: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().max(20).default("#6366f1"),
  budget: amount.default(0),
});

export const categoryPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z.string().max(20).optional(),
  budget: amount.optional(),
});

export const labelCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().max(20).default("#22c55e"),
});

export const ruleCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullish(),
  field: z.enum(["merchant", "description", "amount", "category", "label"]),
  operator: z.enum(["contains", "eq", "gt", "lt", "gte", "lte", "regex"]),
  value: z.string().min(1).max(500),
  action: z.enum(["flag", "flag_savings"]).default("flag"),
  message: z.string().max(300).default(""),
  enabled: z.boolean().default(true),
  categoryId: z.number().int().positive().nullish(),
});

export const rulePatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).nullish(),
  field: z.enum(["merchant", "description", "amount", "category", "label"]).optional(),
  operator: z.enum(["contains", "eq", "gt", "lt", "gte", "lte", "regex"]).optional(),
  value: z.string().min(1).max(500).optional(),
  action: z.enum(["flag", "flag_savings"]).optional(),
  message: z.string().max(300).optional(),
  enabled: z.boolean().optional(),
  categoryId: z.number().int().positive().nullish(),
});

export const registerSchema = z.object({
  name: z.string().trim().max(120).nullish(),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export type ValidationErrors = { field: string; message: string }[];

export function formatZodError(err: z.ZodError): ValidationErrors {
  // zod 4: issues
  const issues = (err as unknown as { issues?: { path: (string|number)[]; message: string }[] }).issues ?? [];
  return issues.map((i) => ({ field: i.path.join("."), message: i.message }));
}

export function parseBody<T>(schema: z.ZodType<T>, data: unknown): { ok: true; value: T } | { ok: false; errors: ValidationErrors } {
  const res = schema.safeParse(data);
  if (res.success) return { ok: true, value: res.data };
  return { ok: false, errors: formatZodError(res.error) };
}
