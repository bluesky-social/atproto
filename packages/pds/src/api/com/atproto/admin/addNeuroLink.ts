// BACKWARDS-COMPAT SHIM — delegates to eu.wsocial.admin.addNeuroLink.
// Safe to delete after September 2026 once all pds-wadmin deployments have
// been updated to call eu.wsocial.admin.addNeuroLink directly.
import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import * as impl from '../../../eu/wsocial/admin/neuroLinkHandlers'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.addNeuroLink({
    auth: ctx.authVerifier.adminToken,
    handler: ({ input, req }) => impl.addNeuroLink(ctx, input.body, req.log),
  })
}
