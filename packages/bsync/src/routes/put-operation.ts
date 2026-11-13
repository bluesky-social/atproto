import { Code, ConnectError, type ServiceImpl } from '@connectrpc/connect'
import { sql } from 'kysely'
import { ensureValidRecordKey } from '@atproto/syntax'
import type { AppContext } from '../context.js'
import type { Database } from '../db/index.js'
import {
  type OperationMethod,
  createOperationChannel,
} from '../db/schema/operation.js'
import type { Service } from '../proto/bsync_connect.js'
import {
  Method,
  type PutOperationRequest,
  PutOperationResponse,
} from '../proto/bsync_pb.js'
import { authWithApiKey } from './auth.js'
import { isValidDid, validateNamespace } from './util.js'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async putOperation(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)
    const { db } = ctx
    const op = validateOp(req)
    const id = await db.transaction(async (txn) => {
      return putOp(txn, op)
    })
    return new PutOperationResponse({
      operation: {
        id: String(id),
        actorDid: op.actorDid,
        namespace: op.namespace,
        key: op.key,
        method: op.method,
        payload: op.payload,
      },
    })
  },
})

const putOp = async (db: Database, op: Operation) => {
  const { ref } = db.db.dynamic
  const { id } = await db.db
    .insertInto('operation')
    .values({
      actorDid: op.actorDid,
      namespace: op.namespace,
      key: op.key,
      method: op.method,
      payload: op.payload,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await sql`notify ${ref(createOperationChannel)}`.execute(db.db) // emitted transactionally
  return id
}

const validateOp = (req: PutOperationRequest): Operation => {
  try {
    validateNamespace(req.namespace)
  } catch (error) {
    throw new ConnectError(
      'operation namespace is invalid NSID',
      Code.InvalidArgument,
    )
  }

  if (!isValidDid(req.actorDid)) {
    throw new ConnectError(
      'operation actor_did is invalid DID',
      Code.InvalidArgument,
    )
  }

  try {
    ensureValidRecordKey(req.key)
  } catch (error) {
    throw new ConnectError('operation key is required', Code.InvalidArgument)
  }

  if (
    req.method !== Method.CREATE &&
    req.method !== Method.UPDATE &&
    req.method !== Method.DELETE
  ) {
    throw new ConnectError('operation method is invalid', Code.InvalidArgument)
  }

  if (req.method === Method.CREATE || req.method === Method.UPDATE) {
    try {
      JSON.parse(new TextDecoder().decode(req.payload))
    } catch (error) {
      throw new ConnectError(
        'payload must be a valid JSON when method is CREATE or UPDATE',
        Code.InvalidArgument,
      )
    }
  }

  if (req.method === Method.DELETE && req.payload.length > 0) {
    throw new ConnectError(
      'cannot specify a payload when method is DELETE',
      Code.InvalidArgument,
    )
  }

  return req as Operation
}

type Operation = {
  actorDid: string
  namespace: string
  key: string
  payload: Uint8Array<ArrayBuffer>
  method: OperationMethod
}
