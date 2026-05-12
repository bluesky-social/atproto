import { AppContext } from '../../../context'
import { Server } from '../../../lexicon'
import createPassInvitation from './admin/xrpc-createPassInvitation'
import checkHandleAvailability from './server/xrpc-checkHandleAvailability'
import linkWid from './quicklogin/xrpc-linkWid'

export default function (server: Server, ctx: AppContext) {
  createPassInvitation(server, ctx)
  checkHandleAvailability(server, ctx)
  linkWid(server, ctx)
}
