import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import wsocial from './wsocial/index'

export default function (server: Server, ctx: AppContext) {
  wsocial(server, ctx)
}
