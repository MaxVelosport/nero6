import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun,
  Footer, PageNumber, ShadingType, PageBreak,
} from "docx";
import { saveAs } from "file-saver";

// ── Mermaid: initialise once ───────────────────────────────────────────────
let _mermaidInited = false;
let _mermaidCounter = 0;

async function getMermaid() {
  const m = (await import("mermaid")).default;
  if (!_mermaidInited) {
    m.initialize({
      startOnLoad: false,
      theme: "default",
      fontFamily: "Times New Roman, serif",
      fontSize: 14,
    });
    _mermaidInited = true;
  }
  return m;
}

// ── LaTeX → readable unicode text ─────────────────────────────────────────
function latexToReadable(tex: string): string {
  let t = tex.trim();
  t = t.replace(/\\text\{([^}]*)\}/g, "$1");
  t = t.replace(/\\mathbf\{([^}]*)\}/g, "$1");
  t = t.replace(/\\mathrm\{([^}]*)\}/g, "$1");
  t = t.replace(/\\mathit\{([^}]*)\}/g, "$1");
  t = t.replace(/\\boldsymbol\{([^}]*)\}/g, "$1");
  t = t.replace(/\\hat\{([^}]*)\}/g, "$1̂");
  t = t.replace(/\\bar\{([^}]*)\}/g, "$1̄");
  t = t.replace(/\\tilde\{([^}]*)\}/g, "$1̃");
  t = t.replace(/\\overline\{([^}]*)\}/g, "$1̄");
  t = t.replace(/\\vec\{([^}]*)\}/g, "$1⃗");

  const greek: Record<string, string> = {
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
    zeta: "ζ", eta: "η", theta: "θ", vartheta: "θ", iota: "ι", kappa: "κ",
    lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", varpi: "π", rho: "ρ",
    sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ",
    chi: "χ", psi: "ψ", omega: "ω",
    Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", Epsilon: "Ε", Theta: "Θ",
    Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  };
  for (const [k, v] of Object.entries(greek)) {
    t = t.replace(new RegExp(`\\\\${k}(?![a-zA-Z])`, "g"), v);
  }

  const ops: Record<string, string> = {
    cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓",
    leq: "≤", geq: "≥", neq: "≠", ne: "≠", approx: "≈", sim: "∼", simeq: "≃",
    infty: "∞", sum: "Σ", prod: "Π", int: "∫", oint: "∮",
    partial: "∂", nabla: "∇",
    rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⟺",
    to: "→", gets: "←",
    "in": "∈", notin: "∉", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇",
    cup: "∪", cap: "∩", setminus: "∖", emptyset: "∅",
    forall: "∀", exists: "∃", nexists: "∄", neg: "¬",
    land: "∧", lor: "∨",
    dots: "…", ldots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱",
    sqrt: "√", circ: "∘", bullet: "•",
  };
  for (const [k, v] of Object.entries(ops)) {
    t = t.replace(new RegExp(`\\\\${k}(?![a-zA-Z])`, "g"), v);
  }

  // fractions — handle nested by applying twice
  t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");
  t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)");
  t = t.replace(/\\sqrt\{([^{}]*)\}/g, "√($1)");
  t = t.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, "ⁿ√($2)");

  const sup: Record<string, string> = { "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","+":"⁺","-":"⁻","=":"⁼","(":"⁽",")":"⁾","n":"ⁿ","i":"ⁱ" };
  const sub: Record<string, string> = { "0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉","+":"₊","-":"₋","=":"₌","(":"₍",")":"₎" };
  t = t.replace(/\^\{([^{}]+)\}/g, (_, s) => s.split("").map((c: string) => sup[c] ?? c).join(""));
  t = t.replace(/\^([0-9a-zA-Z+\-])/g, (_, c) => sup[c] ?? `^${c}`);
  t = t.replace(/\_\{([^{}]+)\}/g, (_, s) => s.split("").map((c: string) => sub[c] ?? c).join(""));
  t = t.replace(/\_([0-9a-zA-Z+\-])/g, (_, c) => sub[c] ?? `_${c}`);

  t = t.replace(/\\left\s*[\(\[\{]/g, "(").replace(/\\right\s*[\)\]\}]/g, ")");
  t = t.replace(/\\left\./g, "").replace(/\\right\./g, "");
  // strip remaining braces pairs (up to 3 levels)
  t = t.replace(/\{([^{}]*)\}/g, "$1");
  t = t.replace(/\{([^{}]*)\}/g, "$1");
  t = t.replace(/\{([^{}]*)\}/g, "$1");
  // strip remaining backslash commands
  t = t.replace(/\\[a-zA-Z]+\*? */g, "");
  t = t.replace(/[{}\\]/g, "");
  t = t.replace(/\s{2,}/g, " ");
  return t.trim();
}

