import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import admin from './trustanchor/admin'
import quicklogin from './trustanchor/quicklogin/xrpc-index'

export default function (server: Server, ctx: AppContext) {
  admin(server, ctx)
  quicklogin(server, ctx)
}
