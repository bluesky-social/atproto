import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import * as impl from './neuroLinkHandlers'

export default function (server: Server, ctx: AppContext) {
  server.eu.wsocial.admin.addNeuroLink({
    auth: ctx.authVerifier.adminToken,
    handler: ({ input, req }) => impl.addNeuroLink(ctx, input.body, req.log),
  })
}
