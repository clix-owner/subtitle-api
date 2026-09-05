"use client";

import { FormEvent, useRef, useState } from "react";

type Result = { subtitleUrl: string; metadataUrl: string; commitUrl: string; subtitle: { id: string } };

export default function Home() {
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(""); setResult(null);
    if (!file) { setError("Choose an SRT or VTT file first."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/subtitles", { method: "POST", body: new FormData(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Upload failed.");
      setResult(body);
      // Keep metadata and the upload key ready for the next submission.
      if (input.current) input.current.value = "";
      setFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  return (
    <main>
      <nav><div className="brand"><span>CA</span> Subtitle Vault</div><a href="/api/subtitles" target="_blank">API status ↗</a></nav>
      <section className="hero">
        <div className="eyebrow">CLIXARENA DATA TOOLS</div>
        <h1>Ship subtitles.<br/><em>Keep the URL.</em></h1>
        <p>Submit verified SRT or VTT subtitles for movies and TV episodes. Every upload is versioned safely in GitHub.</p>
      </section>

      <section className="panel">
        <div className="panelHead"><div><small>NEW SUBMISSION</small><h2>Subtitle details</h2></div><span className="secure">● SERVER-SIDE GITHUB WRITE</span></div>
        <form onSubmit={submit}>
          <div className="switch" role="group" aria-label="Media type">
            <button type="button" className={mediaType === "movie" ? "active" : ""} onClick={() => setMediaType("movie")}>Movie</button>
            <button type="button" className={mediaType === "tv" ? "active" : ""} onClick={() => setMediaType("tv")}>TV Series</button>
          </div>
          <input type="hidden" name="mediaType" value={mediaType}/>
          <div className="grid">
            <label><span>TMDB ID *</span><input name="tmdbId" type="number" min="1" placeholder="e.g. 550" required/></label>
            <label><span>Language *</span><input name="language" defaultValue="Sinhala" placeholder="Sinhala" required/></label>
            <label><span>Language code *</span><input name="languageCode" defaultValue="si" placeholder="si" maxLength={12} required/></label>
            <label><span>Release name</span><input name="releaseName" placeholder="WEB-DL, BluRay, etc."/></label>
            {mediaType === "tv" && <><label><span>Season *</span><input name="season" type="number" min="1" placeholder="1" required/></label><label><span>Episode *</span><input name="episode" type="number" min="1" placeholder="1" required/></label></>}
          </div>
          <label className="upload" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f=e.dataTransfer.files[0]; if(f){setFile(f); if(input.current) input.current.files=e.dataTransfer.files;} }}>
            <input ref={input} name="file" type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" required onChange={e => setFile(e.target.files?.[0] || null)}/>
            <span className="uploadIcon">↑</span>
            <strong>{file ? file.name : "Drop your subtitle here"}</strong>
            <small>{file ? `${(file.size / 1024).toFixed(1)} KB · ready to upload` : "or click to browse · SRT/VTT · max 3 MB"}</small>
          </label>
          <label><span>Upload key <i>(only when enabled)</i></span><input name="uploadKey" type="password" autoComplete="off" placeholder="Private submission key"/></label>
          {error && <div className="notice error">{error}</div>}
          {result && <div className="notice success"><strong>Subtitle published</strong><div className="urls"><a href={result.subtitleUrl} target="_blank">Open subtitle ↗</a><button type="button" onClick={() => navigator.clipboard.writeText(result.subtitleUrl)}>Copy URL</button><a href={result.metadataUrl} target="_blank">Metadata ↗</a><a href={result.commitUrl} target="_blank">Commit ↗</a></div></div>}
          <button className="submit" disabled={busy}>{busy ? "Publishing…" : "Publish subtitle"}<span>→</span></button>
        </form>
      </section>
      <footer><span>Files are committed to your configured GitHub repository.</span><code>POST /api/subtitles</code></footer>
    </main>
  );
}
