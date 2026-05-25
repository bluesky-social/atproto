import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import * as impl from './neuroLinkHandlers'

export default function (server: Server, ctx: AppContext) {
  server.eu.wsocial.admin.listNeuroAccounts({
    auth: ctx.authVerifier.adminToken,
    handler: ({ params }) => impl.listNeuroAccounts(ctx, params),
  })
}
