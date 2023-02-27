import { Server } from '../lexicon'
import comAtproto from './com/atproto'
import appBsky from './app/bsky'
import AppContext from '../context'

export * as health from './health'

export default function (server: Server, ctx: AppContext) {
  comAtproto(server, ctx)
  appBsky(server, ctx)
  return server
}
