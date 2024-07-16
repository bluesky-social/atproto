import { Server } from '../lexicon'
import comAtproto from './com/atproto'
import appBsky from './app/bsky'
import chat from './chat'
import AppContext from '../context'

export default function (server: Server, ctx: AppContext) {
  comAtproto(server, ctx)
  appBsky(server, ctx)
  chat(server, ctx)
  return server
}
