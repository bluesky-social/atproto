import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import actor from './actor'

export default function (server: Server, ctx: AppContext) {
  actor(server, ctx)
}
