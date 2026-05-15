import { AppContext } from '../context'
import { Server } from '../lexicon'
import appBsky from './app/bsky'
import comAtproto from './com/atproto'
import euWsocial from './eu'
import ioTrustanchor from './io'

export default function (server: Server, ctx: AppContext) {
  comAtproto(server, ctx)
  appBsky(server, ctx)
  ioTrustanchor(server, ctx)
  euWsocial(server, ctx)

  return server
}
