import { AppContext } from '../context'
import { Server } from '../lexicon'
import appBsky from './app/bsky'
import comAtproto from './com/atproto'
import internalPds from './internal/pds'

export default function (server: Server, ctx: AppContext) {
  comAtproto(server, ctx)
  appBsky(server, ctx)
  internalPds(server, ctx)
  return server
}
