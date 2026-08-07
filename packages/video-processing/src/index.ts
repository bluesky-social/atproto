export * from './types'
export { CloudflareStreamClient } from './cloudflare-stream'
export type { CloudflareStreamConfig } from './cloudflare-stream'
export { HttpReadinessChecker } from './readiness'
export { StreamUidMismatchError, VideoJobService } from './job-service'

/** Build the gateway URL Stream (or ops) can use to fetch the original MP4. */
export function mediaSourceUrl(
  cdnUrl: string,
  did: string,
  videoCid: string,
): string {
  const base = cdnUrl.replace(/\/+$/, '')
  return `${base}/v1/media/${encodeURIComponent(did)}/${encodeURIComponent(videoCid)}`
}

/**
 * Reject arbitrary fetch targets for Stream copy (SSRF guard).
 * Only same-origin media-gateway `/v1/media/:did/:cid` URLs are allowed.
 */
export function isAllowedMediaSourceUrl(
  sourceUrl: string,
  cdnUrl: string,
): boolean {
  let source: URL
  let cdn: URL
  try {
    source = new URL(sourceUrl)
    cdn = new URL(cdnUrl.includes('://') ? cdnUrl : `https://${cdnUrl}`)
  } catch {
    return false
  }
  if (source.protocol !== 'http:' && source.protocol !== 'https:') return false
  if (source.username || source.password) return false
  if (source.host !== cdn.host) return false
  const parts = source.pathname.split('/').filter(Boolean)
  // v1 / media / :did / :cid
  return parts.length === 4 && parts[0] === 'v1' && parts[1] === 'media'
}

/** Optional mirrored HLS object prefix under private R2. */
export function videoAssetKeyPrefix(did: string, videoCid: string): string {
  return `video/${did}/${videoCid}`
}
