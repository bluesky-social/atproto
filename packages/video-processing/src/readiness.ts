import type { ReadinessChecker } from './types'

/**
 * Confirms a master playlist is retrievable. Optionally follows the first
 * media playlist URI and HEADs the first segment when present.
 */
export class HttpReadinessChecker implements ReadinessChecker {
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async isReady(playlistUrl: string): Promise<boolean> {
    const master = await this.fetchImpl(playlistUrl, { method: 'HEAD' })
    if (!master.ok) {
      const get = await this.fetchImpl(playlistUrl, { method: 'GET' })
      if (!get.ok) return false
      const text = await get.text()
      return hasMediaPlaylistOrSegment(text, playlistUrl, this.fetchImpl)
    }
    // HEAD alone is enough for Stream-hosted masters; still GET when possible.
    const get = await this.fetchImpl(playlistUrl, { method: 'GET' })
    if (!get.ok) return true
    const text = await get.text()
    return hasMediaPlaylistOrSegment(text, playlistUrl, this.fetchImpl)
  }
}

async function hasMediaPlaylistOrSegment(
  masterText: string,
  masterUrl: string,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  const lines = masterText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  if (lines.length === 0) {
    // Empty body after HEAD-ok Stream responses — treat master HEAD success as ready.
    return true
  }
  const first = resolveUrl(masterUrl, lines[0])
  const media = await fetchImpl(first, { method: 'GET' })
  if (!media.ok) return false
  if (first.endsWith('.ts') || first.includes('.ts?')) return true
  const mediaText = await media.text()
  const seg = mediaText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'))
  if (!seg) return false
  const segUrl = resolveUrl(first, seg)
  const segRes = await fetchImpl(segUrl, { method: 'HEAD' })
  if (segRes.ok) return true
  const segGet = await fetchImpl(segUrl, { method: 'GET' })
  return segGet.ok
}

function resolveUrl(base: string, ref: string): string {
  try {
    return new URL(ref, base).toString()
  } catch {
    return ref
  }
}
