import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import registerPush from './registerPush'

export default function (server: Server, ctx: AppContext) {
  registerPush(server, ctx)
}
