import type { PartialMessage } from '@bufbuild/protobuf'
import { Code } from '@connectrpc/connect'
import { describe, expect, test } from 'vitest'
import {
  type AddMuteOperationRequest,
  MuteOperation_Type,
} from '../proto/bsync_pb.js'
import { createTestClient, isConnectError } from './_test-client.test.js'

describe('addMuteOperation', () => {
  const client = createTestClient()

  test.each<{
    note: string
    req: PartialMessage<AddMuteOperationRequest>
    message: string
  }>([
    {
      note: 'an add with an invalid subject',
      req: {
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'invalid',
      },
      message: 'subject must be a did or aturi on add or remove op',
    },
    {
      note: 'an add without a subject',
      req: { type: MuteOperation_Type.ADD, actorDid: 'did:example:a' },
      message: 'subject must be a did or aturi on add or remove op',
    },
    {
      note: 'an add with an invalid aturi subject',
      req: {
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'at://did:example:b/bad.collection/rkey1',
      },
      message: 'subject must be a did or aturi on add or remove op',
    },
    {
      note: 'an add with an invalid actor did',
      req: {
        type: MuteOperation_Type.ADD,
        actorDid: 'invalid',
        subject: 'did:example:b',
      },
      message: 'actor_did must be a valid did',
    },
    {
      note: 'a remove with an invalid subject',
      req: {
        type: MuteOperation_Type.REMOVE,
        actorDid: 'did:example:a',
        subject: 'invalid',
      },
      message: 'subject must be a did or aturi on add or remove op',
    },
    {
      note: 'a clear with a subject',
      req: {
        type: MuteOperation_Type.CLEAR,
        actorDid: 'did:example:a',
        subject: 'did:example:b',
      },
      message: 'subject must not be set on a clear op',
    },
    {
      note: 'a clear with an invalid actor did',
      req: { type: MuteOperation_Type.CLEAR, actorDid: 'invalid' },
      message: 'actor_did must be a valid did',
    },
    {
      note: 'an unknown operation type',
      req: {
        type: 100 as MuteOperation_Type,
        actorDid: 'did:example:a',
        subject: 'did:example:b',
      },
      message: 'bad mute operation type',
    },
    {
      note: 'a scoped mute of a list',
      req: {
        type: MuteOperation_Type.ADD,
        actorDid: 'did:example:a',
        subject: 'at://did:example:b/app.bsky.graph.list/rkey1',
        onlyReposts: true,
      },
      message: 'mute scopes only apply to actor mutes',
    },
  ])('rejects $note', ({ req, message }) =>
    expect(client.addMuteOperation(req)).rejects.toSatisfy(
      isConnectError(message, Code.InvalidArgument),
    ),
  )
})
