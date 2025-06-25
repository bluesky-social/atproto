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

const validateNamespace = (namespace: string): void => {
  const parts = namespace.split('#')

  if (parts.length !== 1 && parts.length !== 2) {
    throw new Error('namespace must be in the format "nsid[#fragment]"')
  }

  const [nsid, fragment] = parts

  ensureValidNsid(nsid)
  if (fragment && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(fragment)) {
    throw new Error('namespace fragment must be a valid identifier')
  }
}

type Operation = {
  actorDid: string
  namespace: string
  key: string
  payload: Uint8Array
  method: OperationMethod
}
