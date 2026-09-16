import { parseGrokSharePayload, GrokShareParseError } from "./parse-share.mjs";
import { normalizeShareUrl, shareApiUrl, ShareUrlError } from "./share-url.mjs";

const MAX_SHARE_PAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

export const GROK_SHARE_HEADERS = {
  Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
  "User-Agent": "GrokTranscriptExtractor/0.1",
};

export class ExtractorHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ExtractorHttpError";
    this.status = status;
  }
}

export function publicErrorDetails(error) {
  if (error instanceof ShareUrlError) {
    return { status: 400, message: error.message, unexpected: false };
  }
  if (error instanceof ExtractorHttpError) {
    return { status: error.status, message: error.message, unexpected: false };
  }
  return {
    status: 500,
    message: "Something unexpected went wrong while extracting the conversation.",
    unexpected: true,
  };
}

async function responseTextWithLimit(response, limit) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > limit) {
    throw new ExtractorHttpError(502, "That shared conversation is too large to process safely.");
  }

  if (!response.body) {
    return "";
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) {
      throw new ExtractorHttpError(502, "That shared conversation is too large to process safely.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function mapUpstreamStatus(status) {
  if (status === 404 || status === 410) {
    throw new ExtractorHttpError(404, "That shared conversation was not found. It may have been deleted or unshared.");
  }
  if (status === 401 || status === 403) {
    throw new ExtractorHttpError(403, "Grok would not allow public access to that link. It may have been revoked.");
  }
  if (status === 429) {
    throw new ExtractorHttpError(429, "Grok is rate limiting requests. Give it a minute and try again.");
  }
  throw new ExtractorHttpError(502, `Grok returned an unexpected ${status} response.`);
}

async function fetchSharePayload(apiUrl, fetchImpl) {
  let currentUrl = apiUrl;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    let response;
    try {
      response = await fetchImpl(currentUrl, {
        headers: GROK_SHARE_HEADERS,
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        throw new ExtractorHttpError(504, "Grok took too long to respond. Try again in a moment.");
      }
      throw new ExtractorHttpError(502, "Could not reach Grok. Try again in a moment.");
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === 3) {
        throw new ExtractorHttpError(502, "Grok returned an unexpected redirect.");
      }
      const redirected = new URL(location, currentUrl);
      if (redirected.protocol !== "https:" || !["grok.com", "www.grok.com"].includes(redirected.hostname)) {
        throw new ExtractorHttpError(502, "Grok redirected outside its public share API.");
      }
      currentUrl = redirected.href;
      continue;
    }

    if (!response.ok) {
      mapUpstreamStatus(response.status);
    }

    return responseTextWithLimit(response, MAX_SHARE_PAGE_BYTES);
  }

  throw new ExtractorHttpError(502, "Grok returned too many redirects.");
}

export async function extractConversation(value, overrides = {}) {
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch;
  const parsePayload = overrides.parsePayload ?? parseGrokSharePayload;
  const normalized = normalizeShareUrl(value);
  const apiUrl = overrides.apiUrl ?? shareApiUrl(normalized.shareId);
  const raw = await fetchSharePayload(apiUrl, fetchImpl);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new ExtractorHttpError(
      502,
      "The share API responded, but the conversation data was unreadable. Grok may have changed its share format.",
    );
  }

  if (payload && payload.isPublic === false) {
    throw new ExtractorHttpError(403, "That share link is no longer public.");
  }

  let conversation;
  try {
    conversation = parsePayload(payload);
  } catch (error) {
    if (error instanceof GrokShareParseError || error instanceof Error) {
      throw new ExtractorHttpError(
        502,
        "The page loaded, but its conversation data was unreadable. Grok may have changed its share format.",
      );
    }
    throw error;
  }

  if (!conversation?.replies?.length) {
    throw new ExtractorHttpError(422, "That share link did not contain any readable conversation messages.");
  }

  return {
    conversation,
    sourceUrl: normalized.url,
  };
}
