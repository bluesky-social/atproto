import { Server } from '../../lexicon'
import simple from './simple'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  simple(server, ctx)
  return server
}
