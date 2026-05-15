import { AppContext } from '../../../context'
import { Server } from '../../../lexicon'
import createPassInvitation from './admin/xrpc-createPassInvitation'
import linkWid from './quicklogin/xrpc-linkWid'
import allocateWidForAccount from './server/xrpc-allocateWidForAccount'
import checkHandleAvailability from './server/xrpc-checkHandleAvailability'

export default function (server: Server, ctx: AppContext) {
  createPassInvitation(server, ctx)
  allocateWidForAccount(server, ctx)
  checkHandleAvailability(server, ctx)
  linkWid(server, ctx)
}
