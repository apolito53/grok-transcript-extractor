# Share extraction and URL security

v1 accepts only public `https://grok.com/share/<id>` links.

`src/share-url.mjs` rejects:

- missing or invalid URLs
- private `/c/` conversation links
- `x.com/i/grok/share` links (reserved for v2)
- credentials, custom ports, and lookalike hosts

The extractor does not scrape the share HTML. It fetches:

`https://grok.com/rest/app-chat/share_links/<id>?useChunk=true`

Redirects are followed only while the target stays on `grok.com`. Responses larger than 8 MB are rejected.

`src/parse-share.mjs` normalizes the JSON snapshot into the same conversation shape used by the ChatGPT sibling:

- `title`, `aiModel`, `updatedAt`
- `replies[]` with `type`, `statement`, `createdAt`, `assets`

Human text comes from `message`, `query`, or `inputChunks`. Assistant text comes from `message` or `outputChunks`. Channels matching `/think|reason/i` become optional tool replies labeled `Thinking`.
