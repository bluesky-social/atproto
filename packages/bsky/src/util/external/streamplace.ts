import type { place } from '../../lexicons/index.js'
import { getLivestreamUrl } from './record-url.js'

/** Match a stream's viewer URL by origin and path-segment prefix, not raw text. */
export function validateLivestreamForUrl(
  record: place.stream.livestream.Main,
  assumedUrl: string,
): boolean {
  const recordUrl = getLivestreamUrl(record)
  if (!recordUrl) return false

  let assumed: URL
  try {
    assumed = new URL(assumedUrl)
  } catch {
    return false
  }
  const canonical = new URL(recordUrl)
  const path = canonical.pathname.replace(/\/$/, '')
  return (
    assumed.origin === canonical.origin &&
    (assumed.pathname === path || assumed.pathname.startsWith(`${path}/`))
  )
}
