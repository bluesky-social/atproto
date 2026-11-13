import { describe, expect, it } from 'vitest'
import { TID } from '@atproto/common'
import { type OpThreadReply, resolveCanonicalOpThread } from './op-thread.js'

const BASE_TIMESTAMP_MS = 1_700_000_000_000

const postUri = (offsetMs: number) =>
  `at://did:plc:op/app.bsky.feed.post/${TID.fromTime(
    (BASE_TIMESTAMP_MS + offsetMs) * 1000,
    0,
  ).toString()}`

const deletedAt = (offsetMs: number) =>
  new Date(BASE_TIMESTAMP_MS + offsetMs).toISOString()

const reply = (
  uri: string,
  parentUri: string,
  deletedAt: string | null = null,
): OpThreadReply => ({ uri, parentUri, deletedAt })

describe(resolveCanonicalOpThread, () => {
  it('selects the oldest contiguous OP reply chain', () => {
    const root = postUri(1)
    const first = postUri(2)
    const fork = postUri(3)
    const second = postUri(4)

    expect(
      resolveCanonicalOpThread(root, [
        reply(fork, root),
        reply(second, first),
        reply(first, root),
      ]),
    ).toEqual([root, first, second])
  })

  it('keeps a deleted middle reply while a descendant survives', () => {
    const root = postUri(1)
    const first = postUri(2)
    const second = postUri(3)

    expect(
      resolveCanonicalOpThread(root, [
        reply(first, root, deletedAt(4)),
        reply(second, first),
      ]),
    ).toEqual([root, first, second])
  })

  it('only lets a reply newer than a tail deletion claim its slot', () => {
    const root = postUri(1)
    const deleted = postUri(2)
    const bystander = postUri(3)
    const replacement = postUri(5)

    expect(
      resolveCanonicalOpThread(root, [
        reply(deleted, root, deletedAt(4)),
        reply(bystander, root),
        reply(replacement, root),
      ]),
    ).toEqual([root, replacement])
  })

  it('rejects cycles in denormalized reply rows', () => {
    const root = postUri(1)
    const first = postUri(2)

    expect(
      resolveCanonicalOpThread(root, [reply(first, root), reply(root, first)]),
    ).toBeUndefined()
  })
})
