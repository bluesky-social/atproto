import { Code, ConnectError, ServiceImpl } from '@connectrpc/connect'
import { AppContext } from '../context'
import { Service } from '../proto/bsync_connect'
import { DeleteOperationsByActorAndNamespaceResponse } from '../proto/bsync_pb'
import { authWithApiKey } from './auth'
import { isValidDid, validateNamespace } from './util'

export default (ctx: AppContext): Partial<ServiceImpl<typeof Service>> => ({
  /**
   * This method is responsible for deleting log rows from the bsync db, it has
   * no other downstream effects. This method is called from the dataplane in
   * response to a data deletion request initiated by a moderator in Ozone.
   * It's the final step of the deletion process, basically cleaning up the
   * breadcrumbs that resulted in the state we store in the dataplane.
   */
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
