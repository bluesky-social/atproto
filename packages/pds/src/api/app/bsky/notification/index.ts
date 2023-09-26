import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'

import getUnreadCount from './getUnreadCount'
import listNotifications from './listNotifications'
import registerPush from './registerPush'
import updateSeen from './updateSeen'

export default function (server: Server, ctx: AppContext) {
  getUnreadCount(server, ctx)
  listNotifications(server, ctx)
  registerPush(server, ctx)
  updateSeen(server, ctx)
}
