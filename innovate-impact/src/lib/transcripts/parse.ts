/**
 * Transcript upload parser. Converts an uploaded file (or text blob) into a
 * normalized plain-text transcript suitable for the Transcript Intake Agent.
 *
 * Server-only. Imports `mammoth` (docx) and `pdf-parse` (pdf) dynamically so
 * the Edge runtime / client bundle never pulls them in.
 */

const ALLOWED_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "vtt",
  "srt",
  "docx",
  "pdf",
]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export type ParseResult = {
  text: string;
  /** Source format detected (txt|md|vtt|srt|docx|pdf). */
  format: string;
  /** Original filename, if any. */
  filename?: string;
  /** Original byte length, before normalization. */
  byteLength: number;
};

export class TranscriptParseError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "TranscriptParseError";
  }
}

function extOf(filename: string | undefined): string {
  if (!filename) return "";
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i + 1).toLowerCase();
}

/**
 * Strip WEBVTT / SRT timing lines and cue numbers; collapse whitespace.
 */
function normalizeCaptions(raw: string): string {
  return raw
    .split(/\r?\n/)
    .filter((line) => {
      const l = line.trim();
      if (!l) return true; // keep paragraph breaks
      if (/^WEBVTT/i.test(l)) return false;
      if (/^\d+$/.test(l)) return false; // SRT cue numbers
      if (/^\d{1,2}:\d{2}(:\d{2})?[.,]?\d*\s*-->\s*\d{1,2}:\d{2}/.test(l)) return false;
      if (/^NOTE\b/.test(l)) return false;
      return true;
    })
    .join("\n");
}

function normalizeWhitespace(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function parseDocx(buf: Buffer): Promise<string> {
  // mammoth is bundled server-side only.
  const mammoth = await import("mammoth").catch(() => null);
  if (!mammoth) {
    throw new TranscriptParseError(
      "DOCX parser not installed on the server (npm install mammoth).",
      500,
    );
  }
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value ?? "";
}

async function parsePdf(buf: Buffer): Promise<string> {
  // pdf-parse pulls in pdfjs-dist — keep it dynamic so it's server-side only.
  // The module ships both ESM and CJS shapes; tolerate either.
  const mod = await import("pdf-parse").catch(() => null);
  if (!mod) {
    throw new TranscriptParseError(
      "PDF parser not installed on the server (npm install pdf-parse).",
      500,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse: (b: Buffer) => Promise<{ text: string }> = (mod as any).default ?? (mod as any);
  const result = await pdfParse(buf);
  return result.text ?? "";
}

export async function parseTranscriptUpload(file: File): Promise<ParseResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new TranscriptParseError(
      `File exceeds ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} MB limit`,
      413,
    );
  }
  const ext = extOf(file.name);
  if (!ALLOWED_EXTS.has(ext)) {
    throw new TranscriptParseError(
      `Unsupported file type ".${ext || file.type}". Allowed: ${Array.from(ALLOWED_EXTS).join(", ")}`,
      415,
    );
  }

  const ab = await file.arrayBuffer();
  const buf = Buffer.from(ab);
  let text: string;

  switch (ext) {
    case "docx":
      text = await parseDocx(buf);
      break;
    case "pdf":
      text = await parsePdf(buf);
      break;
    case "vtt":
    case "srt":
      text = normalizeCaptions(buf.toString("utf8"));
      break;
    default:
      text = buf.toString("utf8");
  }

  return {
    text: normalizeWhitespace(text),
    format: ext,
    filename: file.name,
    byteLength: file.size,
  };
}

export function parsePastedText(raw: string): ParseResult {
  const looksLikeCaptions = /\d{1,2}:\d{2}(:\d{2})?\s*-->/.test(raw) || /^WEBVTT/i.test(raw);
  const text = normalizeWhitespace(looksLikeCaptions ? normalizeCaptions(raw) : raw);
  return {
    text,
    format: looksLikeCaptions ? "vtt" : "text",
    byteLength: Buffer.byteLength(raw, "utf8"),
  };
}
