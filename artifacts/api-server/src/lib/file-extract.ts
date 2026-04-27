import mammoth from "mammoth";
import * as XLSX from "xlsx";

const IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "image/bmp", "image/tiff", "image/svg+xml",
]);

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const PPT_MIME  = "application/vnd.ms-powerpoint";

export function isImageMime(mimeType: string): boolean {
  return IMAGE_TYPES.has(mimeType);
}

export async function extractTextFromFile(
  base64Data: string,
  mimeType: string,
  filename: string,
): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  const label = `[Содержимое файла «${filename}»]`;

  try {
    // PDF — loaded lazily via require() to avoid startup-time test file read
    if (mimeType === "application/pdf") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = (globalThis as any).require("pdf-parse");
      const result = await pdfParse(buffer);
      const text = (result.text as string).trim();
      return `${label}\n${text || "(PDF не содержит извлекаемого текста)"}`;
    }

    // Word DOCX / DOC
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return `${label}\n${result.value.trim()}`;
    }

    // Excel XLSX / XLS
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel"
    ) {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [label];
      for (const name of wb.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        parts.push(`--- Лист: ${name} ---\n${csv}`);
      }
      return parts.join("\n\n");
    }

    // PowerPoint — text extraction not reliable; prompt user
    if (mimeType === PPTX_MIME || mimeType === PPT_MIME) {
      return `${label}\n[Файл PowerPoint прикреплён. Пожалуйста, опишите содержимое или вставьте текст слайдов в условие задачи.]`;
    }

    // Plain text, CSV, Markdown, JSON, code files
    if (
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      mimeType === "application/xml" ||
      filename.match(/\.(txt|csv|md|json|xml|py|js|ts|java|cpp|c|h|cs|go|rs|rb|php|sh|yaml|yml)$/i)
    ) {
      const text = buffer.toString("utf-8");
      return `${label}\n${text}`;
    }

    // Fallback
    return `${label}\n[Тип файла (${mimeType}) не поддерживается для автоматического чтения. Опишите содержимое в условии задачи.]`;
  } catch (err) {
    return `${label}\n[Не удалось прочитать файл: ${(err as Error).message}]`;
  }
}
