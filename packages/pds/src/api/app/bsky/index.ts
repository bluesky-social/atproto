import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import feed from './feed'
import graph from './graph'
import notification from './notification'

export default function (server: Server, ctx: AppContext) {
  feed(server, ctx)
  graph(server, ctx)
  notification(server, ctx)
}
