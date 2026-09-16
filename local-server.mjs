import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import {
  extractConversation,
  ExtractorHttpError,
  publicErrorDetails,
} from "./src/extract-conversation.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const MAX_REQUEST_BYTES = 16 * 1024;

const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/format-transcript.js", ["format-transcript.js", "text/javascript; charset=utf-8"]],
  ["/theme-init.js", ["theme-init.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/favicon.svg", ["favicon.svg", "image/svg+xml"]],
]);

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) {
      throw new ExtractorHttpError(413, "That request is too large.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ExtractorHttpError(400, "Send a valid JSON request.");
  }
}

async function serveStatic(request, response, pathname) {
  const entry = STATIC_FILES.get(pathname);
  if (!entry || !["GET", "HEAD"].includes(request.method)) {
    return false;
  }

  const [filename, contentType] = entry;
  const filePath = join(PUBLIC_DIR, filename);
  const details = await stat(filePath);
  response.writeHead(200, {
    ...SECURITY_HEADERS,
    "Cache-Control": filename === "index.html" ? "no-cache" : "public, max-age=3600",
    "Content-Length": details.size,
    "Content-Type": contentType,
  });

  if (request.method === "HEAD") {
    response.end();
  } else {
    createReadStream(filePath).pipe(response);
  }
  return true;
}

export function createApp(overrides = {}) {
  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    try {
      if (request.method === "POST" && requestUrl.pathname === "/api/extract") {
        const body = await readJson(request);
        const result = await extractConversation(body?.url, overrides);
        sendJson(response, 200, result);
        return;
      }

      if (await serveStatic(request, response, requestUrl.pathname)) {
        return;
      }

      if (requestUrl.pathname === "/api/extract") {
        sendJson(response, 405, { error: "Use POST for this endpoint." }, { Allow: "POST" });
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const details = publicErrorDetails(error);
      if (details.unexpected) {
        console.error(error);
      }
      sendJson(response, details.status, { error: details.message });
    }
  });
}

const isMainModule = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const port = Number(process.env.PORT) || 3000;
  const server = createApp();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Grok Transcript Extractor is running at http://localhost:${port}`);
  });
}
