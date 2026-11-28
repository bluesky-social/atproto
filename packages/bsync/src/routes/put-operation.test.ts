import type { PartialMessage } from '@bufbuild/protobuf'
import { Code } from '@connectrpc/connect'
import { describe, expect, test } from 'vitest'
import { Method, type PutOperationRequest } from '../proto/bsync_pb.js'
import { createTestClient, isConnectError } from './_test-client.test.js'

describe('putOperation', () => {
  const client = createTestClient()

  const valid: PartialMessage<PutOperationRequest> = {
    actorDid: 'did:example:a',
    namespace: 'app.bsky.some.col',
    key: 'key1',
    method: Method.CREATE,
    payload: Buffer.from(JSON.stringify({ value: 0 })),
  }
  const invalidPayload = Buffer.from('{invalid json}')

  test.each<{
    note: string
    req: PartialMessage<PutOperationRequest>
    message: string
  }>([
    {
      note: 'an invalid namespace',
      req: { namespace: 'bad-namespace' },
      message: 'operation namespace is invalid NSID',
    },
    {
      note: 'an invalid actor did',
      req: { actorDid: 'bad-did' },
      message: 'operation actor_did is invalid DID',
    },
    {
      note: 'an empty key',
      req: { key: '' },
      message: 'operation key is required',
    },
    {
      note: 'an unspecified method',
      req: { method: Method.UNSPECIFIED },
      message: 'operation method is invalid',
    },
    {
      note: 'an invalid JSON payload on create',
      req: { method: Method.CREATE, payload: invalidPayload },
      message: 'payload must be a valid JSON when method is CREATE or UPDATE',
    },
    {
      note: 'an invalid JSON payload on update',
      req: { method: Method.UPDATE, payload: invalidPayload },
      message: 'payload must be a valid JSON when method is CREATE or UPDATE',
    },
    {
      note: 'a payload on delete',
      req: { method: Method.DELETE },
      message: 'cannot specify a payload when method is DELETE',
    },
  ])('rejects $note', ({ req, message }) =>
    expect(client.putOperation({ ...valid, ...req })).rejects.toSatisfy(
      isConnectError(message, Code.InvalidArgument),
    ),
  )
})
