import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import simple from './simple'
import dynamic from './dynamic'
import preferences from './preferences'
import munged from './munged'

export default function (server: Server, ctx: AppContext) {
  simple(server, ctx)
  dynamic(server, ctx)
  munged(server, ctx)
  preferences(server, ctx)
}
