import type { IncomingHttpHeaders } from 'node:http'

// @NOTE `x-bsky-topics` is deprecated; use `x-atproto-bsky-topics`.
const LEGACY_TOPIC_HEADER = 'x-bsky-topics'

export function getAtprotoPassthroughHeaders(req: {
  headers: IncomingHttpHeaders
}): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const [name, value] of Object.entries(req.headers)) {
    if (
      (name.startsWith('x-atproto-') || name === LEGACY_TOPIC_HEADER) &&
      value != null
    ) {
      headers[name] = Array.isArray(value) ? value.join(',') : value
    }
  }

  const topics =
    req.headers['x-atproto-bsky-topics'] ?? req.headers[LEGACY_TOPIC_HEADER]
  if (topics != null) {
    headers['x-atproto-bsky-topics'] = Array.isArray(topics)
      ? topics.join(',')
      : topics
  }

  return headers
}
