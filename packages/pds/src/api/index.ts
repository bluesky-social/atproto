import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../context.js'
import appBsky from './app/bsky/index.js'
import comAtproto from './com/atproto/index.js'

export default function (server: Server, ctx: AppContext) {
  comAtproto(server, ctx)
  appBsky(server, ctx)
  return server
}
