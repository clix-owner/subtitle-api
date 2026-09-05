import type { SubtitleRecord } from "./subtitles";
type GithubConfig = { token: string; owner: string; repo: string; branch: string };
class GithubError extends Error { constructor(public status: number) { super(`GitHub storage request failed (${status}).`); } }

function config(): GithubConfig {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  const branch = process.env.GITHUB_BRANCH?.trim() || "main";
  if (!token || !repository || !repository.includes("/")) {
    throw new Error("Server storage is not configured. Set GITHUB_TOKEN and GITHUB_REPOSITORY.");
  }
  const [owner, repo] = repository.split("/", 2);
  return { token, owner, repo, branch };
}

async function github<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { token } = config();
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "clixarena-subtitle-api",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    console.error("GitHub API error", response.status, body.slice(0, 500));
    throw new GithubError(response.status);
  }
  return response.json() as Promise<T>;
}

export async function commitSubtitle(input: {
  subtitlePath: string;
  subtitleText: string;
  record: SubtitleRecord;
  message: string;
}) {
  const { owner, repo, branch } = config();
  const base = `/repos/${owner}/${repo}`;
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}`;
  const subtitleUrl = `${rawBase}/${input.subtitlePath.split("/").map(encodeURIComponent).join("/")}`;
  const metadataPath = "subtitles.json";
  const subtitleBlob = await github<{ sha: string }>(`${base}/git/blobs`, {
    method: "POST", body: JSON.stringify({ content: input.subtitleText, encoding: "utf-8" }),
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    const ref = await github<{ object: { sha: string } }>(`${base}/git/ref/heads/${encodeURIComponent(branch)}`);
    const parentSha = ref.object.sha;
    const commit = await github<{ tree: { sha: string } }>(`${base}/git/commits/${parentSha}`);
    const root = await github<{ tree: { path: string; sha: string; type: string }[] }>(`${base}/git/trees/${commit.tree.sha}`);
    const existing = root.tree.find(entry => entry.path === metadataPath);
    let catalog: { subtitles: Record<string, unknown>[]; [key: string]: unknown } = { subtitles: [] };
    if (existing) {
      if (existing.type !== "blob") throw new Error("subtitles.json must be a file.");
      const blob = await github<{ content: string; encoding: string }>(`${base}/git/blobs/${existing.sha}`);
      if (blob.encoding !== "base64") throw new Error("Unsupported catalog encoding.");
      catalog = JSON.parse(Buffer.from(blob.content, "base64").toString("utf8"));
      if (!catalog || !Array.isArray(catalog.subtitles)) throw new Error("Invalid subtitles.json; existing data was not overwritten.");
    }
    catalog.subtitles = [...catalog.subtitles.filter(entry => entry.id !== input.record.id), { ...input.record, url: subtitleUrl }];
    const metadataBlob = await github<{ sha: string }>(`${base}/git/blobs`, {
      method: "POST", body: JSON.stringify({ content: JSON.stringify(catalog, null, 2) + "\n", encoding: "utf-8" }),
    });
    const tree = await github<{ sha: string }>(`${base}/git/trees`, {
      method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree: [
        { path: input.subtitlePath, mode: "100644", type: "blob", sha: subtitleBlob.sha },
        { path: metadataPath, mode: "100644", type: "blob", sha: metadataBlob.sha },
      ] }),
    });
    const created = await github<{ sha: string; html_url: string }>(`${base}/git/commits`, {
      method: "POST", body: JSON.stringify({ message: input.message, tree: tree.sha, parents: [parentSha] }),
    });
    try {
      await github(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: "PATCH", body: JSON.stringify({ sha: created.sha, force: false }),
      });
      return { commitSha: created.sha, commitUrl: created.html_url, subtitleUrl, metadataUrl: `${rawBase}/${metadataPath}` };
    } catch (error) {
      if (!(error instanceof GithubError) || ![409, 422].includes(error.status) || attempt === 3) throw error;
      const latest = await github<{ object: { sha: string } }>(`${base}/git/ref/heads/${encodeURIComponent(branch)}`);
      if (latest.object.sha === parentSha) throw error;
    }
  }
  throw new Error("Repository changed repeatedly. Please retry the upload.");
}
