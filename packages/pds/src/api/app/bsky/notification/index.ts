import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import registerPush from './registerPush.js'
import unregisterPush from './unregisterPush.js'

export default function (server: Server, ctx: AppContext) {
  registerPush(server, ctx)
  unregisterPush(server, ctx)
}
