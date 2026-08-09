// Creates server/.env from .env.example with a freshly generated MASTER_KEY,
// unless .env already exists (never overwrites an existing configured env).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (fs.existsSync(envPath)) {
  console.log("server/.env already exists — leaving it untouched.");
  process.exit(0);
}

const key = crypto.randomBytes(32).toString("hex");
const content = fs
  .readFileSync(examplePath, "utf-8")
  .replace("replace_with_64_hex_chars_32_bytes", key);

fs.writeFileSync(envPath, content);
console.log("Created server/.env with a generated MASTER_KEY.");
