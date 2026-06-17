import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import checkSignupQueue from './checkSignupQueue.js'

export default function (server: Server, ctx: AppContext) {
  checkSignupQueue(server, ctx)
}
