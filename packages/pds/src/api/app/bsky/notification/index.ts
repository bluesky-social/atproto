import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../../../context.js'
import registerPush from './registerPush.js'
import unregisterPush from './unregisterPush.js'

export default function (server: Server, ctx: AppContext) {
  registerPush(server, ctx)
  unregisterPush(server, ctx)
}
