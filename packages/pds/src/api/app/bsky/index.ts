import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import graph from './graph'
import notification from './notification'

export default function (server: Server, ctx: AppContext) {
  graph(server, ctx)
  notification(server, ctx)
}
