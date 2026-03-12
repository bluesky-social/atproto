import assert from 'node:assert'
import { AtUri, DidString } from '@atproto/syntax'
import { app } from '../lexicons/index.js'
import { StrongRef, parseStrongRef } from '../views/types.js'

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
  const atUri = new AtUri(uri)
  const { hostname } = atUri
  // @NOTE not using atUri.did to avoid re-validating dids (the URIs should be safe)
  assert(hostname.startsWith('did:'), 'Unexpected uri without DID')
  return hostname as DidString
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
