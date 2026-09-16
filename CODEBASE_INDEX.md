# Codebase Index

This is the short routing map for the repository. Each component document owns the detailed file-by-file descriptions and change guidance.

## Runtime flow

`public/app.js` -> `POST /api/extract` -> Vercel or local HTTP adapter -> `src/extract-conversation.mjs` -> `src/parse-share.mjs` -> normalized JSON -> `public/format-transcript.js`

## Components

| Component | Responsibility | Primary files | Details |
| --- | --- | --- | --- |
| HTTP adapters | Vercel Function, local static delivery, request parsing, HTTP errors | `api/extract.mjs`, `local-server.mjs`, `vercel.json` | [HTTP adapters](./docs/components/http-server.md) |
| Share extraction | URL validation, bounded upstream fetching, JSON parsing | `src/share-url.mjs`, `src/extract-conversation.mjs`, `src/parse-share.mjs` | [Share extraction](./docs/components/share-extraction.md) |
| Transcript formatting | Markdown/plain-text generation, filtering, asset links, filenames | `public/format-transcript.js` | [Transcript formatting](./docs/components/transcript-formatting.md) |
| Browser interface | Form workflow, themes, reader/output views, copy/download behavior | `public/index.html`, `public/app.js`, `public/theme-init.js`, `public/styles.css`, `public/favicon.svg` | [Browser interface](./docs/components/browser-ui.md) |
| Verification | Unit, HTTP integration, and opt-in live parser checks | `test/`, `scripts/live-smoke.mjs` | [Testing](./docs/components/testing.md) |

## Common change routes

- Change accepted share URLs or SSRF protections: [Share extraction](./docs/components/share-extraction.md)
- Change upstream fetching or parsing: [Share extraction](./docs/components/share-extraction.md)
- Change API responses, Vercel behavior, or local static serving: [HTTP adapters](./docs/components/http-server.md)
- Change transcript structure or labels: [Transcript formatting](./docs/components/transcript-formatting.md)
- Change controls, user flow, or visual design: [Browser interface](./docs/components/browser-ui.md)
- Add coverage or diagnose a parser-format change: [Testing](./docs/components/testing.md)