function stripLatex(text: string): string {
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => latexToReadable(f));
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, f) => latexToReadable(f));
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, f) => latexToReadable(f));
  text = text.replace(/\$([^$\n]+?)\$/g, (_, f) => latexToReadable(f));
  return text;
}

function stripInlineMarkdown(text: string): string {
  text = stripLatex(text);
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  return text;
}

function parseBoldRuns(line: string, opts?: { size?: number; color?: string; font?: string }): TextRun[] {
  line = stripLatex(line);
  const size = opts?.size ?? 24;
  const color = opts?.color;
  const font = opts?.font;
  const runs: TextRun[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: line.slice(last, m.index), size, ...(color ? { color } : {}), ...(font ? { font } : {}) }));
    runs.push(new TextRun({ text: m[1], bold: true, size, ...(color ? { color } : {}), ...(font ? { font } : {}) }));
    last = m.index + m[0].length;
  }
  if (last < line.length) runs.push(new TextRun({ text: line.slice(last), size, ...(color ? { color } : {}), ...(font ? { font } : {}) }));
  return runs.length > 0 ? runs : [new TextRun({ text: line, size, ...(color ? { color } : {}), ...(font ? { font } : {}) })];
}

// ── Markdown table → docx Table ───────────────────────────────────────────
function parseMarkdownTable(tableLines: string[], opts?: { size?: number; font?: string }): Table | null {
  const dataLines = tableLines.filter(l => !/^\|[\s|:-]+\|$/.test(l.trim()));
  if (dataLines.length === 0) return null;
  const size = opts?.size ?? 24;
  const font = opts?.font;

  const rows = dataLines.map((line, rowIndex) => {
    const cells = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
    const isHeader = rowIndex === 0;
    return new TableRow({
      tableHeader: isHeader,
      children: cells.map(cellText => new TableCell({
        children: [new Paragraph({
          children: isHeader
            ? [new TextRun({ text: stripInlineMarkdown(cellText), bold: true, size, ...(font ? { font } : {}) })]
            : parseBoldRuns(cellText, { size, font }),
          spacing: { after: 60 },
        })],
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        shading: isHeader ? { type: ShadingType.SOLID, fill: "EEEEEE" } : undefined,
      })),
    });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:              { style: BorderStyle.SINGLE, size: 8, color: "555555" },
      bottom:           { style: BorderStyle.SINGLE, size: 8, color: "555555" },
      left:             { style: BorderStyle.SINGLE, size: 8, color: "555555" },
      right:            { style: BorderStyle.SINGLE, size: 8, color: "555555" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
    },
  });
}

