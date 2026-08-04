import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type RuntimeEnv = {
  DB?: D1Database;
  BOT_API_TOKEN?: string;
  PAPER_AUTO_APPROVE?: string;
};

export function getRuntimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export function getD1(): D1Database {
  const database = getRuntimeEnv().DB;
  if (!database) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the logical D1 binding in .openai/hosting.json and apply the generated migrations.",
    );
  }
  return database;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
