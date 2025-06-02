import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import {
  Create,
  Delete,
  Update,
  isCreate,
  isDelete,
  isUpdate,
} from '../../../../lexicon/types/app/bsky/unspecced/applyPrivateWrite'
import { $Typed } from '../../../../lexicon/util'
import { Method } from '../../../../proto/bsync_pb'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.unspecced.applyPrivateWrite({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, input }) => {
      const actorDid = auth.credentials.iss
      const { write } = input.body

      const preparedWrite: PreparedWrite = await prepareWrite(actorDid, write)

      await ctx.bsyncClient.putOperation({
        actorDid,
        collection: preparedWrite.collection,
        rkey: preparedWrite.rkey,
        method: preparedWrite.method,
        payload: preparedWrite.payload,
      })

      return {
        encoding: 'application/json',
        body: {
          result: {
            $type: preparedWrite.$type,
            rkey: preparedWrite.rkey,
          },
        },
      }
    },
  })
}

type PreparedWrite = PreparedCreate | PreparedUpdate | PreparedDelete

type PreparedCreate = {
  $type: 'app.bsky.unspecced.applyPrivateWrite#createResult'
  actorDid: string
  collection: string
  rkey: string
  method: Method.CREATE
  payload: Uint8Array
}

type PreparedUpdate = {
  $type: 'app.bsky.unspecced.applyPrivateWrite#updateResult'
  actorDid: string
  collection: string
  rkey: string
  method: Method.UPDATE
  payload: Uint8Array
}

type PreparedDelete = {
  $type: 'app.bsky.unspecced.applyPrivateWrite#deleteResult'
  actorDid: string
  collection: string
  rkey: string
  method: Method.DELETE
  payload: undefined
}

const prepareWrite = (
  actorDid: string,
  write: $Typed<Create> | $Typed<Update> | $Typed<Delete>,
): PreparedWrite | PromiseLike<PreparedWrite> => {
  if (isCreate(write)) {
    return prepareCreate({
      actorDid,
      write,
    })
  } else if (isUpdate(write)) {
    return prepareUpdate({
      actorDid,
      write,
    })
  } else if (isDelete(write)) {
    return prepareDelete({
      actorDid,
      write,
    })
  } else {
    throw new InvalidRequestError(`Action not supported: ${write['$type']}`)
  }
}

const prepareCreate = async (opts: {
  actorDid: string
  write: $Typed<Create>
}): Promise<PreparedCreate> => {
  const { actorDid, write } = opts

  return {
    $type: 'app.bsky.unspecced.applyPrivateWrite#createResult',
    actorDid,
    collection: write.collection,
    // @TODO: properly handle the rkey creation.
    rkey: write.rkey || 'self',
    payload: Buffer.from(JSON.stringify(write.value)),
    method: Method.CREATE,
  }
}

const prepareUpdate = async (opts: {
  actorDid: string
  write: $Typed<Update>
}): Promise<PreparedUpdate> => {
  const { actorDid, write } = opts

  return {
    $type: 'app.bsky.unspecced.applyPrivateWrite#updateResult',
    actorDid,
    collection: write.collection,
    rkey: write.rkey,
    payload: Buffer.from(JSON.stringify(write.value)),
    method: Method.UPDATE,
  }
}

const prepareDelete = async (opts: {
  actorDid: string
  write: $Typed<Delete>
}): Promise<PreparedDelete> => {
  const { actorDid, write } = opts

  return {
    $type: 'app.bsky.unspecced.applyPrivateWrite#deleteResult',
    actorDid,
    collection: write.collection,
    rkey: write.rkey,
    payload: undefined,
    method: Method.DELETE,
  }
}
