import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getActorLikes from './getActorLikes'
import getAuthorFeed from './getAuthorFeed'
import getPostThread from './getPostThread'
import getProfile from './getProfile'
import getProfiles from './getProfiles'
import getTimeline from './getTimeline'

export default function (server: Server, ctx: AppContext) {
  getActorLikes(server, ctx)
  getAuthorFeed(server, ctx)
  getPostThread(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  getTimeline(server, ctx)
}
