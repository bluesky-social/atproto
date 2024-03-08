// Invalidation is a general interface for propagating an image blob
// takedown through any caches where a representation of it may be stored.
// @NOTE this does not remove the blob from storage: just invalidates it from caches.
// @NOTE keep in sync with same interface in aws/src/cloudfront.ts
export interface ImageInvalidator {
  invalidate(subject: string, paths: string[]): Promise<void>
}
