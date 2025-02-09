import { allFulfilled } from '@atproto/common'
import { ImageInvalidator } from './types'

export type BunnyConfig = {
  accessKey: string
  urlPrefix: string
}

const API_PURGE_URL = 'https://api.bunny.net/purge'

export class BunnyInvalidator implements ImageInvalidator {
  constructor(public cfg: BunnyConfig) {}
  async invalidate(_subject: string, paths: string[]) {
    await allFulfilled(
      paths.map(async (path) =>
        purgeUrl({
          url: this.cfg.urlPrefix + path,
          accessKey: this.cfg.accessKey,
        }),
      ),
    )
  }
}

export default BunnyInvalidator

async function purgeUrl(opts: { accessKey: string; url: string }) {
  const search = new URLSearchParams()
  search.set('async', 'true')
  search.set('url', opts.url)
  await fetch(API_PURGE_URL + '?' + search.toString(), {
    method: 'post',
    headers: { AccessKey: opts.accessKey },
  })
}
