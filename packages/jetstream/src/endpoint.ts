const ENDPOINTS = [
  // 'wss://jetstream1.us-east.bsky.network/subscribe',
  'wss://jetstream2.us-east.bsky.network/subscribe',
  'wss://jetstream1.us-west.bsky.network/subscribe',
  'wss://jetstream2.us-west.bsky.network/subscribe',
] as const

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
  endpoint = ENDPOINTS[(Math.random() * ENDPOINTS.length) | 0],
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

  if (cursor) {
    url.searchParams.set('cursor', cursor.toString())
  }

  if (compress) {
    url.searchParams.set('compress', 'true')
  }

  return url
}
