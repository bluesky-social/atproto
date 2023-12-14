import { BlobCache } from './server'
import { ImageUriBuilder } from './uri'

// Invalidation is a general interface for propagating an image blob
// takedown through any caches where a representation of it may be stored.
// @NOTE this does not remove the blob from storage: just invalidates it from caches.
// @NOTE keep in sync with same interface in aws/src/cloudfront.ts
export interface ImageInvalidator {
  invalidate(subject: string, paths: string[]): Promise<void>
}

export class ImageProcessingServerInvalidator implements ImageInvalidator {
  constructor(private cache: BlobCache) {}
  async invalidate(_subject: string, paths: string[]) {
    const results = await Promise.allSettled(
      paths.map(async (path) => {
        const [, signature] = path.split('/')
        if (!signature) throw new Error('Missing signature')
        const options = ImageUriBuilder.getOptions(path)
        const cacheKey = [
          options.did,
          options.cid.toString(),
          options.preset,
        ].join('::')
        await this.cache.clear(cacheKey)
      }),
    )
    const rejection = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    if (rejection) throw rejection.reason
  }
}
