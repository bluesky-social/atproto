import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import xrpcInit from './xrpc-init'
import xrpcCallback from './xrpc-callback'
import xrpcStatus from './xrpc-status'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.cfg.quicklogin) {
    return
  }

  xrpcInit(server, ctx)
  xrpcCallback(server, ctx)
  xrpcStatus(server, ctx)
}
