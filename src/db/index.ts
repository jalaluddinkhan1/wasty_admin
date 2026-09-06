import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import initSqlJs, { type Database as SqlJsDatabaseInstance, type SqlJsStatic } from "sql.js";

import * as schema from "./schema";
import { seedIfEmpty } from "./seed";
import fs from "node:fs";
import path from "node:path";

type AppDb = SQLJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  wastySqlJs?: SqlJsStatic;
  wastySqlite?: SqlJsDatabaseInstance;
  wastyDb?: AppDb;
  wastyDbReady?: Promise<AppDb>;
};

function resolveDbPath() {
  const configured = process.env.WASTY_SQLITE_PATH;
  if (configured) return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  return path.join(process.cwd(), "data", "wasty-admin.sqlite");
}

function wasmPath(file: string) {
  return path.join(process.cwd(), "node_modules", "sql.js", "dist", file);
}

export function persistDb() {
  const sqlite = globalForDb.wastySqlite;
  if (!sqlite) return;
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const data = sqlite.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

async function createDb(): Promise<AppDb> {
  const SQL =
    globalForDb.wastySqlJs ??
    (await initSqlJs({
      locateFile: wasmPath,
    }));
  globalForDb.wastySqlJs = SQL;

  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite =
    fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0
      ? new SQL.Database(fs.readFileSync(dbPath))
      : new SQL.Database();

  globalForDb.wastySqlite = sqlite;
  bootstrapSchema(sqlite);

  const db = drizzle(sqlite, { schema });
  globalForDb.wastyDb = db;
  seedIfEmpty(db);
  persistDb();
  return db;
}

export async function getDb(): Promise<AppDb> {
  if (globalForDb.wastyDb) return globalForDb.wastyDb;
  if (!globalForDb.wastyDbReady) {
    globalForDb.wastyDbReady = createDb().catch((error) => {
      globalForDb.wastyDbReady = undefined;
      throw error;
    });
  }
  return globalForDb.wastyDbReady;
}

function bootstrapSchema(sqlite: SqlJsDatabaseInstance) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS pickups (
      id TEXT PRIMARY KEY NOT NULL,
      user_name TEXT NOT NULL,
      slot TEXT NOT NULL,
      partner TEXT NOT NULL DEFAULT '—',
      waste TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      zone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      kyc TEXT NOT NULL DEFAULT 'pending',
      rating TEXT NOT NULL DEFAULT '—',
      phone TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bags (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL UNIQUE,
      batch TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '—',
      category TEXT NOT NULL DEFAULT '—',
      status TEXT NOT NULL DEFAULT 'unassigned',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      from_label TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      note TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feature_flags (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

export type WastyDb = AppDb;
