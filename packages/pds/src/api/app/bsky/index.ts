import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../context.js'
import actor from './actor/index.js'
import feed from './feed/index.js'
import notification from './notification/index.js'

export default function (server: Server, ctx: AppContext) {
  actor(server, ctx)
  feed(server, ctx)
  notification(server, ctx)
}