// ── Mermaid code → PNG ArrayBuffer (runs in browser) ─────────────────────
async function renderMermaidToPng(code: string): Promise<{ data: ArrayBuffer; docxW: number; docxH: number } | null> {
  try {
    const mermaid = await getMermaid();
    const id = `mermaid-word-${++_mermaidCounter}`;
    const { svg } = await mermaid.render(id, code.trim());

    // Parse SVG dimensions robustly
    let svgW = 0, svgH = 0;

    // 1. Direct numeric attributes: width="348" height="154"
    const wDirect = svg.match(/\bwidth="([\d.]+)"/);
    const hDirect = svg.match(/\bheight="([\d.]+)"/);
    if (wDirect) svgW = parseFloat(wDirect[1]);
    if (hDirect) svgH = parseFloat(hDirect[1]);

    // 2. max-width in style: style="max-width: 348px;"
    if (!svgW) {
      const wStyle = svg.match(/max-width:\s*([\d.]+)px/);
      if (wStyle) svgW = parseFloat(wStyle[1]);
    }

    // 3. viewBox fallback: viewBox="minX minY width height"
    if (!svgW || !svgH) {
      const vb = svg.match(/viewBox="([^"]+)"/);
      if (vb) {
        const parts = vb[1].trim().split(/[\s,]+/).map(Number);
        if (parts.length >= 4) {
          if (!svgW) svgW = parts[2];
          if (!svgH) svgH = parts[3];
        }
      }
    }

    // Ensure minimum reasonable dimensions
    if (!svgW || svgW < 10) svgW = 800;
    if (!svgH || svgH < 10) svgH = 400;

    // Calculate docx dimensions: max width = 530pt, proportional height
    const maxDocxW = 530;
    const aspect = svgH / svgW;
    const docxW = Math.min(maxDocxW, svgW);
    const docxH = Math.min(400, Math.round(docxW * aspect));

    return new Promise<{ data: ArrayBuffer; docxW: number; docxH: number } | null>((resolve) => {
      const img = new Image();
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const scale = Math.min(2, 1600 / svgW);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(svgW * scale);
        canvas.height = Math.round(svgH * scale);
        if (canvas.width === 0 || canvas.height === 0) { URL.revokeObjectURL(url); resolve(null); return; }
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, svgW, svgH);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          if (!blob) { resolve(null); return; }
          blob.arrayBuffer().then(ab => resolve({ data: ab, docxW, docxH })).catch(() => resolve(null));
        }, "image/png");
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch {
    return null;
  }
}

type DocxBlock = Paragraph | Table;

