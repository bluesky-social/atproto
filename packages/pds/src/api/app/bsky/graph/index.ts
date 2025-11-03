import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import createFollowRequest from './createFollowRequest'
import listFollowRequests from './listFollowRequests'
import respondToFollowRequest from './respondToFollowRequest'

export default function (server: Server, ctx: AppContext) {
  createFollowRequest(server, ctx)
  listFollowRequests(server, ctx)
  respondToFollowRequest(server, ctx)
}

