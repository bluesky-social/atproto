import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getMutes from './getMutes'
import muteActor from './muteActor'
import unmuteActor from './unmuteActor'

export default function (server: Server, ctx: AppContext) {
  getMutes(server, ctx)
  muteActor(server, ctx)
  unmuteActor(server, ctx)
}
