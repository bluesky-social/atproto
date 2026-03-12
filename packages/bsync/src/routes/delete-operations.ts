import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { ensureValidNsid } from '@atproto/syntax'
import { AppContext } from '../context'
import { Service } from '../proto/bsync_connect'
import { DeleteOperationsByActorAndNamespaceResponse } from '../proto/bsync_pb'
import { authWithApiKey } from './auth'
import { isValidDid } from './util'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  async deleteOperationsByActorAndNamespace(req, handlerCtx) {
    authWithApiKey(ctx, handlerCtx)
    const { db } = ctx

    try {
      validateNamespace(req.namespace)
    } catch (error) {
      throw new ConnectError(
        'requested namespace for deletion is invalid NSID',
        Code.InvalidArgument,
      )
    }
    if (!isValidDid(req.actorDid)) {
      throw new ConnectError(
        'requested actor_did for deletion is invalid DID',
        Code.InvalidArgument,
      )
    }

    const deletedRows = await db.db
      .deleteFrom('operation')
      .where('actorDid', '=', req.actorDid)
      .where('namespace', '=', req.namespace)
      .returning('id')
      .execute()
    return new DeleteOperationsByActorAndNamespaceResponse({
      deletedCount: deletedRows.length,
    })
  },
})

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
