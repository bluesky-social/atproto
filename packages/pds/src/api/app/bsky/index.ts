import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import actor from './actor'
import graph from './graph'
import notification from './notification'

export default function (server: Server, ctx: AppContext) {
  actor(server, ctx)
  graph(server, ctx)
  notification(server, ctx)
}
