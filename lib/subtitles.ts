export const MAX_FILE_BYTES = 3 * 1024 * 1024;

export type MediaType = "movie" | "tv";

export type SubtitleRecord = {
  id: string;
  mediaType: MediaType;
  tmdbId: number;
  season: number | null;
  episode: number | null;
  language: string;
  languageCode: string;
  releaseName: string | null;
  format: "srt" | "vtt";
  originalFilename: string;
  subtitlePath: string;
  metadataPath: string;
  submittedAt: string;
};

/** Decode common Unicode subtitle encodings; GitHub storage remains UTF-8. */
export function decodeSubtitle(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  if (view.length >= 2 && view[0] === 0xff && view[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(view.subarray(2));
  }
  if (view.length >= 2 && view[0] === 0xfe && view[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(view.subarray(2));
  }
  const offset = view.length >= 3 && view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf ? 3 : 0;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(view.subarray(offset));
  } catch {
    throw new Error("Unsupported subtitle encoding. Use UTF-8 or UTF-16.");
  }
}

export function safeSegment(value: string, fallback: string) {
  const safe = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return safe || fallback;
}

export function validateSubtitle(text: string, format: "srt" | "vtt") {
  if (!text.trim()) return "Subtitle file is empty.";
  if (text.includes("\u0000")) return "Binary files are not accepted.";
  if (format === "vtt" && !/^\uFEFF?WEBVTT(?:\s|$)/.test(text)) {
    return "Invalid VTT file: WEBVTT header is missing.";
  }
  const timestamp = format === "vtt"
    ? /\d{2}:\d{2}(?::\d{2})?\.\d{3}\s+-->\s+\d{2}:\d{2}(?::\d{2})?\.\d{3}/
    : /\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/;
  if (!timestamp.test(text)) return `Invalid ${format.toUpperCase()} file: no subtitle timestamps found.`;
  return null;
}
