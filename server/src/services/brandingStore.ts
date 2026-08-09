import { db } from "../db/index.js";

export type BrandingPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left";

export interface Branding {
  logoPath: string | null;
  position: BrandingPosition;
  updatedAt: string | null;
}

const EMPTY: Branding = { logoPath: null, position: "bottom-right", updatedAt: null };

/** Global, single-row branding settings (logo stamped onto every rendered post). */
export function getBranding(): Branding {
  const row = db.prepare("SELECT logo_path, position, updated_at FROM branding WHERE id = 1").get() as
    | { logo_path: string | null; position: BrandingPosition; updated_at: string }
    | undefined;
  if (!row) return EMPTY;
  return { logoPath: row.logo_path, position: row.position, updatedAt: row.updated_at };
}

export function setBrandingLogo(logoPath: string, position: BrandingPosition = "bottom-right"): Branding {
  db.prepare(
    `INSERT INTO branding (id, logo_path, position, updated_at) VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT (id) DO UPDATE SET logo_path = excluded.logo_path, position = excluded.position, updated_at = excluded.updated_at`
  ).run(logoPath, position);
  return getBranding();
}

export function setBrandingPosition(position: BrandingPosition): Branding {
  const current = getBranding();
  db.prepare(
    `INSERT INTO branding (id, logo_path, position, updated_at) VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT (id) DO UPDATE SET position = excluded.position, updated_at = excluded.updated_at`
  ).run(current.logoPath, position);
  return getBranding();
}

export function clearBrandingLogo(): Branding {
  db.prepare(
    `INSERT INTO branding (id, logo_path, position, updated_at) VALUES (1, NULL, 'bottom-right', datetime('now'))
     ON CONFLICT (id) DO UPDATE SET logo_path = NULL, updated_at = excluded.updated_at`
  ).run();
  return getBranding();
}

/** Convenience for the render pipeline: undefined when no logo is configured, so callers can spread it in unconditionally. */
export function getWatermarkOption(): { logoPath: string; position: BrandingPosition } | undefined {
  const branding = getBranding();
  if (!branding.logoPath) return undefined;
  return { logoPath: branding.logoPath, position: branding.position };
}
