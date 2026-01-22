import { AtUri } from '@atproto/syntax'
import { StrongRef, parseStrongRef } from '../views/types.js'

/**
 * Convert a post URI to a threadgate URI. If the URI is not a valid
 * post URI, return URI unchanged. Threadgate lookups will then fail.
 */
export function postUriToThreadgateUri(postUri: string) {
  const urip = new AtUri(postUri)
  if (urip.collection === 'app.bsky.feed.post') {
    urip.collection = 'app.bsky.feed.threadgate'
  }
  return urip.toString()
}

/**
 * Convert a post URI to a postgate URI. If the URI is not a valid
 * post URI, return URI unchanged. Postgate lookups will then fail.
 */
export function postUriToPostgateUri(postUri: string) {
  const urip = new AtUri(postUri)
  if (urip.collection === 'app.bsky.feed.post') {
    urip.collection = 'app.bsky.feed.postgate'
  }
  return urip.toString()
}

export function uriToDid(uri: string) {
  return new AtUri(uri).did
}

// @TODO temp fix for proliferation of invalid pinned post values
export function safePinnedPost(value: unknown) {
  if (!value || typeof value !== 'object') {
    return
  }
  const validated = parseStrongRef(value)
  if (!validated.success) {
    return
  }
  return validated.value as StrongRef
}
