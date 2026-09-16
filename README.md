# Grok Transcript Extractor

Grok Transcript Extractor turns a public Grok share link into a clean, reusable transcript. Paste a `https://grok.com/share/...` URL, then copy or download the readable conversation as Markdown or plain text.

The application is deliberately small: a dependency-free browser interface calls a narrow server-side extraction endpoint to avoid browser cross-origin restrictions. That endpoint runs as a Vercel Function in production or inside the included Node.js server locally. Conversation content is processed in memory and is not persisted by the application.

This is the Grok counterpart to [chatgpt-transcript-extractor](https://github.com/apolito53/chatgpt-transcript-extractor). v1 accepts public `grok.com/share` links only. X (`x.com/i/grok/share`) links are reserved for v2.

## What it does

- Extracts the readable conversation from public Grok share links
- Produces Markdown and plain-text transcripts
- Offers a conversation reader plus copy and download actions
- Follows the system color scheme with a persistent light/dark theme toggle
- Optionally includes source metadata, timestamps, and thinking / tool traces
- Preserves Markdown and attaches public generated-image URLs when present
- Rejects private chats, X share links, non-Grok URLs, unsafe redirects, and oversized responses

## Quick start

Requires Node.js 20 or newer.

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) and paste a public Grok share link.

## Architecture

```text
Browser UI
   |  POST /api/extract
   v
Extraction endpoint -- validates URL -- fetches grok.com share API
   |
   +-- Grok payload parser -- normalized conversation JSON
                                      |
                                      v
                         browser formatter and reader
```

Unlike ChatGPT share pages, Grok does not embed the full transcript in the HTML document. The extractor reads the public JSON snapshot at:

`GET https://grok.com/rest/app-chat/share_links/<share-id>?useChunk=true`

Human turns usually live in `inputChunks`. Assistant turns usually live in `outputChunks`. Thinking traces are kept as optional tool messages.

## Documentation

- [Codebase index](./CODEBASE_INDEX.md) — lightweight map of components and files
- [HTTP adapters](./docs/components/http-server.md)
- [Share extraction and URL security](./docs/components/share-extraction.md)
- [Transcript formatting](./docs/components/transcript-formatting.md)
- [Browser interface](./docs/components/browser-ui.md)
- [Testing and verification](./docs/components/testing.md)

## Development

```bash
npm run dev
npm test
```

The normal test suite is deterministic and does not use the network. To check the parser against a current public page:

```bash
npm run test:live -- https://grok.com/share/<conversation-id>
```

## Supported links and privacy

The extractor accepts public conversation links on Grok's `/share/` route. Private `/c/` links cannot be extracted without authentication; the application intentionally does not accept Grok credentials or cookies.

Submitted pages are processed in memory and are not stored by the application. Public share links can still be viewed by anyone who has them, and a hosting platform may apply its own request-logging policy.

## Deployment

### Vercel

Import the repository as a Vercel project. The checked-in `vercel.json` serves `public/` as the static site and deploys `api/extract.mjs` as the `/api/extract` Node.js Function. No dashboard build overrides or environment variables are required.

### Node or Docker

Run the application as one Node.js process with `npm start`. Set `PORT` when required by the hosting environment. No database or persistent volume is needed.

A production container is also included:

```bash
docker build -t grok-transcript-extractor .
docker run --rm -p 3000:3000 grok-transcript-extractor
```
