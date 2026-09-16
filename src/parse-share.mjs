export class GrokShareParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "GrokShareParseError";
  }
}

const THINKING_CHANNEL = /think|reason/i;

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unixSeconds(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? Math.round(value / 1000) : Math.round(value);
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.round(parsed / 1000) : null;
}

function chunkParts(chunks) {
  if (!Array.isArray(chunks)) {
    return [];
  }

  const parts = [];
  for (const chunk of chunks) {
    if (typeof chunk === "string" && chunk.trim()) {
      parts.push({ channel: "CHANNEL_ASSISTANT_RESPONSE", text: chunk });
      continue;
    }

    const record = asRecord(chunk);
    if (!record) {
      continue;
    }

    const nested = asRecord(record.text) ? record.text : record;
    const text = typeof nested.text === "string"
      ? nested.text
      : typeof record.message === "string"
        ? record.message
        : "";
    if (!text.trim()) {
      continue;
    }

    parts.push({
      channel: nested.channel || record.channel || "CHANNEL_ASSISTANT_RESPONSE",
      text,
    });
  }
  return parts;
}

function joinParts(parts) {
  return parts.map((part) => part.text.trim()).filter(Boolean).join("\n\n");
}

function senderType(sender) {
  const value = String(sender || "").toLowerCase();
  if (value === "human" || value === "user") {
    return "user";
  }
  if (value === "tool" || value === "function") {
    return "tool";
  }
  return "assistant";
}

function publicAssetUrl(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function collectAssets(response) {
  const assets = [];
  const seen = new Set();

  function push(assetType, url, filename, description) {
    const href = publicAssetUrl(url);
    if (!href || seen.has(href)) {
      return;
    }
    seen.add(href);
    assets.push({
      assetType,
      url: href,
      filename: filename || (assetType === "image" ? "shared-image" : "shared-file"),
      description: description || null,
      downloadable: true,
    });
  }

  for (const url of Array.isArray(response.generatedImageUrls) ? response.generatedImageUrls : []) {
    push("image", url, "generated-image.png", "Generated image");
  }

  for (const attachment of Array.isArray(response.imageAttachments) ? response.imageAttachments : []) {
    const record = asRecord(attachment) || {};
    push("image", record.url || record.uri || record.imageUrl, record.filename || record.name, record.description);
  }

  for (const attachment of Array.isArray(response.fileAttachments) ? response.fileAttachments : []) {
    const record = asRecord(attachment) || {};
    push("file", record.url || record.uri, record.filename || record.name, record.description);
  }

  for (const uri of Array.isArray(response.fileUris) ? response.fileUris : []) {
    push("file", uri, "shared-file", null);
  }

  return assets;
}

function responseStatement(response, type) {
  const direct = typeof response.message === "string" ? response.message.trim() : "";
  if (type === "user") {
    const query = typeof response.query === "string" ? response.query.trim() : "";
    return direct || query || joinParts(chunkParts(response.inputChunks));
  }
  if (direct) {
    return direct;
  }
  return joinParts(chunkParts(response.outputChunks).filter((part) => !THINKING_CHANNEL.test(part.channel)));
}

function thinkingStatement(response) {
  return joinParts(chunkParts(response.outputChunks).filter((part) => THINKING_CHANNEL.test(part.channel)));
}

export function parseGrokSharePayload(payload) {
  const root = asRecord(payload);
  if (!root) {
    throw new GrokShareParseError("Share payload was not an object.");
  }

  const conversation = asRecord(root.conversation) || {};
  const responses = Array.isArray(root.responses) ? root.responses : [];
  const replies = [];
  let aiModel = "";

  for (const raw of responses) {
    const response = asRecord(raw);
    if (!response) {
      continue;
    }

    const type = senderType(response.sender);
    const createdAt = unixSeconds(response.createTime);
    const model = response.model
      || asRecord(asRecord(response.metadata)?.request_metadata)?.model
      || "";
    if (!aiModel && type === "assistant" && model) {
      aiModel = model;
    }

    if (type === "assistant") {
      const thinking = thinkingStatement(response);
      if (thinking) {
        replies.push({
          authorName: "Thinking",
          type: "tool",
          statement: thinking,
          createdAt,
          assets: [],
        });
      }
    }

    const statement = responseStatement(response, type);
    const assets = collectAssets(response);
    if (!statement && !assets.length) {
      continue;
    }

    replies.push({
      authorName: type === "user" ? "You" : type === "tool" ? "Tool" : "Grok",
      type,
      statement,
      createdAt,
      assets,
    });
  }

  if (!replies.length) {
    throw new GrokShareParseError("Share payload did not contain any readable messages.");
  }

  return {
    shareId: conversation.conversationId || "",
    aiModel: aiModel || conversation.systemPromptName || "",
    title: typeof conversation.title === "string" && conversation.title.trim()
      ? conversation.title.trim()
      : "Grok conversation",
    updatedAt: unixSeconds(conversation.modifyTime || conversation.createTime),
    replies,
  };
}
