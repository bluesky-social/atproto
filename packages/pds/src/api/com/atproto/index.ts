import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../context.js'
import admin from './admin/index.js'
import identity from './identity/index.js'
import moderation from './moderation/index.js'
import repo from './repo/index.js'
import serverMethods from './server/index.js'
import space from './space/index.js'
import sync from './sync/index.js'
import temp from './temp/index.js'

export default function (server: Server, ctx: AppContext) {
  admin(server, ctx)
  identity(server, ctx)
  moderation(server, ctx)
  repo(server, ctx)
  serverMethods(server, ctx)
  space(server, ctx)
  sync(server, ctx)
  temp(server, ctx)
}
