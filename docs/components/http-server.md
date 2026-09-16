# HTTP adapters

`local-server.mjs` serves `public/` and `POST /api/extract`. `api/extract.mjs` is the Vercel Function with the same contract.

Both adapters:

- Accept only POST JSON `{ "url": "..." }`
- Cap request bodies at 16 KB
- Return `{ conversation, sourceUrl }` or `{ error }`
- Never persist extracted conversations

`createApp(overrides)` and `createVercelFunction(overrides)` accept `fetchImpl` and `parsePayload` so tests can stay offline.
