import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../context'
import appBsky from './app/bsky'
import comAtproto from './com/atproto'
import internal from './internal'

export default function (server: Server, ctx: AppContext) {
  comAtproto(server, ctx)
  appBsky(server, ctx)
  internal(server, ctx)
  return server
}
