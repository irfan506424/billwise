// Prepares the active Prisma schema for the build environment.
// - If DATABASE_URL points at Postgres (production on Vercel/Supabase),
//   copy the Postgres schema variant over schema.prisma so `prisma generate`
//   produces a Postgres-compatible client.
// - Otherwise (local dev / CI with SQLite) leave schema.prisma as-is.
import { copyFileSync, existsSync } from "node:fs";

const url = process.env.DATABASE_URL || "";

if (url.startsWith("postgresql")) {
  if (existsSync("prisma/schema.postgres.prisma")) {
    copyFileSync("prisma/schema.postgres.prisma", "prisma/schema.prisma");
    console.log("prepare-schema: DATABASE_URL is Postgres — using prisma/schema.postgres.prisma");
  } else {
    console.warn("prepare-schema: DATABASE_URL is Postgres but prisma/schema.postgres.prisma is missing");
  }
} else {
  console.log("prepare-schema: DATABASE_URL is not Postgres — keeping SQLite schema");
}
