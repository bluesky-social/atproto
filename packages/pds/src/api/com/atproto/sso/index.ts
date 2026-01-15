import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import listIdentityProviders from './listIdentityProviders'
import getRedirect from './getRedirect'
import getCallback from './getCallback'

export default function (server: Server, ctx: AppContext) {
  listIdentityProviders(server, ctx)
  getRedirect(server, ctx)
  getCallback(server, ctx)
}
