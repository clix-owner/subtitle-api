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
