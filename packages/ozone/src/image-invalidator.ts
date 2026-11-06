// Invalidation is a general interface for propagating an image blob
// takedown through any caches where a representation of it may be stored.
// @NOTE this does not remove the blob from storage: just invalidates it from caches.
// @NOTE keep in sync with same interface in aws/src/cloudfront.ts
export interface ImageInvalidator {
  invalidate(subject: string, paths: string[]): Promise<void>
}

export interface RenditionCacheController {
  invalidate(did: string, cid: string): Promise<void>
  restore(did: string, cid: string): Promise<void>
}

export type RenditionCacheConfig = {
  endpoint: string
  token: string
}

// Controls only the renderer's shared completed-rendition cache. The original
// blob lifecycle and Bunny/CloudFront invalidation remain separate operations.
export class RenditionCacheInvalidator implements RenditionCacheController {
  private readonly endpoint: string
  private readonly token: string

  constructor(cfg: RenditionCacheConfig) {
    const endpoint = new URL(cfg.endpoint)
    if (
      (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') ||
      endpoint.username ||
      endpoint.password ||
      endpoint.pathname !== '/' ||
      endpoint.search ||
      endpoint.hash
    ) {
      throw new Error('rendition cache endpoint must be a bare HTTP(S) origin')
    }
    if (Buffer.byteLength(cfg.token, 'utf8') < 32) {
      throw new Error('rendition cache token must be at least 32 bytes')
    }
    this.endpoint = cfg.endpoint.replace(/\/$/, '')
    this.token = cfg.token
  }

  invalidate(did: string, cid: string) {
    return this.post('/internal/v1/source/invalidate', did, cid)
  }

  restore(did: string, cid: string) {
    return this.post('/internal/v1/source/restore', did, cid)
  }

  private async post(operation: string, did: string, cid: string) {
    const response = await fetch(this.endpoint + operation, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ did, cid }),
      signal: AbortSignal.timeout(5000),
    })
    if (response.status !== 200) {
      throw new Error(
        `rendition cache request failed with status ${response.status}`,
      )
    }
  }
}