// ── Markdown → docx blocks (async — handles mermaid images) ──────────────
async function parseMarkdownToBlocksAsync(text: string, opts?: {
  size?: number;
  gost?: boolean;
  font?: string;
}): Promise<DocxBlock[]> {
  const size = opts?.size ?? 24;
  const gost = opts?.gost ?? false;
  const font = opts?.font ?? (gost ? "Times New Roman" : undefined);
  const alignment = gost ? AlignmentType.BOTH : AlignmentType.LEFT;
  const indent = gost ? { firstLine: 709 } : undefined;

  // ── Pre-process BEFORE line splitting: multi-line block math ───────────
  let processedText = text;

  // \[ ... \] block formulas → convert to visible formula lines (centred)
  processedText = processedText.replace(/\\\[([\s\S]+?)\\\]/g, (_, f) =>
    "\n%%FORMULA%%" + latexToReadable(f.trim()) + "%%FORMULA%%\n"
  );
  // $$ ... $$ block formulas
  processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (_, f) =>
    "\n%%FORMULA%%" + latexToReadable(f.trim()) + "%%FORMULA%%\n"
  );
  // \( ... \) inline formulas
  processedText = processedText.replace(/\\\(([\s\S]+?)\\\)/g, (_, f) => latexToReadable(f.trim()));
  // Strip markdown images → figure caption note
  processedText = processedText.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) =>
    alt ? `*[Рисунок: ${alt}]*` : ""
  );
  // ──────────────────────────────────────────────────────────────────────────

  const lines = processedText.split("\n");
  const blocks: DocxBlock[] = [];
  let orderedCounter = 0;

  type State = "normal" | "code" | "table";
  let state: State = "normal";
  let codeLines: string[] = [];
  let codeLang = "";
  let tableLines: string[] = [];

  async function flushCode() {
    if (codeLines.length === 0) return;

    if (codeLang === "mermaid") {
      const code = codeLines.join("\n");
      let rendered = false;
      try {
        const result = await renderMermaidToPng(code);
        if (result) {
          blocks.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 160, after: 80 },
            children: [
              new ImageRun({
                data: result.data,
                transformation: { width: result.docxW, height: result.docxH },
                type: "png",
              } as any),
            ],
          }));
          rendered = true;
        }
      } catch { /* fall through to placeholder */ }

      if (!rendered) {
        blocks.push(new Paragraph({
          children: [new TextRun({ text: "[Диаграмма — откройте документ для просмотра]", italics: true, color: "666666", size, ...(font ? { font } : {}) })],
          spacing: { before: 80, after: 80 },
          alignment: AlignmentType.CENTER,
        }));
      }
    } else if (codeLang === "chart") {
      blocks.push(new Paragraph({
        children: [new TextRun({ text: "[График данных]", italics: true, color: "555555", size, ...(font ? { font } : {}) })],
        spacing: { before: 80, after: 80 },
        alignment: AlignmentType.CENTER,
      }));
    } else {
      blocks.push(new Paragraph({
        children: [new TextRun({ text: "Листинг:", bold: true, size: Math.max(18, size - 4), color: "444444", ...(font ? { font } : {}) })],
        spacing: { before: 160, after: 40 },
      }));
      for (const codeLine of codeLines) {
        blocks.push(new Paragraph({
          children: [new TextRun({ text: codeLine || " ", font: "Courier New", size: Math.max(18, size - 4), color: "1a1a2e" })],
          spacing: { after: 0 },
          indent: { left: 360 },
          shading: { type: ShadingType.SOLID, fill: "F4F4F8" },
        }));
      }
      blocks.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }
    codeLines = [];
    codeLang = "";
  }

  function flushTable() {
    if (tableLines.length === 0) return;
    const table = parseMarkdownTable(tableLines, { size, font });
    if (table) {
      blocks.push(new Paragraph({ text: "", spacing: { after: 60 } }));
      blocks.push(table);
      blocks.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }
    tableLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine;

    // ── Fenced code block ────────────────────────────────────────────────
    if (line.match(/^```/)) {
      if (state === "code") {
        await flushCode();
        state = "normal";
      } else {
        if (state === "table") { flushTable(); state = "normal"; orderedCounter = 0; }
        state = "code";
        codeLang = line.replace(/^```/, "").trim().toLowerCase();
      }
      continue;
    }

    if (state === "code") {
      codeLines.push(line);
      continue;
    }

    // ── Table line ───────────────────────────────────────────────────────
    const isTableLine = line.trim().startsWith("|") && line.trim().endsWith("|");
    if (isTableLine) {
      if (state !== "table") { state = "table"; tableLines = []; }
      tableLines.push(line);
      orderedCounter = 0;
      continue;
    } else if (state === "table") {
      flushTable();
      state = "normal";
    }

    // ── Block formula marker ─────────────────────────────────────────────
    if (line.trim().startsWith("%%FORMULA%%") && line.trim().endsWith("%%FORMULA%%")) {
      const formula = line.trim().slice(11, -11).trim();
      if (formula) {
        blocks.push(new Paragraph({
          children: [new TextRun({ text: formula, size, italics: true, ...(font ? { font } : {}) })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 80 },
          indent: undefined,
        }));
      }
      continue;
    }

    // ── Empty line ───────────────────────────────────────────────────────
    if (line.trim() === "") {
      blocks.push(new Paragraph({ text: "", spacing: { after: 60 } }));
      orderedCounter = 0;
      continue;
    }

    // ── Headings ─────────────────────────────────────────────────────────
    if (line.startsWith("### ")) {
      orderedCounter = 0;
      blocks.push(new Paragraph({
        text: stripInlineMarkdown(line.slice(4)),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 80 },
      }));
    } else if (line.startsWith("## ")) {
      orderedCounter = 0;
      blocks.push(new Paragraph({
        text: stripInlineMarkdown(line.slice(3)),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 100 },
      }));
    } else if (line.startsWith("# ")) {
      orderedCounter = 0;
      blocks.push(new Paragraph({
        text: stripInlineMarkdown(line.slice(2)),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 160 },
      }));

    // ── Bullet list ──────────────────────────────────────────────────────
    } else if (line.match(/^[-*] /)) {
      orderedCounter = 0;
      blocks.push(new Paragraph({
        children: [new TextRun({ text: "• ", size, ...(font ? { font } : {}) }), ...parseBoldRuns(line.slice(2), { size, font })],
        indent: { left: 360 },
        spacing: { after: 60 },
        alignment,
      }));

    // ── Ordered list ─────────────────────────────────────────────────────
    } else if (line.match(/^\d+\. /)) {
      orderedCounter++;
      const rest = line.replace(/^\d+\. /, "");
      blocks.push(new Paragraph({
        children: [new TextRun({ text: `${orderedCounter}. `, size, ...(font ? { font } : {}) }), ...parseBoldRuns(rest, { size, font })],
        indent: { left: 360 },
        spacing: { after: 60 },
        alignment,
      }));

    // ── Horizontal rule ──────────────────────────────────────────────────
    } else if (line.match(/^---+$/) || line.match(/^===+$/)) {
      blocks.push(new Paragraph({ text: "─────────────────────────────────", spacing: { after: 100 } }));

    // ── Figure caption: *[Рисунок: description]* ─────────────────────────
    } else if (line.trim().match(/^\*\[Рисунок:.+\]\*$/)) {
      const caption = line.trim().slice(2, -2); // strip leading/trailing *
      blocks.push(new Paragraph({
        children: [new TextRun({ text: caption, italics: true, size, color: "555555", ...(font ? { font } : {}) })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 100 },
      }));

    // ── Italic figure/table caption line ─────────────────────────────────
    } else if (line.trim().match(/^\*Рисунок\s+\d+/i) || line.trim().match(/^\*Таблица\s+\d+/i)) {
      const caption = stripInlineMarkdown(line.trim());
      blocks.push(new Paragraph({
        children: [new TextRun({ text: caption, italics: true, size, color: "444444", ...(font ? { font } : {}) })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 100 },
      }));

    // ── Regular paragraph ────────────────────────────────────────────────
    } else {
      orderedCounter = 0;
      blocks.push(new Paragraph({
        children: parseBoldRuns(line, { size, font }),
        spacing: { after: 80 },
        alignment,
        indent,
      }));
    }
  }

  // Flush any unclosed blocks at end of text
  if (state === "code") await flushCode();
  if (state === "table") flushTable();

  return blocks;
}

