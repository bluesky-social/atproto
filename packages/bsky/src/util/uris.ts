import { AtUri, DidString } from '@atproto/syntax'
import { app } from '../lexicons/index.js'
import { StrongRef, validateStrongRef } from '../views/types.js'

/**
 * Convert a post URI to a threadgate URI. If the URI is not a valid
 * post URI, return URI unchanged. Threadgate lookups will then fail.
 */
export function postUriToThreadgateUri(postUri: string) {
  const urip = new AtUri(postUri)
  if (urip.collection === app.bsky.feed.post.$type) {
    urip.collection = app.bsky.feed.threadgate.$type
  }
  return urip.toString()
}

/**
 * Convert a post URI to a postgate URI. If the URI is not a valid
 * post URI, return URI unchanged. Postgate lookups will then fail.
 */
export function postUriToPostgateUri(postUri: string) {
  const urip = new AtUri(postUri)
  if (urip.collection === app.bsky.feed.post.$type) {
    urip.collection = app.bsky.feed.postgate.$type
  }
  return urip.toString()
}

export function uriToDid(uri: string): DidString {
  // @NOTE URIs returned from the dataplane are always in DID form.
  return new AtUri(uri).hostname as DidString
}

// @TODO temp fix for proliferation of invalid pinned post values
export function safePinnedPost(value: unknown): StrongRef | undefined {
  const validated = validateStrongRef(value)
  return validated.success ? validated.value : undefined
}
