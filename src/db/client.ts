import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { schema } from "./schema";

export type AppDatabase = BunSQLiteDatabase<typeof schema> & {
  $client: Database;
};

export function createDatabase(filename = process.env.DB_FILE_NAME ?? "healthcare.sqlite"): AppDatabase {
  const sqlite = new Database(filename, {
    create: true,
    readwrite: true,
  });

  sqlite.exec("PRAGMA foreign_keys = ON");

  return drizzle(sqlite, {
    schema,
  });
}
