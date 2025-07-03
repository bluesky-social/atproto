import { randomInt } from 'node:crypto'
import { ENDPOINTS } from '../constants.js'

export type EndpointOptions = {
  /**
   * The full Jetstream endpoint URL.
   */
  endpoint?: string
  /**
   * An array of Collection NSIDs to filter which records you receive on your stream.
   */
  wantedCollections?: string[]
  /**
   * An array of Repo DIDs to filter which records you receive on your stream.
   */
  wantedDids?: string[]
  /**
   * A unix microseconds timestamp cursor to begin playback from
   */
  cursor?: number
  /**
   * Set to true to enable zstd
   *
   * @default false
   * @see {@link https://github.com/bluesky-social/jetstream?tab=readme-ov-file#compression}
   */
  compress?: boolean
}

export function buildUrl({
  endpoint = ENDPOINTS[randomInt(0, ENDPOINTS.length)],
  wantedDids,
  wantedCollections,
  cursor,
  compress = false,
}: EndpointOptions) {
  const url = new URL(endpoint)

  if (wantedDids) {
    for (const did of wantedDids) {
      url.searchParams.append('wantedDids', did)
    }
  }

  if (wantedCollections) {
    for (const collection of wantedCollections) {
      url.searchParams.append('wantedCollections', collection)
    }
  }

  if (typeof cursor === 'number') {
    url.searchParams.set('cursor', cursor.toString())
  }

  if (compress) {
    url.searchParams.set('compress', 'true')
  }

  return url
}
