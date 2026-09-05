type GithubConfig = { token: string; owner: string; repo: string; branch: string };

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
    throw new Error(response.status === 401 || response.status === 403
      ? "GitHub rejected the server credentials or repository permission."
      : `GitHub storage request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export async function commitSubtitle(input: {
  subtitlePath: string;
  subtitleText: string;
  metadataPath: string;
  metadataText: string;
  message: string;
}) {
  const { owner, repo, branch } = config();
  const base = `/repos/${owner}/${repo}`;
  const ref = await github<{ object: { sha: string } }>(`${base}/git/ref/heads/${encodeURIComponent(branch)}`);
  const parentSha = ref.object.sha;
  const commit = await github<{ tree: { sha: string } }>(`${base}/git/commits/${parentSha}`);
  const [subtitleBlob, metadataBlob] = await Promise.all([
    github<{ sha: string }>(`${base}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: input.subtitleText, encoding: "utf-8" }),
    }),
    github<{ sha: string }>(`${base}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: input.metadataText, encoding: "utf-8" }),
    }),
  ]);
  const tree = await github<{ sha: string }>(`${base}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: commit.tree.sha,
      tree: [
        { path: input.subtitlePath, mode: "100644", type: "blob", sha: subtitleBlob.sha },
        { path: input.metadataPath, mode: "100644", type: "blob", sha: metadataBlob.sha },
      ],
    }),
  });
  const created = await github<{ sha: string; html_url: string }>(`${base}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: input.message, tree: tree.sha, parents: [parentSha] }),
  });
  await github(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: created.sha, force: false }),
  });
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}`;
  return {
    commitSha: created.sha,
    commitUrl: created.html_url,
    subtitleUrl: `${rawBase}/${input.subtitlePath.split("/").map(encodeURIComponent).join("/")}`,
    metadataUrl: `${rawBase}/${input.metadataPath.split("/").map(encodeURIComponent).join("/")}`,
  };
}
