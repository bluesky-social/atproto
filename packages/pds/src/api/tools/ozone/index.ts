import AppContext from '../../../context'
import { Server } from '../../../lexicon'
import communication from './communication'
import moderation from './moderation'
import moderator from './moderator'

export default function (server: Server, ctx: AppContext) {
  communication(server, ctx)
  moderation(server, ctx)
  moderator(server, ctx)
}
