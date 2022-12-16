import { Options } from '@atproto/xrpc-server'
import { createServer } from '../lexicon'
import comAtproto from './com/atproto'
import appBsky from './app/bsky'
import AppContext from '../context'

export * as health from './health'

export default function (ctx: AppContext, options: Options) {
  const server = createServer(options)
  comAtproto(server, ctx)
  appBsky(server, ctx)
  return server
}
