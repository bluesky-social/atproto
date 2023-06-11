import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getMutes from './getMutes'
import getListMutes from './getListMutes'
import muteActor from './muteActor'
import unmuteActor from './unmuteActor'
import muteActorList from './muteActorList'
import unmuteActorList from './unmuteActorList'

export default function (server: Server, ctx: AppContext) {
  getMutes(server, ctx)
  getListMutes(server, ctx)
  muteActor(server, ctx)
  unmuteActor(server, ctx)
  muteActorList(server, ctx)
  unmuteActorList(server, ctx)
}
