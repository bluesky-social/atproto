import { IncomingHttpHeaders } from 'node:http'
import { ServerConfig } from '../config.js'
import { ParsedLabelers, formatLabelerHeader } from '../util.js'

export const BSKY_USER_AGENT = 'BskyAppView'
export const ATPROTO_CONTENT_LABELERS = 'Atproto-Content-Labelers'
export const ATPROTO_REPO_REV = 'Atproto-Repo-Rev'

type ResHeaderOpts = {
  labelers: ParsedLabelers
  repoRev: string | null
}

export const resHeaders = (
  opts: Partial<ResHeaderOpts>,
): Record<string, string> => {
  const headers = {}
  if (opts.labelers) {
    headers[ATPROTO_CONTENT_LABELERS] = formatLabelerHeader(opts.labelers)
  }
  if (opts.repoRev) {
    headers[ATPROTO_REPO_REV] = opts.repoRev
  }
  return headers
}

export const clearlyBadCursor = (cursor?: string) => {
  // hallmark of v1 cursor, highly unlikely in v2 cursors based on time or rkeys
  return !!cursor?.includes('::')
}

// @TEMPORARY backdoor to force search v2 via a request header, gated by the
// BSKY_SEARCH_V2_OVERRIDE_HEADER env var. Remove once search v2 is fully rolled out.
const SEARCH_V2_OVERRIDE_HEADER = 'x-bsky-search-v2-override'

export const resolveSearchV2Override = (
  req: { headers: IncomingHttpHeaders },
  cfg: ServerConfig,
): boolean => {
  const expected = cfg.searchV2OverrideHeader
  if (!expected) return false
  const value = req.headers[SEARCH_V2_OVERRIDE_HEADER]
  const header = Array.isArray(value) ? value.join(',') : value
  return header === expected
}
