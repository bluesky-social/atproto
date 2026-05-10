import { AppContext } from '../../../context'
import { Server } from '../../../lexicon'
import checkHandleAvailability from './server/xrpc-checkHandleAvailability'
import linkWid from './quicklogin/xrpc-linkWid'

export default function (server: Server, ctx: AppContext) {
  checkHandleAvailability(server, ctx)
  linkWid(server, ctx)
}
