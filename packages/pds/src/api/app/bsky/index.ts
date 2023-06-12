import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import actor from './actor'
import proxied from './proxied'

export default function (server: Server, ctx: AppContext) {
  actor(server, ctx)
  proxied(server, ctx)
}