// ── ГОСТ styles for document ──────────────────────────────────────────────
function makeGostStyles(fontSize: number) {
  const sz = fontSize;
  return {
    paragraphStyles: [
      {
        id: "Normal",
        name: "Normal",
        run: { font: "Times New Roman", size: sz, color: "000000" },
        paragraph: {
          spacing: { line: 360, lineRule: "auto" as const },
          alignment: AlignmentType.BOTH,
        },
      },
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Times New Roman", size: sz, bold: true, color: "000000" },
        paragraph: {
          spacing: { before: 360, after: 180, line: 360, lineRule: "auto" as const },
          alignment: AlignmentType.CENTER,
        },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Times New Roman", size: sz, bold: true, color: "000000" },
        paragraph: {
          spacing: { before: 280, after: 140, line: 360, lineRule: "auto" as const },
          alignment: AlignmentType.LEFT,
        },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: "Times New Roman", size: sz, bold: true, color: "000000" },
        paragraph: {
          spacing: { before: 200, after: 80, line: 360, lineRule: "auto" as const },
          alignment: AlignmentType.LEFT,
        },
      },
    ],
    characterStyles: [
      {
        id: "Hyperlink",
        name: "Hyperlink",
        run: { color: "000000", underline: undefined },
      },
    ],
  };
}

