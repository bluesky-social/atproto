import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import checkSignupQueue from './checkSignupQueue.js'

export default function (server: Server, ctx: AppContext) {
  checkSignupQueue(server, ctx)
}
