import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { renderPost } from "./renderEngine.js";
import type { Template } from "../../types.js";

describe("renderPost", () => {
  it("composites photo + gradient + auto-fit headline + frame into a flattened export", async () => {
    // Frame: opaque red border with a transparent hole in the middle (the "slot").
    const canvasWidth = 800;
    const canvasHeight = 800;
    const slot = { x: 40, y: 40, width: 720, height: 720 };

    const frame = await sharp({
      create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: slot.width, height: slot.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
          })
            .png()
            .toBuffer(),
          left: slot.x,
          top: slot.y,
        },
      ])
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
      baseImagePath: undefined as any, // replaced below with the in-memory frame via Buffer path support
      canvasWidth,
      canvasHeight,
      imageSlot: slot,
      textZone: { x: 60, y: 500, width: 680, height: 220, align: "left" },
      style: { fontColor: "#ffffff", gradientDirection: "to-top", gradientOpacity: 0.7 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // renderEngine composites baseImagePath directly via sharp's `input`, which accepts Buffers too.
    (template as any).baseImagePath = frame;

    const output = await renderPost({
      template,
      photo,
      headline: "Titre très long qui doit se replier automatiquement sur deux lignes maximum",
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
