import { AppContext } from '../../../context'
import { Server } from '../../../lexicon'
import actor from './actor'
import feed from './feed'
import notification from './notification'

export default function (server: Server, ctx: AppContext) {
  actor(server, ctx)
  feed(server, ctx)
  notification(server, ctx)
}
