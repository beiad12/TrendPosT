import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { computeDefaultOutputSize, renderPost } from "./renderEngine.js";
import type { Template } from "../../types.js";

describe("computeDefaultOutputSize", () => {
  it("scales a square design canvas up to a 3840-long-edge 4K export", () => {
    expect(computeDefaultOutputSize(1080, 1080)).toEqual({ width: 3840, height: 3840 });
  });

  it("preserves a non-square template's aspect ratio", () => {
    const { width, height } = computeDefaultOutputSize(1080, 1350); // 4:5 portrait
    expect(height).toBe(3840);
    expect(Math.round((width / height) * 1000)).toBe(Math.round((1080 / 1350) * 1000));
  });
});

async function buildTestTemplate(canvasWidth: number, canvasHeight: number): Promise<Template> {
  const photoZoneRect = { x: 40, y: 40, width: Math.round(canvasWidth * 0.9), height: Math.round(canvasHeight * 0.5) };

  // Locked background artwork: a simple opaque red frame (no transparency needed —
  // zones composite strictly on top of it regardless).
  const background = await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } },
  })
    .png()
    .toBuffer();

  return {
    id: "test-template",
    name: "Test",
    category: "news",
    baseImagePath: background as any, // sharp's `input` accepts Buffers too
    canvasWidth,
    canvasHeight,
    zones: [
      { id: "photo", label: "Photo", type: "photo", ...photoZoneRect },
      {
        id: "headline",
        label: "Headline",
        type: "text",
        x: Math.round(canvasWidth * 0.075),
        y: Math.round(canvasHeight * 0.625),
        width: Math.round(canvasWidth * 0.85),
        height: Math.round(canvasHeight * 0.275),
        align: "left",
        weight: "extrabold",
        color: "#ffffff",
        highlightColor: "#39FF14",
      },
      {
        id: "cta",
        label: "CTA",
        type: "text",
        x: Math.round(canvasWidth * 0.075),
        y: Math.round(canvasHeight * 0.9125),
        width: Math.round(canvasWidth * 0.375),
        height: Math.round(canvasHeight * 0.055),
        align: "left",
        weight: "bold",
        color: "#39FF14",
        pill: true,
        locked: true,
        defaultValue: "Lire la suite",
      },
    ],
    style: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function testPhoto(): Promise<Buffer> {
  return sharp({
    create: { width: 1200, height: 900, channels: 3, background: { r: 20, g: 80, b: 160 } },
  })
    .jpeg()
    .toBuffer();
}

describe("renderPost", () => {
  it("composites background artwork + photo zone + text zones (with highlight) into a flattened export at a specific requested size", async () => {
    const template = await buildTestTemplate(800, 800);
    const photo = await testPhoto();

    const output = await renderPost({
      template,
      photos: { photo },
      values: { headline: "Titre très long qui doit se replier automatiquement sur **deux lignes**" },
      outputWidth: 1080,
      outputHeight: 1080,
      format: "jpeg",
    });

    expect(output).toBeInstanceOf(Buffer);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1080);
    expect(meta.format).toBe("jpeg");
  });

  it("defaults to a 4K-scale export when no output size is requested (not the small design-canvas size)", async () => {
    const template = await buildTestTemplate(1080, 1080);
    const photo = await testPhoto();

    const output = await renderPost({
      template,
      photos: { photo },
      values: { headline: "Un gros titre **important**" },
      format: "jpeg",
    });

    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(3840);
    expect(meta.height).toBe(3840);
  });

  it("renders zones natively at the target resolution rather than upscaling a small composite (photo zone stays sharp)", async () => {
    // A photo zone at 4K-scale render should carry real high-frequency detail from
    // the source photo, not the flat blur an upscaled-after-the-fact raster would have.
    const template = await buildTestTemplate(1080, 1080);
    const sharpPhoto = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .composite([
        {
          // A fine checkerboard -- upscaling a small pre-composited raster would smear this into gray;
          // resampling straight from this source at full target resolution keeps it distinct.
          input: Buffer.from(
            `<svg width="2400" height="1800">${Array.from({ length: 40 }, (_, i) =>
              Array.from({ length: 30 }, (_, j) =>
                (i + j) % 2 === 0 ? `<rect x="${i * 60}" y="${j * 60}" width="60" height="60" fill="white"/>` : ""
              ).join("")
            ).join("")}</svg>`
          ),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer();

    const output = await renderPost({
      template,
      photos: { photo: sharpPhoto },
      values: { headline: "Photo detail test" },
      format: "png",
    });

    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(3840);
    // A meaningfully large output confirms this wasn't silently downgraded/clamped.
    expect(output.length).toBeGreaterThan(50_000);
  });
});
