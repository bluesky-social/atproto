import { Options } from '@atproto/xrpc-server'
import { createServer } from '../lexicon'
import comAtproto from './com/atproto'
import appBsky from './app/bsky'

export * as health from './health'

export default function (options: Options) {
  const server = createServer(options)
  comAtproto(server)
  appBsky(server)
  return server
}
