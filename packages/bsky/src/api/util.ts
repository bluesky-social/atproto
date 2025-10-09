import http from 'node:http'
import { Registry } from 'prom-client'
import { httpLogger } from '../logger'
import { ParsedLabelers, formatLabelerHeader } from '../util'

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

export const createMetricsServer = (registry: Registry) => {
  return http.createServer(async (req, res) => {
    try {
      if (req.url === '/metrics') {
        res.statusCode = 200
        res.setHeader('content-type', registry.contentType)
        return res.end(await registry.metrics())
      }
      res.statusCode = 404
      res.setHeader('content-type', 'text/plain')
      return res.end('not found')
    } catch (err) {
      httpLogger.error({ err }, 'internal server error')
      res.statusCode = 500
      res.setHeader('content-type', 'text/plain')
      return res.end('internal server error')
    }
  })
}
