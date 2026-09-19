import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

let client: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return null;
    }
    try {
      client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
      dbInstance = drizzle(client, { schema });
    } catch (err) {
      console.error("Failed to initialize PostgreSQL connection:", err);
      return null;
    }
  }
  return dbInstance;
}

export function getRawSql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  }
  return client;
}

export { schema };
