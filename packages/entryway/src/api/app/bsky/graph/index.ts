import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getBlocks from './getBlocks'
import getFollowers from './getFollowers'
import getFollows from './getFollows'
import getList from './getList'
import getListBlocks from './getListBlocks'
import getListMutes from './getListMutes'
import getLists from './getLists'
import getMutes from './getMutes'
import getSuggestedFollowsByActor from './getSuggestedFollowsByActor'
import muteActor from './muteActor'
import muteActorList from './muteActorList'
import unmuteActor from './unmuteActor'
import unmuteActorList from './unmuteActorList'

export default function (server: Server, ctx: AppContext) {
  getBlocks(server, ctx)
  getFollowers(server, ctx)
  getFollows(server, ctx)
  getList(server, ctx)
  getListBlocks(server, ctx)
  getListMutes(server, ctx)
  getLists(server, ctx)
  getMutes(server, ctx)
  getSuggestedFollowsByActor(server, ctx)
  muteActor(server, ctx)
  muteActorList(server, ctx)
  unmuteActor(server, ctx)
  unmuteActorList(server, ctx)
}
