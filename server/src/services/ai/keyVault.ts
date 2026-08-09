import { db } from "../../db/index.js";
import { decryptSecret } from "../crypto.js";
import type { Provider } from "./providers.js";

/** Decrypts and returns the stored API key for a provider, or null if none is configured. */
export function getProviderApiKey(provider: Provider): string | null {
  const row = db
    .prepare("SELECT ciphertext, iv, auth_tag FROM api_keys WHERE provider = ?")
    .get(provider) as { ciphertext: string; iv: string; auth_tag: string } | undefined;
  if (!row) return null;
  return decryptSecret({
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.auth_tag,
  });
}
