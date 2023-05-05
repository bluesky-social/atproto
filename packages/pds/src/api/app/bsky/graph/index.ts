import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getMutes from './getMutes'
import getListMutes from './getListMutes'
import muteActor from './muteActor'
import unmuteActor from './unmuteActor'
import subscribeMuteList from './subscribeMuteList'
import unsubscribeMuteList from './unsubscribeMuteList'

export default function (server: Server, ctx: AppContext) {
  getMutes(server, ctx)
  getListMutes(server, ctx)
  muteActor(server, ctx)
  unmuteActor(server, ctx)
  subscribeMuteList(server, ctx)
  unsubscribeMuteList(server, ctx)
}
