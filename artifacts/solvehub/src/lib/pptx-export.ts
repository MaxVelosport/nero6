import pptxgen from "pptxgenjs";

interface SlideContent {
  title: string;
  bullets: string[];
  body: string;
}

function parseAiSlides(text: string): SlideContent[] {
  // Parse AI output: === СЛАЙД N: TITLE ===\ncontent
  const slideBlockRe = /===\s*(?:СЛАЙД\s*\d+[.:]\s*|SLIDE\s*\d+[.:]\s*)(.+?)\s*===/gi;
  const results: SlideContent[] = [];

  const parts = text.split(slideBlockRe);
  // parts[0] = text before first slide (ignore)
  // then alternating: title, content, title, content...
  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim();
    const raw = (parts[i + 1] || "").trim();

    const bullets: string[] = [];
    const bodyLines: string[] = [];

    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith("- ") || t.startsWith("• ") || t.startsWith("* ")) {
        bullets.push(t.replace(/^[-•*]\s+/, ""));
      } else if (t.match(/^\d+\.\s/)) {
        bullets.push(t.replace(/^\d+\.\s+/, ""));
      } else {
        bodyLines.push(t);
      }
    }

    results.push({ title, bullets, body: bodyLines.join("\n") });
  }

  return results;
}

const DARK_BG   = "0D0717";
const PRIMARY   = "7C3AED";
const PRIMARY2  = "A78BFA";
const TEXT_MAIN = "E2E8F0";
const TEXT_DIM  = "94A3B8";
const ACCENT    = "6D28D9";

export async function exportToPptx(
  presentationTitle: string,
  subject: string,
  aiContent: string,
): Promise<void> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

  const slides = parseAiSlides(aiContent);

  // ── Title slide ───────────────────────────────────────────────────────────
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: DARK_BG };

  // Accent strip top
  titleSlide.addShape(pptxgen.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: 0.06,
    fill: { color: PRIMARY }, line: { color: PRIMARY },
  });

  // Glow circle decoration
  titleSlide.addShape(pptxgen.ShapeType.ellipse, {
    x: 10.5, y: -0.5, w: 3.5, h: 3.5,
    fill: { color: PRIMARY, transparency: 85 },
    line: { color: PRIMARY, transparency: 85 },
  });

  titleSlide.addText("НейроЗачёт", {
    x: 0.7, y: 1.3, w: 11.93, h: 0.5,
    fontSize: 12, color: PRIMARY2, bold: true, align: "left",
  });
  titleSlide.addText(presentationTitle, {
    x: 0.7, y: 2.0, w: 9.5, h: 2.0,
    fontSize: 38, bold: true, color: TEXT_MAIN, align: "left", wrap: true,
  });
  titleSlide.addText(subject, {
    x: 0.7, y: 4.2, w: 9.5, h: 0.6,
    fontSize: 18, color: PRIMARY2, align: "left",
  });

  // Bottom strip
  titleSlide.addShape(pptxgen.ShapeType.rect, {
    x: 0, y: 7.3, w: "100%", h: 0.2,
    fill: { color: PRIMARY, transparency: 60 },
    line: { color: PRIMARY, transparency: 60 },
  });

  // ── Content slides ────────────────────────────────────────────────────────
  const slideList = slides.length > 0 ? slides : [
    { title: presentationTitle, bullets: [], body: aiContent.slice(0, 800) },
  ];

  for (const slide of slideList) {
    const s = pptx.addSlide();
    s.background = { color: DARK_BG };

    // Top accent bar
    s.addShape(pptxgen.ShapeType.rect, {
      x: 0, y: 0, w: "100%", h: 0.06,
      fill: { color: PRIMARY }, line: { color: PRIMARY },
    });

    // Left accent bar
    s.addShape(pptxgen.ShapeType.rect, {
      x: 0, y: 0.06, w: 0.07, h: 7.44,
      fill: { color: ACCENT, transparency: 50 },
      line: { color: ACCENT, transparency: 50 },
    });

    // Slide title
    s.addText(slide.title, {
      x: 0.4, y: 0.25, w: 12.53, h: 0.85,
      fontSize: 26, bold: true, color: TEXT_MAIN, align: "left",
    });

    // Separator line
    s.addShape(pptxgen.ShapeType.rect, {
      x: 0.4, y: 1.15, w: 12.53, h: 0.035,
      fill: { color: PRIMARY, transparency: 40 },
      line: { color: PRIMARY, transparency: 40 },
    });

    let yPos = 1.35;

    if (slide.body) {
      s.addText(slide.body, {
        x: 0.4, y: yPos, w: 12.53, h: 1.4,
        fontSize: 15, color: TEXT_DIM, wrap: true, valign: "top",
      });
      yPos += 1.55;
    }

    if (slide.bullets.length > 0) {
      const bulletObjs = slide.bullets.map((b, idx) => ({
        text: `  ${b}`,
        options: {
          bullet: { code: 0x2022 },
          fontSize: 15,
          color: idx % 2 === 0 ? TEXT_MAIN : TEXT_DIM,
          breakLine: true,
        },
      }));

      s.addText(bulletObjs, {
        x: 0.4, y: yPos, w: 12.53, h: 7.5 - yPos - 0.3,
        valign: "top",
      });
    }

    // Footer: slide subject
    s.addText(subject, {
      x: 0.4, y: 7.2, w: 12.53, h: 0.3,
      fontSize: 9, color: PRIMARY2, align: "right",
    });
  }

  // ── Final "Questions?" slide ──────────────────────────────────────────────
  const endSlide = pptx.addSlide();
  endSlide.background = { color: DARK_BG };
  endSlide.addShape(pptxgen.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: 0.06,
    fill: { color: PRIMARY }, line: { color: PRIMARY },
  });
  endSlide.addShape(pptxgen.ShapeType.ellipse, {
    x: -0.5, y: 4.5, w: 4, h: 4,
    fill: { color: PRIMARY, transparency: 88 },
    line: { color: PRIMARY, transparency: 88 },
  });
  endSlide.addText("Спасибо за внимание!", {
    x: 1, y: 2.3, w: 11.33, h: 1.2,
    fontSize: 40, bold: true, color: TEXT_MAIN, align: "center",
  });
  endSlide.addText("Вопросы?", {
    x: 1, y: 3.7, w: 11.33, h: 0.8,
    fontSize: 24, color: PRIMARY2, align: "center",
  });
  endSlide.addText("Создано с помощью НейроЗачёт", {
    x: 1, y: 6.8, w: 11.33, h: 0.5,
    fontSize: 11, color: TEXT_DIM, align: "center",
  });

  await pptx.writeFile({ fileName: `${presentationTitle}.pptx` });
}