// ── ГОСТ section properties ───────────────────────────────────────────────
const GOST_PAGE = {
  page: {
    margin: {
      left:   1701, // 30 mm
      right:  851,  // 15 mm
      top:    1134, // 20 mm
      bottom: 1134, // 20 mm
      header: 709,
      footer: 709,
    },
  },
};

function makeGostFooter(fontSize: number) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: "Times New Roman",
            size: fontSize,
          }),
        ],
      }),
    ],
  });
}

// ── Standard (non-GOST) styles ────────────────────────────────────────────
function makeStandardStyles(fontSize: number) {
  const sz = fontSize;
  return {
    paragraphStyles: [
      {
        id: "Normal",
        name: "Normal",
        run: { size: sz, color: "000000" },
        paragraph: { spacing: { line: 276, lineRule: "auto" as const } },
      },
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { bold: true, color: "000000", size: sz + 4 },
        paragraph: { spacing: { before: 360, after: 160 } },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { bold: true, color: "000000", size: sz + 2 },
        paragraph: { spacing: { before: 280, after: 100 } },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { bold: true, color: "000000", size: sz },
        paragraph: { spacing: { before: 200, after: 80 } },
      },
    ],
    characterStyles: [
      {
        id: "Hyperlink",
        name: "Hyperlink",
        run: { color: "000000", underline: undefined },
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Export: Курсовая работа
// ═══════════════════════════════════════════════════════════════════════════
export async function exportCourseworkToDocx(params: {
  topic: string;
  subject: string;
  workType: string;
  requirements?: string;
  chapters: Array<{ id: number; title: string; estimatedPages: number }>;
  chapterContents: Record<number, string>;
  gost?: boolean;
}) {
  const { topic, subject, workType, requirements, chapters, chapterContents, gost = false } = params;

  const WORK_TYPE_LABELS: Record<string, string> = {
    essay: "Реферат", report: "Отчёт по практике", coursework: "Курсовая работа",
    diploma: "Дипломная работа (ВКР)", master: "Магистерская диссертация", phd_thesis: "Кандидатская диссертация",
  };

  const fontSize = 28; // 14pt = 28 half-points
  const font = gost ? "Times New Roman" : undefined;
  const alignment = gost ? AlignmentType.BOTH : AlignmentType.LEFT;
  const styles = gost ? makeGostStyles(fontSize) : makeStandardStyles(fontSize);
  const footer = gost ? makeGostFooter(fontSize) : undefined;

  // ── Title page ──────────────────────────────────────────────────────────
  const titleBlock: DocxBlock[] = [
    new Paragraph({
      children: [new TextRun({ text: WORK_TYPE_LABELS[workType] || workType, font: font ?? "Times New Roman", size: fontSize, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: topic, font: font ?? "Times New Roman", size: fontSize, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Дисциплина: ", bold: true, font: font ?? "Times New Roman", size: fontSize }),
        new TextRun({ text: subject, font: font ?? "Times New Roman", size: fontSize }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Дата: ", bold: true, font: font ?? "Times New Roman", size: fontSize }),
        new TextRun({ text: new Date().toLocaleDateString("ru-RU"), font: font ?? "Times New Roman", size: fontSize }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: requirements?.trim() ? 80 : 480 },
    }),
  ];

  if (requirements?.trim()) {
    titleBlock.push(new Paragraph({
      children: [
        new TextRun({ text: "Требования: ", bold: true, font: font ?? "Times New Roman", size: fontSize }),
        new TextRun({ text: requirements.trim(), italics: true, font: font ?? "Times New Roman", size: fontSize }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    }));
  }

  // ── Table of contents (text stub) ───────────────────────────────────────
  const tocBlocks: DocxBlock[] = [];
  if (chapters.length > 0) {
    tocBlocks.push(new Paragraph({
      children: [new PageBreak()],
    }));
    tocBlocks.push(new Paragraph({
      text: "СОДЕРЖАНИЕ",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
    }));
    for (const ch of chapters) {
      tocBlocks.push(new Paragraph({
        children: [
          new TextRun({ text: ch.title, size: fontSize, ...(font ? { font } : {}) }),
          new TextRun({ text: "  ....  ", size: fontSize, color: "888888", ...(font ? { font } : {}) }),
          new TextRun({ text: String(ch.estimatedPages), size: fontSize, ...(font ? { font } : {}) }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 80 },
        indent: gost ? { left: 0 } : undefined,
      }));
    }
  }

  // ── Chapter content ─────────────────────────────────────────────────────
  const contentBlocks: DocxBlock[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const content = chapterContents[chapter.id];
    if (!content) continue;

    // Page break before each chapter (except first)
    if (i > 0) {
      contentBlocks.push(new Paragraph({
        children: [new PageBreak()],
      }));
    }

    const parsed = await parseMarkdownToBlocksAsync(content, { size: fontSize, gost, font });
    contentBlocks.push(...parsed);
  }

  const sectionProps = gost ? GOST_PAGE : {};
  const doc = new Document({
    styles,
    sections: [{
      properties: sectionProps as any,
      footers: footer ? { default: footer } : undefined,
      children: [...titleBlock, ...tocBlocks, ...contentBlocks],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = topic.replace(/[<>:"/\\|?*]/g, "").slice(0, 60);
  const prefix = WORK_TYPE_LABELS[workType] || "Работа";
  saveAs(blob, `${prefix} — ${safe}${gost ? " (ГОСТ)" : ""}.docx`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Export: Сессия (диалог с ИИ)
// ═══════════════════════════════════════════════════════════════════════════
export async function exportSessionToDocx(params: {
  title: string;
  subject: string;
  model: string;
  createdAt: string;
  messages: { role: string; content: string; created_at?: string }[];
}) {
  const { title, subject, model, createdAt, messages } = params;
  const fontSize = 24;
  const styles = makeStandardStyles(fontSize);

  const children: DocxBlock[] = [
    new Paragraph({
      text: title, heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER, spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Предмет: ", bold: true, size: fontSize }), new TextRun({ text: subject, size: fontSize })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Модель: ", bold: true, size: fontSize }), new TextRun({ text: model, size: fontSize })],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Дата: ", bold: true, size: fontSize }), new TextRun({ text: new Date(createdAt).toLocaleString("ru-RU"), size: fontSize })],
      spacing: { after: 400 },
    }),
    new Paragraph({ text: "Диалог", heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 300 } }),
  ];

  for (const msg of messages) {
    const isUser = msg.role === "user";
    children.push(new Paragraph({
      children: [new TextRun({ text: isUser ? "Вы:" : "НейроЗачёт:", bold: true, color: "000000", size: fontSize })],
      spacing: { before: 200, after: 100 },
    }));
    const parsed = await parseMarkdownToBlocksAsync(msg.content, { size: fontSize });
    children.push(...parsed);
  }

  const doc = new Document({
    styles,
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = title.replace(/[<>:"/\\|?*]/g, "").slice(0, 50);
  saveAs(blob, `НейроЗачёт — ${safe}.docx`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Export: Задание
// ═══════════════════════════════════════════════════════════════════════════
export async function exportTaskToDocx(params: {
  title: string;
  subject: string;
  taskType: string;
  description?: string | null;
  result?: string | null;
  createdAt: string;
  completedAt?: string | null;
  solvingMode: string;
}) {
  const { title, subject, taskType, description, result, createdAt, completedAt, solvingMode } = params;
  const fontSize = 24;
  const styles = makeStandardStyles(fontSize);

  const MODE_LABELS: Record<string, string> = { fast: "Быстрый", standard: "Стандартный", premium: "Премиум", super_premium: "Супер Премиум" };
  const TYPE_LABELS: Record<string, string> = { homework: "Домашняя работа", test: "Тест", coursework: "Курсовая работа", lab: "Лабораторная работа", essay: "Эссе", diploma: "Дипломная работа", presentation: "Презентация", other: "Другое" };

  const mkRun = (label: string, value: string) => [
    new TextRun({ text: label, bold: true, size: fontSize }),
    new TextRun({ text: value, size: fontSize }),
  ];

  const children: DocxBlock[] = [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
    new Paragraph({ children: mkRun("Предмет: ", subject), spacing: { after: 100 } }),
    new Paragraph({ children: mkRun("Тип: ", TYPE_LABELS[taskType] || taskType), spacing: { after: 100 } }),
    new Paragraph({ children: mkRun("Режим: ", MODE_LABELS[solvingMode] || solvingMode), spacing: { after: 100 } }),
    new Paragraph({ children: mkRun("Дата: ", new Date(createdAt).toLocaleString("ru-RU")), spacing: { after: completedAt ? 100 : 400 } }),
  ];

  if (completedAt) {
    children.push(new Paragraph({ children: mkRun("Выполнено: ", new Date(completedAt).toLocaleString("ru-RU")), spacing: { after: 400 } }));
  }

  if (description) {
    children.push(new Paragraph({ text: "Условие задачи", heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 } }));
    children.push(...await parseMarkdownToBlocksAsync(description, { size: fontSize }));
  }

  if (result) {
    children.push(new Paragraph({ text: "Решение", heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }));
    children.push(...await parseMarkdownToBlocksAsync(result, { size: fontSize }));
  }

  const doc = new Document({ styles, sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const safe = title.replace(/[<>:"/\\|?*]/g, "").slice(0, 50);
  saveAs(blob, `НейроЗачёт — ${safe}.docx`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Export: Экзаменационные билеты
// ═══════════════════════════════════════════════════════════════════════════
export async function exportTicketsToDocx(params: {
  subject: string;
  mode: string;
  ticketCount: number;
  result: string;
  createdAt?: string;
}) {
  const { subject, mode, ticketCount, result, createdAt } = params;
  const fontSize = 24;
  const styles = makeStandardStyles(fontSize);
  const MODE_LABELS: Record<string, string> = { fast: "Быстрый", standard: "Стандартный", premium: "Премиум", super_premium: "Супер Премиум" };

  const mkRun = (label: string, value: string) => [
    new TextRun({ text: label, bold: true, size: fontSize }),
    new TextRun({ text: value, size: fontSize }),
  ];

  const children: DocxBlock[] = [
    new Paragraph({ text: `Экзаменационные билеты: ${subject}`, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
    new Paragraph({ children: mkRun("Предмет: ", subject), spacing: { after: 100 } }),
    new Paragraph({ children: mkRun("Режим: ", MODE_LABELS[mode] || mode), spacing: { after: 100 } }),
    new Paragraph({ children: mkRun("Билетов: ", String(ticketCount)), spacing: { after: 100 } }),
    ...(createdAt
      ? [new Paragraph({ children: mkRun("Дата: ", new Date(createdAt).toLocaleString("ru-RU")), spacing: { after: 400 } })]
      : [new Paragraph({ text: "", spacing: { after: 300 } })]
    ),
    ...await parseMarkdownToBlocksAsync(result, { size: fontSize }),
  ];

  const doc = new Document({ styles, sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const safe = subject.replace(/[<>:"/\\|?*]/g, "").slice(0, 50);
  saveAs(blob, `Билеты — ${safe}.docx`);
}
