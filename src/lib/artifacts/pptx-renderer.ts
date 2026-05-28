import PptxGenJS from "pptxgenjs";
import type { ArtifactContent } from "./artifact-schemas";

const NAVY = "0F172A";
const ACCENT = "22D3EE";
const LIGHT = "F8FAFC";
const INK = "0B1220";
const MUTED = "64748B";

export async function renderPptx(content: ArtifactContent, artifactType: string): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.title = content.title;

  // Title slide
  const title = pres.addSlide();
  title.background = { color: NAVY };
  title.addText(content.title, {
    x: 0.6,
    y: 1.6,
    w: 12,
    h: 1.5,
    fontSize: 40,
    bold: true,
    color: "FFFFFF",
    fontFace: "Segoe UI"
  });
  if (content.subtitle) {
    title.addText(content.subtitle, {
      x: 0.6,
      y: 3.1,
      w: 12,
      h: 1,
      fontSize: 20,
      color: ACCENT,
      fontFace: "Segoe UI"
    });
  }
  title.addText("Workshop Buddy", {
    x: 0.6,
    y: 6.6,
    w: 12,
    h: 0.4,
    fontSize: 12,
    color: "94A3B8",
    fontFace: "Segoe UI"
  });

  // Metrics slide
  if (content.metrics?.length) {
    const m = pres.addSlide();
    m.background = { color: LIGHT };
    m.addText("Headline Metrics", { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 28, bold: true, color: INK });
    const cardW = 11.5 / Math.min(content.metrics.length, 4);
    content.metrics.slice(0, 4).forEach((metric, i) => {
      const x = 0.6 + i * cardW;
      m.addShape("roundRect", { x, y: 1.5, w: cardW - 0.2, h: 3, fill: { color: "FFFFFF" }, line: { color: ACCENT, width: 1 }, rectRadius: 0.15 });
      m.addText(metric.value, { x: x + 0.1, y: 1.7, w: cardW - 0.4, h: 1.2, fontSize: 32, bold: true, color: ACCENT, align: "center" });
      m.addText(metric.label, { x: x + 0.1, y: 2.9, w: cardW - 0.4, h: 0.6, fontSize: 14, bold: true, color: INK, align: "center" });
      if (metric.subtext) m.addText(metric.subtext, { x: x + 0.1, y: 3.5, w: cardW - 0.4, h: 0.9, fontSize: 11, color: MUTED, align: "center" });
    });
  }

  // Section slides
  for (const s of content.sections) {
    const slide = pres.addSlide();
    slide.background = { color: LIGHT };
    slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.25, fill: { color: ACCENT } });
    slide.addText(s.heading, { x: 0.6, y: 0.4, w: 12, h: 0.7, fontSize: 26, bold: true, color: INK });

    const bullets = s.content
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 8);
    const isBulleted = bullets.length > 1 && bullets.every((b) => /^[-*]\s+/.test(b));
    if (isBulleted) {
      slide.addText(
        bullets.map((b) => ({ text: b.replace(/^[-*]\s+/, ""), options: { bullet: true } })),
        { x: 0.6, y: 1.3, w: 12, h: 5.5, fontSize: 16, color: INK, valign: "top" }
      );
    } else {
      slide.addText(s.content, { x: 0.6, y: 1.3, w: 12, h: 5.5, fontSize: 16, color: INK, valign: "top" });
    }
    slide.addText(`Workshop Buddy  •  ${artifactType}`, {
      x: 0.6,
      y: 7.0,
      w: 12,
      h: 0.3,
      fontSize: 10,
      color: MUTED
    });
  }

  // Next steps
  if (content.nextSteps?.length) {
    const slide = pres.addSlide();
    slide.background = { color: NAVY };
    slide.addText("Recommended Next Steps", { x: 0.6, y: 0.5, w: 12, h: 0.8, fontSize: 28, bold: true, color: "FFFFFF" });
    slide.addText(
      content.nextSteps.map((n) => ({ text: n, options: { bullet: true } })),
      { x: 0.6, y: 1.6, w: 12, h: 5, fontSize: 18, color: "FFFFFF", valign: "top" }
    );
  }

  // Assumptions (speaker-notes-like final slide)
  if (content.assumptions?.length) {
    const slide = pres.addSlide();
    slide.background = { color: LIGHT };
    slide.addText("Assumptions and Inputs Used", { x: 0.6, y: 0.5, w: 12, h: 0.8, fontSize: 24, bold: true, color: INK });
    slide.addText(
      content.assumptions.map((a) => ({ text: a, options: { bullet: true } })),
      { x: 0.6, y: 1.5, w: 12, h: 5, fontSize: 14, color: INK, valign: "top" }
    );
  }

  const data = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  return data;
}
