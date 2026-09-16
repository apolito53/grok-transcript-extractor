import { GROK_SHARE_HEADERS } from "../src/extract-conversation.mjs";
import { parseGrokSharePayload } from "../src/parse-share.mjs";
import { normalizeShareUrl, shareApiUrl } from "../src/share-url.mjs";

const input = process.env.GROK_SHARE_URL || process.argv[2];
if (!input) {
  console.error("Usage: npm run test:live -- https://grok.com/share/<conversation-id>");
  process.exitCode = 1;
} else {
  const { shareId } = normalizeShareUrl(input);
  const response = await fetch(shareApiUrl(shareId), {
    headers: GROK_SHARE_HEADERS,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Grok returned ${response.status}.`);
  }
  const conversation = parseGrokSharePayload(JSON.parse(await response.text()));
  console.log(`${conversation.title || "Untitled"}: ${conversation.replies.length} readable messages`);
}
