import { Server } from '../lexicon'
import comAtproto from './com/atproto'
import appBsky from './app/bsky'
import toolsOzone from './tools/ozone'
import chatBsky from './chat'
import AppContext from '../context'

export default function (server: Server, ctx: AppContext) {
  comAtproto(server, ctx)
  appBsky(server, ctx)
  toolsOzone(server, ctx)
  chatBsky(server, ctx)
  return server
}
