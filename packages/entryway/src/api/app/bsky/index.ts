import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import actor from './actor'
import feed from './feed'
import graph from './graph'
import notification from './notification'
import unspecced from './unspecced'

export default function (server: Server, ctx: AppContext) {
  actor(server, ctx)
  feed(server, ctx)
  graph(server, ctx)
  notification(server, ctx)
  unspecced(server, ctx)
}
