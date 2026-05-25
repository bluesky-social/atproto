import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import * as impl from './neuroLinkHandlers'

export default function (server: Server, ctx: AppContext) {
  server.eu.wsocial.admin.removeNeuroLink({
    auth: ctx.authVerifier.adminToken,
    handler: ({ input, req }) => impl.removeNeuroLink(ctx, input.body, req.log),
  })
}
