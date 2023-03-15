import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import setVote from './feed/setVote'
import updateProfile from './actor/updateProfile'
import graph from './graph'
import getMutes from './graph/getMutes'
import notification from './notification'
import postNotificationsSeen from './notification/updateSeen'

export default function (server: Server, ctx: AppContext) {
  setVote(server, ctx)
  updateProfile(server, ctx)
  graph(server, ctx)
  getMutes(server, ctx)
  notification(server, ctx)
  postNotificationsSeen(server, ctx)
}
