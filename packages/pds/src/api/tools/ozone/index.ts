import AppContext from '../../../context'
import { Server } from '../../../lexicon'
import communication from './communication'
import moderation from './moderation'
import serverRoutes from './server'

export default function (server: Server, ctx: AppContext) {
  communication(server, ctx)
  moderation(server, ctx)
  serverRoutes(server, ctx)
}
