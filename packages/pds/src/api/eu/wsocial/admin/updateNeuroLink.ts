import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import * as impl from './neuroLinkHandlers'

export default function (server: Server, ctx: AppContext) {
  server.eu.wsocial.admin.updateNeuroLink({
    auth: ctx.authVerifier.adminToken,
    handler: ({ input, req }) => impl.updateNeuroLink(ctx, input.body, req.log),
  })
}
