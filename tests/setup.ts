import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

// Isolated test database (SQLite). Re-created from migrations on every run
// so tests start from a clean slate.
const dbPath = resolve(process.cwd(), "tests/test.db");
const dbUrl = `file:${dbPath}`;

process.env.DATABASE_URL = dbUrl;
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret";

// Wipe + sync the schema to the test DB. Tests don't need migration history,
// so `db push` is simpler and less failure-prone than `migrate deploy`.
rmSync(dbPath, { force: true });
rmSync(`${dbPath}-journal`, { force: true });
execSync("npx prisma db push --skip-generate", {
  stdio: "ignore",
  env: { ...process.env, DATABASE_URL: dbUrl },
});
