import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sqlitePath = process.env.SQLITE_PATH || "./data/trendpost.db";
const resolved = path.isAbsolute(sqlitePath)
  ? sqlitePath
  : path.join(process.cwd(), sqlitePath);

fs.mkdirSync(path.dirname(resolved), { recursive: true });

export const db = new Database(resolved);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const schemaPath = path.join(__dirname, "schema.sqlite.sql");
db.exec(fs.readFileSync(schemaPath, "utf-8"));
