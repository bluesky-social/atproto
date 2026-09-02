import type { ConnectRouter } from '@connectrpc/connect'
import { sql } from 'kysely'
import { ATTR_BSYNC_NAMESPACE } from '@atproto-labs/opentelemetry-node/conventions'
import type { AppContext } from '../context.js'
import { Service } from '../proto/bsync_connect.js'
import { operationAttributes } from '../telemetry/attributes.js'
import { withRpcServerTelemetry } from '../telemetry/rpc.js'
import addMuteOperation from './add-mute-operation.js'
import addNotifOperation from './add-notif-operation.js'
import deleteOperations from './delete-operations.js'
import putOperation from './put-operation.js'
import scanMuteOperations from './scan-mute-operations.js'
import scanNotifOperations from './scan-notif-operations.js'
import scanOperations from './scan-operations.js'

export default (ctx: AppContext) => (router: ConnectRouter) => {
  return router.service(
    Service,
    withRpcServerTelemetry(
      {
        ...addMuteOperation(ctx),
        ...scanMuteOperations(ctx),
        ...addNotifOperation(ctx),
        ...scanNotifOperations(ctx),
        ...putOperation(ctx),
        ...scanOperations(ctx),
        ...deleteOperations(ctx),
        async ping() {
          const { db } = ctx
          await sql`select 1`.execute(db.db)
          return {}
        },
      },
      {
        putOperation: operationAttributes,
        deleteOperationsByActorAndNamespace: (req) => ({
          [ATTR_BSYNC_NAMESPACE]: req.namespace,
        }),
      },
    ),
  )
}
