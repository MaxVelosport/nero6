// ────────────────────────────────────────────────────────────────────────────
// PDF-экспорт для всех инструментов НейроЗачёт.
// Стратегия: программно строим аккуратный HTML «как в книге», конвертируем в
// PDF через html2pdf.js (jsPDF + html2canvas). Печать одинаково красива на
// разных страницах, кириллица сохраняется (растеризуется в canvas).
// ────────────────────────────────────────────────────────────────────────────

import katex from "katex";
import "katex/dist/katex.min.css";

// ── lazy-инициализация mermaid ──────────────────────────────────────────────
let _mermaidInited = false;
let _mermaidCounter = 0;
async function getMermaid() {
  const m = (await import("mermaid")).default;
  if (!_mermaidInited) {
    m.initialize({ startOnLoad: false, theme: "default", fontFamily: "Inter, system-ui, sans-serif" });
    _mermaidInited = true;
  }
  return m;
}

// ── утилиты ────────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeFilename(s: string, max = 60): string {
  return s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim().slice(0, max) || "Документ";
}
function fmtDate(d?: string | number | Date | null): string {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return String(d); }
}
function fmtDateTime(d?: string | number | Date | null): string {
  if (!d) return "";
  try { return new Date(d).toLocaleString("ru-RU"); } catch { return String(d); }
}

// ── KaTeX рендер с тихим fallback на сырой текст ────────────────────────────
function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode, output: "html" });
  } catch {
    return `<code>${escapeHtml(tex)}</code>`;
  }
}

// безопасные URL для img/a (исключаем javascript:, vbscript: и т.п.)
function safeUrl(raw: string): string {
  const u = (raw || "").trim();
  if (!u) return "";
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(u)) return u;
  if (u.startsWith("/") || u.startsWith("./") || u.startsWith("../")) return u;
  return ""; // запретить javascript:/vbscript:/etc.
}

