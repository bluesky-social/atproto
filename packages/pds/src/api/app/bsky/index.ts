import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import actor from './actor'
import feed from './feed'
import notification from './notification'

export default function (server: Server, ctx: AppContext) {
  actor(server, ctx)
  feed(server, ctx)
  notification(server, ctx)
}
