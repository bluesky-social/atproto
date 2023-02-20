import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import setVote from './feed/setVote'
import updateProfile from './actor/updateProfile'
import mute from './graph/mute'
import unmute from './graph/unmute'
import getMutes from './graph/getMutes'
import getNotifications from './notification/list'
import getNotificationCount from './notification/getCount'
import postNotificationsSeen from './notification/updateSeen'

export default function (server: Server, ctx: AppContext) {
  setVote(server, ctx)
  updateProfile(server, ctx)
  mute(server, ctx)
  unmute(server, ctx)
  getMutes(server, ctx)
  getNotifications(server, ctx)
  getNotificationCount(server, ctx)
  postNotificationsSeen(server, ctx)
}
