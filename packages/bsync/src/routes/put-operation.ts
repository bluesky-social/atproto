import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { sql } from 'kysely'
import { ensureValidNsid, ensureValidRecordKey } from '@atproto/syntax'
import { AppContext } from '../context'
import { Database } from '../db'
import { OperationMethod, createOperationChannel } from '../db/schema/operation'
import { Service } from '../proto/bsync_connect'
import {
  Method,
  PutOperationRequest,
  PutOperationResponse,
} from '../proto/bsync_pb'
import { authWithApiKey } from './auth'
import { isValidDid } from './util'

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
        collection: op.collection,
        actorDid: op.actorDid,
        rkey: op.rkey,
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
      collection: op.collection,
      actorDid: op.actorDid,
      rkey: op.rkey,
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
    ensureValidNsid(req.collection)
  } catch (error) {
    throw new ConnectError(
      'operation collection is invalid NSID',
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
    ensureValidRecordKey(req.rkey)
  } catch (error) {
    throw new ConnectError('operation rkey is required', Code.InvalidArgument)
  }

  if (
    req.method !== Method.CREATE &&
    req.method !== Method.UPDATE &&
    req.method !== Method.DELETE
  ) {
    throw new ConnectError('operation method is invalid', Code.InvalidArgument)
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
  collection: string
  actorDid: string
  rkey: string
  payload: Uint8Array
  method: OperationMethod
}
