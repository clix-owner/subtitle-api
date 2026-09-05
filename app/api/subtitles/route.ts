import { NextResponse } from "next/server";
import { commitSubtitle } from "@/lib/github";
import { decodeSubtitle, MAX_FILE_BYTES, safeSegment, type MediaType, type SubtitleRecord, validateSubtitle } from "@/lib/subtitles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function positiveInt(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "ClixArena Subtitle API",
    endpoint: "/api/subtitles",
    method: "POST multipart/form-data",
    fields: ["file", "mediaType", "tmdbId", "language", "languageCode", "releaseName?", "season+episode (TV only)", "uploadKey?"],
    accepts: [".srt", ".vtt"],
    maxBytes: MAX_FILE_BYTES,
  });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) return error("Use multipart/form-data.", 415);
    const form = await request.formData();
    const requiredKey = process.env.SUBTITLE_UPLOAD_KEY;
    const suppliedKey = request.headers.get("x-upload-key") || String(form.get("uploadKey") || "");
    if (requiredKey && suppliedKey !== requiredKey) return error("Invalid upload key.", 401);

    const file = form.get("file");
    if (!(file instanceof File)) return error("A subtitle file is required.", 400);
    if (file.size > MAX_FILE_BYTES) return error("Subtitle file exceeds the 3 MB limit.", 413);

    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "srt" && extension !== "vtt") return error("Only .srt and .vtt files are accepted.", 415);
    const text = decodeSubtitle(await file.arrayBuffer()).replace(/^\uFEFF/, "");
    const validationError = validateSubtitle(text, extension);
    if (validationError) return error(validationError, 422);

    const mediaType = String(form.get("mediaType") || "") as MediaType;
    if (mediaType !== "movie" && mediaType !== "tv") return error("mediaType must be movie or tv.", 400);
    const tmdbId = positiveInt(form.get("tmdbId"));
    if (!tmdbId) return error("A valid TMDB ID is required.", 400);
    const season = mediaType === "tv" ? positiveInt(form.get("season")) : null;
    const episode = mediaType === "tv" ? positiveInt(form.get("episode")) : null;
    if (mediaType === "tv" && (!season || !episode)) return error("TV subtitles require season and episode numbers.", 400);

    const language = String(form.get("language") || "").trim().slice(0, 50);
    const languageCode = safeSegment(String(form.get("languageCode") || "").toLowerCase(), "und").slice(0, 12);
    if (!language) return error("Language is required.", 400);
    const releaseName = String(form.get("releaseName") || "").trim().slice(0, 180) || null;
    const id = crypto.randomUUID();
    const episodePath = mediaType === "tv" ? `/season-${season}/episode-${episode}` : "";
    const basePath = `subtitles/${mediaType}/${tmdbId}${episodePath}/${languageCode}`;
    const subtitlePath = `${basePath}/${id}.${extension}`;
    const metadataPath = "subtitles.json";
    const record: SubtitleRecord = {
      id, mediaType, tmdbId, season, episode, language, languageCode, releaseName,
      format: extension, originalFilename: file.name.slice(0, 255), subtitlePath, metadataPath,
      submittedAt: new Date().toISOString(),
    };
    const stored = await commitSubtitle({
      subtitlePath,
      subtitleText: text,
      record,
      message: `Add ${mediaType} ${tmdbId} ${languageCode} subtitle [skip ci]`,
    });
    return NextResponse.json({ ok: true, subtitle: record, ...stored }, { status: 201 });
  } catch (cause) {
    console.error("Subtitle upload failed", cause);
    return error(cause instanceof Error ? cause.message : "Upload failed unexpectedly.", 500);
  }
}
