import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import * as impl from './neuroLinkHandlers'

export default function (server: Server, ctx: AppContext) {
  server.eu.wsocial.admin.getNeuroLink({
    auth: ctx.authVerifier.adminToken,
    handler: ({ params }) => impl.getNeuroLink(ctx, params),
  })
}
