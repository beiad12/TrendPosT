import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sqlitePath = process.env.SQLITE_PATH || "./data/trendpost.db";
// SQLite's special in-memory identifiers (":memory:", "") must be passed
// through untouched -- path.join()-ing them against cwd would otherwise
// create a literal file named e.g. ":memory:" on disk, silently defeating
// the whole point of an ephemeral test/in-memory database.
const isSpecialPath = sqlitePath === ":memory:" || sqlitePath === "";
const resolved = isSpecialPath
  ? sqlitePath
  : path.isAbsolute(sqlitePath)
  ? sqlitePath
  : path.join(process.cwd(), sqlitePath);

if (!isSpecialPath) fs.mkdirSync(path.dirname(resolved), { recursive: true });

// Uses Node's built-in sqlite module (no native/compiled dependency — works
// out of the box on every OS, no Visual Studio / build-essential required).
export const db = new DatabaseSync(resolved);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const schemaPath = path.join(__dirname, "schema.sqlite.sql");
db.exec(fs.readFileSync(schemaPath, "utf-8"));
