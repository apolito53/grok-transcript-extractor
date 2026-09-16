import {
  extractConversation,
  ExtractorHttpError,
  publicErrorDetails,
} from "../src/extract-conversation.mjs";

const MAX_REQUEST_BYTES = 16 * 1024;

function json(payload, options = {}) {
  return Response.json(payload, {
    ...options,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...options.headers,
    },
  });
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new ExtractorHttpError(413, "That request is too large.");
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
    throw new ExtractorHttpError(413, "That request is too large.");
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new ExtractorHttpError(400, "Send a valid JSON request.");
  }
}

export function createVercelFunction(overrides = {}) {
  return {
    async fetch(request) {
      if (request.method !== "POST") {
        return json(
          { error: "Use POST for this endpoint." },
          { status: 405, headers: { Allow: "POST" } },
        );
      }

      try {
        const body = await readJson(request);
        const result = await extractConversation(body?.url, overrides);
        return json(result);
      } catch (error) {
        const details = publicErrorDetails(error);
        if (details.unexpected) {
          console.error(error);
        }
        return json({ error: details.message }, { status: details.status });
      }
    },
  };
}

export default createVercelFunction();
