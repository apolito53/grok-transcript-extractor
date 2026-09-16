const ALLOWED_HOSTS = new Set([
  "grok.com",
  "www.grok.com",
]);

const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;

export class ShareUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = "ShareUrlError";
  }
}

export function normalizeShareUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ShareUrlError("Paste a public Grok share link first.");
  }

  const rawValue = value.trim();
  const withScheme = /^https?:\/\//i.test(rawValue)
    ? rawValue
    : `https://${rawValue}`;

  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ShareUrlError("That does not look like a valid URL.");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:"
    || !ALLOWED_HOSTS.has(hostname)
    || url.username
    || url.password
    || url.port
  ) {
    if (hostname === "x.com" || hostname === "www.x.com" || hostname.endsWith(".x.com")) {
      throw new ShareUrlError(
        "X Grok share links are not supported yet. Use a public https://grok.com/share/... link.",
      );
    }

    throw new ShareUrlError(
      "Use a public https://grok.com/share/... conversation link.",
    );
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const shareId = segments[1];

  if (segments[0] === "c") {
    throw new ShareUrlError(
      "That is a private chat link. In Grok, choose Share and copy the public /share/ link.",
    );
  }

  if (
    segments[0] !== "share"
    || segments.length !== 2
    || !shareId
    || !SHARE_ID_PATTERN.test(shareId)
  ) {
    throw new ShareUrlError(
      "Use a public Grok conversation link ending in /share/<conversation-id>.",
    );
  }

  return {
    shareId,
    url: `https://grok.com/share/${shareId}`,
  };
}

export function shareApiUrl(shareId) {
  return `https://grok.com/rest/app-chat/share_links/${encodeURIComponent(shareId)}?useChunk=true`;
}
