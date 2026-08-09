import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { renderPost } from "./renderEngine.js";
import type { Template } from "../../types.js";

describe("renderPost", () => {
  it("composites background artwork + photo zone + text zones (with highlight) into a flattened export", async () => {
    const canvasWidth = 800;
    const canvasHeight = 800;
    const photoZoneRect = { x: 40, y: 40, width: 720, height: 400 };

    // Locked background artwork: a simple opaque red frame (no transparency needed —
    // zones composite strictly on top of it regardless).
    const background = await sharp({
      create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const photo = await sharp({
      create: { width: 1200, height: 900, channels: 3, background: { r: 20, g: 80, b: 160 } },
    })
      .jpeg()
      .toBuffer();

    const template: Template = {
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
          x: 60,
          y: 500,
          width: 680,
          height: 220,
          align: "left",
          weight: "extrabold",
          color: "#ffffff",
          highlightColor: "#39FF14",
        },
        {
          id: "cta",
          label: "CTA",
          type: "text",
          x: 60,
          y: 730,
          width: 300,
          height: 44,
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
});
