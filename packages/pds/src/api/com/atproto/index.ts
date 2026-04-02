import { Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../context'
import admin from './admin'
import identity from './identity'
import moderation from './moderation'
import repo from './repo'
import serverMethods from './server'
import space from './space'
import sync from './sync'
import temp from './temp'

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
