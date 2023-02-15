import { Options } from '@atproto/xrpc-server'
import { createServer } from '../../lexicon'
import appBsky from './app/bsky'
import AppContext from '../../context'

export default function (ctx: AppContext, options: Options) {
  const server = createServer(options)
  appBsky(server, ctx)
  return server
}
