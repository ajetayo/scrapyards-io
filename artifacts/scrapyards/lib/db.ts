import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@workspace/db/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const globalPool = global as typeof global & { _scrapPool?: pg.Pool };
if (!globalPool._scrapPool) {
  globalPool._scrapPool = new Pool({ connectionString: process.env.DATABASE_URL });
}

export const db = drizzle(globalPool._scrapPool, { schema });
