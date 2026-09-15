export type VideoInvalidatorConfig = {
  url: string
  helperKey: string
}

// Invalidates transcoded video content associated with a source blob.
// @NOTE this does not remove the blob from PDS storage.
export class VideoInvalidator {
  readonly invalidate: (did: string, cid: string) => Promise<void>

  constructor(cfg: VideoInvalidatorConfig) {
    this.invalidate = async (did: string, cid: string) => {
      const url = new URL(cfg.url)
      url.searchParams.set('did', did)
      url.searchParams.set('cid', cid)

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'helper-key': cfg.helperKey },
      })
      if (!res.ok) {
        throw new Error(`Video invalidation failed with status ${res.status}`)
      }
    }
  }
}
