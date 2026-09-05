# ClixArena Subtitle API

Vercel-ready UI and API that commits uploaded `.srt` and `.vtt` subtitles plus JSON metadata to a GitHub repository.

## Environment variables

- `GITHUB_TOKEN`: fine-grained GitHub token with **Contents: Read and write** for the data repository.
- `GITHUB_REPOSITORY`: `owner/repository`.
- `GITHUB_BRANCH`: target branch, defaults to `main`.
- `SUBTITLE_UPLOAD_KEY`: optional private key required by both UI and API submissions.

## Saved layout

```text
subtitles/movie/{tmdbId}/{languageCode}/{uuid}.srt
subtitles.json  # shared catalog: all subtitle URLs and metadata
subtitles/tv/{tmdbId}/season-{n}/episode-{n}/{languageCode}/{uuid}.vtt
```

## API

Send `POST /api/subtitles` as `multipart/form-data`. Required fields are `file`, `mediaType`, `tmdbId`, `language`, and `languageCode`. TV submissions also require `season` and `episode`. If configured, send the upload key as `x-upload-key` or `uploadKey`.

## Vercel deployment

Import this directory as a Vercel project, add the environment variables above, then deploy. The GitHub token is used only by the server route and is never bundled into the browser.

1. Push the sibling `subtitle-data` folder to a PUBLIC GitHub repository with a `main` branch. The README initializes the branch. Public visibility is required for the returned raw URLs.
2. Push this folder's contents to a separate `subtitle-api` repository.
3. Import ONLY `subtitle-api` in Vercel. Select Next.js, root `./`, Node.js 24, and default build settings.
4. Set `GITHUB_TOKEN`, `GITHUB_REPOSITORY=YOUR_USERNAME/subtitle-data`, `GITHUB_BRANCH=main`, and `SUBTITLE_UPLOAD_KEY` in Vercel's Production environment. The token needs Contents read/write access to the data repository.
5. Deploy. Enter the upload key in the form when submitting subtitles.

GitHub Actions and VERCEL_* secrets are not required. Data uploads only change
the separate data repository, so they do not redeploy the app.

Local development: run `npm ci`, copy `.env.example` to `.env.local`, fill in
your values and run `npm run dev`. Never commit real tokens or passwords.