// ── Inline markdown → HTML (bold, italic, code, links, math) ────────────────
//
// Стратегия безопасного экранирования:
//   1. Сначала вырезаем все «защищённые» куски (math, code) → плейсхолдеры
//      ВМЕСТО уже отрендеренного HTML (потому что KaTeX даёт ВЛОЖЕННЫЕ <span>,
//      и грубая регулярка их разбивает).
//   2. Экранируем оставшийся текст (escapeHtml) — это полностью обезопасит
//      пользовательский ввод.
//   3. Применяем inline-форматирование (**жирный**, [ссылка](url) …) на уже
//      экранированной строке. Для ссылок URL пропускаем через safeUrl.
//   4. Восстанавливаем плейсхолдеры → HTML, который мы сами сгенерировали.
function renderInline(s: string): string {
  const placeholders: string[] = [];
  const stash = (html: string): string => {
    placeholders.push(html);
    return `\u0000P${placeholders.length - 1}\u0000`;
  };

  // 1. Display math
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => stash(renderMath(f.trim(), true)));
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, f) => stash(renderMath(f.trim(), true)));
  // 2. Inline math
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, f) => stash(renderMath(f.trim(), false)));
  s = s.replace(/\$([^$\n]+?)\$/g, (_, f) => stash(renderMath(f.trim(), false)));
  // 3. Inline `code`
  s = s.replace(/`([^`]+)`/g, (_, code) => stash(`<code class="nz-code">${escapeHtml(code)}</code>`));

  // 4. Полное экранирование оставшегося пользовательского текста
  s = escapeHtml(s);

  // 5. Inline-форматирование (на уже экранированной строке)
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  // [text](url) — здесь и url, и text уже экранированы, но url мы дополнительно
  // фильтруем через safeUrl на случай javascript:/data:text-html и т.п.
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
    const safe = safeUrl(url);
    return safe ? `<a href="${escapeHtml(safe)}">${text}</a>` : text;
  });

  // 6. Восстанавливаем безопасные плейсхолдеры (math/code)
  s = s.replace(/\u0000P(\d+)\u0000/g, (_, i) => placeholders[Number(i)]);

  return s;
}

// ── Markdown → HTML (block-level) ───────────────────────────────────────────
async function markdownToHtml(md: string): Promise<string> {
  if (!md) return "";

  // Pre-process display math так, чтобы они стали отдельными «строками».
  // Картинки markdown ![alt](url) кладём в плейсхолдеры — URL фильтруем через
  // safeUrl(), alt экранируем; так исключаем атрибутную инъекцию (XSS).
  const blockPlaceholders: string[] = [];
  const stashBlock = (html: string): string => {
    blockPlaceholders.push(html);
    return `\u0000B${blockPlaceholders.length - 1}\u0000`;
  };

  let text = md
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, f) => `\n\n$$${f.trim()}$$\n\n`)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      const safe = safeUrl(url);
      if (!safe) return alt ? escapeHtml(alt) : "";
      const safeAlt = escapeHtml(alt || "");
      const html = `<figure class="nz-fig"><img src="${escapeHtml(safe)}" alt="${safeAlt}"/>` +
        (alt ? `<figcaption>${safeAlt}</figcaption>` : "") + `</figure>`;
      return `\n\n${stashBlock(html)}\n\n`;
    });

  const lines = text.split("\n");
  const out: string[] = [];

  type State = "normal" | "code" | "table" | "ul" | "ol" | "quote";
  let state: State = "normal";
  let codeLang = "";
  let codeBuf: string[] = [];
  let tableBuf: string[] = [];

  const closeList = () => {
    if (state === "ul") out.push("</ul>");
    else if (state === "ol") out.push("</ol>");
    else if (state === "quote") out.push("</blockquote>");
    state = "normal";
  };

  async function flushCode() {
    if (codeBuf.length === 0) { codeLang = ""; return; }
    if (codeLang === "mermaid") {
      try {
        const mermaid = await getMermaid();
        const id = `mermaid-pdf-${++_mermaidCounter}`;
        const { svg } = await mermaid.render(id, codeBuf.join("\n").trim());
        out.push(`<div class="nz-mermaid">${svg}</div>`);
      } catch {
        out.push(`<pre class="nz-pre"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
      }
    } else {
      const langLabel = codeLang ? `<div class="nz-pre-lang">${escapeHtml(codeLang)}</div>` : "";
      out.push(`<div class="nz-pre-wrap">${langLabel}<pre class="nz-pre"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre></div>`);
    }
    codeBuf = []; codeLang = "";
  }

  function flushTable() {
    if (tableBuf.length === 0) return;
    const dataLines = tableBuf.filter(l => !/^\|[\s|:-]+\|$/.test(l.trim()));
    if (dataLines.length === 0) { tableBuf = []; return; }
    const rows = dataLines.map(l =>
      l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim())
    );
    const head = rows[0]; const body = rows.slice(1);
    const thead = `<thead><tr>${head.map(c => `<th>${renderInline(c)}</th>`).join("")}</tr></thead>`;
    const tbody = body.length > 0
      ? `<tbody>${body.map(r => `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join("")}</tr>`).join("")}</tbody>`
      : "";
    out.push(`<table class="nz-table">${thead}${tbody}</table>`);
    tableBuf = [];
  }

  for (const raw of lines) {
    const line = raw;

    // fenced code
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      if (state === "code") { await flushCode(); state = "normal"; }
      else { closeList(); state = "code"; codeLang = fence[1].trim().toLowerCase(); }
      continue;
    }
    if (state === "code") { codeBuf.push(line); continue; }

    // table line
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (state !== "table") { closeList(); state = "table"; tableBuf = []; }
      tableBuf.push(line); continue;
    } else if (state === "table") {
      flushTable(); state = "normal";
    }

    // empty line
    if (line.trim() === "") { closeList(); continue; }

    // headings
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      closeList();
      const lvl = Math.min(m[1].length + 1, 5);
      out.push(`<h${lvl} class="nz-h${lvl}">${renderInline(m[2])}</h${lvl}>`);
      continue;
    }

    // hr
    if (line.match(/^([-*_])\1{2,}\s*$/)) { closeList(); out.push(`<hr class="nz-hr"/>`); continue; }

    // blockquote
    if (line.startsWith("> ")) {
      if (state !== "quote") { closeList(); out.push("<blockquote class=\"nz-quote\">"); state = "quote"; }
      out.push(`<p>${renderInline(line.slice(2))}</p>`);
      continue;
    }

    // ordered list
    if (line.match(/^\s*\d+\.\s+/)) {
      if (state !== "ol") { closeList(); out.push("<ol class=\"nz-ol\">"); state = "ol"; }
      out.push(`<li>${renderInline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
      continue;
    }

    // bullet list
    if (line.match(/^\s*[-*•]\s+/)) {
      if (state !== "ul") { closeList(); out.push("<ul class=\"nz-ul\">"); state = "ul"; }
      out.push(`<li>${renderInline(line.replace(/^\s*[-*•]\s+/, ""))}</li>`);
      continue;
    }

    // paragraph
    closeList();
    out.push(`<p class="nz-p">${renderInline(line)}</p>`);
  }

  if (state === "code") await flushCode();
  if (state === "table") flushTable();
  closeList();

  // Восстанавливаем безопасные блочные плейсхолдеры (например, <figure> картинок)
  let html = out.join("\n");
  html = html.replace(/\u0000B(\d+)\u0000/g, (_, i) => blockPlaceholders[Number(i)] ?? "");
  return html;
}

// ── Глобальные стили документа (печатные, белая бумага, чёрный текст) ───────
const PDF_STYLES = `
  .nz-doc { color: #111; font-family: "Inter", "Helvetica Neue", Arial, sans-serif; font-size: 12pt; line-height: 1.55; background: #ffffff; padding: 0; margin: 0; }
  .nz-doc * { box-sizing: border-box; }
  .nz-page { padding: 22mm 18mm 22mm 22mm; }
  .nz-cover { padding: 32mm 22mm 22mm 22mm; min-height: 240mm; display: flex; flex-direction: column; }
  .nz-brand { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #6d28d9; padding-bottom: 12px; margin-bottom: 18mm; }
  .nz-brand-mark { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg,#6d28d9,#db2777); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px; letter-spacing:-0.02em; }
  .nz-brand-name { font-size: 14pt; font-weight: 700; color: #111; }
  .nz-brand-sub { font-size: 9pt; color: #666; margin-left: auto; }
  .nz-cover-title { font-size: 24pt; font-weight: 800; color: #111; line-height: 1.2; margin: 12mm 0 8mm 0; }
  .nz-cover-subject { font-size: 13pt; color: #444; margin-bottom: 6mm; }
  .nz-meta { font-size: 10pt; color: #555; border-top: 1px solid #ddd; padding-top: 6mm; margin-top: auto; }
  .nz-meta-row { display: flex; justify-content: space-between; padding: 3px 0; }
  .nz-meta-row b { color: #222; font-weight: 600; }

  .nz-h2 { font-size: 17pt; font-weight: 700; color: #1a1a2e; margin: 18px 0 8px; page-break-after: avoid; }
  .nz-h3 { font-size: 14pt; font-weight: 700; color: #1a1a2e; margin: 14px 0 6px; page-break-after: avoid; }
  .nz-h4 { font-size: 12pt; font-weight: 700; color: #333; margin: 10px 0 4px; page-break-after: avoid; }
  .nz-h5 { font-size: 11pt; font-weight: 700; color: #444; margin: 8px 0 4px; page-break-after: avoid; }
  .nz-p { margin: 6px 0; text-align: justify; }
  .nz-ul, .nz-ol { margin: 6px 0 6px 22px; padding: 0; }
  .nz-ul li, .nz-ol li { margin: 3px 0; }
  .nz-hr { border: none; border-top: 1px dashed #bbb; margin: 14px 0; }
  .nz-quote { border-left: 3px solid #6d28d9; background: #f8f5ff; padding: 8px 12px; margin: 8px 0; color: #333; }
  .nz-code { background: #f1f1f5; padding: 1px 5px; border-radius: 4px; font-family: "JetBrains Mono", "Courier New", monospace; font-size: 10pt; color: #b91c1c; }
  .nz-pre-wrap { margin: 10px 0; border: 1px solid #e5e5ea; border-radius: 8px; overflow: hidden; }
  .nz-pre-lang { background: #1a1a2e; color: #fff; padding: 4px 10px; font-size: 9pt; font-family: "JetBrains Mono", "Courier New", monospace; }
  .nz-pre { background: #f7f7fb; padding: 10px 12px; font-family: "JetBrains Mono", "Courier New", monospace; font-size: 9.5pt; line-height: 1.45; white-space: pre-wrap; word-break: break-word; color: #1a1a2e; margin: 0; page-break-inside: avoid; }

  .nz-table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10.5pt; page-break-inside: avoid; }
  .nz-table th, .nz-table td { border: 1px solid #c8c8d0; padding: 6px 8px; text-align: left; vertical-align: top; }
  .nz-table thead th { background: #efeff4; font-weight: 700; }

  .nz-fig { margin: 10px 0; text-align: center; page-break-inside: avoid; }
  .nz-fig img { max-width: 100%; height: auto; border-radius: 6px; }
  .nz-fig figcaption { font-size: 10pt; color: #555; font-style: italic; margin-top: 4px; }

  .nz-mermaid { text-align: center; margin: 12px 0; page-break-inside: avoid; }
  .nz-mermaid svg { max-width: 100%; height: auto; }

  .nz-msg { margin: 10px 0 16px; page-break-inside: avoid; }
  .nz-msg-head { font-size: 10pt; font-weight: 700; color: #fff; padding: 4px 10px; border-radius: 6px 6px 0 0; display: inline-block; }
  .nz-msg-user .nz-msg-head { background: #2563eb; }
  .nz-msg-ai .nz-msg-head { background: linear-gradient(135deg,#6d28d9,#db2777); }
  .nz-msg-body { border: 1px solid #e5e5ea; border-top: none; border-radius: 0 6px 6px 6px; padding: 10px 12px; background: #fafafe; }

  .nz-section-title { font-size: 18pt; font-weight: 800; color: #6d28d9; border-bottom: 2px solid #e5e5ea; padding-bottom: 6px; margin: 22px 0 12px; page-break-after: avoid; }

  .nz-page-break { page-break-before: always; height: 0; }
  .nz-footer { margin-top: 18mm; border-top: 1px solid #e5e5ea; padding-top: 6px; font-size: 9pt; color: #888; text-align: center; }

  .katex { font-size: 1.05em; }
  .katex-display { margin: 8px 0; }
`;

// ── обёртка-документ ────────────────────────────────────────────────────────
function buildDocument(opts: {
  title: string;
  subject?: string;
  metaRows?: { label: string; value: string }[];
  bodyHtml: string;
  toolLabel: string;
}): HTMLElement {
  const { title, subject, metaRows = [], bodyHtml, toolLabel } = opts;

  const root = document.createElement("div");
  root.className = "nz-doc";
  root.style.width = "210mm";
  root.style.background = "#ffffff";

  const styleTag = document.createElement("style");
  styleTag.textContent = PDF_STYLES;
  root.appendChild(styleTag);

  const cover = document.createElement("div");
  cover.className = "nz-cover";
  cover.innerHTML = `
    <div class="nz-brand">
      <div class="nz-brand-mark">НЗ</div>
      <div>
        <div class="nz-brand-name">НейроЗачёт</div>
        <div style="font-size:9pt;color:#777;">neurozachet.ru</div>
      </div>
      <div class="nz-brand-sub">${escapeHtml(toolLabel)}</div>
    </div>
    <div class="nz-cover-title">${escapeHtml(title)}</div>
    ${subject ? `<div class="nz-cover-subject">Дисциплина: <b>${escapeHtml(subject)}</b></div>` : ""}
    <div class="nz-meta">
      ${metaRows.map(r => `<div class="nz-meta-row"><b>${escapeHtml(r.label)}</b><span>${escapeHtml(r.value)}</span></div>`).join("")}
    </div>
  `;
  root.appendChild(cover);

  const page = document.createElement("div");
  page.className = "nz-page";
  page.innerHTML = `<div class="nz-page-break"></div>${bodyHtml}<div class="nz-footer">Сгенерировано НейроЗачёт · neurozachet.ru · ${new Date().toLocaleDateString("ru-RU")}</div>`;
  root.appendChild(page);

  return root;
}

// ── основная функция «HTML → PDF» ───────────────────────────────────────────
async function renderToPdf(root: HTMLElement, filename: string): Promise<void> {
  // Off-screen контейнер: html2pdf требует, чтобы элемент был в DOM
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.width = "210mm";
  host.style.background = "#ffffff";
  host.appendChild(root);
  document.body.appendChild(host);

  try {
    const html2pdf = (await import("html2pdf.js")).default as any;
    await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"], avoid: [".nz-msg", ".nz-table", ".nz-pre", ".nz-mermaid", ".nz-fig"] },
      })
      .from(root)
      .save();
  } finally {
    // дать html2pdf время; затем чистим
    setTimeout(() => { try { document.body.removeChild(host); } catch { /* noop */ } }, 250);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Публичные экспорты для каждого инструмента
// ═══════════════════════════════════════════════════════════════════════════

const TASK_MODE_LABELS: Record<string, string> = { fast: "Быстрый", standard: "Стандартный", premium: "Премиум", super_premium: "Супер Премиум", deep: "Глубокий" };
const TASK_TYPE_LABELS: Record<string, string> = { homework: "Домашняя работа", test: "Тест", coursework: "Курсовая работа", lab: "Лабораторная работа", essay: "Эссе", diploma: "Дипломная работа", presentation: "Презентация", other: "Другое" };
const COURSEWORK_TYPE_LABELS: Record<string, string> = { essay: "Реферат", report: "Отчёт по практике", coursework: "Курсовая работа", diploma: "Дипломная работа (ВКР)", master: "Магистерская диссертация", phd_thesis: "Кандидатская диссертация", phd: "Кандидатская диссертация" };

// ── Задача (tasks/[id].tsx) ────────────────────────────────────────────────
export async function exportTaskToPdf(params: {
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

  const meta: { label: string; value: string }[] = [
    { label: "Тип задачи:", value: TASK_TYPE_LABELS[taskType] || taskType },
    { label: "Режим решения:", value: TASK_MODE_LABELS[solvingMode] || solvingMode },
    { label: "Создано:", value: fmtDateTime(createdAt) },
  ];
  if (completedAt) meta.push({ label: "Решено:", value: fmtDateTime(completedAt) });

  let body = "";
  if (description) {
    body += `<h2 class="nz-section-title">Условие задачи</h2>` + await markdownToHtml(description);
  }
  if (result) {
    body += `<div class="nz-page-break"></div><h2 class="nz-section-title">Решение</h2>` + await markdownToHtml(result);
  }
  if (!description && !result) body = `<p class="nz-p"><em>Решение ещё не готово.</em></p>`;

  const root = buildDocument({ title, subject, metaRows: meta, bodyHtml: body, toolLabel: "Решение задачи" });
  await renderToPdf(root, `НейроЗачёт — ${safeFilename(title)}.pdf`);
}

// ── Чат-сессия (sessions/[id].tsx) ─────────────────────────────────────────
export async function exportSessionToPdf(params: {
  title: string;
  subject: string;
  model: string;
  createdAt: string;
  messages: { role: string; content: string; created_at?: string }[];
}) {
  const { title, subject, model, createdAt, messages } = params;

  const meta = [
    { label: "Модель:", value: model },
    { label: "Сообщений:", value: String(messages.length) },
    { label: "Создано:", value: fmtDateTime(createdAt) },
  ];

  let body = `<h2 class="nz-section-title">Диалог</h2>`;
  for (const msg of messages) {
    const isUser = msg.role === "user";
    const head = isUser ? "Вы" : "НейроЗачёт";
    const cls = isUser ? "nz-msg nz-msg-user" : "nz-msg nz-msg-ai";
    const time = msg.created_at ? ` · ${fmtDateTime(msg.created_at)}` : "";
    body += `<div class="${cls}">
      <div class="nz-msg-head">${head}${time}</div>
      <div class="nz-msg-body">${await markdownToHtml(msg.content || "")}</div>
    </div>`;
  }

  const root = buildDocument({ title, subject, metaRows: meta, bodyHtml: body, toolLabel: "Чат-сессия" });
  await renderToPdf(root, `НейроЗачёт — ${safeFilename(title)}.pdf`);
}

// ── Курсовая/диплом (coursework/new.tsx) ───────────────────────────────────
export async function exportCourseworkToPdf(params: {
  topic: string;
  subject: string;
  workType: string;
  requirements?: string;
  chapters: Array<{ id: number; title: string; estimatedPages: number }>;
  chapterContents: Record<number, string>;
}) {
  const { topic, subject, workType, requirements, chapters, chapterContents } = params;
  const typeLabel = COURSEWORK_TYPE_LABELS[workType] || workType;

  const meta = [
    { label: "Тип работы:", value: typeLabel },
    { label: "Глав:", value: String(chapters.length) },
    { label: "Создано:", value: fmtDate(new Date()) },
  ];
  if (requirements?.trim()) meta.push({ label: "Требования:", value: requirements.trim().slice(0, 80) });

  // Содержание
  let body = `<h2 class="nz-section-title">Содержание</h2><ol class="nz-ol">`;
  for (const ch of chapters) {
    body += `<li>${escapeHtml(ch.title)} <span style="color:#999;">(~${ch.estimatedPages} стр.)</span></li>`;
  }
  body += `</ol>`;

  // Главы — каждая со своей страницы
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const content = chapterContents[ch.id];
    if (!content) continue;
    body += `<div class="nz-page-break"></div><h2 class="nz-section-title">${escapeHtml(ch.title)}</h2>`;
    body += await markdownToHtml(content);
  }

  const root = buildDocument({ title: topic, subject, metaRows: meta, bodyHtml: body, toolLabel: typeLabel });
  await renderToPdf(root, `${typeLabel} — ${safeFilename(topic)}.pdf`);
}

// ── Билеты (tickets/new.tsx) ────────────────────────────────────────────────
export async function exportTicketsToPdf(params: {
  subject: string;
  mode: string;
  ticketCount: number;
  result: string;
  createdAt?: string;
}) {
  const { subject, mode, ticketCount, result, createdAt } = params;
  const meta = [
    { label: "Режим:", value: TASK_MODE_LABELS[mode] || mode },
    { label: "Билетов:", value: String(ticketCount) },
    { label: "Создано:", value: fmtDateTime(createdAt || new Date()) },
  ];
  const body = `<h2 class="nz-section-title">Экзаменационные билеты</h2>` + await markdownToHtml(result);
  const root = buildDocument({ title: `Билеты по предмету «${subject}»`, subject, metaRows: meta, bodyHtml: body, toolLabel: "Экзаменационные билеты" });
  await renderToPdf(root, `Билеты — ${safeFilename(subject)}.pdf`);
}

// ── Конспект (learn/summary.tsx) ────────────────────────────────────────────
export async function exportSummaryToPdf(params: {
  topic: string;
  subject?: string;
  type?: string;
  content: string;
  createdAt?: string;
}) {
  const { topic, subject, type, content, createdAt } = params;
  const meta: { label: string; value: string }[] = [];
  if (type) meta.push({ label: "Формат:", value: type });
  meta.push({ label: "Создано:", value: fmtDateTime(createdAt || new Date()) });
  const body = `<h2 class="nz-section-title">Конспект</h2>` + await markdownToHtml(content);
  const root = buildDocument({ title: topic, subject, metaRows: meta, bodyHtml: body, toolLabel: "Конспект" });
  await renderToPdf(root, `Конспект — ${safeFilename(topic)}.pdf`);
}

// ── Подсказки (hints.tsx) ───────────────────────────────────────────────────
export async function exportHintsToPdf(params: {
  subject?: string;
  question: string;
  hints: string;
  createdAt?: string;
}) {
  const { subject, question, hints, createdAt } = params;
  const meta = [{ label: "Создано:", value: fmtDateTime(createdAt || new Date()) }];
  const body =
    `<h2 class="nz-section-title">Вопрос</h2>` + await markdownToHtml(question) +
    `<h2 class="nz-section-title">Подсказки</h2>` + await markdownToHtml(hints);
  const root = buildDocument({
    title: question.length > 80 ? question.slice(0, 80) + "…" : question,
    subject, metaRows: meta, bodyHtml: body, toolLabel: "Подсказки",
  });
  await renderToPdf(root, `Подсказки — ${safeFilename(subject || question)}.pdf`);
}
