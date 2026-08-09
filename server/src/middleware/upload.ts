import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), "data", "storage");
export const TEMPLATES_DIR = path.join(STORAGE_ROOT, "templates");
export const EXPORTS_DIR = path.join(STORAGE_ROOT, "exports");
export const UPLOADS_DIR = path.join(STORAGE_ROOT, "uploads");

for (const dir of [TEMPLATES_DIR, EXPORTS_DIR, UPLOADS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(destDir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      cb(null, `${randomUUID()}${ext}`);
    },
  });
}

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) {
    return cb(new Error("Only PNG, JPG, or WEBP images are allowed"));
  }
  cb(null, true);
};

export const uploadTemplateImage = multer({
  storage: makeStorage(TEMPLATES_DIR),
  fileFilter: imageFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const uploadPhoto = multer({
  storage: makeStorage(UPLOADS_DIR),
  fileFilter: imageFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

/**
 * Accepts any number of file fields under arbitrary names — used for
 * per-zone photo uploads, where each photo zone's field name is that
 * zone's id (a template can define any number of photo zones).
 */
export const uploadAnyPhotos = multer({
  storage: makeStorage(UPLOADS_DIR),
  fileFilter: imageFileFilter,
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
}).any();
